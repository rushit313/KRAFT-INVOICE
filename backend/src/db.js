require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './db/kraft.db';
// __dirname is backend/src, go up one level to backend/ then resolve db path
const resolvedPath = path.resolve(__dirname, '..', dbPath.replace('./', ''));

// Ensure db directory exists
const dbDir = path.dirname(resolvedPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(resolvedPath);

// Apply schema if not already done
const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');

db.exec(schema);

// Ensure company row exists
const co = db.prepare('SELECT id FROM company_profile WHERE id = 1').get();
if (!co) {
  db.prepare(`INSERT INTO company_profile (id, name) VALUES (1, 'My Company')`).run();
}

module.exports = db;
