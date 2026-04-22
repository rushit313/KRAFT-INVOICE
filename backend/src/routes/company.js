const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');

const uploadsPath = path.resolve(__dirname, '../../', (process.env.UPLOADS_PATH || './uploads').replace('./', ''));

const storage = multer.diskStorage({
  destination: uploadsPath,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.type || 'file'}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
  res.json(company || {});
});

router.put('/', (req, res) => {
  const fields = ['name','address','city','state','pin','phone','email','gstin','pan','bank_name','account_no','ifsc','branch','financial_year_start','terms_default'];
  const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f} = ?`);
  const values = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
  if (updates.length === 0) return res.json({ message: 'No fields to update' });
  db.prepare(`UPDATE company_profile SET ${updates.join(', ')} WHERE id = 1`).run(...values);
  res.json(db.prepare('SELECT * FROM company_profile WHERE id = 1').get());
});

router.post('/logo', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const logo_path = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE company_profile SET logo_path = ? WHERE id = 1').run(logo_path);
  res.json({ logo_path });
});

router.post('/signature', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const signature_path = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE company_profile SET signature_path = ? WHERE id = 1').run(signature_path);
  res.json({ signature_path });
});

module.exports = router;
