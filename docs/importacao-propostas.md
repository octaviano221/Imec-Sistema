# Importacao em lote de propostas IMEC

Este recurso importa PDFs antigos de propostas tecnicas e comerciais para o modulo `Propostas`.

## Fluxo recomendado

1. Coloque os PDFs no servidor em:
   `/home/u974096246/uploads-imec/propostas-importacao`
2. Configure a variavel de ambiente:
   `PROPOSALS_IMPORT_DIR=/home/u974096246/uploads-imec/propostas-importacao`
3. Reimplante o site na Hostinger.
4. Acesse `Propostas > Importar pasta`.
5. Confira a previa de clientes, numeros e revisoes.
6. Rode primeiro `Importar teste 20`.
7. Se estiver correto, rode `Importar tudo`.

O importador evita duplicidade usando o SHA256 do PDF e tambem compara numero, revisao e titulo da proposta.

## Uso local para conferencia

```powershell
node scripts/import-proposals.js --source "C:\Users\Octaviano\OneDrive\Documentos\Propostas IMEC" --preview --limit 100
```

O comando gera relatorios em `tmp/`, que nao entram no Git.

## Importacao via terminal

Use apenas quando o banco estiver configurado nas variaveis `DB_*`.

```bash
node scripts/import-proposals.js --source "/home/u974096246/uploads-imec/propostas-importacao" --import --limit 20
node scripts/import-proposals.js --source "/home/u974096246/uploads-imec/propostas-importacao" --import
```

## Observacoes

- Clientes conhecidos sao normalizados para evitar repeticoes.
- Arquivos com baixa confianca aparecem na previa para revisao.
- Os PDFs sao copiados para `UPLOAD_DIR/proposals` e ficam vinculados no campo de anexo da proposta.
