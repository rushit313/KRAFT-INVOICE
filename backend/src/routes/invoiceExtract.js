/**
 * Kraft Invoicing — /api/invoices/extract  &  /api/invoices/confirm-extract
 *
 * Drop this file at:  backend/src/routes/invoiceExtract.js
 * Then in server.js add:
 *   const invoiceExtract = require('./routes/invoiceExtract');
 *   app.use('/api/invoices', invoiceExtract);
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

const { refinedRuleBasedExtract, formatINR, parseAmount } = require('../utils/extractionEngine');
// ↑ Copy extractionEngine.js to backend/src/utils/extractionEngine.js

// ── Multer config ────────────────────────────────────────────────────────────
const upload = multer({
  dest: path.join(__dirname, '../../uploads/tmp'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const ok = /pdf|jpeg|jpg|png/i.test(file.mimetype);
    cb(ok ? null : new Error('Only PDF, JPG, PNG allowed'), ok);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function extractTextFromFile(filePath, mimetype) {
  if (/pdf/i.test(mimetype)) {
    const buf = fs.readFileSync(filePath);
    try {
      const result = await pdfParse(buf);
      const text = result.text || '';
      // If text is suspiciously short it's likely a scanned PDF — fall through to OCR
      if (text.replace(/\s/g, '').length > 80) {
        return { text, method: 'pdf-parse' };
      }
    } catch (e) {
      console.warn('[Extract] pdf-parse failed, falling back to OCR:', e.message);
    }
    // Scanned PDF → OCR (render first page to image via Tesseract directly on PDF is limited;
    // for production use pdf2pic. Here we attempt direct Tesseract on the file.)
  }

  // Image or scanned PDF → OCR
  try {
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
      logger: () => {}, // silence verbose output
    });
    return { text, method: 'tesseract' };
  } catch (e) {
    throw new Error('Could not extract text from file: ' + e.message);
  }
}

// ── POST /api/invoices/extract ───────────────────────────────────────────────
router.post('/extract', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;

  try {
    // 1. Extract raw text
    const { text, method } = await extractTextFromFile(filePath, req.file.mimetype);

    // 2. Load master data for matching
    const db      = req.app.get('db');
    const clients = db.prepare('SELECT * FROM clients').all();
    const items   = db.prepare('SELECT * FROM items').all();

    // 3. Run extraction engine
    const extracted = refinedRuleBasedExtract(text, clients, items);

    // 4. Clean up temp file
    try { fs.unlinkSync(filePath); } catch (_) {}

    return res.json({
      success: true,
      extraction_method: method,
      data: extracted,
    });
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    console.error('[Extract] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/invoices/confirm-extract ──────────────────────────────────────
router.post('/confirm-extract', (req, res) => {
  const db   = req.app.get('db');
  const body = req.body;

  const {
    invoice_no, issue_date, due_date, supply_type, place_of_supply,
    client_id,                          // set by frontend after user confirms/picks client
    new_client,                         // { company_name, gstin, billing_address, state, city, pin }
    line_items,
    subtotal, total_cgst, total_sgst, total_igst, total, rounded_off,
    status = 'unpaid',
    terms, notes,
  } = body;

  // ── Resolve / create client ──
  let resolvedClientId = client_id || null;

  if (!resolvedClientId && new_client && new_client.company_name) {
    // Check if already exists by GSTIN
    if (new_client.gstin) {
      const existing = db.prepare('SELECT id FROM clients WHERE gstin = ?').get(new_client.gstin);
      if (existing) {
        resolvedClientId = existing.id;
      }
    }

    // Still no match → insert
    if (!resolvedClientId) {
      const insert = db.prepare(`
        INSERT INTO clients (company_name, gstin, billing_address, city, state, pin, gst_treatment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Registered', datetime('now'))
      `);
      const r = insert.run(
        new_client.company_name,
        new_client.gstin || '',
        new_client.billing_address || '',
        new_client.city  || '',
        new_client.state || '',
        new_client.pin   || '',
      );
      resolvedClientId = r.lastInsertRowid;
    }
  }

  // ── Recalculate totals server-side to guarantee accuracy ──
  let calcSubtotal = 0, calcCgst = 0, calcSgst = 0, calcIgst = 0;

  const processedItems = (line_items || []).map(li => {
    const qty      = parseFloat(li.qty)      || 1;
    const price    = parseAmount(li.price);
    const disc     = parseFloat(li.discount_pct) || 0;
    const taxable  = Math.round(qty * price * (1 - disc / 100) * 100) / 100;
    const cgstPct  = parseFloat(li.cgst_pct) || (supply_type === 'intra' ? 9 : 0);
    const sgstPct  = parseFloat(li.sgst_pct) || (supply_type === 'intra' ? 9 : 0);
    const igstPct  = parseFloat(li.igst_pct) || (supply_type === 'inter' ? 18 : 0);
    const cgstAmt  = Math.round(taxable * cgstPct / 100 * 100) / 100;
    const sgstAmt  = Math.round(taxable * sgstPct / 100 * 100) / 100;
    const igstAmt  = Math.round(taxable * igstPct / 100 * 100) / 100;
    const amount   = taxable + cgstAmt + sgstAmt + igstAmt;

    calcSubtotal += taxable;
    calcCgst     += cgstAmt;
    calcSgst     += sgstAmt;
    calcIgst     += igstAmt;

    return { ...li, qty, price, taxable_value: taxable, cgst_pct: cgstPct, cgst_amt: cgstAmt, sgst_pct: sgstPct, sgst_amt: sgstAmt, igst_pct: igstPct, igst_amt: igstAmt, amount };
  });

  const calcTotal      = Math.round(calcSubtotal + calcCgst + calcSgst + calcIgst);
  const calcRoundedOff = calcTotal - (calcSubtotal + calcCgst + calcSgst + calcIgst);

  // ── Insert invoice ──
  const insertInvoice = db.prepare(`
    INSERT INTO invoices
      (invoice_no, issue_date, due_date, client_id, place_of_supply, supply_type,
       subtotal, total_cgst, total_sgst, total_igst, rounded_off, total,
       status, terms, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const invResult = insertInvoice.run(
    invoice_no, issue_date, due_date,
    resolvedClientId, place_of_supply, supply_type,
    calcSubtotal, calcCgst, calcSgst, calcIgst,
    calcRoundedOff, calcTotal,
    status, terms || '', notes || '',
  );
  const invoiceId = invResult.lastInsertRowid;

  // ── Insert line items ──
  const insertItem = db.prepare(`
    INSERT INTO invoice_items
      (invoice_id, item_id, description, hsn_sac, qty, unit, price, discount_pct,
       taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const li of processedItems) {
    insertItem.run(
      invoiceId,
      li.item_id || null,
      li.description,
      li.hsn_sac || '',
      li.qty,
      li.unit || 'Nos',
      li.price,
      li.discount_pct || 0,
      li.taxable_value,
      li.cgst_pct,
      li.cgst_amt,
      li.sgst_pct,
      li.sgst_amt,
      li.igst_pct,
      li.igst_amt,
      li.amount,
    );
  }

  return res.json({
    success:    true,
    invoice_id: invoiceId,
    invoice_no,
    total:      calcTotal,
    message:    `Invoice ${invoice_no} imported successfully`,
  });
});

module.exports = router;
