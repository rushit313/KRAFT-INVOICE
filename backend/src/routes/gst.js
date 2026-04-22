const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');

// Store sessions index by client ID or UUID
const gstSessions = new Map();

// Helper to get or create session
const getGstSession = (id) => {
  if (!gstSessions.has(id)) {
    gstSessions.set(id, axios.create({
      baseURL: 'https://services.gst.gov.in/services',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://services.gst.gov.in/services/searchtp'
      },
      withCredentials: true
    }));
  }
  return gstSessions.get(id);
};

function getSummaryForPeriod(dateFrom, dateTo) {
  const invoices = db.prepare(`SELECT i.*, c.company_name as client_name FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.issue_date >= ? AND i.issue_date <= ? AND i.status != 'draft' ORDER BY i.issue_date`).all(dateFrom, dateTo);

  const purchases = db.prepare(`SELECT pb.* FROM purchase_bills pb WHERE pb.issue_date >= ? AND pb.issue_date <= ? ORDER BY pb.issue_date`).all(dateFrom, dateTo);

  const sales = invoices.reduce((acc, inv) => ({
    taxable: acc.taxable + (inv.subtotal || 0),
    cgst: acc.cgst + (inv.total_cgst || 0),
    sgst: acc.sgst + (inv.total_sgst || 0),
    igst: acc.igst + (inv.total_igst || 0),
    total: acc.total + (inv.total || 0),
    invoice_count: acc.invoice_count + 1
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, invoice_count: 0 });

  const purchasesAgg = purchases.reduce((acc, pb) => ({
    taxable: acc.taxable + (pb.subtotal || 0),
    cgst: acc.cgst + (pb.total_cgst || 0),
    sgst: acc.sgst + (pb.total_sgst || 0),
    igst: acc.igst + (pb.total_igst || 0),
    total: acc.total + (pb.total || 0),
    bill_count: acc.bill_count + 1
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, bill_count: 0 });

  const net = {
    cgst_payable: Math.max(0, sales.cgst - purchasesAgg.cgst),
    sgst_payable: Math.max(0, sales.sgst - purchasesAgg.sgst),
    igst_payable: Math.max(0, sales.igst - purchasesAgg.igst),
    total_payable: 0
  };
  net.total_payable = net.cgst_payable + net.sgst_payable + net.igst_payable;

  return { sales, purchases: purchasesAgg, net, sales_detail: invoices, purchase_detail: purchases };
}

// GET monthly summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  const now = new Date();
  const m = parseInt(month || now.getMonth() + 1);
  const y = parseInt(year || now.getFullYear());
  const dateFrom = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const dateTo = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
  res.json({ period: { month: m, year: y, dateFrom, dateTo }, ...getSummaryForPeriod(dateFrom, dateTo) });
});

// GET quarterly summary
router.get('/summary/quarterly', (req, res) => {
  const { quarter, year } = req.query;
  const now = new Date();
  const y = parseInt(year || now.getFullYear());
  const q = parseInt(quarter || Math.ceil((now.getMonth() + 1) / 3));
  const quarterMap = { 1: ['01', '03'], 2: ['04', '06'], 3: ['07', '09'], 4: ['10', '12'] };
  const [startMonth, endMonth] = quarterMap[q] || ['01', '03'];
  const lastDay = new Date(y, parseInt(endMonth), 0).getDate();
  const dateFrom = `${y}-${startMonth}-01`;
  const dateTo = `${y}-${endMonth}-${lastDay}`;
  res.json({ period: { quarter: q, year: y, dateFrom, dateTo }, ...getSummaryForPeriod(dateFrom, dateTo) });
});

// --- NEW: GST VERIFICATION & HSN FETCH ---

router.get('/verify/captcha', async (req, res) => {
  const sessionId = req.query.sid || 'default';
  const session = getGstSession(sessionId);
  try {
    // Visit main page to set initial cookies if needed
    await session.get('/searchtp');
    const response = await session.get('/captcha', { responseType: 'arraybuffer' });
    const b64 = Buffer.from(response.data, 'binary').toString('base64');
    res.json({ image: `data:image/png;base64,${b64}`, sid: sessionId });
  } catch (err) {
    res.status(500).json({ error: 'Captcha failed: ' + err.message });
  }
});

router.post('/verify/details', async (req, res) => {
  const { gstin, captcha, sid } = req.body;
  const session = getGstSession(sid || 'default');
  console.log(`[GST] Verifying ${gstin} with captcha ${captcha}...`);
  try {
    const response = await session.post('/api/search/taxpayerDetails', {
      gstin: gstin.toUpperCase(),
      captcha
    });
    console.log(`[GST] Verification successful for ${gstin}`);
    res.json({ ...response.data, success: true });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[GST] Verification failed for ${gstin}: ${msg}`);
    res.status(400).json({ success: false, error: msg || 'Incorrect captcha or server error.' });
  }
});

router.get('/hsn/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (q.length < 2) return res.json([]);
  
  // Intelligent mapping for common terms
  const synonyms = {
    'laptop': 'data processing machine',
    'computer': 'data processing machine',
    'mobile': 'telephone',
    'phone': 'telephone',
    'tablet': 'data processing machine',
    'printer': 'printing machinery',
    'software': 'software',
    'consultancy': 'professional services',
    'service': 'service',
    'amc': 'maintenance',
    'repair': 'maintenance',
    'hosting': 'data processing',
    'cloud': 'data processing',
    'adapter': 'static converter',
    'charger': 'static converter',
    'cable': 'insulated wire',
    'wire': 'insulated wire',
    'switch': 'electrical apparatus',
    'monitor': 'monitor',
    'display': 'monitor',
    'keyboard': 'data processing machine',
    'mouse': 'data processing machine',
    'box': 'box',
    'battery': 'battery',
    'ink': 'ink',
    'cartridge': 'cartridge',
    'stationery': 'paper'
  };

  let searchQuery = q;
  for (const [key, val] of Object.entries(synonyms)) {
    if (q.includes(key)) {
      searchQuery = val;
      break;
    }
  }

  try {
    const results = db.prepare(`
      SELECT * FROM hsn_codes 
      WHERE hsn LIKE ? 
      OR description LIKE ? 
      OR description LIKE ?
      LIMIT 15
    `).all(`${q}%`, `%${q}%`, `%${searchQuery}%`);
    res.json(results);
  } catch (err) {
    res.status(500).json([]);
  }
});

module.exports = router;
