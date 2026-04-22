# Kraft Invoicing — Migration Fix

## Files & Where They Go

| File | Destination in your project |
|------|------------------------------|
| `extractionEngine.js` | `backend/src/utils/extractionEngine.js` |
| `invoiceExtract.js` | `backend/src/routes/invoiceExtract.js` |
| `VisualInvoice.jsx` | `frontend/src/components/VisualInvoice.jsx` |
| `MigrateDatabase.jsx` | `frontend/src/pages/MigrateDatabase.jsx` |

## Wire up the backend route

In `backend/src/server.js`, add:

```js
const invoiceExtract = require('./routes/invoiceExtract');
app.use('/api/invoices', invoiceExtract);
// Make sure db is accessible via req.app.get('db'):
app.set('db', db);
```

## Fix Summary

### A — Invoice Number Regex
Old broad regex matched decimal amounts like `1500.00` as invoice numbers.
New regex: constrained to alphanumeric+dash+slash, rejects decimals and
blacklisted keywords, has a secondary scan near "TAX INVOICE" header.

### B — Fuzzy Item Matching
Old: exact token overlap failed on "Web Dev" vs "Web Development".
New: `itemMatchScore()` uses exact → substring containment → token overlap
with partial-prefix scoring. Threshold 40/100 before accepting a match.

### C — ₹ Duplication (₹₹1,000)
Root cause: some components called `₹${formatINR(x)}` where formatINR
already returns "₹1,000.00". 
Fix: `formatINR()` is the single source of truth. VisualInvoice.jsx and
MigrateDatabase.jsx never prepend ₹ manually.

### D — Fallback Line Items
Old: immediately fell back to `[{ description: 'Migrated Service' }]`.
New: secondary scan checks if any master item name/SAC appears anywhere
in the raw text and finds an amount nearby. Only uses "Migrated Service"
as absolute last resort with a console.warn.

## Testing

Upload Bill No 375 (Rupa Renaissance Ltd) — you should see:
- Client: "✓ Matched: Rupa Renaissance Ltd"  
- Item 1: "Website Development" · ₹2,60,000 · CGST ₹23,400 · SGST ₹23,400
- Item 2: "Company Profile Designing" · ₹25,000 · CGST ₹2,250 · SGST ₹2,250
- Total: ₹3,36,300
