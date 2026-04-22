const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsPath = path.resolve(__dirname, '../../', (process.env.UPLOADS_PATH || './uploads').replace('./', ''));
const upload = multer({ dest: uploadsPath });

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM purchase_bills ORDER BY issue_date DESC').all());
});

router.post('/', (req, res) => {
  const { vendor_name, vendor_gstin, invoice_no, invoice_date, subtotal, total_cgst, total_sgst, total_igst, total, line_items } = req.body;
  const result = db.prepare('INSERT INTO purchase_bills (vendor_name, vendor_gstin, bill_no, issue_date, subtotal, total_cgst, total_sgst, total_igst, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(vendor_name, vendor_gstin, invoice_no, invoice_date, subtotal, total_cgst, total_sgst, total_igst, total);
  const purchaseId = result.lastInsertRowid;
  if (line_items && line_items.length) {
    const insertItem = db.prepare('INSERT INTO purchase_bill_items (purchase_bill_id, description, hsn_sac, qty, unit, price, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const li of line_items) {
      insertItem.run(purchaseId, li.description, li.hsn_sac, li.qty, li.unit, li.price, li.taxable_value, li.cgst_pct, li.cgst_amt, li.sgst_pct, li.sgst_amt, li.igst_pct, li.igst_amt, li.amount);
    }
  }
  res.status(201).json({ id: purchaseId });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM purchase_bills WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

router.post('/extract', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    let rawText = '';
    if (req.file.mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(fs.readFileSync(req.file.path));
      rawText = data.text || '';
    } else {
      const Tesseract = require('tesseract.js');
      const { data } = await Tesseract.recognize(req.file.path, 'eng');
      rawText = data.text || '';
    }
    
    let prompt = `EXTRACT PURCHASE JSON: ${rawText} 
    IMPORTANT: Return ONLY raw JSON. Do NOT guess the year; if missing, use 2025/2026 based on context. 
    FORMAT: { "vendor_name": "", "vendor_gstin": "", "invoice_no": "", "invoice_date": "YYYY-MM-DD", "line_items": [{ "description": "", "qty": 1, "price": 0, "tax_rate": 18 }], "total": 0 }`;

    const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tinyllama', prompt: prompt, stream: false, format: 'json' })
    });
    if (!ollamaRes.ok) throw new Error('Ollama service unreachable.');
    const ollamaData = await ollamaRes.json();
    let extracted = {};
    try {
      const responseText = (ollamaData.response || '').trim();
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('AI failed to produce valid JSON.');
      extracted = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
    } catch (parseErr) {
      console.error('--- PURCHASE PARSE FAILURE ---');
      console.error('Raw Output:', ollamaData.response);
      throw new Error('AI digitization failed for this purchase bill format.');
    }
    res.json({ success: true, extracted });
  } catch (err) { 
    console.error('--- CRITICAL PURCHASE EXTRACTION ERROR ---', err.message);
    res.status(500).json({ error: err.message }); 
  } finally { try { fs.unlinkSync(req.file.path); } catch (_) {} }
});

module.exports = router;
