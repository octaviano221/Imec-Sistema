const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function str(value) {
  return value == null ? '' : String(value).trim();
}

function stripMarks(value) {
  return str(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSpaces(value) {
  return str(value).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function canonicalName(value) {
  return stripMarks(value)
    .toUpperCase()
    .replace(/\b(USINA|FAZENDA|FAZ|LTDA|S\/A|SA|S A|AGRICOLA|AGROPECUARIA)\b/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function safeFilename(value) {
  return stripMarks(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'proposta';
}

function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function walkPdfFiles(rootDir) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile() && /\.pdf$/i.test(entry.name)) files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function normalizeRevision(value) {
  const match = str(value).match(/R\s*0*(\d{1,2})/i);
  if (!match) return 'R00';
  return `R${String(Number(match[1])).padStart(2, '0')}`;
}

function detectProposalType(text) {
  const source = stripMarks(text).toLowerCase();
  if (/munch/.test(source)) return 'locacao_equipamento';
  if (/laudo|inspecao|capacidade/.test(source)) return 'laudo_inspecao';
  if (/munck|guindaste|guindauto|loca(c|ç)ao|movimenta/.test(source)) return 'locacao_equipamento';
  if (/caldeiraria|estrutura|metalic|solda|reforma|fabric/.test(source)) return 'caldeiraria';
  if (/manutenc|montagem|desmont|instalac|adequac|nr-13|trocador|coluna|caldeira/.test(source)) return 'manutencao_industrial';
  return 'manutencao_industrial';
}

function extractProposalNumber(name) {
  const source = stripMarks(name);
  const strong = source.match(/\b(?:PROPOSTA|PROP|PRO|PR|P\.?\s*T\.?|PT|P\s*T|N\.?|Nº|NO)\s*(?:TEC(?:NICA)?|COM(?:ERCIAL)?|C)?\.?\s*(?:N\.?)?\s*(\d{3,5})\b/i);
  if (strong) return strong[1];
  const afterN = source.match(/\bN\.?\s*(\d{3,5})\b/i);
  if (afterN) return afterN[1];
  const fallback = source.match(/\b(\d{3,5})\b/g) || [];
  const chosen = fallback.find((item) => !/^20\d{2}$/.test(item) && !/^19\d{2}$/.test(item));
  return chosen || '';
}

function titleCaseClient(value) {
  const keep = new Set(['S.A.', 'S.A.P.B.', 'S.A.P.B', 'LTDA', 'IMEC', 'JBS', 'BP', 'BUNGE']);
  return normalizeSpaces(value)
    .split(' ')
    .map((part) => {
      const clean = part.replace(/[^\wÀ-ÿ.]/g, '');
      if (keep.has(clean.toUpperCase())) return clean.toUpperCase();
      if (/^[A-Z]\.?$/.test(clean)) return clean.toUpperCase();
      return clean ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : part;
    })
    .join(' ')
    .replace(/\bS\.?\s*A\.?\s*P\.?\s*B\.?\b/gi, 'S.A.P.B.')
    .replace(/\bS\.?\s*A\.?\b/gi, 'S.A.');
}

function detectKnownClient(value) {
  const source = stripMarks(value).toUpperCase();
  if (/\bS\.?\s*A\.?\s*[.\-]/.test(source)) return 'Usina Santa Adelia';
  const rules = [
    [/\b(SANTA\s+A\.?\s*P\.?\s*B|S\.?\s*A\.?\s*P\.?\s*B|SANTA\s+ADELIA|SANTA\s+ADELHA|SANTA\s+ADEL|SANTA\s+A\.|SANTA\s+A\b|S\.?\s*ADELIA|U\.?\s*S\.?\s*A\.?)\b/, 'Usina Santa Adelia'],
    [/\b(COMPANHIA\s+MULLER|MULLER|MULLE)\b/, 'Companhia Muller de Bebidas'],
    [/\bCLEALCO\b/, 'Clealco Acucar e Alcool'],
    [/\bDIANA\s+BIOENERGIA\b/, 'Diana Bioenergia'],
    [/\bRIVULIS\b/, 'Rivulis'],
    [/\bFERTIBOM\b/, 'Fertibom'],
    [/\bVALE\s+(DO\s+)?PARANA\b/, 'Vale do Parana'],
    [/\bARALCO\b/, 'Aralco'],
    [/\bALCOO?ESTE\b/, 'Alcoeste'],
    [/\bGRUPO\s+CORURIPE\b/, 'Grupo Coruripe'],
    [/\bUSIMAT\b/, 'Usimat'],
    [/\bDEMOP\b/, 'Demop'],
    [/\bCONDETERME\b/, 'Condeterme'],
    [/\bJ\.?\s*E\.?\s*EQUIP/, 'J.E. Equipamentos'],
    [/\bJ\.?\s*TOLEDO\b/, 'J. Toledo'],
    [/\bRICHETTI\b/, 'Richetti Energy'],
    [/\bDENUSA\b/, 'Denusa'],
    [/\bCITRO?PLAST\b/, 'Citroplast'],
    [/\bPIONEIROS\b/, 'Usina Pioneiros']
    , [/\bGEM\b/, 'GEM']
    , [/\bECODI?SEL\b/, 'Ecodisel']
    , [/\bREPRATEC\b/, 'Repratec']
    , [/\bIMPACTO\b/, 'Impacto']
    , [/\bVITAL\b/, 'Vital']
    , [/\bMCW\s+PARTS\b/, 'MCW Parts']
    , [/\bRAIZEN\b/, 'Raizen']
  ];
  const found = rules.find(([pattern]) => pattern.test(source));
  return found ? found[1] : '';
}

function cleanupClientCandidate(value) {
  let text = normalizeSpaces(value)
    .replace(/\.(pdf)$/i, '')
    .replace(/\b(Proposta|Pro|Prop|Pr|Tecnica|T[eé]cnica|Comercial|Comer|Tec|Cronograma|Planilha|Memorial|Descrito|PT|P\.T\.|N|R\d{1,2})\b/gi, ' ')
    .replace(/\b\d{3,5}\b/g, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s*[-–]\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopWords = [
    'Munch', 'Munck', 'Guindaste', 'Ton', 'Troc', 'Trocador', 'Caldeira', 'Coluna',
    'Reforma', 'Montagem', 'Desmt', 'Desmontagem', 'Predio', 'Prédio', 'Metalico',
    'Metálico', 'Fabrica', 'Fábrica', 'Adubo', 'Acucar', 'Açucar', 'Cobertura',
    'Aerador', 'Polo', 'Sistema', 'Sist', 'Movimen', 'Bagaço', 'Costado'
  ];

  const dashParts = text.split(' - ').map((part) => normalizeSpaces(part)).filter(Boolean);
  if (dashParts.length) {
    const best = dashParts.find((part) => /[A-Za-zÀ-ÿ]/.test(part) && !stopWords.some((word) => new RegExp(`\\b${stripMarks(word)}\\b`, 'i').test(stripMarks(part))));
    if (best) text = best;
  }

  const words = text.split(' ').filter(Boolean);
  const clientWords = [];
  for (const word of words) {
    const plain = stripMarks(word).replace(/[^A-Za-z0-9.]/g, '');
    if (!plain) continue;
    if (stopWords.some((stop) => stripMarks(stop).toLowerCase() === plain.toLowerCase())) break;
    clientWords.push(word);
    if (clientWords.length >= 5) break;
  }
  text = clientWords.join(' ');
  return titleCaseClient(text);
}

function extractClientName(name) {
  const base = normalizeSpaces(path.basename(name, path.extname(name)));
  const known = detectKnownClient(base);
  if (known) return known;

  const afterRevision = base.match(/\bR\s*0*\d{1,2}\b\s*[-.]?\s*(.+)$/i);
  if (afterRevision) {
    const fromRevision = cleanupClientCandidate(afterRevision[1]);
    if (fromRevision && canonicalName(fromRevision).length >= 3) return fromRevision;
  }

  const afterNumber = base.match(/\b(?:N|N\.|Nº|NO|PT|P\.T\.)\s*\d{3,5}\b\s*[-.]?\s*(.+)$/i);
  if (afterNumber) {
    const fromNumber = cleanupClientCandidate(afterNumber[1]);
    if (fromNumber && canonicalName(fromNumber).length >= 3) return fromNumber;
  }

  const candidate = cleanupClientCandidate(base);
  return canonicalName(candidate).length >= 3 ? candidate : 'Cliente nao identificado';
}

function buildTitle(filename, proposalNumber, clientName) {
  const base = normalizeSpaces(path.basename(filename, path.extname(filename)));
  let title = base
    .replace(/\b(Proposta|Pro|Prop|Pr)\.?\s*(Tec(?:nica)?|T[eé]cnica|Comercial|Comer|Tec\.?\s*Comer\.?)?/gi, '')
    .replace(/\bN\.?\s*\d{3,5}\b/gi, '')
    .replace(/\bP\.?\s*T\.?\s*(?:C)?\s*-?\s*N?\s*\d{3,5}\b/gi, '')
    .replace(/\bR\s*0*\d{1,2}\b/gi, '')
    .replace(clientName, '')
    .replace(/\s*[-.]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title || title.length < 5) title = `Proposta ${proposalNumber || ''} - ${clientName}`;
  return title.slice(0, 255);
}

function analyzeProposalFile(filePath, rootDir) {
  const filename = path.basename(filePath);
  const relativePath = path.relative(rootDir, filePath);
  const sha256 = hashFile(filePath);
  const proposalNumber = extractProposalNumber(filename);
  const revision = normalizeRevision(filename);
  const clientName = extractClientName(filename);
  const proposalType = detectProposalType(filename);
  const title = buildTitle(filename, proposalNumber, clientName);
  const stats = fs.statSync(filePath);
  const confidence = Math.min(0.95, (proposalNumber ? 0.35 : 0) + (clientName !== 'Cliente nao identificado' ? 0.35 : 0) + (revision ? 0.1 : 0) + (proposalType ? 0.1 : 0));
  const warnings = [];
  if (!proposalNumber) warnings.push('Numero da proposta nao identificado.');
  if (clientName === 'Cliente nao identificado') warnings.push('Cliente nao identificado pelo nome do arquivo.');

  return {
    source_path: filePath,
    relative_path: relativePath,
    original_name: filename,
    size: stats.size,
    sha256,
    confidence,
    warnings,
    client: {
      name: clientName,
      canonical: canonicalName(clientName)
    },
    proposal: {
      proposal_number: proposalNumber || `SEM-NUMERO-${safeFilename(filename).slice(0, 24)}`,
      revision,
      title,
      proposal_type: proposalType,
      status: 'rascunho',
      scope_summary: title,
      equipment_description: title,
      source_model: 'bulk_pdf_import',
      notes: `Importado em lote da pasta de propostas. Arquivo original: ${relativePath}. SHA256: ${sha256}`
    }
  };
}

function getImportSourceDir() {
  return process.env.PROPOSALS_IMPORT_DIR
    || process.env.PROPOSAL_IMPORT_DIR
    || path.join(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'), 'propostas-importacao');
}

function getUploadDir() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', 'uploads');
}

function scanProposals(sourceDir = getImportSourceDir()) {
  const files = walkPdfFiles(sourceDir);
  const items = files.map((file) => analyzeProposalFile(file, sourceDir));
  const clients = new Map();
  for (const item of items) {
    if (!clients.has(item.client.canonical)) {
      clients.set(item.client.canonical, { name: item.client.name, canonical: item.client.canonical, count: 0 });
    }
    clients.get(item.client.canonical).count += 1;
  }
  return {
    sourceDir,
    totalFiles: files.length,
    recognized: items.filter((item) => item.confidence >= 0.65).length,
    reviewNeeded: items.filter((item) => item.warnings.length).length,
    clients: Array.from(clients.values()).sort((a, b) => b.count - a.count),
    items
  };
}

async function findOrCreateClient(db, client, userId) {
  const [rows] = await db.query('SELECT id, name FROM clients');
  const existing = rows.find((row) => canonicalName(row.name) === client.canonical);
  if (existing) return existing.id;

  const [result] = await db.query(
    'INSERT INTO clients (name, notes) VALUES (?, ?)',
    [client.name, 'Cliente criado automaticamente pelo importador de propostas antigas.']
  );
  if (userId) {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, 'create', 'client', result.insertId, `Cliente ${client.name} criado no importador de propostas`]
    ).catch(() => {});
  }
  return result.insertId;
}

async function proposalExists(db, item) {
  const [byHash] = await db.query(
    'SELECT id FROM technical_proposals WHERE source_model = ? AND notes LIKE ? LIMIT 1',
    ['bulk_pdf_import', `%SHA256: ${item.sha256}%`]
  );
  if (byHash.length) return byHash[0].id;

  const [byProposal] = await db.query(
    'SELECT id FROM technical_proposals WHERE proposal_number = ? AND revision = ? AND title = ? LIMIT 1',
    [item.proposal.proposal_number, item.proposal.revision, item.proposal.title]
  );
  return byProposal.length ? byProposal[0].id : null;
}

function copyProposalFile(item, uploadDir = getUploadDir()) {
  const folder = path.join(uploadDir, 'proposals');
  fs.mkdirSync(folder, { recursive: true });
  const destName = `${safeFilename(`${item.proposal.proposal_number}-${item.proposal.revision}-${item.client.name}`)}-${item.sha256.slice(0, 10)}.pdf`;
  const destPath = path.join(folder, destName);
  if (!fs.existsSync(destPath)) fs.copyFileSync(item.source_path, destPath);
  return `/uploads/proposals/${encodeURIComponent(destName)}`;
}

async function importProposals(db, options = {}) {
  const scan = Array.isArray(options.items)
    ? {
        sourceDir: options.sourceDir || 'manifest',
        totalFiles: options.items.length,
        items: options.items
      }
    : scanProposals(options.sourceDir);
  const limit = Number(options.limit || 0);
  const items = limit > 0 ? scan.items.slice(0, limit) : scan.items;
  const attachFiles = options.attachFiles !== false;
  const summary = {
    sourceDir: scan.sourceDir,
    totalFiles: scan.totalFiles,
    processed: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    clientsCreatedOrFound: new Set(),
    errors: []
  };

  for (const item of items) {
    summary.processed += 1;
    try {
      const existingId = await proposalExists(db, item);
      if (existingId) {
        summary.skipped += 1;
        continue;
      }
      const clientId = await findOrCreateClient(db, item.client, options.userId);
      summary.clientsCreatedOrFound.add(clientId);
      const fileUrl = attachFiles ? copyProposalFile(item, options.uploadDir) : null;
      const p = item.proposal;
      const [result] = await db.query(`
        INSERT INTO technical_proposals (
          proposal_number, revision, title, proposal_type, client_id,
          status, scope_summary, equipment_description, currency, file_url, source_model, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.proposal_number, p.revision, p.title, p.proposal_type, clientId,
        p.status, p.scope_summary, p.equipment_description, 'BRL', fileUrl, p.source_model, p.notes
      ]);
      if (options.userId) {
        await db.query(
          'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
          [options.userId, 'create', 'technical_proposal', result.insertId, `Proposta ${p.proposal_number} importada em lote`]
        ).catch(() => {});
      }
      summary.imported += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({ file: item.relative_path, error: error.message });
    }
  }

  summary.clientsCreatedOrFound = summary.clientsCreatedOrFound.size;
  return summary;
}

module.exports = {
  analyzeProposalFile,
  scanProposals,
  importProposals,
  getImportSourceDir,
  getUploadDir,
  canonicalName
};
