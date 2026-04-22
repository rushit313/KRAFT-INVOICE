PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS company_profile (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT '',
  logo_path TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pin TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  pan TEXT,
  bank_name TEXT,
  account_no TEXT,
  ifsc TEXT,
  branch TEXT,
  signature_path TEXT,
  financial_year_start TEXT DEFAULT '04',
  terms_default TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  pan TEXT,
  gst_treatment TEXT DEFAULT 'regular',
  billing_address TEXT,
  shipping_address TEXT,
  city TEXT,
  state TEXT,
  pin TEXT,
  opening_balance REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  pan TEXT,
  billing_address TEXT,
  city TEXT,
  state TEXT,
  pin TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'service',
  description TEXT,
  hsn TEXT,
  sac TEXT,
  unit TEXT DEFAULT 'Nos',
  sale_price REAL DEFAULT 0,
  purchase_price REAL DEFAULT 0,
  tax_rate REAL DEFAULT 18,
  current_stock REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  po_number TEXT,
  client_id INTEGER REFERENCES clients(id),
  place_of_supply TEXT,
  supply_type TEXT DEFAULT 'intra',
  subtotal REAL DEFAULT 0,
  total_cgst REAL DEFAULT 0,
  total_sgst REAL DEFAULT 0,
  total_igst REAL DEFAULT 0,
  rounded_off REAL DEFAULT 0,
  total REAL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  terms TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id),
  description TEXT,
  hsn_sac TEXT,
  qty REAL DEFAULT 1,
  unit TEXT DEFAULT 'Nos',
  price REAL DEFAULT 0,
  discount_pct REAL DEFAULT 0,
  taxable_value REAL DEFAULT 0,
  cgst_pct REAL DEFAULT 0,
  cgst_amt REAL DEFAULT 0,
  sgst_pct REAL DEFAULT 0,
  sgst_amt REAL DEFAULT 0,
  igst_pct REAL DEFAULT 0,
  igst_amt REAL DEFAULT 0,
  amount REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'NEFT',
  reference_no TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_no TEXT,
  vendor_id INTEGER REFERENCES vendors(id),
  vendor_name TEXT,
  vendor_gstin TEXT,
  issue_date TEXT,
  due_date TEXT,
  subtotal REAL DEFAULT 0,
  total_cgst REAL DEFAULT 0,
  total_sgst REAL DEFAULT 0,
  total_igst REAL DEFAULT 0,
  total REAL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  pdf_path TEXT,
  raw_extracted_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_bill_id INTEGER NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  description TEXT,
  hsn_sac TEXT,
  qty REAL DEFAULT 1,
  unit TEXT DEFAULT 'Nos',
  price REAL DEFAULT 0,
  taxable_value REAL DEFAULT 0,
  cgst_pct REAL DEFAULT 0,
  cgst_amt REAL DEFAULT 0,
  sgst_pct REAL DEFAULT 0,
  sgst_amt REAL DEFAULT 0,
  igst_pct REAL DEFAULT 0,
  igst_amt REAL DEFAULT 0,
  amount REAL DEFAULT 0
);
