const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM vendors';
  const params = [];
  if (search) {
    query += ` WHERE company_name LIKE ? OR contact_person LIKE ? OR gstin LIKE ?`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  query += ' ORDER BY company_name';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  res.json(vendor);
});

router.post('/', (req, res) => {
  const { company_name, contact_person, phone, email, gstin, pan, billing_address, city, state, pin } = req.body;
  if (!company_name) return res.status(400).json({ error: 'company_name is required' });
  const result = db.prepare(`INSERT INTO vendors (company_name, contact_person, phone, email, gstin, pan, billing_address, city, state, pin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(company_name, contact_person, phone, email, gstin, pan, billing_address, city, state, pin);
  res.status(201).json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/bulk', (req, res) => {
  const vendors = req.body.vendors || [];
  if (!Array.isArray(vendors) || vendors.length === 0) return res.status(400).json({ error: 'vendors array is required' });

  const insert = db.prepare(`INSERT INTO vendors (company_name, contact_person, phone, email, gstin, pan, billing_address, city, state, pin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let count = 0;
  const transaction = db.transaction((vl) => {
    for (const v of vl) {
      if (!v.company_name) continue;
      insert.run(v.company_name, v.contact_person, v.phone, v.email, v.gstin, v.pan, v.billing_address, v.city, v.state, v.pin);
      count++;
    }
  });

  transaction(vendors);
  res.status(201).json({ message: `Successfully imported ${count} vendors` });
});

router.put('/:id', (req, res) => {
  const fields = ['company_name','contact_person','phone','email','gstin','pan','billing_address','city','state','pin'];
  const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f} = ?`);
  const values = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE vendors SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  res.json(vendor);
});

router.delete('/:id', (req, res) => {
  const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  // Detach vendor from purchase bills to satisfy foreign key constraints
  const transaction = db.transaction(() => {
    db.prepare('UPDATE purchase_bills SET vendor_id = NULL WHERE vendor_id = ?').run(req.params.id);
    db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  });

  transaction();
  res.json({ message: 'Deleted' });
});

module.exports = router;
