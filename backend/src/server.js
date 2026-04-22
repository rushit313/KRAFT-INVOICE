require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
app.set('db', db);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploads statically
const uploadsPath = path.resolve(__dirname, '..', (process.env.UPLOADS_PATH || './uploads').replace('./', ''));
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// Routes
app.use('/api/company', require('./routes/company'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/items', require('./routes/items'));
const invoiceExtract = require('./routes/invoiceExtract');
app.use('/api/invoices', invoiceExtract);
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/gst', require('./routes/gst'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/payments', require('./routes/payments'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Kraft Invoicing' }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'Operational', 
    name: 'Kraft Invoicing API', 
    version: '1.2.0',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Kraft Invoicing API running on http://localhost:${PORT}`);
});
