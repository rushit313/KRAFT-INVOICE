const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateInvoicePDF } = require('../pdf/invoice-template');

function round2(n) { return Math.round(n * 100) / 100; }

function calcLineItem(li, supplyType) {
  const taxable_value = round2((li.qty || 1) * (li.price || 0) * (1 - (li.discount_pct || 0) / 100));
  const tax_rate = li.tax_rate || 0;
  const half = tax_rate / 2;
  let cgst_pct = 0, cgst_amt = 0, sgst_pct = 0, sgst_amt = 0, igst_pct = 0, igst_amt = 0;
  if (supplyType === 'intra') {
    cgst_pct = half; cgst_amt = round2(taxable_value * half / 100);
    sgst_pct = half; sgst_amt = round2(taxable_value * half / 100);
  } else {
    igst_pct = tax_rate; igst_amt = round2(taxable_value * tax_rate / 100);
  }
  const amount = round2(taxable_value + cgst_amt + sgst_amt + igst_amt);
  return { ...li, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount };
}

function calcTotals(lineItems) {
  let subtotal = 0, total_cgst = 0, total_sgst = 0, total_igst = 0;
  for (const li of lineItems) {
    subtotal += (li.taxable_value || 0);
    total_cgst += (li.cgst_amt || 0);
    total_sgst += (li.sgst_amt || 0);
    total_igst += (li.igst_amt || 0);
  }
  const unrounded = round2(subtotal + total_cgst + total_sgst + total_igst);
  const total = Math.round(unrounded);
  const rounded_off = round2(total - unrounded);
  return { subtotal: round2(subtotal), total_cgst: round2(total_cgst), total_sgst: round2(total_sgst), total_igst: round2(total_igst), rounded_off, total };
}

function updateInvoiceStatus(invoiceId) {
  const invoice = db.prepare('SELECT total FROM invoices WHERE id = ?').get(invoiceId);
  if (!invoice) return;
  const paid = db.prepare('SELECT COALESCE(SUM(amount),0) as total_paid FROM payments WHERE invoice_id = ?').get(invoiceId);
  const totalPaid = paid.total_paid || 0;
  let status = 'unpaid';
  if (totalPaid >= invoice.total) status = 'paid';
  else if (totalPaid > 0) status = 'partial';
  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, invoiceId);
}

function getNextInvoiceNo() {
  const company = db.prepare('SELECT financial_year_start FROM company_profile WHERE id = 1').get();
  const fyStart = parseInt(company?.financial_year_start || '04');
  const now = new Date();
  let fyYear = now.getFullYear();
  if (now.getMonth() + 1 < fyStart) fyYear--;
  const fyLabel = fyYear + '-' + String(fyYear + 1).slice(-2);
  const last = db.prepare('SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1').get('KE/' + fyLabel + '/%');
  let seq = 1;
  if (last) {
    const parts = last.invoice_no.split('/');
    seq = parseInt(parts[parts.length - 1]) + 1;
  }
  return 'KE/' + fyLabel + '/' + String(seq).padStart(3, '0');
}

router.get('/next-no', (req, res) => {
  res.json({ next_no: getNextInvoiceNo() });
});

router.get('/', (req, res) => {
  const { status, client_id, date_from, date_to, search } = req.query;
  let query = 'SELECT i.*, c.company_name as client_name FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE 1=1';
  const params = [];
  if (status) { 
    if (status.toLowerCase() === 'unpaid') {
      query += " AND TRIM(LOWER(i.status)) IN ('unpaid', 'overdue')";
    } else {
      query += ' AND TRIM(LOWER(i.status)) = ?'; 
      params.push(status.toLowerCase()); 
    }
  }
  if (client_id) { query += ' AND i.client_id = ?'; params.push(client_id); }
  if (date_from) { query += ' AND i.issue_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND i.issue_date <= ?'; params.push(date_to); }
  if (search) { query += ' AND (i.invoice_no LIKE ? OR c.company_name LIKE ?)'; const s = '%' + search + '%'; params.push(s, s); }
  query += ' ORDER BY i.issue_date DESC, i.id DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const invoice = db.prepare('SELECT i.*, c.company_name as client_name, c.gstin as client_gstin, c.billing_address as client_billing_address, c.shipping_address as client_shipping_address, c.city as client_city, c.state as client_state, c.pin as client_pin, c.phone as client_phone, c.email as client_email FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(req.params.id);
  const paid = db.prepare('SELECT COALESCE(SUM(amount),0) as total_paid FROM payments WHERE invoice_id = ?').get(req.params.id);
  invoice.total_paid = paid.total_paid || 0;
  invoice.balance_due = round2(invoice.total - invoice.total_paid);
  res.json(invoice);
});

function createInvoiceInternal(data) {
  const { invoice_no, issue_date, due_date, po_number, client_id, place_of_supply, supply_type, items, terms, notes, status } = data;
  if (!client_id || !items || !items.length) throw new Error('client_id and items are required');
  const invNo = invoice_no || getNextInvoiceNo();
  const existing = db.prepare('SELECT id FROM invoices WHERE invoice_no = ?').get(invNo);
  if (existing) throw new Error('Invoice number ' + invNo + ' already exists');
  const sType = supply_type || 'intra';
  const calcedItems = items.map(li => calcLineItem(li, sType));
  const totals = calcTotals(calcedItems);
  const result = db.prepare('INSERT INTO invoices (invoice_no, issue_date, due_date, po_number, client_id, place_of_supply, supply_type, subtotal, total_cgst, total_sgst, total_igst, rounded_off, total, status, terms, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    invNo, issue_date, due_date, po_number, client_id, place_of_supply, sType,
    totals.subtotal, totals.total_cgst, totals.total_sgst, totals.total_igst, totals.rounded_off, totals.total,
    status || 'unpaid', terms, notes
  );
  const invoiceId = result.lastInsertRowid;
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, item_id, description, hsn_sac, qty, unit, price, discount_pct, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const li of calcedItems) {
    insertItem.run(invoiceId, li.item_id || null, li.description, li.hsn_sac, li.qty, li.unit || 'Nos', li.price, li.discount_pct || 0, li.taxable_value, li.cgst_pct, li.cgst_amt, li.sgst_pct, li.sgst_amt, li.igst_pct, li.igst_amt, li.amount);
  }
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
  return invoice;
}

router.post('/', (req, res) => {
  try { res.status(201).json(createInvoiceInternal(req.body)); } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const { issue_date, due_date, po_number, client_id, place_of_supply, supply_type, items, terms, notes, status } = req.body;
  const sType = supply_type || invoice.supply_type;
  let totals = {};
  if (items && items.length) {
    const calcedItems = items.map(li => calcLineItem(li, sType));
    totals = calcTotals(calcedItems);
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
    const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, item_id, description, hsn_sac, qty, unit, price, discount_pct, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const li of calcedItems) {
      insertItem.run(req.params.id, li.item_id || null, li.description, li.hsn_sac, li.qty, li.unit || 'Nos', li.price, li.discount_pct || 0, li.taxable_value, li.cgst_pct, li.cgst_amt, li.sgst_pct, li.sgst_amt, li.igst_pct, li.igst_amt, li.amount);
    }
  }
  let sql = 'UPDATE invoices SET issue_date=COALESCE(?,issue_date), due_date=COALESCE(?,due_date), po_number=COALESCE(?,po_number), client_id=COALESCE(?,client_id), place_of_supply=COALESCE(?,place_of_supply), supply_type=?, terms=COALESCE(?,terms), notes=COALESCE(?,notes), status=COALESCE(?,status)';
  const params = [issue_date, due_date, po_number, client_id, place_of_supply, sType, terms, notes, status];
  if (items && items.length) {
    sql += ', subtotal=?, total_cgst=?, total_sgst=?, total_igst=?, rounded_off=?, total=?';
    params.push(totals.subtotal, totals.total_cgst, totals.total_sgst, totals.total_igst, totals.rounded_off, totals.total);
  }
  sql += ' WHERE id = ?';
  params.push(req.params.id);
  db.prepare(sql).run(...params);
  if (!status) updateInvoiceStatus(req.params.id);
  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  updated.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

router.delete('/', (req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoices').run();
  })();
  res.json({ message: 'All invoices deleted' });
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = db.prepare('SELECT i.*, c.company_name as client_name, c.gstin as client_gstin, c.billing_address as client_billing_address, c.shipping_address as client_shipping_address, c.city as client_city, c.state as client_state, c.pin as client_pin FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(req.params.id);
    const pdfBuffer = await generateInvoicePDF(invoice, db.prepare('SELECT * FROM company_profile WHERE id = 1').get(), req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

router.post('/:id/payments', (req, res) => {
  const { payment_date, amount, method, reference_no, notes } = req.body;
  const result = db.prepare('INSERT INTO payments (invoice_id, payment_date, amount, method, reference_no, notes) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, payment_date, amount, method, reference_no, notes);
  updateInvoiceStatus(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id/payments', (req, res) => {
  res.json(db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC').all(req.params.id));
});

// --- HIGH-FIDELITY EXTRACTION ENGINE (supports both Kraft IT bill formats) ---
function refinedRuleBasedExtract(text, filename = '', allItems = []) {
  const MY_GSTIN = '27AJVPD0565B1ZC';
  const MY_KEYWORDS = ['kraft it', 'kraftit', 'kraft it services', MY_GSTIN.toLowerCase(), 'ghatkopar', 'chatkopar', 'rushit', '9869350586', 'rushit.dani'];

  const rawLines = text.split('\n').map(l => l.trim());
  const lines = rawLines.filter(l => l.length > 0);
  const textFlat = rawLines.join(' ');
  const textLower = textFlat.toLowerCase();

  const result = { items: [], terms: '', supply_type: 'intra' };

  // ── 1. INVOICE NUMBER ───────────────────────────────────────────────────
  const invPatterns = [
    /TAX\s+INVOICE\s+(?:NO\.?\s*)?(\d[\w\-\/]*)/i,
    /(?:original|duplicate|triplicate)\s+(?:for\s+\w+\s+)?(?:copy\s+)?(\d[\w\-\/]+)/i,
    /Invoice\s*(?:No|Number|#)?\s*[:.#\s]+([A-Za-z0-9\-\/]*\d[A-Za-z0-9\-\/]*)/i,
    /Bill\s*(?:No|Number)?\s*[:.#\s]*([A-Za-z0-9\-\/]*\d[A-Za-z0-9\-\/]*)/i,
  ];
  for (const p of invPatterns) {
    const m = textFlat.match(p);
    if (m && m[1] && m[1].length <= 25 && !/^(copy|for|from|recipient|no)$/i.test(m[1])) {
      const isDecimalAmount = /^\d+[\.,]\d{2}$/.test(m[1]);
      if (!isDecimalAmount && !textFlat.substring(Math.max(0, m.index - 10), m.index).toLowerCase().includes('amount') && !textFlat.substring(Math.max(0, m.index - 10), m.index).toLowerCase().includes('total')) {
        result.invoice_no = m[1].trim(); break;
      }
    }
  }
  if (!result.invoice_no && filename) {
    const fn = filename.replace(/\.(pdf|jpg|jpeg|png)$/i, '');
    const fnM = fn.match(/(\d+[-\/]\d+)/) || fn.match(/(\d{2,})/);
    if (fnM) result.invoice_no = fnM[1];
    else result.invoice_no = fn.substring(0, 30);
  }
  result.invoice_no = result.invoice_no || 'MIGRATED';

  // ── 2. GSTIN ─────────────────────────────────────────────────────────────
  const gstinRe = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g;
  const allGstins = [...new Set((textFlat.match(gstinRe) || []))];
  const clientGstins = allGstins.filter(g => g !== MY_GSTIN);
  result.client_gstin = clientGstins[0] || null;

  // ── 3. DATES ─────────────────────────────────────────────────────────────
  function parseDate(str) {
    if (!str) return null;
    str = str.replace(/\s*-\s*/g, '-').trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    // DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const d2 = new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`);
      if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
    }
    return null;
  }

  const issuePat = [
    /Issue\s*Date\s*[:\s]*(\d{1,2}\s*[-\/]\s*[A-Za-z]{3,}\s*[-\/]\s*\d{4})/i,
    /Issue\s*Date\s*[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
    /(?:^|[:\s])Date\s*[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:^|[:\s])Date\s*[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
    /(\d{2}\s*[-\/]\s*[A-Z][a-z]{2}\s*[-\/]\s*\d{4})/,
    /([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})/,
  ];
  for (const p of issuePat) {
    const m = textFlat.match(p);
    if (m) { const d = parseDate(m[1]); if (d) { result.issue_date = d; break; } }
  }

  const duePat = /Due\s*Date\s*[:\s]*(\d{1,2}\s*[-\/]\s*[A-Za-z]{3,}\s*[-\/]\s*\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i;
  const dueM = textFlat.match(duePat);
  if (dueM) { const d = parseDate(dueM[1]); if (d) result.due_date = d; }

  // ── 4. PO NUMBER ─────────────────────────────────────────────────────────
  const poM = textFlat.match(/P\.?\s*O\.?\s*(?:Number|No\.?)\s*[:\s]+([A-Z0-9][\w\-\/]+)/i);
  if (poM && poM[1]) result.po_number = poM[1].trim();

  // ── 5. PLACE OF SUPPLY ────────────────────────────────────────────────────
  const posM = textFlat.match(/Place\s*of\s*Supply\s*[:\s]*([A-Za-z\s]+(?:\([A-Z]{2}\s*[-\/]?\s*\d{2}\))?)/i);
  if (posM) result.place_of_supply = posM[1].trim().replace(/\s+/g, ' ').substring(0, 40);

  // ── 6. CLIENT NAME & ADDRESS ─────────────────────────────────────────────
  const billToMarkers = ['bill to:', 'bill to', 'billed to:', 'billed to', 'consignee:', 'buyer:'];
  for (const marker of billToMarkers) {
    const idx = textLower.indexOf(marker);
    if (idx === -1) continue;
    const chunk = text.substring(idx + marker.length, idx + marker.length + 800);
    const chunkLines = chunk.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const clientLines = [];
    for (const cl of chunkLines) {
      const clLower = cl.toLowerCase();
      if (/ship\s*to|bill\s*to|hsn|product|service|qty|amount|cgst|sgst|place\s*of\s*supply/i.test(cl)) break;
      if (cl.length < 3) continue;
      // Two-column layout: "Our Address    Client Name" — split on 4+ spaces, take right column
      const colParts = cl.split(/\s{4,}/);
      const usePart = colParts.length > 1 ? colParts[colParts.length - 1].trim() : cl.trim();
      if (!usePart || usePart.length < 3) continue;
      if (MY_KEYWORDS.some(k => usePart.toLowerCase().includes(k))) break;
      clientLines.push(usePart);
      if (clientLines.length >= 8) break;
    }
    if (clientLines.length > 0) {
      result.client_name = clientLines[0].replace(/^[:\-\s]+/, '').trim();
      if (clientLines.length > 1) result.client_address = clientLines.slice(1, 4).join(', ');
      const addrStr = clientLines.slice(1, 6).join(' ');
      const pinM = addrStr.match(/\b(\d{6})\b/);
      if (pinM) result.client_pin = pinM[1];
      const stateM = addrStr.match(/Maharashtra|Delhi|Karnataka|Gujarat|Rajasthan|Tamil\s*Nadu|Telangana|Andhra|West\s*Bengal|Uttar\s*Pradesh|Punjab|Haryana/i);
      if (stateM) result.client_state = stateM[0];
    }
    break;
  }

  // Fallback: use client GSTIN proximity
  if (!result.client_name && result.client_gstin) {
    const gIdx = textFlat.indexOf(result.client_gstin);
    const pre = textFlat.substring(Math.max(0, gIdx - 200), gIdx);
    const preLines = pre.split(/\n| {2,}/).map(l => l.trim()).filter(l => l.length > 3);
    const name = preLines.filter(l => !MY_KEYWORDS.some(k => l.toLowerCase().includes(k))).pop();
    if (name) result.client_name = name;
  }

  // ── 7. SUPPLY TYPE ────────────────────────────────────────────────────────
  // IGST only = inter-state; CGST+SGST = intra-state
  if (/\bIGST\b/i.test(textFlat) && !/\bCGST\b/i.test(textFlat)) result.supply_type = 'inter';
  const isInter = result.supply_type === 'inter';

  // ── 8. ITEM TABLE (token-based, back-calculates price from amounts) ───────
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const ll = lines[i].toLowerCase();
    const hasDesc = /product|service|description|particulars|item|name|code|hsn/i.test(ll);
    const hasAmt  = /qty|amount|price|cgst|sgst|igst|rate/i.test(ll);
    if (hasDesc && hasAmt) { tableStart = i; break; }
  }

  if (tableStart !== -1) {
    for (let i = tableStart + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      const ll = l.toLowerCase();

      // Stop at totals / footer sections
      if (/^(sub[\s-]?total|grand\s*total|total\s*amount|total\s*before|total\s*tax|terms\s*[&a]|note:|notes:|neft|warranty|a\/c\s*no|bank\s*name|ifsc|amount\s*due)/i.test(ll)) break;
      if (/^\s*total\b/i.test(ll)) break; // "TOTAL 149.00 ..." summary row
      // Skip @18% summary row and column-header repeats
      if (/^@\s*\d+/.test(l)) continue;
      if (/^(cgst|sgst|igst)\s*@/i.test(l)) continue;

      // Extract all positive numbers from the line
      const nums = (l.match(/[\d,]+(?:\.\d{1,3})?/g) || [])
        .map(n => parseFloat(n.replace(/,/g, '')))
        .filter(n => !isNaN(n) && n > 0);

      // Need at least 3 numbers: qty + (cgst or igst) + amount
      if (nums.length < 3) continue;

      // ── DESCRIPTION: token scan ──────────────────────────────────────────
      // Walk tokens L→R; skip leading row-number; accumulate text tokens;
      // stop when we see 2 consecutive purely-numeric tokens (= data columns start).
      const tokens = l.split(/\s+/);
      const descTokens = [];
      let rowNumSkipped = false;
      let consecNums = 0;

      for (let j = 0; j < tokens.length; j++) {
        const t = tokens[j];
        const asNum = parseFloat(t.replace(/,/g, ''));
        const isPureNum = /^[\d,\.]+$/.test(t) && !isNaN(asNum) && asNum > 0;

        if (!rowNumSkipped && isPureNum && descTokens.length === 0) {
          rowNumSkipped = true; // skip leading serial number
          continue;
        }
        if (isPureNum) {
          consecNums++;
          if (consecNums >= 2) {
            // two consecutive numbers = we've hit qty/price columns; discard the first one we added
            if (descTokens.length > 0 && /^[\d,\.]+$/.test(descTokens[descTokens.length - 1])) {
              descTokens.pop();
            }
            break;
          }
          descTokens.push(t); // might be part of name e.g. "Camera 2.4 Full HD"
        } else {
          consecNums = 0;
          descTokens.push(t);
        }
      }

      let description = descTokens.join(' ').trim();
      // Strip any trailing lone number that leaked in
      description = description.replace(/\s+[\d\.]+$/, '').trim();

      if (!description || description.length < 2) continue;
      if (/^(cgst|sgst|igst|hsn|qty|sr\.?\s*no|no\.|rounded)/i.test(description)) continue;
      if (/^[\d\.\%,\s]+$/.test(description)) continue; // purely numeric line

      // ── PRICE BACK-CALCULATION ───────────────────────────────────────────
      // Column order (intra): NO | DESC | HSN | QTY | UNIT_PRICE | CGST | SGST | AMOUNT
      // Column order (inter): NO | DESC | HSN | QTY | UNIT_PRICE | IGST        | AMOUNT
      // Strategy: read from the RIGHT end of nums[].
      //   amount  = nums[-1]
      //   sgst    = nums[-2]  (intra only)
      //   cgst    = nums[-3]  (intra only)  /  igst = nums[-2] (inter)
      //   taxable = amount - cgst - sgst  (or amount - igst)
      //   qty     = nums[-5] (intra) / nums[-4] (inter); fallback = 1
      //   price   = taxable / qty

      const amount = nums[nums.length - 1];
      let taxable, qty, price, tax_rate;

      if (!isInter && nums.length >= 4) {
        const sgst = nums[nums.length - 2];
        const cgst = nums[nums.length - 3];
        taxable = Math.max(0, round2(amount - cgst - sgst));
        tax_rate = taxable > 0 ? Math.round((cgst + sgst) / taxable * 100) : 18;
      } else if (isInter && nums.length >= 3) {
        const igst = nums[nums.length - 2];
        taxable = Math.max(0, round2(amount - igst));
        tax_rate = taxable > 0 ? Math.round(igst / taxable * 100) : 18;
      } else {
        taxable = amount;
        tax_rate = 18;
      }

      // Sanity check tax rate (valid GST slabs: 0, 5, 12, 18, 28)
      if (tax_rate <= 0 || tax_rate > 28) tax_rate = 18;

      // Find (qty, price) where qty × price = taxable
      // Scan candidates (everything except last 3 = cgst/igst, sgst, amount)
      qty = 1; price = taxable;
      if (taxable > 0) {
        const candidates = nums.slice(0, -3).filter(n => n > 0);
        let found = false;
        outer: for (let j = 0; j < candidates.length; j++) {
          for (let k = j; k < candidates.length; k++) {
            const a = candidates[j], b = candidates[k];
            if (Math.abs(a * b - taxable) < 0.5) {
              // Take larger as price, smaller as qty
              qty = Math.min(a, b);
              price = Math.max(a, b);
              found = true; break outer;
            }
          }
        }
        if (!found) {
          // Fallback: last candidate before tax columns is price, derive qty
          const lastCand = nums[nums.length - 4];
          if (lastCand && lastCand > 0 && lastCand <= taxable) {
            price = lastCand;
            qty = round2(taxable / price);
            if (qty <= 0 || qty > 100000) { qty = 1; price = taxable; }
          }
        }
      }

      const hsnM = l.match(/\b(\d{6,8})\b/);

      result.items.push({
        description,
        hsn_sac: hsnM ? hsnM[1] : '',
        qty,
        unit: 'Nos',
        price: price || 0,
        tax_rate,
      });
    }
  }

  // ── 9. TERMS ──────────────────────────────────────────────────────────────
  for (const marker of ['terms & conditions', 'terms and conditions', 'note:', 'notes:']) {
    const idx = textLower.indexOf(marker);
    if (idx !== -1) {
      result.terms = text.substring(idx + marker.length, idx + marker.length + 600)
        .split('\n').map(l => l.trim()).filter(l => l).slice(0, 8).join('\n');
      break;
    }
  }

  // ── 10. DEFAULTS & DB ITEM MATCHING ───────────────────────────────────────
  if (!result.issue_date) result.issue_date = new Date().toISOString().split('T')[0];

  if (allItems && allItems.length > 0) {
    if (result.items.length > 0) {
      // Table found items. Match descriptions to DB Items.
      for (let it of result.items) {
        if (!it.description) continue;
        const descLower = it.description.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        const tokensExt = descLower.split(/\s+/).filter(t => t.length > 2);
        let bestMatch = null;
        let highestScore = 0;
        
        for (const dbItem of allItems) {
            if (!dbItem.name) continue;
            const dbNameLower = dbItem.name.toLowerCase().replace(/[^a-z0-9]/g, ' ');
            const tokensDb = dbNameLower.split(/\s+/).filter(t => t.length > 2);
            let overlap = 0;
            for (const tExt of tokensExt) {
                 for (const tDb of tokensDb) {
                     if (tExt === tDb) overlap += 1;
                     else if (tExt.length > 3 && tDb.length > 3 && (tExt.includes(tDb) || tDb.includes(tExt))) overlap += 0.5;
                 }
            }
            if (overlap > 0 && overlap > highestScore) {
                highestScore = overlap;
                bestMatch = dbItem;
            } else if (descLower.includes(dbNameLower) || dbNameLower.includes(descLower)) {
                highestScore = 999;
                bestMatch = dbItem;
            }
        }
        
        if (bestMatch && (highestScore >= 2 || highestScore === 999 || tokensExt.length === highestScore || highestScore >= tokensDb?.length / 2)) {
            it.description = bestMatch.name;
            it.item_id = bestMatch.id;
            if (!it.hsn_sac) it.hsn_sac = bestMatch.hsn || bestMatch.sac || '';
            it.unit = bestMatch.unit || it.unit;
        }
      }
    } else {
      // Table parser failed. Fallback: Search the cleaned full text for DB Item names.
      const textFlatClean = textFlat.replace(/\s+/g, ' ').toLowerCase();
      const sortedItems = [...allItems].sort((a,b) => (b.name || '').length - (a.name || '').length);
      const foundItems = [];
      let tempText = textFlatClean;
      
      for (const dbItem of sortedItems) {
          if (!dbItem.name || dbItem.name.length < 4) continue;
          const dbNameClean = dbItem.name.replace(/\s+/g, ' ').toLowerCase();
          
          if (tempText.includes(dbNameClean)) {
              let qty = 1, price = dbItem.sale_price || 0, tax_rate = dbItem.tax_rate || 18;
              const idx = tempText.indexOf(dbNameClean);
              const afterText = tempText.substring(idx + dbNameClean.length, idx + dbNameClean.length + 50);
              const nums = (afterText.match(/[\d,]+(?:\.\d{1,3})?/g) || []).map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n) && n > 0);
              
              if (nums.length > 0) {
                  if (nums[0] < 1000) qty = nums[0];
                  if (nums.length >= 2) {
                      const lastAmt = nums[nums.length - 1]; // Assume last is amount
                      const foundPriceLike = nums.find(n => Math.abs(n - dbItem.sale_price) < 5);
                      if (foundPriceLike) price = foundPriceLike;
                      else if (lastAmt > 0 && qty > 0) {
                          const taxablePrice = lastAmt / (1 + tax_rate/100);
                          let deducedPrice = Math.round((taxablePrice / qty) * 100) / 100;
                          if (deducedPrice > 0.1 && Math.abs(deducedPrice - dbItem.sale_price) < dbItem.sale_price * 10) price = deducedPrice;
                      }
                  }
              }
              
              foundItems.push({
                  item_id: dbItem.id,
                  description: dbItem.name,
                  hsn_sac: dbItem.hsn || dbItem.sac || '',
                  qty,
                  unit: dbItem.unit || 'Nos',
                  price,
                  tax_rate
              });
              
              tempText = tempText.replace(dbNameClean, ' '); 
          }
      }
      if (foundItems.length > 0) result.items = foundItems;
    }
  }

  if (result.items.length === 0) {
    const taxableM = textFlat.match(/(?:total\s*before\s*tax|sub\s*total|taxable\s*(?:value|amount))[:\s]*(?:inr|₹|rs\.?)?\s*([\d,]+(?:\.\d{2})?)/i);
    const totalM   = textFlat.match(/(?:total\s*amount|grand\s*total|amount\s*due)[:\s]*(?:inr|₹|rs\.?)?\s*([\d,]+(?:\.\d{2})?)/i);
    const amt = taxableM
      ? parseFloat(taxableM[1].replace(/,/g, ''))
      : totalM ? parseFloat(totalM[1].replace(/,/g, '')) : 0;
    const useAmt = taxableM ? amt : 0; // if only grand total, store 0 price to avoid double-tax
    
    // Attempt final keyword match before giving up
    let fallbackDesc = 'Migrated Service';
    let fallbackId = null;
    let fallbackHsn = '';
    const textLower = textFlat.toLowerCase();
    
    const sortedItems = [...(allItems || [])].sort((a,b) => (b.name || '').length - (a.name || '').length);
    for (const item of sortedItems) {
      if (item.name && item.name.length > 3 && textLower.includes(item.name.toLowerCase())) {
        fallbackDesc = item.name;
        fallbackId = item.id;
        fallbackHsn = item.hsn || item.sac || '';
        break;
      }
    }
    
    result.items.push({ item_id: fallbackId, description: fallbackDesc, hsn_sac: fallbackHsn, qty: 1, price: useAmt, tax_rate: 18, unit: 'Nos' });
  }

  return result;
}

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');

// --- OCR PDF FALLBACK (pdfjs-dist + canvas + Tesseract) ---
async function ocrPdf(pdfPath) {
  let pdfDoc = null;
  try {
    console.log(`[OCR] Loading PDF with pdfjs-dist: ${pdfPath}`);
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = require('canvas');

    // Disable worker thread for Node.js
    GlobalWorkerOptions.workerSrc = false;

    const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = getDocument({ data: pdfData, verbosity: 0, useSystemFonts: true });
    pdfDoc = await loadingTask.promise;
    console.log(`[OCR] PDF has ${pdfDoc.numPages} page(s)`);

    class NodeCanvasFactory {
      create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
      reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
      destroy(cc) { cc.canvas = null; cc.context = null; }
    }
    const canvasFactory = new NodeCanvasFactory();

    let fullText = '';

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);

      // 1) Try the text layer first (works for digital/text PDFs)
      const textContent = await page.getTextContent();
      const layerText = textContent.items.map(i => i.str || '').join(' ').trim();
      if (layerText.length > 30) {
        console.log(`[OCR] Page ${p}: text layer OK (${layerText.length} chars)`);
        fullText += layerText + '\n';
        page.cleanup();
        continue;
      }

      // 2) Render page to canvas → Tesseract (for scanned/image PDFs)
      console.log(`[OCR] Page ${p}: no text layer, rendering at 2.5x for OCR…`);
      const viewport = page.getViewport({ scale: 2.5 });
      const cc = canvasFactory.create(Math.floor(viewport.width), Math.floor(viewport.height));

      await page.render({ canvasContext: cc.context, viewport, canvasFactory }).promise;

      const pngBuf = cc.canvas.toBuffer('image/png');
      const { data: ocrResult } = await Tesseract.recognize(pngBuf, 'eng', { logger: () => {} });
      console.log(`[OCR] Page ${p}: Tesseract got ${ocrResult.text.length} chars`);
      fullText += ocrResult.text + '\n';

      canvasFactory.destroy(cc);
      page.cleanup();
    }

    return fullText;
  } catch (err) {
    console.error('[OCR ERROR]:', err.message);
    return '';
  } finally {
    if (pdfDoc) { try { pdfDoc.destroy(); } catch (_) {} }
  }
}

const uploadsPath = path.resolve(__dirname, '../../', (process.env.UPLOADS_PATH || './uploads').replace('./', ''));
const upload = multer({ dest: uploadsPath });

router.post('/extract', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    let rawText = '';
    const mime = req.file.mimetype;
    const isPdf = mime === 'application/pdf';
    const isImage = mime.startsWith('image/');

    if (isPdf) {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(fs.readFileSync(req.file.path));
      rawText = data.text || '';
      if (!rawText.trim() || rawText.length < 50) {
        console.log(`[EXTRACT] No text layer, falling back to OCR...`);
        rawText = await ocrPdf(req.file.path) || '';
      }
    } else if (isImage) {
      const { data } = await Tesseract.recognize(req.file.path, 'eng');
      rawText = data.text || '';
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Upload PDF or image.' });
    }

    const allItems = db.prepare('SELECT * FROM items').all();
    const extracted = refinedRuleBasedExtract(rawText || '', req.file.originalname, allItems);

    // Match client in DB
    let existing = null;
    if (extracted.client_gstin) existing = db.prepare('SELECT * FROM clients WHERE gstin = ?').get(extracted.client_gstin);
    if (!existing && extracted.client_name) existing = db.prepare("SELECT * FROM clients WHERE LOWER(company_name) LIKE LOWER(?)").get('%' + extracted.client_name + '%');
    extracted.matched_client = existing || null;

    res.json({ success: true, extracted, method: 'rules' });
  } catch (err) {
    console.error('[EXTRACTION ERROR]:', err);
    res.status(500).json({ error: err.message || String(err) });
  } finally {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (_) {}
  }
});

router.post('/confirm-extract', (req, res) => {
  try {
    const { extracted } = req.body;
    
    // 1. IMPROVED CLIENT MATCHING & DEDUPLICATION
    let client_id = null;
    
    // Check by GSTIN first (most reliable)
    if (extracted.client_gstin) {
      const c = db.prepare('SELECT id FROM clients WHERE gstin = ?').get(extracted.client_gstin);
      if (c) client_id = c.id;
    }
    
    // If no GSTIN match, check by Name (Fuzzy)
    if (!client_id && extracted.client_name) {
      const c = db.prepare('SELECT id FROM clients WHERE company_name LIKE ?').get('%' + extracted.client_name + '%');
      if (c) client_id = c.id;
    }

    // 2. AUTO-CREATE OR UPDATE CLIENT PROFILE
    if (!client_id) {
      const resC = db.prepare('INSERT INTO clients (company_name, gstin, billing_address, city, state, pin) VALUES (?, ?, ?, ?, ?, ?)').run(
        extracted.client_name || 'Migrated Client',
        extracted.client_gstin || null,
        extracted.client_address || null,
        extracted.client_city || null,
        extracted.client_state || null,
        extracted.client_pin || null
      );
      client_id = resC.lastInsertRowid;
    } else {
      db.prepare('UPDATE clients SET gstin = COALESCE(gstin, ?), billing_address = COALESCE(billing_address, ?), city = COALESCE(city, ?), state = COALESCE(state, ?), pin = COALESCE(pin, ?) WHERE id = ?').run(
        extracted.client_gstin || null,
        extracted.client_address || null,
        extracted.client_city || null,
        extracted.client_state || null,
        extracted.client_pin || null,
        client_id
      );
    }

    // 3. CREATE INVOICE
    const invoice = createInvoiceInternal({
      invoice_no: extracted.invoice_no,
      issue_date: extracted.issue_date || new Date().toISOString().split('T')[0],
      due_date: extracted.due_date || null,
      po_number: extracted.po_number || null,
      client_id,
      place_of_supply: extracted.place_of_supply || null,
      supply_type: extracted.supply_type || 'intra',
      terms: extracted.terms || null,
      notes: extracted.notes || null,
      status: 'unpaid',
      items: extracted.items && extracted.items.length ? extracted.items : [{ description: 'Migrated Bill', qty: 1, price: 0, tax_rate: 18 }],
    });
    
    res.status(201).json(invoice);
  } catch (err) { 
    console.error('[CONFIRM ERROR]:', err);
    res.status(400).json({ error: err.message }); 
  }
});

router.post('/bulk', (req, res) => {
  try {
    const { invoices } = req.body;
    if (!invoices || !Array.isArray(invoices)) return res.status(400).json({ error: 'Invalid payload' });

    let importedCount = 0;
    
    db.transaction(() => {
      for (const extracted of invoices) {
        let client_id = null;
        if (extracted.client_gstin) {
          const c = db.prepare('SELECT id FROM clients WHERE gstin = ?').get(extracted.client_gstin);
          if (c) client_id = c.id;
        }
        if (!client_id && extracted.client_name) {
          const c = db.prepare('SELECT id FROM clients WHERE company_name LIKE ?').get('%' + extracted.client_name + '%');
          if (c) client_id = c.id;
        }
        if (!client_id) {
          const resC = db.prepare('INSERT INTO clients (company_name, gstin, billing_address, city, state, pin, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
            extracted.client_name || 'Migrated Client',
            extracted.client_gstin || null,
            extracted.client_address || null,
            extracted.client_city || null,
            extracted.client_state || null,
            extracted.client_pin || null,
            extracted.client_phone || null,
            extracted.client_email || null
          );
          client_id = resC.lastInsertRowid;
        }
        
        try {
          createInvoiceInternal({
            invoice_no: extracted.invoice_no,
            issue_date: extracted.issue_date || new Date().toISOString().split('T')[0],
            client_id,
            place_of_supply: extracted.place_of_supply || null,
            supply_type: extracted.supply_type || 'intra',
            status: extracted.status || 'unpaid',
            items: extracted.items && extracted.items.length ? extracted.items : [{ description: 'Migrated Bill', qty: 1, price: 0, tax_rate: 18 }],
          });
          importedCount++;
        } catch (e) {
          if (e.message.includes('already exists')) {
            console.warn('Skipping duplicate invoice:', extracted.invoice_no);
          } else {
            throw e;
          }
        }
      }
    })();

    res.status(201).json({ message: `Successfully imported ${importedCount} invoices` });
  } catch (err) {
    console.error('[BULK IMPORT ERROR]:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
