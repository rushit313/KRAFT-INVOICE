const puppeteer = require('puppeteer');

function formatINR(amount) {
  if (amount === null || amount === undefined) return '0.00';
  const n = parseFloat(amount);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function convertHundreds(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertHundreds(n % 100) : '');
  }
  const num = Math.round(amount);
  if (num === 0) return 'Zero Rupees Only';
  let words = '';
  if (num >= 10000000) words += convertHundreds(Math.floor(num / 10000000)) + ' Crore ';
  if (num % 10000000 >= 100000) words += convertHundreds(Math.floor((num % 10000000) / 100000)) + ' Lakh ';
  if (num % 100000 >= 1000) words += convertHundreds(Math.floor((num % 100000) / 1000)) + ' Thousand ';
  if (num % 1000 >= 100) words += convertHundreds(Math.floor((num % 1000) / 100)) + ' Hundred ';
  if (num % 100 > 0) words += convertHundreds(num % 100) + ' ';
  return 'Rupees ' + words.trim() + ' Only';
}

// ─── Template 1: Kraft IT Format (matches uploaded invoice style) ────────────
function templateModel1(invoice, company, options) {
  const isInter = invoice.supply_type === 'inter';
  const serverBase = 'http://localhost:3001';
  const logoUrl = company.logo_path ? `${serverBase}${company.logo_path}` : null;
  const themeColor = options.color || '#1a1a2e';
  const docLabel = options.label || 'Original Copy';
  const layout = options.layout || 'a4-portrait';
  const isA5 = layout.startsWith('a5');
  const isLandscape = layout.endsWith('landscape');
  const fs = isA5 ? '9px' : '11px';
  const w = isLandscape ? (isA5 ? '210mm' : '297mm') : (isA5 ? '148mm' : '210mm');
  const h = isLandscape ? (isA5 ? '148mm' : '210mm') : (isA5 ? '210mm' : '297mm');
  const pad = isA5 ? '8mm 10mm' : '12mm 14mm';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Helvetica Neue',Arial,sans-serif; font-size:${fs}; color:#1a1a1a; background:white; }
.page { width:${w}; min-height:${h}; padding:${pad}; background:white; }

.header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; border-bottom:3px solid ${themeColor}; margin-bottom:12px; }
.company-name { font-size:${isA5 ? '17px' : '22px'}; font-weight:800; color:${themeColor}; }
.company-sub { font-size:${isA5 ? '8px' : '9.5px'}; color:#555; line-height:1.6; margin-top:3px; }
.title-block { text-align:right; }
.title-block h2 { font-size:${isA5 ? '13px' : '16px'}; font-weight:800; letter-spacing:3px; color:#111; }
.title-block .inv-no { font-size:${isA5 ? '11px' : '13px'}; font-weight:700; color:${themeColor}; margin-top:3px; }
.title-block .copy-tag { display:inline-block; margin-top:4px; font-size:8px; background:${themeColor}; color:white; padding:2px 8px; border-radius:3px; text-transform:uppercase; letter-spacing:1px; }

.banner { background:${themeColor}; color:white; padding:${isA5 ? '8px 14px' : '10px 18px'}; margin:10px 0; border-radius:6px; display:flex; justify-content:space-between; align-items:center; }
.banner-amt { font-size:${isA5 ? '17px' : '22px'}; font-weight:800; }
.banner-lbl { font-size:7.5px; opacity:0.75; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px; }
.banner-status { background:rgba(255,255,255,0.15); padding:3px 10px; border-radius:10px; font-size:8px; text-transform:uppercase; letter-spacing:1.5px; }

.meta-row { display:flex; gap:8px; margin:10px 0; }
.meta-item { flex:1; border:1px solid #e8e8e8; border-radius:5px; padding:5px 9px; }
.meta-item .lbl { font-size:7.5px; color:#999; text-transform:uppercase; margin-bottom:1px; }
.meta-item .val { font-size:${isA5 ? '10px' : '11px'}; font-weight:600; }

.parties { display:flex; gap:12px; margin:10px 0; }
.party { flex:1; border-top:3px solid ${themeColor}; background:#fafafa; padding:8px 12px; }
.party-type { font-size:7.5px; color:${themeColor}; font-weight:700; text-transform:uppercase; margin-bottom:3px; }
.party-name { font-size:${isA5 ? '11px' : '13px'}; font-weight:700; }
.party-detail { font-size:${isA5 ? '8px' : '9.5px'}; color:#555; line-height:1.55; margin-top:2px; }

table { width:100%; border-collapse:collapse; margin:10px 0; }
thead tr { background:#f4f4f4; border-bottom:2px solid ${themeColor}; }
th { padding:7px 4px; font-size:8px; text-transform:uppercase; font-weight:700; color:#333; }
td { padding:7px 4px; font-size:${isA5 ? '8.5px' : '10px'}; border-bottom:1px solid #eee; word-break:break-word; }
.right { text-align:right; } .center { text-align:center; } .bold { font-weight:700; }

.totals-wrap { display:flex; justify-content:flex-end; margin-top:8px; }
.totals-tbl { width:220px; }
.totals-tbl td { padding:3px 6px; border:none; font-size:${isA5 ? '9px' : '10px'}; }
.total-final td { border-top:2px solid #111 !important; font-weight:800 !important; font-size:${isA5 ? '11px' : '13px'} !important; padding-top:6px !important; }

.words { margin-top:8px; font-size:${isA5 ? '8px' : '9px'}; }
.words b { color:#333; }

.footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top:20px; border-top:1px solid #e5e5e5; padding-top:12px; }
.bank-det { font-size:${isA5 ? '7.5px' : '9px'}; color:#555; line-height:1.7; }
.sig { text-align:right; font-size:${isA5 ? '8px' : '9px'}; }
.sig-space { height:35px; }
.logo { max-height:40px; max-width:130px; }
</style></head><body><div class="page">

<div class="header">
  <div>
    ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo"><br>` : ''}
    <div class="company-name">${company.name || ''}</div>
    <div class="company-sub">
      ${[company.address, company.city && company.state ? `${company.city}, ${company.state} - ${company.pin || ''}` : '', company.gstin ? `GSTIN: ${company.gstin}` : '', company.phone ? `Ph: ${company.phone}` : ''].filter(Boolean).join('<br>')}
    </div>
  </div>
  <div class="title-block">
    <h2>TAX INVOICE</h2>
    <div class="inv-no">${invoice.invoice_no}</div>
    <div class="copy-tag">${docLabel}</div>
  </div>
</div>

<div class="banner">
  <div>
    <div class="banner-lbl">Invoice Total</div>
    <div class="banner-amt">₹${formatINR(invoice.total)}</div>
  </div>
  <div class="banner-status">${(invoice.status || 'Unpaid').toUpperCase()}</div>
</div>

<div class="meta-row">
  <div class="meta-item"><div class="lbl">Invoice Date</div><div class="val">${invoice.issue_date}</div></div>
  ${invoice.due_date ? `<div class="meta-item"><div class="lbl">Due Date</div><div class="val">${invoice.due_date}</div></div>` : ''}
  <div class="meta-item"><div class="lbl">Place of Supply</div><div class="val">${invoice.place_of_supply || '—'}</div></div>
  <div class="meta-item"><div class="lbl">Supply Type</div><div class="val">${isInter ? 'Inter-State' : 'Intra-State'}</div></div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-type">Bill To</div>
    <div class="party-name">${invoice.client_name}</div>
    <div class="party-detail">${[invoice.client_billing_address, invoice.client_city && invoice.client_state ? `${invoice.client_city}, ${invoice.client_state}` : '', invoice.client_gstin ? `GSTIN: ${invoice.client_gstin}` : 'Unregistered'].filter(Boolean).join('<br>')}</div>
  </div>
  <div class="party">
    <div class="party-type">Ship To</div>
    <div class="party-name">${invoice.client_name}</div>
    <div class="party-detail">${invoice.client_shipping_address || invoice.client_billing_address || '—'}</div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:22px">#</th>
    <th style="text-align:left">Description</th>
    <th style="width:55px">HSN/SAC</th>
    <th style="width:35px">Qty</th>
    <th style="width:70px;text-align:right">Rate</th>
    <th style="width:70px;text-align:right">Taxable</th>
    ${isInter ? '<th style="width:75px;text-align:right">IGST</th>' : '<th style="width:55px;text-align:right">CGST</th><th style="width:55px;text-align:right">SGST</th>'}
    <th style="width:80px;text-align:right">Amount</th>
  </tr></thead>
  <tbody>
    ${(invoice.items || []).map((item, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${item.description}</td>
      <td class="center">${item.hsn_sac || ''}</td>
      <td class="center">${item.qty}</td>
      <td class="right">₹${formatINR(item.price)}</td>
      <td class="right">₹${formatINR(item.taxable_value)}</td>
      ${isInter
        ? `<td class="right">₹${formatINR(item.igst_amt)}<br><small style="color:#888">${item.igst_pct}%</small></td>`
        : `<td class="right">₹${formatINR(item.cgst_amt)}<br><small style="color:#888">${item.cgst_pct}%</small></td><td class="right">₹${formatINR(item.sgst_amt)}<br><small style="color:#888">${item.sgst_pct}%</small></td>`}
      <td class="right bold">₹${formatINR(item.amount)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals-wrap"><table class="totals-tbl">
  <tr><td>Subtotal</td><td class="right">₹${formatINR(invoice.subtotal)}</td></tr>
  ${invoice.total_cgst > 0 ? `<tr><td>CGST</td><td class="right">₹${formatINR(invoice.total_cgst)}</td></tr>` : ''}
  ${invoice.total_sgst > 0 ? `<tr><td>SGST</td><td class="right">₹${formatINR(invoice.total_sgst)}</td></tr>` : ''}
  ${invoice.total_igst > 0 ? `<tr><td>IGST</td><td class="right">₹${formatINR(invoice.total_igst)}</td></tr>` : ''}
  ${invoice.rounded_off ? `<tr><td>Round Off</td><td class="right">${invoice.rounded_off > 0 ? '+' : ''}${(invoice.rounded_off).toFixed(2)}</td></tr>` : ''}
  <tr class="total-final"><td>TOTAL</td><td class="right">₹${formatINR(invoice.total)}</td></tr>
</table></div>

<div class="words"><b>In Words:</b> ${amountInWords(invoice.total)}</div>

<div class="footer">
  <div class="bank-det">
    ${company.bank_name ? `<b>Bank:</b> ${company.bank_name}<br>` : ''}
    ${company.account_no ? `<b>A/C No:</b> ${company.account_no}<br>` : ''}
    ${company.ifsc ? `<b>IFSC:</b> ${company.ifsc}${company.branch ? ` | Branch: ${company.branch}` : ''}<br>` : ''}
  </div>
  <div class="sig">
    <div>For <b>${company.name || ''}</b></div>
    <div class="sig-space"></div>
    <div>Authorised Signatory</div>
  </div>
</div>

</div></body></html>`;
}

// ─── Template 2: Classic Bordered (traditional accountancy style) ────────────
function templateModel2(invoice, company, options) {
  const isInter = invoice.supply_type === 'inter';
  const serverBase = 'http://localhost:3001';
  const logoUrl = company.logo_path ? `${serverBase}${company.logo_path}` : null;
  const themeColor = options.color || '#1a1a2e';
  const docLabel = options.label || 'Original Copy';
  const layout = options.layout || 'a4-portrait';
  const isA5 = layout.startsWith('a5');
  const isLandscape = layout.endsWith('landscape');
  const fs = isA5 ? '9px' : '11px';
  const w = isLandscape ? (isA5 ? '210mm' : '297mm') : (isA5 ? '148mm' : '210mm');
  const h = isLandscape ? (isA5 ? '148mm' : '210mm') : (isA5 ? '210mm' : '297mm');
  const pad = isA5 ? '8mm 10mm' : '12mm 14mm';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; font-size:${fs}; color:#111; background:white; }
.page { width:${w}; min-height:${h}; padding:${pad}; background:white; border:1px solid #ccc; }

.outer-border { border:2px solid ${themeColor}; padding:0; }

.top-band { background:${themeColor}; color:white; text-align:center; padding:${isA5 ? '8px' : '10px'} 0; }
.top-band h1 { font-size:${isA5 ? '18px' : '24px'}; font-weight:bold; letter-spacing:2px; font-family:'Helvetica Neue',sans-serif; }
.top-band .tagline { font-size:${isA5 ? '8px' : '9px'}; opacity:0.8; margin-top:1px; letter-spacing:3px; text-transform:uppercase; }

.company-section { display:flex; justify-content:space-between; align-items:center; padding:${isA5 ? '6px 10px' : '8px 14px'}; border-bottom:1px solid ${themeColor}; }
.comp-left { display:flex; align-items:center; gap:10px; }
.comp-name { font-size:${isA5 ? '13px' : '16px'}; font-weight:bold; color:${themeColor}; }
.comp-detail { font-size:${isA5 ? '7.5px' : '8.5px'}; color:#444; line-height:1.6; }
.comp-right { text-align:right; }
.comp-right .gstin { font-size:${isA5 ? '8px' : '9px'}; color:#333; font-weight:bold; }
.comp-right .inv-label { font-size:${isA5 ? '10px' : '12px'}; font-weight:bold; color:${themeColor}; margin-top:2px; }
.comp-right .copy-tag { font-size:7.5px; color:#666; font-style:italic; margin-top:1px; }
.logo { max-height:40px; max-width:120px; }

.inv-meta { display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid ${themeColor}; }
.inv-meta-box { padding:${isA5 ? '5px 10px' : '6px 14px'}; }
.inv-meta-box:first-child { border-right:1px solid ${themeColor}; }
.inv-meta-box .field { display:flex; gap:6px; margin-bottom:2px; }
.inv-meta-box .field .key { font-size:${isA5 ? '7.5px' : '8.5px'}; color:#666; min-width:80px; }
.inv-meta-box .field .val { font-size:${isA5 ? '8px' : '9.5px'}; font-weight:bold; color:#111; }

.parties-section { display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid ${themeColor}; }
.party-block { padding:${isA5 ? '5px 10px' : '6px 14px'}; }
.party-block:first-child { border-right:1px solid ${themeColor}; }
.party-block .hdr { font-size:7.5px; text-transform:uppercase; font-weight:bold; color:white; background:${themeColor}; padding:2px 6px; display:inline-block; margin-bottom:4px; }
.party-block .name { font-size:${isA5 ? '11px' : '13px'}; font-weight:bold; color:#111; }
.party-block .addr { font-size:${isA5 ? '7.5px' : '8.5px'}; color:#444; line-height:1.6; margin-top:2px; }

table { width:100%; border-collapse:collapse; }
thead tr { background:${themeColor}; color:white; }
th { padding:${isA5 ? '5px 4px' : '6px 5px'}; font-size:${isA5 ? '7.5px' : '8.5px'}; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
td { padding:${isA5 ? '5px 4px' : '6px 5px'}; font-size:${isA5 ? '8.5px' : '9.5px'}; border-bottom:1px solid #ddd; }
tbody tr:nth-child(even) { background:#fafafa; }
.right { text-align:right; } .center { text-align:center; } .bold { font-weight:bold; }

.summary-row { display:flex; border-top:1px solid ${themeColor}; }
.words-col { flex:1; border-right:1px solid ${themeColor}; padding:${isA5 ? '6px 10px' : '8px 14px'}; }
.words-col .hdr { font-size:7.5px; text-transform:uppercase; color:${themeColor}; font-weight:bold; margin-bottom:3px; }
.words-col .text { font-size:${isA5 ? '8px' : '9px'}; color:#333; font-style:italic; }
.totals-col { width:${isA5 ? '160px' : '200px'}; padding:${isA5 ? '4px 6px' : '5px 10px'}; }
.totals-col .t-row { display:flex; justify-content:space-between; font-size:${isA5 ? '8.5px' : '9.5px'}; padding:2px 0; border-bottom:1px dotted #ddd; }
.totals-col .t-row.grand { border-top:2px solid ${themeColor}; border-bottom:none; font-weight:bold; font-size:${isA5 ? '11px' : '13px'}; color:${themeColor}; padding-top:4px; margin-top:2px; }

.footer-row { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid ${themeColor}; padding:${isA5 ? '6px 10px' : '8px 14px'}; }
.bank-det { font-size:${isA5 ? '7.5px' : '8.5px'}; color:#444; line-height:1.7; }
.sig-block { text-align:right; font-size:${isA5 ? '8px' : '9px'}; }
.sig-space { height:32px; }

.terms { font-size:7.5px; color:#888; text-align:center; padding:${isA5 ? '3px 10px' : '4px 14px'}; border-top:1px solid #ddd; }
</style></head><body>
<div class="page">
<div class="outer-border">

<div class="top-band">
  <h1>TAX INVOICE</h1>
  <div class="tagline">Original for Recipient</div>
</div>

<div class="company-section">
  <div class="comp-left">
    ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo">` : ''}
    <div>
      <div class="comp-name">${company.name || ''}</div>
      <div class="comp-detail">${[company.address, company.city && company.state ? `${company.city}, ${company.state} ${company.pin ? '- ' + company.pin : ''}` : '', company.phone ? `Tel: ${company.phone}` : '', company.email || ''].filter(Boolean).join(' | ')}</div>
    </div>
  </div>
  <div class="comp-right">
    ${company.gstin ? `<div class="gstin">GSTIN: ${company.gstin}</div>` : ''}
    <div class="inv-label">${invoice.invoice_no}</div>
    <div class="copy-tag">${docLabel}</div>
  </div>
</div>

<div class="inv-meta">
  <div class="inv-meta-box">
    <div class="field"><span class="key">Invoice Date:</span><span class="val">${invoice.issue_date}</span></div>
    ${invoice.due_date ? `<div class="field"><span class="key">Due Date:</span><span class="val">${invoice.due_date}</span></div>` : ''}
    ${invoice.po_number ? `<div class="field"><span class="key">PO Number:</span><span class="val">${invoice.po_number}</span></div>` : ''}
    <div class="field"><span class="key">Supply Type:</span><span class="val">${isInter ? 'Inter-State Supply' : 'Intra-State Supply'}</span></div>
  </div>
  <div class="inv-meta-box">
    <div class="field"><span class="key">Place of Supply:</span><span class="val">${invoice.place_of_supply || '—'}</span></div>
    <div class="field"><span class="key">Tax Type:</span><span class="val">${isInter ? 'IGST' : 'CGST + SGST'}</span></div>
    <div class="field"><span class="key">Status:</span><span class="val" style="text-transform:uppercase">${invoice.status || 'Unpaid'}</span></div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <div class="hdr">Bill To</div>
    <div class="name">${invoice.client_name}</div>
    <div class="addr">${[invoice.client_billing_address, invoice.client_city && invoice.client_state ? `${invoice.client_city}, ${invoice.client_state}` : '', invoice.client_pin ? `PIN: ${invoice.client_pin}` : '', invoice.client_gstin ? `GSTIN: ${invoice.client_gstin}` : 'Consumer (Unregistered)'].filter(Boolean).join('<br>')}</div>
  </div>
  <div class="party-block">
    <div class="hdr">Ship To</div>
    <div class="name">${invoice.client_name}</div>
    <div class="addr">${invoice.client_shipping_address || invoice.client_billing_address || 'Same as billing address'}</div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:22px">Sr</th>
    <th style="text-align:left">Description of Goods / Services</th>
    <th style="width:50px">HSN/SAC</th>
    <th style="width:35px">Qty</th>
    <th style="width:45px">Unit</th>
    <th style="width:68px;text-align:right">Rate (₹)</th>
    <th style="width:65px;text-align:right">Taxable (₹)</th>
    ${isInter
      ? '<th style="width:70px;text-align:right">IGST (₹)</th>'
      : '<th style="width:55px;text-align:right">CGST (₹)</th><th style="width:55px;text-align:right">SGST (₹)</th>'}
    <th style="width:75px;text-align:right">Total (₹)</th>
  </tr></thead>
  <tbody>
    ${(invoice.items || []).map((item, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${item.description}${item.discount_pct ? `<br><small style="color:#888">Disc: ${item.discount_pct}%</small>` : ''}</td>
      <td class="center">${item.hsn_sac || ''}</td>
      <td class="center">${item.qty}</td>
      <td class="center">${item.unit || ''}</td>
      <td class="right">${formatINR(item.price)}</td>
      <td class="right">${formatINR(item.taxable_value)}</td>
      ${isInter
        ? `<td class="right">${formatINR(item.igst_amt)}<br><small style="color:#888">${item.igst_pct}%</small></td>`
        : `<td class="right">${formatINR(item.cgst_amt)}<br><small style="color:#888">${item.cgst_pct}%</small></td><td class="right">${formatINR(item.sgst_amt)}<br><small style="color:#888">${item.sgst_pct}%</small></td>`}
      <td class="right bold">${formatINR(item.amount)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="summary-row">
  <div class="words-col">
    <div class="hdr">Amount in Words</div>
    <div class="text">${amountInWords(invoice.total)}</div>
    ${company.bank_name ? `
    <div style="margin-top:8px">
      <div class="hdr">Bank Details</div>
      <div class="bank-det">
        ${company.bank_name ? `<b>Bank:</b> ${company.bank_name}&nbsp;&nbsp;` : ''}${company.account_no ? `<b>A/C:</b> ${company.account_no}<br>` : ''}
        ${company.ifsc ? `<b>IFSC:</b> ${company.ifsc}` : ''}${company.branch ? `&nbsp;&nbsp;<b>Branch:</b> ${company.branch}` : ''}
      </div>
    </div>` : ''}
  </div>
  <div class="totals-col">
    <div class="t-row"><span>Subtotal</span><span>₹${formatINR(invoice.subtotal)}</span></div>
    ${invoice.total_cgst > 0 ? `<div class="t-row"><span>CGST</span><span>₹${formatINR(invoice.total_cgst)}</span></div>` : ''}
    ${invoice.total_sgst > 0 ? `<div class="t-row"><span>SGST</span><span>₹${formatINR(invoice.total_sgst)}</span></div>` : ''}
    ${invoice.total_igst > 0 ? `<div class="t-row"><span>IGST</span><span>₹${formatINR(invoice.total_igst)}</span></div>` : ''}
    ${invoice.rounded_off ? `<div class="t-row"><span>Round Off</span><span>${invoice.rounded_off > 0 ? '+' : ''}${invoice.rounded_off.toFixed(2)}</span></div>` : ''}
    <div class="t-row grand"><span>GRAND TOTAL</span><span>₹${formatINR(invoice.total)}</span></div>
  </div>
</div>

<div class="footer-row">
  <div style="font-size:${isA5 ? '7.5px' : '8.5px'}; color:#666;">
    This is a computer generated invoice.
  </div>
  <div class="sig-block">
    <div>For <b>${company.name || ''}</b></div>
    <div class="sig-space"></div>
    <div>Authorised Signatory</div>
  </div>
</div>

<div class="terms">Subject to ${company.city || 'local'} jurisdiction. E. &amp; O.E.</div>

</div>
</div></body></html>`;
}

// ─── Template 3: Minimal Clean (modern SaaS style) ───────────────────────────
function templateModel3(invoice, company, options) {
  const isInter = invoice.supply_type === 'inter';
  const serverBase = 'http://localhost:3001';
  const logoUrl = company.logo_path ? `${serverBase}${company.logo_path}` : null;
  const themeColor = options.color || '#1a1a2e';
  const docLabel = options.label || 'Original Copy';
  const layout = options.layout || 'a4-portrait';
  const isA5 = layout.startsWith('a5');
  const isLandscape = layout.endsWith('landscape');
  const fs = isA5 ? '9px' : '11px';
  const w = isLandscape ? (isA5 ? '210mm' : '297mm') : (isA5 ? '148mm' : '210mm');
  const h = isLandscape ? (isA5 ? '148mm' : '210mm') : (isA5 ? '210mm' : '297mm');
  const pad = isA5 ? '8mm 10mm' : '14mm 16mm';

  // Accent lighter version for backgrounds
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  };
  const rgb = hexToRgb(themeColor.length === 7 ? themeColor : '#1a1a2e');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif; font-size:${fs}; color:#222; background:white; }
.page { width:${w}; min-height:${h}; padding:${pad}; background:white; }

.header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:${isA5 ? '16px' : '24px'}; }
.logo-area .company-name { font-size:${isA5 ? '15px' : '20px'}; font-weight:900; color:${themeColor}; letter-spacing:-0.5px; }
.logo-area .company-sub { font-size:${isA5 ? '7.5px' : '9px'}; color:#888; margin-top:3px; line-height:1.7; }
.logo { max-height:38px; max-width:120px; margin-bottom:5px; }

.inv-block { text-align:right; }
.inv-type { font-size:${isA5 ? '9px' : '11px'}; text-transform:uppercase; letter-spacing:3px; color:#aaa; font-weight:600; }
.inv-num { font-size:${isA5 ? '19px' : '26px'}; font-weight:900; color:${themeColor}; margin-top:2px; letter-spacing:-0.5px; }
.inv-copy { font-size:7.5px; color:rgba(${rgb},0.7); background:rgba(${rgb},0.08); border:1px solid rgba(${rgb},0.15); padding:2px 8px; border-radius:20px; display:inline-block; margin-top:4px; text-transform:uppercase; }

.divider { height:2px; background:linear-gradient(90deg, ${themeColor}, rgba(${rgb},0.1)); border-radius:2px; margin-bottom:${isA5 ? '12px' : '18px'}; }

.info-row { display:flex; gap:${isA5 ? '20px' : '32px'}; margin-bottom:${isA5 ? '12px' : '18px'}; }
.info-group { }
.info-group .lbl { font-size:7.5px; text-transform:uppercase; letter-spacing:1.5px; color:#aaa; font-weight:600; }
.info-group .val { font-size:${isA5 ? '10px' : '12px'}; font-weight:700; color:#111; margin-top:2px; }
.info-group .val.accent { color:${themeColor}; }

.status-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
.status-pill.unpaid { background:rgba(239,68,68,0.08); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }
.status-pill.paid { background:rgba(34,197,94,0.08); color:#22c55e; border:1px solid rgba(34,197,94,0.2); }
.status-pill.partial { background:rgba(234,179,8,0.08); color:#eab308; border:1px solid rgba(234,179,8,0.2); }

.parties { display:flex; gap:${isA5 ? '16px' : '24px'}; margin-bottom:${isA5 ? '12px' : '18px'}; }
.party { flex:1; }
.party .lbl { font-size:7.5px; text-transform:uppercase; letter-spacing:1.5px; color:#aaa; font-weight:600; margin-bottom:4px; }
.party .name { font-size:${isA5 ? '11px' : '13px'}; font-weight:800; color:#111; margin-bottom:3px; }
.party .addr { font-size:${isA5 ? '8px' : '9.5px'}; color:#666; line-height:1.6; }
.party .gstin-tag { display:inline-block; margin-top:3px; font-size:7.5px; font-weight:600; color:${themeColor}; background:rgba(${rgb},0.06); padding:1px 6px; border-radius:3px; }

table { width:100%; border-collapse:collapse; margin-bottom:${isA5 ? '10px' : '14px'}; }
thead tr { border-bottom:2px solid #111; }
th { padding:${isA5 ? '6px 4px' : '8px 5px'}; font-size:7.5px; text-transform:uppercase; letter-spacing:1px; font-weight:700; color:#555; }
td { padding:${isA5 ? '7px 4px' : '9px 5px'}; font-size:${isA5 ? '8.5px' : '9.5px'}; border-bottom:1px solid #f0f0f0; }
.right { text-align:right; } .center { text-align:center; }
.item-name { font-weight:600; color:#111; }
.item-sub { font-size:7.5px; color:#aaa; margin-top:1px; }

.bottom-section { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
.words-bank { flex:1; }
.words-section { background:#f8f8f8; border-radius:8px; padding:${isA5 ? '8px' : '10px'}; margin-bottom:10px; }
.words-section .lbl { font-size:7.5px; text-transform:uppercase; letter-spacing:1px; color:#aaa; font-weight:600; margin-bottom:3px; }
.words-section .text { font-size:${isA5 ? '8.5px' : '9.5px'}; color:#333; font-weight:500; }
.bank-section .lbl { font-size:7.5px; text-transform:uppercase; letter-spacing:1px; color:#aaa; font-weight:600; margin-bottom:4px; }
.bank-section .brow { font-size:${isA5 ? '8px' : '9px'}; color:#444; margin-bottom:1.5px; }

.totals-block { min-width:${isA5 ? '150px' : '190px'}; }
.t-line { display:flex; justify-content:space-between; padding:${isA5 ? '3px 0' : '4px 0'}; font-size:${isA5 ? '9px' : '10px'}; color:#555; }
.t-line .mono { font-variant-numeric:tabular-nums; }
.t-separator { border-top:1px solid #e5e5e5; margin:4px 0; }
.t-grand { display:flex; justify-content:space-between; padding:${isA5 ? '6px 12px' : '8px 14px'}; background:${themeColor}; color:white; border-radius:6px; margin-top:6px; }
.t-grand .lbl { font-size:${isA5 ? '9px' : '10px'}; font-weight:600; opacity:0.85; }
.t-grand .amt { font-size:${isA5 ? '14px' : '18px'}; font-weight:900; }

.sig-footer { display:flex; justify-content:flex-end; margin-top:${isA5 ? '16px' : '24px'}; padding-top:${isA5 ? '10px' : '14px'}; border-top:1px solid #eee; }
.sig-inner { text-align:center; }
.sig-line { width:${isA5 ? '100px' : '130px'}; border-bottom:1.5px solid #555; margin-bottom:4px; height:28px; }
.sig-name { font-size:${isA5 ? '8px' : '9px'}; color:#444; font-weight:600; }
.sig-title { font-size:7.5px; color:#aaa; }
</style></head><body><div class="page">

<div class="header">
  <div class="logo-area">
    ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="">` : ''}
    <div class="company-name">${company.name || ''}</div>
    <div class="company-sub">${[company.gstin ? `GSTIN: ${company.gstin}` : '', company.address || '', company.city && company.state ? `${company.city}, ${company.state}` : ''].filter(Boolean).join(' · ')}</div>
  </div>
  <div class="inv-block">
    <div class="inv-type">Tax Invoice</div>
    <div class="inv-num">${invoice.invoice_no}</div>
    <div class="inv-copy">${docLabel}</div>
  </div>
</div>

<div class="divider"></div>

<div class="info-row">
  <div class="info-group">
    <div class="lbl">Date</div>
    <div class="val">${invoice.issue_date}</div>
  </div>
  ${invoice.due_date ? `<div class="info-group"><div class="lbl">Due Date</div><div class="val">${invoice.due_date}</div></div>` : ''}
  <div class="info-group">
    <div class="lbl">Place of Supply</div>
    <div class="val">${invoice.place_of_supply || '—'}</div>
  </div>
  <div class="info-group">
    <div class="lbl">Tax</div>
    <div class="val accent">${isInter ? 'IGST' : 'CGST + SGST'}</div>
  </div>
  <div class="info-group" style="margin-left:auto">
    <div class="lbl">Status</div>
    <div style="margin-top:2px">
      <span class="status-pill ${invoice.status || 'unpaid'}">${(invoice.status || 'Unpaid').toUpperCase()}</span>
    </div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="lbl">Billed To</div>
    <div class="name">${invoice.client_name}</div>
    <div class="addr">${[invoice.client_billing_address, invoice.client_city && invoice.client_state ? `${invoice.client_city}, ${invoice.client_state}` : ''].filter(Boolean).join('<br>')}</div>
    ${invoice.client_gstin ? `<div class="gstin-tag">GSTIN: ${invoice.client_gstin}</div>` : ''}
  </div>
  <div class="party">
    <div class="lbl">Shipped To</div>
    <div class="name">${invoice.client_name}</div>
    <div class="addr">${invoice.client_shipping_address || invoice.client_billing_address || 'Same as billing'}</div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:20px">#</th>
    <th style="text-align:left">Item</th>
    <th style="width:50px">HSN/SAC</th>
    <th style="width:35px">Qty</th>
    <th style="width:70px;text-align:right">Rate</th>
    <th style="width:70px;text-align:right">Taxable</th>
    ${isInter
      ? '<th style="width:75px;text-align:right">IGST</th>'
      : '<th style="width:60px;text-align:right">CGST</th><th style="width:60px;text-align:right">SGST</th>'}
    <th style="width:80px;text-align:right">Amount</th>
  </tr></thead>
  <tbody>
    ${(invoice.items || []).map((item, i) => `
    <tr>
      <td class="center" style="color:#aaa">${i + 1}</td>
      <td>
        <div class="item-name">${item.description}</div>
        ${item.unit ? `<div class="item-sub">${item.unit}${item.discount_pct ? ` · ${item.discount_pct}% off` : ''}</div>` : ''}
      </td>
      <td class="center" style="color:#888;font-size:8px">${item.hsn_sac || '—'}</td>
      <td class="center">${item.qty}</td>
      <td class="right">₹${formatINR(item.price)}</td>
      <td class="right">₹${formatINR(item.taxable_value)}</td>
      ${isInter
        ? `<td class="right">₹${formatINR(item.igst_amt)}<br><span style="color:#aaa;font-size:7.5px">${item.igst_pct}%</span></td>`
        : `<td class="right">₹${formatINR(item.cgst_amt)}<br><span style="color:#aaa;font-size:7.5px">${item.cgst_pct}%</span></td><td class="right">₹${formatINR(item.sgst_amt)}<br><span style="color:#aaa;font-size:7.5px">${item.sgst_pct}%</span></td>`}
      <td class="right" style="font-weight:700">₹${formatINR(item.amount)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="bottom-section">
  <div class="words-bank">
    <div class="words-section">
      <div class="lbl">Amount in Words</div>
      <div class="text">${amountInWords(invoice.total)}</div>
    </div>
    ${company.bank_name ? `<div class="bank-section">
      <div class="lbl">Payment Details</div>
      ${company.bank_name ? `<div class="brow"><b>Bank:</b> ${company.bank_name}</div>` : ''}
      ${company.account_no ? `<div class="brow"><b>A/C No:</b> ${company.account_no}</div>` : ''}
      ${company.ifsc ? `<div class="brow"><b>IFSC:</b> ${company.ifsc}${company.branch ? ` · Branch: ${company.branch}` : ''}</div>` : ''}
    </div>` : ''}
  </div>
  <div class="totals-block">
    <div class="t-line"><span>Subtotal</span><span class="mono">₹${formatINR(invoice.subtotal)}</span></div>
    <div class="t-separator"></div>
    ${invoice.total_cgst > 0 ? `<div class="t-line"><span>CGST</span><span class="mono">₹${formatINR(invoice.total_cgst)}</span></div>` : ''}
    ${invoice.total_sgst > 0 ? `<div class="t-line"><span>SGST</span><span class="mono">₹${formatINR(invoice.total_sgst)}</span></div>` : ''}
    ${invoice.total_igst > 0 ? `<div class="t-line"><span>IGST</span><span class="mono">₹${formatINR(invoice.total_igst)}</span></div>` : ''}
    ${invoice.rounded_off ? `<div class="t-line"><span>Round Off</span><span class="mono">${invoice.rounded_off > 0 ? '+' : ''}${invoice.rounded_off.toFixed(2)}</span></div>` : ''}
    <div class="t-grand">
      <div class="lbl">Total</div>
      <div class="amt">₹${formatINR(invoice.total)}</div>
    </div>
  </div>
</div>

<div class="sig-footer">
  <div class="sig-inner">
    <div class="sig-line"></div>
    <div class="sig-name">${company.name || ''}</div>
    <div class="sig-title">Authorised Signatory</div>
  </div>
</div>

</div></body></html>`;
}

// ─── Router ──────────────────────────────────────────────────────────────────
function generateHTML(invoice, company, options = {}) {
  const tmpl = options.template || 'model-1';
  if (tmpl === 'model-2') return templateModel2(invoice, company, options);
  if (tmpl === 'model-3') return templateModel3(invoice, company, options);
  return templateModel1(invoice, company, options);
}

async function generateInvoicePDF(invoice, company, options = {}) {
  const html = generateHTML(invoice, company, options);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    const isA5 = options.layout?.startsWith('a5');
    const isLandscape = options.layout?.endsWith('landscape');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: isA5 ? 'A5' : 'A4',
      landscape: isLandscape,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateInvoicePDF };
