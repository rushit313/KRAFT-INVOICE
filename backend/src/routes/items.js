const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { type, search } = req.query;
  let query = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  if (type) { query += ' AND type = ?'; params.push(type); }
  if (search) {
    query += ' AND (name LIKE ? OR hsn LIKE ? OR sac LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  query += ' ORDER BY name';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.post('/', (req, res) => {
  const { name, type, description, hsn, sac, unit, sale_price, purchase_price, tax_rate, current_stock } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare(`INSERT INTO items (name, type, description, hsn, sac, unit, sale_price, purchase_price, tax_rate, current_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, type || 'service', description, hsn, sac, unit || 'Nos', sale_price || 0, purchase_price || 0, tax_rate || 18, current_stock || 0);
  res.status(201).json(db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const fields = ['name','type','description','hsn','sac','unit','sale_price','purchase_price','tax_rate','current_stock'];
  const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f} = ?`);
  const values = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

router.post('/bulk', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Array of items required' });

  const insert = db.prepare(`INSERT INTO items (name, type, description, hsn, sac, unit, sale_price, purchase_price, tax_rate, current_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const runBulk = db.transaction((data) => {
    for (const item of data) {
      insert.run(
        item.name, 
        item.type || 'service', 
        item.description || '', 
        item.hsn || '', 
        item.sac || '', 
        item.unit || 'Nos', 
        item.sale_price || 0, 
        item.purchase_price || 0, 
        item.tax_rate || 18, 
        item.current_stock || 0
      );
    }
  });

  try {
    runBulk(items);
    res.json({ message: `Successfully imported ${items.length} items` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/', (req, res) => {
  db.prepare('DELETE FROM items').run();
  res.json({ message: 'All items deleted' });
});

module.exports = router;
