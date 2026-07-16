const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');

const DEFAULT_MODEL = process.env.OPENAI_VEHICLE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';

function buildPublicUrl(filename) {
  const relativeUrl = `/uploads/${filename}`;
  const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl;
}

function getMime(file) {
  if (file.mimetype) return file.mimetype;
  const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  return 'image/jpeg';
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part.text === 'string') return part.text;
      if (typeof part.output_text === 'string') return part.output_text;
    }
  }
  return '';
}

function parseJsonLoose(text) {
  const cleaned = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw err;
  }
}

function str(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeDate(value) {
  const text = str(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}

function normalizeExtraction(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const vehicle = data.vehicle && typeof data.vehicle === 'object' ? data.vehicle : {};
  const document = data.document && typeof data.document === 'object' ? data.document : {};
  const warnings = Array.isArray(data.warnings) ? data.warnings.map(str).filter(Boolean) : [];
  return {
    confidence: Number.isFinite(Number(data.confidence)) ? Math.max(0, Math.min(1, Number(data.confidence))) : 0,
    vehicle: {
      plate: str(vehicle.plate).toUpperCase(),
      renavam: str(vehicle.renavam),
      name: str(vehicle.name),
      type: str(vehicle.type) || 'Outro',
      brand: str(vehicle.brand),
      model: str(vehicle.model),
      year: str(vehicle.year),
      serial_number: str(vehicle.serial_number),
      asset_number: str(vehicle.asset_number),
      capacity: str(vehicle.capacity),
      owner: str(vehicle.owner)
    },
    document: {
      type: str(document.type) || 'CRLV',
      title: str(document.title),
      number: str(document.number),
      issue_date: normalizeDate(document.issue_date),
      expiration_date: normalizeDate(document.expiration_date),
      exercise_year: str(document.exercise_year),
      notes: str(document.notes)
    },
    warnings
  };
}

function buildPrompt() {
  return [
    'Voce e um assistente de leitura de documentos brasileiros de frota para um sistema industrial.',
    'Leia o arquivo enviado e extraia dados para cadastrar o veiculo e o documento.',
    'Documentos comuns: CRLV, licenciamento, IPVA, seguro, ANTT, tacografo, laudo de capacidade e inspecao.',
    'Responda somente JSON valido, sem markdown, com este formato exato:',
    '{"confidence":0.0,"vehicle":{"plate":"","renavam":"","name":"","type":"","brand":"","model":"","year":"","serial_number":"","asset_number":"","capacity":"","owner":""},"document":{"type":"","title":"","number":"","issue_date":null,"expiration_date":null,"exercise_year":"","notes":""},"warnings":[]}',
    'Use datas em YYYY-MM-DD. Nao invente data de vencimento se ela nao estiver clara no documento.',
    'Para CRLV/licenciamento, use placa, RENAVAM, marca/modelo, ano e proprietario quando existirem.',
    'Se houver apenas exercicio sem vencimento explicito, preencha exercise_year e coloque um aviso para conferencia manual.'
  ].join('\n');
}

router.post('/analyze', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Envie um PDF ou imagem para a IA ler.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: 'OPENAI_API_KEY nao configurada nas variaveis de ambiente.' });
    }

    const mime = getMime(req.file);
    if (!/^application\/pdf$|^image\/(png|jpe?g)$/i.test(mime)) {
      return res.status(400).json({ message: 'Para leitura com IA, envie PDF, JPG ou PNG.' });
    }

    const bytes = fs.readFileSync(req.file.path);
    const fileData = `data:${mime};base64,${bytes.toString('base64')}`;
    const filePart = mime === 'application/pdf'
      ? { type: 'input_file', filename: req.file.originalname || req.file.filename, file_data: fileData }
      : { type: 'input_image', image_url: fileData };

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: buildPrompt() },
            filePart
          ]
        }],
        max_output_tokens: 1600
      })
    });

    const payload = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      const openaiMessage = payload.error && payload.error.message ? payload.error.message : '';
      const message = openaiResponse.status === 401
        ? 'Chave da OpenAI invalida. Confira a variavel OPENAI_API_KEY na Hostinger.'
        : openaiMessage || 'Erro ao consultar a IA.';
      return res.status(502).json({ message });
    }

    const text = extractOutputText(payload);
    const extracted = normalizeExtraction(parseJsonLoose(text));
    const fileUrl = buildPublicUrl(req.file.filename);

    console.log('Vehicle AI extraction:', {
      file: req.file.filename,
      confidence: extracted.confidence,
      plate: extracted.vehicle.plate,
      documentType: extracted.document.type
    });

    res.json({
      file_url: fileUrl,
      original_name: req.file.originalname,
      extraction: extracted
    });
  } catch (error) {
    console.error('Erro na leitura IA de documento veicular:', error);
    res.status(500).json({ message: 'Nao foi possivel ler o documento com IA. Confira o arquivo e tente novamente.' });
  }
});

module.exports = router;
