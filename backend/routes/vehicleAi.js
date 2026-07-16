const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
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

async function parsePdfText(bytes) {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result && result.text ? result.text : '';
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function stripMarks(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findAfterLabel(text, label, fallbackPattern) {
  const compact = String(text || '').replace(/\r/g, '');
  const search = stripMarks(compact);
  const escaped = stripMarks(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const labelPattern = new RegExp(`${escaped}\\s*\\n\\s*([^\\n]+)`, 'i');
  const labelMatch = search.match(labelPattern);
  if (labelMatch) return str(labelMatch[1]);
  if (fallbackPattern) {
    const fallbackMatch = search.match(fallbackPattern);
    if (fallbackMatch) return str(fallbackMatch[1] || fallbackMatch[0]);
  }
  return '';
}

function normalizePlate(value) {
  const clean = str(value).replace(/[^a-z0-9]/gi, '').toUpperCase();
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(clean) ? clean : '';
}

function inferVehicleType(text) {
  const source = stripMarks(String(text || '')).toLowerCase();
  if (/guindaste|guindauto|munck/.test(source)) return 'Caminhao Munck';
  if (/carga|caminhao|camioneta|prancha/.test(source)) return 'Caminhao';
  if (/onibus|microonibus|micro-onibus/.test(source)) return 'Onibus';
  if (/pick[\s-]?up/.test(source)) return 'Pickup';
  if (/van|microonibus|micro-onibus/.test(source)) return 'Van';
  return 'Carro';
}

function extractCrlvDataBlock(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => str(line))
    .filter(Boolean);
  const qrIndex = lines.findIndex((line) => stripMarks(line).toLowerCase() === 'qrcode');
  if (qrIndex < 0) return {};

  const block = lines.slice(qrIndex + 1);
  const renavamIndex = block.findIndex((line) => /^\d{9,13}$/.test(line));
  if (renavamIndex < 0) return {};

  const data = block.slice(renavamIndex);
  const plateLine = data.find((line) => /\b[A-Z]{3}\d[A-Z0-9]\d{2}\b/i.test(line));
  const plateMatch = plateLine ? plateLine.match(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/i) : null;
  const exerciseMatch = plateLine ? plateLine.match(/\b(20\d{2}|19\d{2})\b/) : null;
  const yearsLine = data.find((line) => /^\d{4}\s+\d{4}$/.test(line));
  const years = yearsLine ? yearsLine.match(/\d{4}/g) : [];
  const crvLine = data.find((line) => /^\d{8,}\s+\*{3}/.test(line));
  const modelLine = data.find((line) => /\/|FORD|MARCOPOLO|VOLKSWAGEN|MERCEDES|IVECO|SCANIA|FIAT|CHEVROLET|TOYOTA|HYUNDAI|XCMG/i.test(line));
  const specieTypeLine = data.find((line) => /(PASSAGEIRO|CARGA|CAMINHAO|CAMINH[ÃA]O|ONIBUS|[ÔO]NIBUS|AUTOMOVEL|AUTOM[ÓO]VEL|MISTO)/i.test(line));
  const chassisLine = data.find((line) => /[A-Z0-9*]{6,}\/\*{2}|\*{3,}\/\*{2}|[A-Z0-9]{12,}/i.test(line));
  const chassisMatch = chassisLine ? chassisLine.match(/\b([A-Z0-9*]{12,})\b/i) : null;
  const ownerIndex = data.findIndex((line) => /IMEC|LTDA|EIRELI|INDUSTRIA|METALURGICA|SOLUCOES|SERVICOS/i.test(stripMarks(line)));
  const issueLine = data.find((line) => /\b\d{2}\/\d{2}\/\d{4}\b/.test(line));
  const issueMatch = issueLine ? issueLine.match(/\b(\d{2}\/\d{2}\/\d{4})\b/) : null;
  const motorCapacityLine = data.find((line) => /^\d{8,}\s+[\d.,]+\s+\d+\s+\w+/i.test(line));
  const capacityMatch = motorCapacityLine ? motorCapacityLine.match(/^\d{8,}\s+([\d.,]+)/) : null;

  return {
    plate: plateMatch ? plateMatch[1].toUpperCase() : '',
    renavam: data[0] || '',
    exerciseYear: exerciseMatch ? exerciseMatch[1] : '',
    manufactureYear: years[0] || '',
    modelYear: years[1] || '',
    crvNumber: crvLine ? crvLine.split(/\s+/)[0] : '',
    modelVersion: modelLine || '',
    specieType: specieTypeLine || '',
    chassis: chassisMatch ? chassisMatch[1] : '',
    capacity: capacityMatch ? capacityMatch[1] : '',
    owner: ownerIndex >= 0 ? data[ownerIndex] : '',
    issueDate: issueMatch ? issueMatch[1] : ''
  };
}

function extractCrlvOffline(text) {
  const normalized = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n');
  const dataBlock = extractCrlvDataBlock(normalized);
  const warnings = [];
  const plate = normalizePlate(dataBlock.plate || findAfterLabel(normalized, 'PLACA', /\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/i));
  const renavam = dataBlock.renavam || findAfterLabel(normalized, 'CODIGO RENAVAM', /\bRENAVAM\s*[:\n ]\s*(\d{9,13})/i);
  const exerciseYear = dataBlock.exerciseYear || findAfterLabel(normalized, 'EXERCICIO', /\bEXERCICIO\s*[:\n ]\s*(\d{4})/i);
  const manufactureYear = dataBlock.manufactureYear || findAfterLabel(normalized, 'ANO FABRICACAO', /ANO FABRICACAO\s*[:\n ]\s*(\d{4})/i);
  const modelYear = dataBlock.modelYear || findAfterLabel(normalized, 'ANO MODELO', /ANO MODELO\s*[:\n ]\s*(\d{4})/i);
  const modelVersion = dataBlock.modelVersion || findAfterLabel(normalized, 'MARCA / MODELO / VERSAO', /MARCA\s*\/\s*MODELO\s*\/\s*VERSAO\s*[:\n ]\s*([^\n]+)/i);
  const owner = dataBlock.owner || findAfterLabel(normalized, 'NOME', /NOME\s*[:\n ]\s*([^\n]+)/i);
  const issueDate = dataBlock.issueDate || findAfterLabel(normalized, 'DATA', /\bDATA\s*[:\n ]\s*(\d{2}[/-]\d{2}[/-]\d{4})/i);
  const crvNumber = dataBlock.crvNumber || findAfterLabel(normalized, 'NUMERO DO CRV', /NUMERO DO CRV\s*[:\n ]\s*([A-Z0-9.-]+)/i);
  const securityCode = findAfterLabel(normalized, 'CODIGO DE SEGURANCA DO CLA', /CODIGO DE SEGURANCA DO CLA\s*[:\n ]\s*([A-Z0-9.-]+)/i);
  const capacity = dataBlock.capacity || findAfterLabel(normalized, 'CAPACIDADE', /CAPACIDADE\s*[:\n ]\s*([0-9.,]+)/i);
  const chassis = dataBlock.chassis || findAfterLabel(normalized, 'CHASSI', /CHASSI\s*[:\n ]\s*([A-Z0-9*.-]+)/i);

  if (!plate) warnings.push('Placa nao identificada automaticamente.');
  if (!renavam) warnings.push('RENAVAM nao identificado automaticamente.');
  if (!issueDate) warnings.push('Data de emissao nao identificada automaticamente.');
  warnings.push('Vencimento de CRLV/licenciamento pode depender do calendario do estado; confira antes de salvar.');

  const docNumber = crvNumber || securityCode || exerciseYear || renavam;
  const titleParts = ['CRLV'];
  if (exerciseYear) titleParts.push(exerciseYear);
  if (plate) titleParts.push(plate);

  return normalizeExtraction({
    confidence: plate && renavam ? 0.88 : 0.62,
    vehicle: {
      plate,
      renavam,
      name: [modelVersion, plate].filter(Boolean).join(' - '),
      type: inferVehicleType(`${dataBlock.specieType || ''} ${modelVersion} ${normalized}`),
      brand: modelVersion ? modelVersion.split(/\s+/)[0] : '',
      model: modelVersion,
      year: modelYear || manufactureYear,
      serial_number: chassis,
      asset_number: '',
      capacity,
      owner
    },
    document: {
      type: 'CRLV',
      title: titleParts.join(' - '),
      number: docNumber,
      issue_date: normalizeDate(issueDate),
      expiration_date: null,
      exercise_year: exerciseYear,
      notes: 'Leitura offline do PDF oficial. Conferir vencimento conforme calendario do estado.'
    },
    warnings
  });
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
      return res.status(400).json({ message: 'Envie o PDF digital do Detran para o leitor offline.' });
    }

    const mime = getMime(req.file);
    if (!/^application\/pdf$|^image\/(png|jpe?g)$/i.test(mime)) {
      return res.status(400).json({ message: 'Para leitura offline, envie PDF digital do Detran.' });
    }

    const bytes = fs.readFileSync(req.file.path);
    const fileUrl = buildPublicUrl(req.file.filename);

    if (mime === 'application/pdf') {
      const text = await parsePdfText(bytes);
      if (text.trim().length >= 30) {
        const extracted = extractCrlvOffline(text);
        console.log('Vehicle offline extraction:', {
          file: req.file.filename,
          confidence: extracted.confidence,
          plate: extracted.vehicle.plate,
          documentType: extracted.document.type
        });
        return res.json({
          file_url: fileUrl,
          original_name: req.file.originalname,
          mode: 'offline-pdf',
          extraction: extracted
        });
      }
      return res.status(422).json({ message: 'Nao consegui ler texto nesse PDF. Envie o PDF digital baixado do Detran, nao imagem escaneada.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: 'Leitura de imagem exige OPENAI_API_KEY. Para modo offline, envie o PDF digital do Detran.' });
    }

    const fileData = `data:${mime};base64,${bytes.toString('base64')}`;
    const filePart = { type: 'input_image', image_url: fileData };

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
      let message = openaiMessage || 'Erro ao consultar a IA.';
      if (openaiResponse.status === 401) {
        message = 'Chave da OpenAI invalida. Confira a variavel OPENAI_API_KEY na Hostinger.';
      } else if (openaiResponse.status === 429 || /quota|billing|plan/i.test(openaiMessage)) {
        message = 'Limite ou credito da OpenAI esgotado. Confira billing/creditos da conta OpenAI e tente novamente.';
      }
      return res.status(502).json({ message });
    }

    const text = extractOutputText(payload);
    const extracted = normalizeExtraction(parseJsonLoose(text));

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
    console.error('Erro na leitura offline de documento veicular:', error);
    res.status(500).json({ message: 'Nao foi possivel ler o PDF offline. Confira se ele e o CRLV digital do Detran e tente novamente.' });
  }
});

module.exports = router;
