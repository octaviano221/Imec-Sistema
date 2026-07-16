#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db = require('../backend/config/db');
const { scanProposals, importProposals, getImportSourceDir } = require('../backend/services/proposalImporter');

function parseArgs(argv) {
  const args = {
    source: '',
    preview: false,
    import: false,
    limit: 0,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--source') args.source = argv[++index] || '';
    else if (item === '--preview') args.preview = true;
    else if (item === '--import') args.import = true;
    else if (item === '--limit') args.limit = Number(argv[++index] || 0);
    else if (item === '--json') args.json = true;
    else if (item === '--help' || item === '-h') args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/import-proposals.js --source "C:\\Users\\Octaviano\\OneDrive\\Documentos\\Propostas IMEC" --preview --limit 80
  node scripts/import-proposals.js --source "/home/u974096246/uploads-imec/propostas-importacao" --import --limit 20
  node scripts/import-proposals.js --source "/home/u974096246/uploads-imec/propostas-importacao" --import

Opcoes:
  --preview       So analisa a pasta e gera relatorios em tmp/.
  --import        Importa para o banco configurado nas variaveis DB_*.
  --limit N       Limita a quantidade para teste.
  --json          Imprime JSON completo no terminal.
`);
}

function ensureTmpDir() {
  const dir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function csvCell(value) {
  return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

function writePreviewFiles(scan, limit) {
  const dir = ensureTmpDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const items = limit > 0 ? scan.items.slice(0, limit) : scan.items;
  const jsonPath = path.join(dir, `proposal-import-preview-${stamp}.json`);
  const csvPath = path.join(dir, `proposal-import-preview-${stamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({
    sourceDir: scan.sourceDir,
    totalFiles: scan.totalFiles,
    recognized: scan.recognized,
    reviewNeeded: scan.reviewNeeded,
    clients: scan.clients,
    items
  }, null, 2), 'utf8');

  const rows = [
    ['arquivo', 'cliente', 'numero', 'revisao', 'tipo', 'titulo', 'confianca', 'avisos'].map(csvCell).join(',')
  ];
  items.forEach((item) => {
    rows.push([
      item.relative_path,
      item.client.name,
      item.proposal.proposal_number,
      item.proposal.revision,
      item.proposal.proposal_type,
      item.proposal.title,
      Math.round(Number(item.confidence || 0) * 100),
      (item.warnings || []).join(' | ')
    ].map(csvCell).join(','));
  });
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf8');

  return { jsonPath, csvPath };
}

function printSummary(scan, limit) {
  console.log('Previa de importacao de propostas');
  console.log(`Pasta: ${scan.sourceDir}`);
  console.log(`PDFs encontrados: ${scan.totalFiles}`);
  console.log(`Reconhecidos: ${scan.recognized}`);
  console.log(`Precisam revisao: ${scan.reviewNeeded}`);
  console.log(`Itens exibidos no relatorio: ${limit > 0 ? Math.min(limit, scan.items.length) : scan.items.length}`);
  console.log('\nClientes mais encontrados:');
  scan.clients.slice(0, 20).forEach((client) => {
    console.log(`- ${client.name}: ${client.count}`);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.preview && !args.import)) {
    printHelp();
    return;
  }

  const sourceDir = args.source || getImportSourceDir();
  const scan = scanProposals(sourceDir);

  if (args.preview) {
    const files = writePreviewFiles(scan, args.limit);
    printSummary(scan, args.limit);
    console.log(`\nRelatorio JSON: ${files.jsonPath}`);
    console.log(`Relatorio CSV:  ${files.csvPath}`);
    if (args.json) console.log(JSON.stringify(scan, null, 2));
    await db.end();
    return;
  }

  if (!args.import) return;
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Pasta nao encontrada: ${sourceDir}`);
  }

  console.log(`Importando propostas de ${sourceDir}`);
  if (args.limit) console.log(`Modo teste: ${args.limit} arquivo(s).`);
  const result = await importProposals(db, {
    sourceDir,
    limit: args.limit
  });
  console.log(JSON.stringify(result, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await db.end();
  } catch (_) {}
  process.exit(1);
});
