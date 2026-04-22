require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './db/kraft.db';
const resolvedPath = path.resolve(__dirname, '..', dbPath.replace('./', ''));

console.log('Seeding database at:', resolvedPath);

const db = new Database(resolvedPath);

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Clear existing data
db.exec(`
  DELETE FROM purchase_bill_items;
  DELETE FROM purchase_bills;
  DELETE FROM payments;
  DELETE FROM invoice_items;
  DELETE FROM invoices;
  DELETE FROM items;
  DELETE FROM vendors;
  DELETE FROM clients;
  DELETE FROM company_profile;
`);

// Seed company
db.prepare(`INSERT INTO company_profile (id, name, address, city, state, pin, phone, email, gstin, pan, bank_name, account_no, ifsc, branch, financial_year_start, terms_default)
  VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'Kraft Enterprises',
  '101, Business Hub, Andheri East',
  'Mumbai',
  'Maharashtra',
  '400069',
  '9876543210',
  'billing@kraftenterprises.in',
  '27AABCK1234M1Z5',
  'AABCK1234M',
  'HDFC Bank',
  '50100123456789',
  'HDFC0001234',
  'Andheri East Branch',
  '04',
  'Payment due within 30 days. Late payment charges of 1.5% per month apply.'
);

// Seed clients
const insertClient = db.prepare(`INSERT INTO clients (company_name, contact_person, phone, email, gstin, pan, gst_treatment, billing_address, city, state, pin)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const mehta = insertClient.run('Mehta Traders', 'Rajesh Mehta', '9823001122', 'rajesh@mehtatraders.com', '27AAQPM5678N1ZB', 'AAQPM5678N', 'regular', '45, Marine Lines, Fort', 'Mumbai', 'Maharashtra', '400001');
const zenith = insertClient.run('Zenith Corp', 'Priya Sharma', '9988776655', 'priya@zenithcorp.in', '29AAFCZ4321K1ZD', 'AAFCZ4321K', 'regular', '12, MG Road, Indiranagar', 'Bengaluru', 'Karnataka', '560038');
const ray = insertClient.run('Ray Industries', 'Sunil Ray', '9765432100', 'sunil@rayindustries.in', '27AARPR9876L1ZF', 'AARPR9876L', 'regular', '78, MIDC, Thane West', 'Thane', 'Maharashtra', '400601');

// Seed vendors
const insertVendor = db.prepare(`INSERT INTO vendors (company_name, contact_person, phone, email, gstin, billing_address, city, state, pin)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const shreya = insertVendor.run('Shreya Supplies', 'Shreya Patel', '9112233445', 'shreya@shreyasupplies.com', '27AAHPS3456T1ZG', '22, Dharavi Industrial Area', 'Mumbai', 'Maharashtra', '400017');
const gupta = insertVendor.run('Gupta Wholesale', 'Amit Gupta', '9009009001', 'amit@guptawholesale.com', '27AADPG7890R1ZH', '15, Bhiwandi Warehouse Complex', 'Thane', 'Maharashtra', '421302');

// Seed items
const insertItem = db.prepare(`INSERT INTO items (name, type, description, hsn, sac, unit, sale_price, purchase_price, tax_rate, current_stock)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const webDev = insertItem.run('Web Development', 'service', 'Custom website and web application development', null, '998314', 'Hours', 2500, 0, 18, 0);
const domain = insertItem.run('Domain Registration', 'service', 'Annual domain name registration (.com/.in)', null, '998431', 'Nos', 1200, 800, 18, 0);
const ssl = insertItem.run('SSL Certificate', 'product', 'Wildcard SSL Certificate (1 Year)', '85238090', null, 'Nos', 4500, 3000, 12, 25);
const maintenance = insertItem.run('Annual Maintenance', 'service', 'Website annual maintenance contract', null, '998319', 'Nos', 18000, 0, 18, 0);
const laptop = insertItem.run('Laptop', 'product', 'Business Laptop - Core i7, 16GB RAM, 512GB SSD', '84713010', null, 'Nos', 85000, 72000, 18, 10);

// Helper functions
function round2(n) { return Math.round(n * 100) / 100; }

function calcInvoice(items, supplyType) {
  let subtotal = 0, total_cgst = 0, total_sgst = 0, total_igst = 0;
  const lineItems = items.map(item => {
    const taxable_value = round2(item.qty * item.price * (1 - (item.discount_pct || 0) / 100));
    const half = item.tax_rate / 2;
    let cgst_pct = 0, cgst_amt = 0, sgst_pct = 0, sgst_amt = 0, igst_pct = 0, igst_amt = 0;
    if (supplyType === 'intra') {
      cgst_pct = half; cgst_amt = round2(taxable_value * half / 100);
      sgst_pct = half; sgst_amt = round2(taxable_value * half / 100);
    } else {
      igst_pct = item.tax_rate; igst_amt = round2(taxable_value * item.tax_rate / 100);
    }
    const amount = round2(taxable_value + cgst_amt + sgst_amt + igst_amt);
    subtotal += taxable_value;
    total_cgst += cgst_amt; total_sgst += sgst_amt; total_igst += igst_amt;
    return { ...item, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount };
  });
  const unrounded_total = round2(subtotal + total_cgst + total_sgst + total_igst);
  const total = Math.round(unrounded_total);
  const rounded_off = round2(total - unrounded_total);
  return { lineItems, subtotal: round2(subtotal), total_cgst: round2(total_cgst), total_sgst: round2(total_sgst), total_igst: round2(total_igst), rounded_off, total };
}

// Invoice 1 - Mehta Traders (intra-state)
const inv1Items = [
  { item_id: webDev.lastInsertRowid, description: 'Web Development - E-commerce Portal', hsn_sac: '998314', qty: 40, unit: 'Hours', price: 2500, discount_pct: 0, tax_rate: 18 },
  { item_id: domain.lastInsertRowid, description: 'Domain Registration - mehtaTraders.com', hsn_sac: '998431', qty: 1, unit: 'Nos', price: 1200, discount_pct: 0, tax_rate: 18 },
  { item_id: ssl.lastInsertRowid, description: 'SSL Certificate (Wildcard, 1 Year)', hsn_sac: '85238090', qty: 1, unit: 'Nos', price: 4500, discount_pct: 0, tax_rate: 12 }
];
const inv1Calc = calcInvoice(inv1Items, 'intra');
const inv1 = db.prepare(`INSERT INTO invoices (invoice_no, issue_date, due_date, client_id, place_of_supply, supply_type, subtotal, total_cgst, total_sgst, total_igst, rounded_off, total, status, terms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'KE/2025-26/001', '2025-04-10', '2025-05-10', mehta.lastInsertRowid,
  'Maharashtra', 'intra', inv1Calc.subtotal, inv1Calc.total_cgst, inv1Calc.total_sgst, inv1Calc.total_igst, inv1Calc.rounded_off, inv1Calc.total,
  'paid', 'Payment due within 30 days.'
);
const insertInvItem = db.prepare(`INSERT INTO invoice_items (invoice_id, item_id, description, hsn_sac, qty, unit, price, discount_pct, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const li of inv1Calc.lineItems) {
  insertInvItem.run(inv1.lastInsertRowid, li.item_id, li.description, li.hsn_sac, li.qty, li.unit, li.price, li.discount_pct, li.taxable_value, li.cgst_pct, li.cgst_amt, li.sgst_pct, li.sgst_amt, li.igst_pct, li.igst_amt, li.amount);
}
// Payment for invoice 1
db.prepare(`INSERT INTO payments (invoice_id, payment_date, amount, method, reference_no) VALUES (?, ?, ?, ?, ?)`).run(inv1.lastInsertRowid, '2025-04-28', inv1Calc.total, 'NEFT', 'HDFC000123456');

// Invoice 2 - Zenith Corp (inter-state)
const inv2Items = [
  { item_id: maintenance.lastInsertRowid, description: 'Annual Website Maintenance Contract 2025-26', hsn_sac: '998319', qty: 1, unit: 'Nos', price: 18000, discount_pct: 5, tax_rate: 18 },
  { item_id: ssl.lastInsertRowid, description: 'SSL Certificate (Standard, 1 Year)', hsn_sac: '85238090', qty: 2, unit: 'Nos', price: 4500, discount_pct: 0, tax_rate: 12 }
];
const inv2Calc = calcInvoice(inv2Items, 'inter');
const inv2 = db.prepare(`INSERT INTO invoices (invoice_no, issue_date, due_date, client_id, place_of_supply, supply_type, subtotal, total_cgst, total_sgst, total_igst, rounded_off, total, status, terms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'KE/2025-26/002', '2025-04-22', '2025-05-22', zenith.lastInsertRowid,
  'Karnataka', 'inter', inv2Calc.subtotal, inv2Calc.total_cgst, inv2Calc.total_sgst, inv2Calc.total_igst, inv2Calc.rounded_off, inv2Calc.total,
  'partial', 'Payment due within 30 days.'
);
for (const li of inv2Calc.lineItems) {
  insertInvItem.run(inv2.lastInsertRowid, li.item_id, li.description, li.hsn_sac, li.qty, li.unit, li.price, li.discount_pct, li.taxable_value, li.cgst_pct, li.cgst_amt, li.sgst_pct, li.sgst_amt, li.igst_pct, li.igst_amt, li.amount);
}
// Partial payment for invoice 2
db.prepare(`INSERT INTO payments (invoice_id, payment_date, amount, method, reference_no) VALUES (?, ?, ?, ?, ?)`).run(inv2.lastInsertRowid, '2025-05-01', 15000, 'UPI', 'UPI12345678');

// Invoice 3 - Ray Industries (intra-state)
const inv3Items = [
  { item_id: laptop.lastInsertRowid, description: 'Business Laptop - Core i7 16GB 512GB', hsn_sac: '84713010', qty: 2, unit: 'Nos', price: 85000, discount_pct: 0, tax_rate: 18 },
  { item_id: maintenance.lastInsertRowid, description: 'Setup & Configuration Charges', hsn_sac: '998319', qty: 1, unit: 'Nos', price: 5000, discount_pct: 0, tax_rate: 18 }
];
const inv3Calc = calcInvoice(inv3Items, 'intra');
const inv3 = db.prepare(`INSERT INTO invoices (invoice_no, issue_date, due_date, client_id, place_of_supply, supply_type, subtotal, total_cgst, total_sgst, total_igst, rounded_off, total, status, terms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'KE/2025-26/003', '2025-05-05', '2025-06-05', ray.lastInsertRowid,
  'Maharashtra', 'intra', inv3Calc.subtotal, inv3Calc.total_cgst, inv3Calc.total_sgst, inv3Calc.total_igst, inv3Calc.rounded_off, inv3Calc.total,
  'unpaid', 'Payment due within 30 days.'
);
for (const li of inv3Calc.lineItems) {
  insertInvItem.run(inv3.lastInsertRowid, li.item_id, li.description, li.hsn_sac, li.qty, li.unit, li.price, li.discount_pct, li.taxable_value, li.cgst_pct, li.cgst_amt, li.sgst_pct, li.sgst_amt, li.igst_pct, li.igst_amt, li.amount);
}

// Purchase Bills
const insertPB = db.prepare(`INSERT INTO purchase_bills (bill_no, vendor_id, vendor_name, vendor_gstin, issue_date, due_date, subtotal, total_cgst, total_sgst, total_igst, total, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertPBI = db.prepare(`INSERT INTO purchase_bill_items (purchase_bill_id, description, hsn_sac, qty, unit, price, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

// PB1 - Shreya Supplies
const pb1 = insertPB.run('SS/2025/0421', shreya.lastInsertRowid, 'Shreya Supplies', '27AAHPS3456T1ZG', '2025-04-15', '2025-05-15', 50000, 4500, 4500, 0, 59000, 'paid');
insertPBI.run(pb1.lastInsertRowid, 'Office Supplies - Q1 2025', null, 1, 'Lot', 50000, 50000, 9, 4500, 9, 4500, 0, 0, 59000);

// PB2 - Gupta Wholesale
const pb2 = insertPB.run('GW/2025/189', gupta.lastInsertRowid, 'Gupta Wholesale', '27AADPG7890R1ZH', '2025-04-28', '2025-05-28', 144000, 12960, 12960, 0, 169920, 'unpaid');
insertPBI.run(pb2.lastInsertRowid, 'Laptop - Core i7 16GB 512GB', '84713010', 2, 'Nos', 72000, 144000, 9, 12960, 9, 12960, 0, 0, 169920);

db.close();
console.log('✅ Seed complete!');
console.log('Company: Kraft Enterprises (27AABCK1234M1Z5)');
console.log('Clients: Mehta Traders, Zenith Corp, Ray Industries');
console.log('Vendors: Shreya Supplies, Gupta Wholesale');
console.log('Items: 5 items seeded');
console.log('Invoices: KE/2025-26/001 (paid), KE/2025-26/002 (partial), KE/2025-26/003 (unpaid)');
console.log('Purchase Bills: 2 bills seeded');
