const db = require('./backend/src/db.js');
const items = db.prepare('SELECT * FROM invoice_items ORDER BY id DESC LIMIT 5').all();
console.log(items);
