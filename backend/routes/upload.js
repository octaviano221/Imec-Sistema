const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

function getUploadStatus() {
  const uploadDir = upload.uploadDir;
  const status = {
    configuredDir: process.env.UPLOAD_DIR || null,
    resolvedDir: uploadDir,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
    exists: false,
    writable: false,
    fileCount: 0,
    recentFiles: []
  };

  try {
    status.exists = fs.existsSync(uploadDir);
    if (status.exists) {
      fs.accessSync(uploadDir, fs.constants.W_OK);
      status.writable = true;

      const files = fs.readdirSync(uploadDir)
        .map((filename) => {
          const filePath = path.join(uploadDir, filename);
          const stat = fs.statSync(filePath);
          return {
            filename,
            size: stat.size,
            modifiedAt: stat.mtime
          };
        })
        .filter((file) => file.size > 0);

      status.fileCount = files.length;
      status.recentFiles = files
        .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
        .slice(0, 10);
    }
  } catch (error) {
    status.error = error.message;
  }

  return status;
}

router.get('/status', authenticate, (req, res) => {
  res.json(getUploadStatus());
});

router.post('/', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    console.log('Upload salvo:', {
      file: req.file.filename,
      destination: req.file.destination,
      path: req.file.path
    });
    res.json({ url: baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer upload do arquivo' });
  }
});

module.exports = router;
