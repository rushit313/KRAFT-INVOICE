const express = require('express');
const router = express.Router();
const db = require('../db');

// Invoice-wise tax summary CSV
router.get('/invoice-tax', (req, res) => {
  const { from, to } = req.query;
  let query = `SELECT i.invoice_no, i.issue_date, c.company_name as client_name, c.gstin as client_gstin, i.place_of_supply, i.supply_type, i.subtotal, i.total_cgst, i.total_sgst, i.total_igst, i.total, i.status
    FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.status != 'draft'`;
  const params = [];
  if (from) { query += ' AND i.issue_date >= ?'; params.push(from); }
  if (to) { query += ' AND i.issue_date <= ?'; params.push(to); }
  query += ' ORDER BY i.issue_date';
  const rows = db.prepare(query).all(...params);
  const headers = ['Invoice No','Date','Client','Client GSTIN','Place of Supply','Supply Type','Taxable Value','CGST','SGST','IGST','Total','Status'];
  const csv = [headers.join(','), ...rows.map(r => [
    r.invoice_no, r.issue_date, `"${r.client_name || ''}"`, r.client_gstin || '', `"${r.place_of_supply || ''}"`,
    r.supply_type, r.subtotal, r.total_cgst, r.total_sgst, r.total_igst, r.total, r.status
  ].join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="invoice-tax-report.csv"');
  res.send(csv);
});

// Client-wise outstanding (JSON)
router.get('/client-outstanding', (req, res) => {
  const rows = db.prepare(`SELECT c.id, c.company_name, c.gstin, c.phone, c.email,
    COUNT(i.id) as invoice_count,
    COALESCE(SUM(i.total),0) as total_invoiced,
    COALESCE(SUM(COALESCE(p.paid,0)),0) as total_paid,
    COALESCE(SUM(i.total - COALESCE(p.paid,0)),0) as outstanding
    FROM clients c
    LEFT JOIN invoices i ON i.client_id = c.id AND i.status IN ('unpaid','partial','overdue')
    LEFT JOIN (SELECT invoice_id, SUM(amount) as paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id
    GROUP BY c.id ORDER BY outstanding DESC`).all();
  res.json(rows);
});

// Sales by item/product
router.get('/sales-by-item', (req, res) => {
  const { from, to } = req.query;
  let query = `SELECT ii.description, ii.hsn_sac, ii.unit,
    SUM(ii.qty) as total_qty,
    SUM(ii.taxable_value) as total_taxable,
    SUM(ii.cgst_amt) as total_cgst,
    SUM(ii.sgst_amt) as total_sgst,
    SUM(ii.igst_amt) as total_igst,
    SUM(ii.amount) as total_amount,
    COUNT(DISTINCT ii.invoice_id) as invoice_count
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.status != 'draft'`;
  const params = [];
  if (from) { query += ' AND i.issue_date >= ?'; params.push(from); }
  if (to) { query += ' AND i.issue_date <= ?'; params.push(to); }
  query += ' GROUP BY ii.description, ii.hsn_sac ORDER BY total_amount DESC';
  res.json(db.prepare(query).all(...params));
});

// Sales by client
router.get('/sales-by-client', (req, res) => {
  const { from, to } = req.query;
  let query = `SELECT c.id, c.company_name, c.gstin, c.state,
    COUNT(i.id) as invoice_count,
    SUM(i.subtotal) as total_taxable,
    SUM(i.total_cgst) as total_cgst,
    SUM(i.total_sgst) as total_sgst,
    SUM(i.total_igst) as total_igst,
    SUM(i.total) as total_amount,
    COALESCE(SUM(p.paid),0) as total_paid,
    SUM(i.total) - COALESCE(SUM(p.paid),0) as outstanding
    FROM clients c
    JOIN invoices i ON i.client_id = c.id
    LEFT JOIN (SELECT invoice_id, SUM(amount) as paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id
    WHERE i.status != 'draft'`;
  const params = [];
  if (from) { query += ' AND i.issue_date >= ?'; params.push(from); }
  if (to) { query += ' AND i.issue_date <= ?'; params.push(to); }
  query += ' GROUP BY c.id ORDER BY total_amount DESC';
  res.json(db.prepare(query).all(...params));
});

// GSTR1 data
router.get('/gstr1', (req, res) => {
  const { from, to, format } = req.query;
  let query = `SELECT i.invoice_no, i.issue_date, i.place_of_supply, i.supply_type,
    c.company_name as receiver_name, c.gstin as receiver_gstin, c.billing_address as receiver_address,
    c.state as receiver_state,
    i.subtotal as taxable_value, i.total_cgst, i.total_sgst, i.total_igst, i.total,
    ii.description, ii.hsn_sac, ii.qty, ii.unit, ii.price, ii.taxable_value as line_taxable,
    ii.cgst_pct, ii.cgst_amt, ii.sgst_pct, ii.sgst_amt, ii.igst_pct, ii.igst_amt, ii.amount as line_amount
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.status != 'draft'`;
  const params = [];
  if (from) { query += ' AND i.issue_date >= ?'; params.push(from); }
  if (to) { query += ' AND i.issue_date <= ?'; params.push(to); }
  query += ' ORDER BY i.issue_date, i.id';
  const rows = db.prepare(query).all(...params);

  if (format === 'json') {
    // Group by invoice for JSON format
    const invoiceMap = {};
    for (const row of rows) {
      if (!invoiceMap[row.invoice_no]) {
        invoiceMap[row.invoice_no] = {
          invoice_no: row.invoice_no,
          issue_date: row.issue_date,
          place_of_supply: row.place_of_supply,
          supply_type: row.supply_type,
          receiver_name: row.receiver_name,
          receiver_gstin: row.receiver_gstin,
          taxable_value: row.taxable_value,
          cgst: row.total_cgst,
          sgst: row.total_sgst,
          igst: row.total_igst,
          total: row.total,
          items: []
        };
      }
      if (row.description) {
        invoiceMap[row.invoice_no].items.push({
          description: row.description,
          hsn_sac: row.hsn_sac,
          qty: row.qty,
          unit: row.unit,
          price: row.price,
          taxable_value: row.line_taxable,
          cgst_pct: row.cgst_pct, cgst_amt: row.cgst_amt,
          sgst_pct: row.sgst_pct, sgst_amt: row.sgst_amt,
          igst_pct: row.igst_pct, igst_amt: row.igst_amt,
          amount: row.line_amount
        });
      }
    }
    res.setHeader('Content-Disposition', `attachment; filename="GSTR1-${from}-${to}.json"`);
    res.json(Object.values(invoiceMap));
    return;
  }

  // CSV format (B2B summary)
  const headers = ['Invoice No','Invoice Date','Place of Supply','Supply Type','Receiver Name','Receiver GSTIN','Taxable Value','CGST','SGST','IGST','Invoice Total'];
  const seen = new Set();
  const csvRows = rows.filter(r => { const k = r.invoice_no; if (seen.has(k)) return false; seen.add(k); return true; }).map(r => [
    r.invoice_no, r.issue_date, `"${r.place_of_supply || ''}"`, r.supply_type,
    `"${r.receiver_name || ''}"`, r.receiver_gstin || '',
    r.taxable_value, r.total_cgst, r.total_sgst, r.total_igst, r.total
  ].join(','));
  const csv = [headers.join(','), ...csvRows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="GSTR1-${from || 'all'}-${to || 'all'}.csv"`);
  res.send(csv);
});

// Vendor outstanding / aging report
router.get('/vendor-outstanding', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare(`SELECT pb.id, pb.bill_no, pb.vendor_name, pb.vendor_gstin,
    pb.issue_date, pb.due_date, pb.total,
    v.id as vendor_id,
    julianday(?) - julianday(COALESCE(pb.due_date, pb.issue_date)) as overdue_days
    FROM purchase_bills pb
    LEFT JOIN vendors v ON v.id = pb.vendor_id
    WHERE pb.status IN ('unpaid','partial')
    ORDER BY pb.vendor_name, pb.issue_date`).all(today);

  // Group by vendor
  const vendorMap = {};
  for (const row of rows) {
    const key = row.vendor_name;
    if (!vendorMap[key]) {
      vendorMap[key] = {
        vendor_name: row.vendor_name,
        vendor_gstin: row.vendor_gstin,
        vendor_id: row.vendor_id,
        bills: [],
        total_pending: 0
      };
    }
    vendorMap[key].bills.push(row);
    vendorMap[key].total_pending += row.total || 0;
  }
  res.json(Object.values(vendorMap));
});

// Client aging (invoice-wise pending with overdue days)
router.get('/client-aging', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare(`SELECT i.id, i.invoice_no, i.issue_date, i.due_date, i.total,
    c.company_name as client_name, c.gstin as client_gstin, c.id as client_id,
    COALESCE(p.paid,0) as paid_amount,
    i.total - COALESCE(p.paid,0) as pending_amount,
    julianday(?) - julianday(COALESCE(i.due_date, i.issue_date)) as overdue_days
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    LEFT JOIN (SELECT invoice_id, SUM(amount) as paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id
    WHERE i.status IN ('unpaid','partial')
    ORDER BY c.company_name, i.issue_date`).all(today);

  const clientMap = {};
  for (const row of rows) {
    const key = row.client_name || 'Unknown';
    if (!clientMap[key]) {
      clientMap[key] = { client_name: row.client_name, client_gstin: row.client_gstin, client_id: row.client_id, invoices: [], total_pending: 0 };
    }
    clientMap[key].invoices.push(row);
    clientMap[key].total_pending += row.pending_amount || 0;
  }
  res.json(Object.values(clientMap));
});

module.exports = router;
