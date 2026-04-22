/**
 * Kraft Invoicing — Refined Rule-Based Extraction Engine
 * 
 * FIXES APPLIED:
 *  A. Invoice number regex — no longer matches decimal amounts
 *  B. Fuzzy item matching — substring + token overlap, handles short names
 *  C. ₹ duplication — formatINR centralised here, never double-prefixes
 *  D. Fallback line items — secondary master-item scan before "Migrated Service"
 */

// ─── A. INVOICE NUMBER REGEX ────────────────────────────────────────────────
// Must contain at least one digit, no decimal point, not preceded by currency
// keywords. Examples matched: 372, 375-375, INV/2026/001, GW/2025/0341
const INVOICE_NO_REGEX =
  /(?:invoice\s*(?:no|number|#)|bill\s*(?:no|number|#)|\binv\b\s*(?:no|#)?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{0,29})/i;

// Negative list — if the captured group matches any of these, reject it
const INVOICE_NO_BLACKLIST = /^(amount|total|date|gst|cgst|sgst|igst|tax|price|rate|qty|uom|rs|inr|mh|original|copy|ship)$/i;

/**
 * Kraft PDF layout after "TAX INVOICE":
 *   Amount Due:
 *   Issue Date:
 *   Due Date:
 *   Place of Supply:
 *   <invoice_no>       ← line 0
 *   INR <amount>       ← line 1
 *   <date>             ← line 2
 *   <date>             ← line 3
 *   <place>            ← line 4
 *
 * Returns { invoiceNo, issueDate, dueDate, placeOfSupply } or null.
 */
function parseKraftHeaderBlock(text) {
  // Find where the 4 labels end and values begin
  const headerMatch = text.match(
    /Place\s+of\s+Supply\s*[:\-]?\s*\n([\s\S]{0,400}?)(?:Kraft\s+IT|GSTIN:\s*27AJVPD)/i
  );
  if (!headerMatch) return null;

  const block = headerMatch[1];
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  // lines[0] = invoice_no, lines[1] = INR amount, lines[2] = issue date, lines[3] = due date, lines[4] = place
  if (lines.length < 2) return null;

  const invoiceNo = lines[0];
  const issueDate = lines.length > 2 ? normaliseDate(lines[2]) : null;
  const dueDate   = lines.length > 3 ? normaliseDate(lines[3]) : null;
  const placeOfSupply = lines.length > 4 ? lines[4] : '';

  // Validate invoice number: must contain a digit and not be a keyword
  if (!/\d/.test(invoiceNo) || INVOICE_NO_BLACKLIST.test(invoiceNo)) return null;

  return { invoiceNo, issueDate, dueDate, placeOfSupply };
}

function extractInvoiceNo(text) {
  // Primary: labelled match ("Invoice No: 375", "Bill No: INV-001")
  const m = text.match(INVOICE_NO_REGEX);
  if (m) {
    const candidate = m[1].trim();
    if (/^\d+\.\d+$/.test(candidate)) return null;  // reject decimals
    if (INVOICE_NO_BLACKLIST.test(candidate)) return null;
    return candidate;
  }

  // Secondary: Kraft block parser
  const kraft = parseKraftHeaderBlock(text);
  if (kraft) return kraft.invoiceNo;

  return null;
}

// ─── DATE HELPERS ────────────────────────────────────────────────────────────
function extractDate(text, label) {
  // Pattern 1: inline - "Issue Date: 07-Apr-2026" or "Issue Date: 2026-04-07"
  const inlinePattern = new RegExp(
    label + '\\s*[:\\-]?\\s*(\\d{1,2}\\s*[\\-\\/]\\s*(?:\\w+)\\s*[\\-\\/]\\s*\\d{2,4}|\\d{4}-\\d{2}-\\d{2})',
    'i'
  );
  const inlineM = text.match(inlinePattern);
  if (inlineM) return normaliseDate(inlineM[1]);

  // Pattern 2: Kraft PDF layout — value appears on the line AFTER the label
  const blockPattern = new RegExp(
    label + '\\s*[:\\-]?\\n([^\\n]{4,25})',
    'i'
  );
  const blockM = text.match(blockPattern);
  if (blockM) return normaliseDate(blockM[1].trim());

  return null;
}

function normaliseDate(raw) {
  if (!raw) return null;
  // Remove excess whitespace
  raw = raw.replace(/\s+/g, ' ').trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD - Mon - YYYY  or  DD-Mon-YYYY  or  DD/Mon/YYYY
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const p = raw.match(/(\d{1,2})\s*[\-\/]\s*(\w+)\s*[\-\/]\s*(\d{2,4})/);
  if (p) {
    const d = p[1].padStart(2,'0');
    const mStr = p[2].toLowerCase().slice(0,3);
    const mo = (months[mStr] || parseInt(p[2], 10)).toString().padStart(2,'0');
    const y = p[3].length === 2 ? '20' + p[3] : p[3];
    return `${y}-${mo}-${d}`;
  }
  return null;
}

// ─── CLIENT / GSTIN ──────────────────────────────────────────────────────────
const GSTIN_REGEX = /\b(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})\b/g;

function extractGSTINs(text) {
  return [...text.matchAll(GSTIN_REGEX)].map(m => m[1]);
}

function extractBillToBlock(text) {
  // Capture everything between "Bill To" and either "Ship To" or next section
  const m = text.match(/Bill\s+To[\s\S]{0,20}?\n([\s\S]{0,400}?)(?:Ship\s+To|HSN\/SAC|S\.No|Item\s+Desc)/i);
  if (!m) return '';
  return m[1].trim();
}

// ─── AMOUNT HELPERS ──────────────────────────────────────────────────────────
function parseAmount(str) {
  if (!str && str !== 0) return 0;
  // Remove ₹, INR, commas, spaces
  const cleaned = String(str).replace(/[₹INR,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ─── C. SINGLE SOURCE OF TRUTH FOR CURRENCY FORMATTING ───────────────────────
// NEVER prepend ₹ outside this function — doing so causes "₹₹" duplication.
function formatINR(amount) {
  const n = parseAmount(amount);
  return n.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Returns "₹1,23,456.00" — never call this and then prepend ₹ again
}

// ─── B. FUZZY ITEM MATCHING ──────────────────────────────────────────────────
/**
 * Score how well `description` matches a master item.
 * Returns 0–100. Threshold: ≥ 40 to count as a match.
 */
function itemMatchScore(description, masterItem) {
  const desc = description.toLowerCase().trim();
  const name = (masterItem.name || '').toLowerCase().trim();
  const altNames = [
    name,
    masterItem.description ? masterItem.description.toLowerCase() : '',
    masterItem.hsn || '',
    masterItem.sac || '',
  ].filter(Boolean);

  let best = 0;

  for (const alt of altNames) {
    if (!alt) continue;

    // Exact match
    if (desc === alt) return 100;

    // Substring containment (either direction)
    if (desc.includes(alt) || alt.includes(desc)) {
      best = Math.max(best, 85);
      continue;
    }

    // Token overlap — split on non-alpha, ignore short words (≤2 chars)
    const descTokens = new Set(desc.split(/\W+/).filter(t => t.length > 2));
    const altTokens  = new Set(alt.split(/\W+/).filter(t => t.length > 2));
    if (descTokens.size === 0 || altTokens.size === 0) continue;

    let overlap = 0;
    for (const t of descTokens) {
      if (altTokens.has(t)) { overlap++; continue; }
      // Partial: desc token is prefix/suffix of any alt token
      for (const at of altTokens) {
        if (at.startsWith(t) || t.startsWith(at)) { overlap += 0.6; break; }
      }
    }
    const score = Math.round((overlap / Math.max(descTokens.size, altTokens.size)) * 80);
    best = Math.max(best, score);
  }

  return best;
}

function matchItemToMaster(description, masterItems) {
  if (!description || !masterItems || masterItems.length === 0) return null;

  let bestItem = null;
  let bestScore = 0;

  for (const item of masterItems) {
    const score = itemMatchScore(description, item);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  // Minimum threshold: 40
  return bestScore >= 40 ? bestItem : null;
}

// ─── LINE ITEM TABLE PARSER ──────────────────────────────────────────────────
/**
 * Attempts to parse a structured line-item table from extracted text.
 * Handles both PDF-parsed (columnar) and OCR (messy) text.
 *
 * Expected columns (any order): Description, HSN/SAC, Qty, Price/Rate,
 * Taxable Value, CGST%, CGST₹, SGST%, SGST₹, Amount
 */
function parseLineItemTable(text, masterItems) {
  const items = [];

  // ── Strategy 0: Kraft-specific line-by-line parser ──────────────────────────
  // The Kraft PDF structure after the table header has rows like:
  //   [1Website Development]       ← row number + item name (no space)
  //   [Corporate Look Professional] ← optional extra description line
  //   [Website]                    ← optional
  //   [99831312,60,000.002,60,000.0023,400.00]  ← HSN+Qty+Rate+Taxable+CGST merged
  //   [9%]
  //   [23,400.00]                  ← SGST
  //   [9%]
  //   [3,06,800.00]                ← Amount
  const kraftItems = parseKraftTableRows(text, masterItems);
  if (kraftItems.length > 0) return kraftItems;

  // Strategy 1: Look for lines that start with a row number followed by content
  const numberedRows = [...text.matchAll(
    /^\s*(\d{1,2})\s{1,6}(.{5,80?}?)\s{2,}(\d{6,})\s{2,}(\d[\d,]*(?:\.\d{2})?)\s{2,}([\d,]+(?:\.\d{2})?)\s{2,}([\d,]+(?:\.\d{2})?)\s{1,}(\d+)%?\s{1,}([\d,]+(?:\.\d{2})?)\s{1,}(\d+)%?\s{1,}([\d,]+(?:\.\d{2})?)\s{1,}([\d,]+(?:\.\d{2})?)/gm
  )];

  if (numberedRows.length > 0) {
    for (const row of numberedRows) {
      const desc    = row[2].trim();
      const hsnSac  = row[3].trim();
      const qty     = parseFloat(row[4].replace(/,/g, '')) || 1;
      const price   = parseAmount(row[5]);
      const taxable = parseAmount(row[6]);
      const cgstPct = parseFloat(row[7]) || 9;
      const cgstAmt = parseAmount(row[8]);
      const sgstPct = parseFloat(row[9]) || 9;
      const sgstAmt = parseAmount(row[10]);
      const amount  = parseAmount(row[11]);

      const matched = matchItemToMaster(desc, masterItems);
      items.push({
        description: matched ? matched.name : desc,
        hsn_sac:     hsnSac,
        qty,
        unit:        'Nos',
        price:       matched ? matched.sale_price : price,
        taxable_value: taxable || (qty * price),
        cgst_pct:    cgstPct,
        cgst_amt:    cgstAmt,
        sgst_pct:    sgstPct,
        sgst_amt:    sgstAmt,
        igst_pct:    0,
        igst_amt:    0,
        amount:      amount || (taxable + cgstAmt + sgstAmt),
        _matched:    !!matched,
      });
    }
    if (items.length > 0) return items;
  }

  // Strategy 2: Detect lines with HSN/SAC codes (6-digit numbers) to anchor rows
  const hsnAnchored = parseHSNAnchoredRows(text, masterItems);
  if (hsnAnchored.length > 0) return hsnAnchored;

  // Strategy 3: Disabled as it causes too much noise. Fallback will handle it.
  return [];
}

/**
 * Parse Kraft-format PDF line items.
 * Kraft PDFs produce rows like:
 *   "1Website Development" (row# glued to item name)
 *   "99831312,60,000.002,60,000.0023,400.00" (HSN+Qty+Rate+Taxable+CGST all merged)
 *   "9%"  "23,400.00"  "9%"  "3,06,800.00"
 */
function parseKraftTableRows(text, masterItems) {
  const items = [];
  const lines = text.split('\n').map(l => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Identify a row-start line: begins with digit(s) immediately followed by letters
    // e.g. "1Website Development", "2Company Profile Designing998391125,000.00..."
    const rowStart = line.match(/^(\d{1,2})([A-Za-z].{2,})/);
    if (!rowStart) continue;

    const rowIdx = parseInt(rowStart[1], 10);
    let descRaw = rowStart[2];

    // The numeric data may be on this same line (when fully merged) or the next line
    // Extract only the text portion of descRaw (stop at first 6-digit HSN)
    const hsnInDesc = descRaw.match(/(\d{6})/);
    let numericLine = '';
    if (hsnInDesc) {
      numericLine = descRaw.slice(hsnInDesc.index);  // "998313..."
      descRaw = descRaw.slice(0, hsnInDesc.index).trim();
    } else {
      // Data is on subsequent line(s) — scan ahead
      let j = i + 1;
      while (j < lines.length && j < i + 6) {
        const nextLine = lines[j];
        if (/^\d{6}/.test(nextLine.replace(/,/g, ''))) {
          numericLine = nextLine;
          break;
        }
        // If next line has a blob of numbers that isn't another row
        if (/[\d,]+\.\d{2}/.test(nextLine) && !/^\d{1,2}[A-Za-z]/.test(nextLine)) {
          numericLine = nextLine;
          break;
        }
        // Extra description lines
        if (/^[A-Za-z]/.test(nextLine) && !/^\d{1,2}[A-Za-z]/.test(nextLine)) {
          j++; continue;
        }
        break;
      }
    }

    // Now parse numericLine: [HSN:6][Qty:1-3][Rate.dd][Taxable.dd][CGST.dd]...
    // We try qty string lengths of 1, 2, and 3 digits and check if qty * rate ≈ taxable
    const nStr = numericLine.replace(/\s/g, '');
    const hsnM = nStr.match(/^(\d{6})/);
    const hsn = hsnM ? hsnM[1] : '';
    const afterHSN = hsn ? nStr.slice(6) : nStr;

    let qty = 1, price = 0, taxable = 0;
    let foundValid = false;
    
    for (let len = 1; len <= 3; len++) {
      if (afterHSN.length <= len) break;
      const qtyStr = afterHSN.slice(0, len);
      const rest = afterHSN.slice(len);
      const amts = [...rest.matchAll(/((?:\d{1,3},)*\d{1,3}\.\d{2}|\d+\.\d{2})/g)];
      
      if (amts.length >= 2) {
        const testQty = parseInt(qtyStr, 10);
        const testRate = parseAmount(amts[0][1]);
        const testTax = parseAmount(amts[1][1]);
        
        // Ensure starting amount digit isn't a comma (rest[0] must match amt start)
        // Check if qty * rate == taxable (within tiny margin)
        if (testTax > 0 && Math.abs((testQty * testRate) - testTax) / testTax < 0.05) {
          qty = testQty;
          price = testRate;
          taxable = testTax;
          foundValid = true;
          break;
        }
      }
    }

    // Fallback if no clean mathematical match
    if (!foundValid) {
      const amts = [...afterHSN.matchAll(/((?:\d{1,3},)*\d{1,3}\.\d{2}|\d+\.\d{2})/g)];
      if (amts.length > 0) {
        price = parseAmount(amts[0][1]);
        taxable = parseAmount(amts[amts.length > 1 ? 1 : 0][1]);
        qty = 1;
      } else {
        continue; // Unparseable row
      }
    }


    // To prevent messy alignment bugs with OCR (e.g. CGST read as SGST), 
    // we strictly calculate taxes from the taxable amount!
    const cgstPct = 9;
    const sgstPct = 9;
    const cgstAmt = Math.round(taxable * (cgstPct / 100) * 100) / 100;
    const sgstAmt = Math.round(taxable * (sgstPct / 100) * 100) / 100;
    const amount = Math.round((taxable + cgstAmt + sgstAmt) * 100) / 100;

    const matched = matchItemToMaster(descRaw, masterItems);
    items.push({
      description:   matched ? matched.name : descRaw,
      hsn_sac:       hsn,
      qty,
      unit:          'Nos',
      price,
      taxable_value: taxable,
      cgst_pct:      cgstPct,
      cgst_amt:      cgstAmt,
      sgst_pct:      sgstPct,
      sgst_amt:      sgstAmt,
      igst_pct:      0,
      igst_amt:      0,
      amount,
      _matched:      !!matched,
    });
  }
  return items;
}


function parseHSNAnchoredRows(text, masterItems) {
  const items = [];
  // Find all 6-digit HSN/SAC occurrences (between 100000–999999)
  const hsnMatches = [...text.matchAll(/\b(\d{6})\b/g)];

  for (const hsnM of hsnMatches) {
    const hsnIdx = hsnM.index;
    const hsn    = hsnM[1];

    // Look back up to 200 chars for description
    const before = text.slice(Math.max(0, hsnIdx - 200), hsnIdx);
    // Look ahead up to 200 chars for amounts
    const after  = text.slice(hsnIdx, Math.min(text.length, hsnIdx + 300));

    // Description: last non-empty line before HSN
    const descLines = before.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !/^\d+$/.test(l));
    const desc = descLines[descLines.length - 1] || '';

    // Amounts: pull all numbers from after
    const nums = [...after.matchAll(/([\d,]+\.\d{2})/g)].map(m => parseAmount(m[1])).filter(n => n > 0);
    if (nums.length < 3) continue; // Need at least qty/price/taxable

    // Heuristic: largest number in the row is likely the amount
    // Second-largest is likely taxable value
    const sorted = [...nums].sort((a, b) => b - a);
    const amount  = sorted[0];
    const taxable = sorted[1] !== sorted[0] ? sorted[1] : sorted[0];

    // Tax: look for "9%" or similar
    const taxPct = (after.match(/(\d+)\s*%/) || [])[1];
    const pct    = parseFloat(taxPct) || 9;
    const halfTax = Math.round((taxable * pct / 100) * 100) / 100;

    if (!desc || amount === 0) continue;

    const matched = matchItemToMaster(desc, masterItems);
    items.push({
      description:   matched ? matched.name : desc,
      hsn_sac:       hsn,
      qty:           1,
      unit:          'Nos',
      price:         matched ? matched.sale_price : taxable,
      taxable_value: taxable,
      cgst_pct:      pct,
      cgst_amt:      halfTax,
      sgst_pct:      pct,
      sgst_amt:      halfTax,
      igst_pct:      0,
      igst_amt:      0,
      amount,
      _matched:      !!matched,
    });
  }
  return items;
}

function parseAmountAnchoredRows(text, masterItems) {
  // Last-resort: split text into lines, find lines with amounts
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items  = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Must contain a large number (looks like an invoice amount)
    const amtMatch = line.match(/([\d,]+\.\d{2})$/);
    if (!amtMatch) continue;
    const amount = parseAmount(amtMatch[1]);
    if (amount < 100) continue; // Skip tiny numbers

    // Description: trace backward until a valid string is found
    let desc = line.replace(amtMatch[0], '').trim();
    let lookback = 1;
    while ((!desc || !/[A-Za-z]{3,}/.test(desc) || /(?:total|tax|sgst|cgst|igst|discount|round)/i.test(desc)) && i - lookback >= 0 && lookback <= 4) {
      desc = lines[i - lookback];
      lookback++;
    }
    if (!desc || !/[A-Za-z]{3,}/.test(desc)) continue;
    if (/(?:total|subtotal|taxable|amount|cgst|sgst|igst|discount|round|balance)/i.test(desc)) continue;
    
    // Clean up desc if it has concatenated numbers
    desc = desc.replace(/\d{6,}.*$/, '').trim();

    const matched = matchItemToMaster(desc, masterItems);
    const taxable = Math.round(amount / 1.18 * 100) / 100;
    const halfTax = Math.round(taxable * 0.09 * 100) / 100;
    items.push({
      description:   matched ? matched.name : desc,
      hsn_sac:       '',
      qty:           1,
      unit:          'Nos',
      price:         taxable,
      taxable_value: taxable,
      cgst_pct:      9,
      cgst_amt:      halfTax,
      sgst_pct:      9,
      sgst_amt:      halfTax,
      igst_pct:      0,
      igst_amt:      0,
      amount:        amount,
      _matched:      !!matched,
    });
  }
  return items;
}

// ─── D. IMPROVED FALLBACK ────────────────────────────────────────────────────
/**
 * If all table-parsing strategies yielded nothing, do a secondary scan
 * that looks for master item names anywhere in the text, near a number.
 * Only uses the generic "Migrated Service" as absolute last resort.
 */
function fallbackLineItems(text, masterItems, totalAmount) {
  // Secondary pass: scan for master item keywords
  const found = [];

  for (const item of masterItems) {
    const name = item.name.toLowerCase();
    
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedName})`, 'i');
    const match = text.match(regex);
    if (!match) continue;
    
    // Everything right after the item name (strip spaces)
    const remaining = text.slice(match.index + match[0].length, match.index + match[0].length + 200).replace(/\s+/g, '');
    let qty = 1;
    let price = item.sale_price || 0;
    let taxable = price;

    // Pattern for Kraft PDFs: ItemName[HSN:6digits][Qty:1-4digits][Rate.dd][Taxable.dd]...
    // e.g.  "Company Profile Designing998391125,000.0025,000.002,250.00"
    //       HSN=998391, qty=1, rate=25,000.00, taxable=25,000.00
    // e.g.  "Website Development99831312,60,000.002,60,000.0023,400.00"
    //       HSN=998313, qty=1, rate=2,60,000.00, taxable=2,60,000.00
    const p = remaining.match(/(?:\d{6})?(\d{1,2})((?:\d{1,3},)+\d{2,3}\.\d{2}|\d{2,9}\.\d{2})((?:\d{1,3},)+\d{2,3}\.\d{2}|\d{2,9}\.\d{2})/);
    if (p) {
      const parsedQty = parseInt(p[1], 10);
      const parsedRate = parseAmount(p[2]);
      const parsedTaxable = parseAmount(p[3]);
      // Sanity: qty * rate should roughly equal taxable (within 5%)
      const expected = parsedQty * parsedRate;
      if (parsedTaxable > 0 && Math.abs(expected - parsedTaxable) / parsedTaxable < 0.05) {
        qty = parsedQty;
        price = parsedRate;
        taxable = parsedTaxable;
      } else {
        // qty=1, first amount is rate/taxable
        qty = 1;
        price = parsedRate;
        taxable = parsedRate;
      }
    } else {
      // Just take the first reasonable amount as taxable value
      const amounts = [...remaining.matchAll(/((?:\d{1,3},)+\d{2,3}\.\d{2}|\d{4,}\.\d{2})/g)].map(m => parseAmount(m[1])).filter(n => n >= 100);
      if (amounts.length > 0) {
        price = amounts[0];
        taxable = amounts[0];
      } else if (totalAmount > 0) {
        taxable = totalAmount / 1.18;
        price = taxable;
      }
    }
    
    const halfTax = Math.round(taxable * 0.09 * 100) / 100;

    found.push({
      description:   item.name,
      hsn_sac:       item.sac || item.hsn || '',
      qty,
      unit:          item.unit || 'Nos',
      price,
      taxable_value: taxable,
      cgst_pct:      9,
      cgst_amt:      halfTax,
      sgst_pct:      9,
      sgst_amt:      halfTax,
      igst_pct:      0,
      igst_amt:      0,
      amount:        Math.round((taxable + halfTax * 2) * 100) / 100,
      _matched:      true,
    });
  }

  if (found.length > 0) return found;

  // Absolute last resort
  console.warn('[Extract] No items found — using Migrated Service fallback');
  const taxable = totalAmount / 1.18;
  const halfTax = Math.round(taxable * 0.09 * 100) / 100;
  return [{
    description:   'Migrated Service',
    hsn_sac:       '',
    qty:           1,
    unit:          'Nos',
    price:         taxable,
    taxable_value: Math.round(taxable * 100) / 100,
    cgst_pct:      9,
    cgst_amt:      halfTax,
    sgst_pct:      9,
    sgst_amt:      halfTax,
    igst_pct:      0,
    igst_amt:      0,
    amount:        totalAmount,
    _matched:      false,
  }];
}

// ─── CLIENT MATCHING ─────────────────────────────────────────────────────────
function matchClient(extractedGstin, extractedName, dbClients) {
  if (!dbClients || dbClients.length === 0) return null;

  // 1. Exact GSTIN match (strongest signal)
  if (extractedGstin) {
    const byGstin = dbClients.find(c => c.gstin === extractedGstin);
    if (byGstin) return { client: byGstin, confidence: 'gstin' };
  }

  // 2. Fuzzy name match
  if (extractedName) {
    const name = extractedName.toLowerCase().trim();
    let best = null, bestScore = 0;
    for (const c of dbClients) {
      const cName = (c.company_name || '').toLowerCase().trim();
      // Contains each other
      if (cName.includes(name) || name.includes(cName)) {
        const score = Math.min(cName.length, name.length) / Math.max(cName.length, name.length);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      // Token overlap
      const tokens1 = new Set(name.split(/\W+/).filter(t => t.length > 2));
      const tokens2 = new Set(cName.split(/\W+/).filter(t => t.length > 2));
      let overlap = 0;
      for (const t of tokens1) if (tokens2.has(t)) overlap++;
      const score = tokens1.size > 0 ? overlap / Math.max(tokens1.size, tokens2.size) : 0;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best && bestScore >= 0.5) return { client: best, confidence: 'name' };
  }

  return null;
}

// ─── MAIN EXTRACT FUNCTION ──────────────────────────────────────────────────
/**
 * @param {string} rawText    - Text extracted from PDF or OCR
 * @param {Array}  dbClients  - All clients from DB
 * @param {Array}  dbItems    - All items from DB
 * @returns {Object}          - Structured invoice data ready for confirm-extract
 */
function refinedRuleBasedExtract(rawText, dbClients = [], dbItems = []) {
  // Normalize whitespace (tame tabs and multiple spaces)
  const text = (rawText || '').replace(/\r/g, '').replace(/[\t ]+/g, ' ').trim();

  // ── Invoice metadata (try Kraft block parser first, then fall back) ──
  const kraftHeader = parseKraftHeaderBlock(text);
  const invoiceNo   = kraftHeader?.invoiceNo || extractInvoiceNo(text);
  const issueDate   = kraftHeader?.issueDate || extractDate(text, 'Issue\s*Date') || extractDate(text, 'Invoice\s*Date');
  const dueDate     = kraftHeader?.dueDate   || extractDate(text, 'Due\s*Date');

  // ── GSTINs ──
  const gstins = extractGSTINs(text);
  const buyerGstin = gstins.length >= 2 ? gstins[gstins.length - 1] : (gstins[0] || null);

  // ── Client block ──
  const billToBlock = extractBillToBlock(text);
  const clientNameLine = billToBlock.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !/^\d/.test(l))[0] || '';

  // ── Supply type ──
  const isInter = /inter.?state|IGST/i.test(text);
  const supplyType = isInter ? 'inter' : 'intra';

  // ── Place of supply ──
  const posMatch = text.match(/Place\s+of\s+Supply\s*[:\-]?\s*([^\n]{2,40})/i);
  const placeOfSupply = kraftHeader?.placeOfSupply || (posMatch ? posMatch[1].trim() : '');


  // ── Totals ──
  // Look for "Total Value" or "Grand Total" or "Amount Due"
  const totalPatterns = [
    /Total\s+Value\s+\(in\s+figure\)[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i,
    /Grand\s+Total[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i,
    /Amount\s+Due[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i,
    /Total\s+Amount[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i,
    /TOTAL[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i,
  ];
  let grandTotal = 0;
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m) { grandTotal = parseAmount(m[1]); break; }
  }

  const cgstMatch  = text.match(/(?:Total\s+)?CGST[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i);
  const sgstMatch  = text.match(/(?:Total\s+)?SGST[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i);
  const igstMatch  = text.match(/(?:Total\s+)?IGST[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i);
  const taxMatch   = text.match(/Total\s+Tax\s+Amount[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i);
  const taxableMatch = text.match(/Total\s+Taxable\s+Value[:\s₹INR]*([\d,]+(?:\.\d{2})?)/i);

  const totalCgst    = cgstMatch    ? parseAmount(cgstMatch[1])    : 0;
  const totalSgst    = sgstMatch    ? parseAmount(sgstMatch[1])    : 0;
  const totalIgst    = igstMatch    ? parseAmount(igstMatch[1])    : 0;
  const totalTaxAmt  = taxMatch     ? parseAmount(taxMatch[1])     : (totalCgst + totalSgst + totalIgst);
  const totalTaxable = taxableMatch ? parseAmount(taxableMatch[1]) : (grandTotal - totalTaxAmt);

  // ── Line items ──
  let lineItems = parseLineItemTable(text, dbItems);
  if (lineItems.length === 0) {
    lineItems = fallbackLineItems(text, dbItems, grandTotal);
  }

  // ── Client matching ──
  const clientMatch = matchClient(buyerGstin, clientNameLine, dbClients);

  return {
    invoice_no:     invoiceNo,
    issue_date:     issueDate,
    due_date:       dueDate,
    supply_type:    supplyType,
    place_of_supply: placeOfSupply,
    subtotal:       totalTaxable,
    total_cgst:     totalCgst,
    total_sgst:     totalSgst,
    total_igst:     totalIgst,
    total:          grandTotal,
    rounded_off:    Math.round(grandTotal) - grandTotal,

    // Client
    client_gstin:   buyerGstin,
    client_name_raw: clientNameLine,
    client_match:   clientMatch ? {
      id:         clientMatch.client.id,
      name:       clientMatch.client.company_name,
      confidence: clientMatch.confidence,
    } : null,

    // Line items
    line_items: lineItems,

    // Raw for debugging
    _debug: {
      gstins_found: gstins,
      bill_to_block: billToBlock.slice(0, 200),
      grand_total: grandTotal,
      items_count: lineItems.length,
    },
  };
}

module.exports = {
  refinedRuleBasedExtract,
  formatINR,      // ← import this everywhere instead of defining your own
  matchItemToMaster,
  matchClient,
  parseAmount,
  normaliseDate,
};
