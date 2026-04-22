const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM clients';
  const params = [];
  if (search) {
    query += ` WHERE company_name LIKE ? OR contact_person LIKE ? OR gstin LIKE ? OR phone LIKE ?`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += ' ORDER BY company_name';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.post('/', (req, res) => {
  const { company_name, contact_person, phone, email, gstin, pan, gst_treatment, billing_address, shipping_address, city, state, pin, opening_balance } = req.body;
  if (!company_name) return res.status(400).json({ error: 'company_name is required' });
  const result = db.prepare(`INSERT INTO clients (company_name, contact_person, phone, email, gstin, pan, gst_treatment, billing_address, shipping_address, city, state, pin, opening_balance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(company_name, contact_person, phone, email, gstin, pan, gst_treatment || 'regular', billing_address, shipping_address, city, state, pin, opening_balance || 0);
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/bulk', (req, res) => {
  const clients = req.body.clients || [];
  if (!Array.isArray(clients) || clients.length === 0) return res.status(400).json({ error: 'clients array is required' });
  
  const insert = db.prepare(`INSERT INTO clients (company_name, contact_person, phone, email, gstin, pan, gst_treatment, billing_address, shipping_address, city, state, pin, opening_balance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  let count = 0;
  const transaction = db.transaction((cl) => {
    for (const c of cl) {
      if (!c.company_name) continue;
      insert.run(c.company_name, c.contact_person, c.phone, c.email, c.gstin, c.pan, c.gst_treatment || 'regular', c.billing_address, c.shipping_address, c.city, c.state, c.pin, c.opening_balance || 0);
      count++;
    }
  });

  transaction(clients);
  res.status(201).json({ message: `Successfully imported ${count} clients` });
});

router.put('/:id', (req, res) => {
  const fields = ['company_name','contact_person','phone','email','gstin','pan','gst_treatment','billing_address','shipping_address','city','state','pin','opening_balance'];
  const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f} = ?`);
  const values = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.delete('/:id', (req, res) => {
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // Cascade delete all invoices associated with this client to clear constraints
  const invoices = db.prepare('SELECT id FROM invoices WHERE client_id = ?').all(req.params.id);
  const transaction = db.transaction(() => {
    for (const inv of invoices) {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(inv.id);
      db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(inv.id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(inv.id);
    }
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  });
  
  transaction();
  res.json({ message: 'Deleted' });
});

router.delete('/', (req, res) => {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM clients').run();
  });
  transaction();
  res.json({ message: 'All clients and associated records deleted' });
});

router.get('/:id/invoices', (req, res) => {
  const invoices = db.prepare(`SELECT i.*, c.company_name as client_name FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.client_id = ? ORDER BY i.created_at DESC`).all(req.params.id);
  res.json(invoices);
});

module.exports = router;
