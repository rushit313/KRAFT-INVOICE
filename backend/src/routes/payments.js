const express = require('express');
const router = express.Router();
const db = require('../db');

// GET unpaid invoices for a client
router.get('/unpaid', (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.json([]);
  const invoices = db.prepare(`
    SELECT i.id, i.invoice_no, i.issue_date, i.total,
           i.total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as balance_due
    FROM invoices i
    WHERE i.client_id = ? AND i.status IN ('unpaid', 'partial')
    ORDER BY i.issue_date ASC
  `).all(client_id);
  res.json(invoices);
});

// GET all payments across all invoices
router.get('/', (req, res) => {
  const { method, client_id, date_from, date_to, search } = req.query;
  let query = `
    SELECT p.*, i.invoice_no, i.client_id, c.company_name as client_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    LEFT JOIN clients c ON c.id = i.client_id
    WHERE 1=1
  `;
  const params = [];
  if (method) { query += ' AND p.method = ?'; params.push(method); }
  if (client_id) { query += ' AND i.client_id = ?'; params.push(client_id); }
  if (date_from) { query += ' AND p.payment_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND p.payment_date <= ?'; params.push(date_to); }
  if (search) {
    query += ' AND (i.invoice_no LIKE ? OR c.company_name LIKE ? OR p.reference_no LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  query += ' ORDER BY p.payment_date DESC, p.id DESC';
  res.json(db.prepare(query).all(...params));
});

// GET payment totals summary
router.get('/summary', (req, res) => {
  const { date_from, date_to } = req.query;
  let query = `SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM payments WHERE 1=1`;
  const params = [];
  if (date_from) { query += ' AND payment_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND payment_date <= ?'; params.push(date_to); }
  res.json(db.prepare(query).get(...params));
});

// POST record multiple payments
router.post('/', (req, res) => {
  const { allocations } = req.body;
  if (!allocations || !allocations.length) return res.status(400).json({ error: 'No allocations provided' });

  const insert = db.prepare(`INSERT INTO payments (invoice_id, payment_date, amount, method, reference_no, notes) VALUES (?, ?, ?, ?, ?, ?)`);
  
  db.transaction(() => {
    for (const alloc of allocations) {
      if (alloc.amount > 0) {
        insert.run(alloc.invoice_id, alloc.payment_date, alloc.amount, alloc.method || 'cash', alloc.reference_no, alloc.notes);
      }
    }
  })();

  // Update statuses
  for (const alloc of allocations) {
    if (alloc.amount > 0) {
      const invoice = db.prepare('SELECT total FROM invoices WHERE id = ?').get(alloc.invoice_id);
      if (!invoice) continue;
      const paid = db.prepare('SELECT COALESCE(SUM(amount),0) as total_paid FROM payments WHERE invoice_id = ?').get(alloc.invoice_id);
      const totalPaid = paid.total_paid || 0;
      let status = 'unpaid';
      if (totalPaid >= invoice.total) status = 'paid';
      else if (totalPaid > 0) status = 'partial';
      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, alloc.invoice_id);
    }
  }

  res.status(201).json({ message: 'Payments recorded' });
});

module.exports = router;
