const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    res.json({ url: baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer upload do arquivo' });
  }
});

module.exports = router;
