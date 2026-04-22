/**
 * VisualInvoice.jsx
 *
 * Live invoice preview shown during migration / import.
 * Matches the Kraft IT Services PDF layout exactly.
 *
 * FIX C: All amounts go through formatINR() — never prepend ₹ manually.
 *        Search for "₹" in JSX and you'll find NONE outside this file's helpers.
 */

import React from 'react';

// ─── C. THE ONE TRUE CURRENCY FORMATTER ─────────────────────────────────────
// Import this from a shared util if you have one; do NOT redefine elsewhere.
function formatINR(amount) {
  const n = typeof amount === 'string'
    ? parseFloat(amount.replace(/[₹INR,\s]/g, ''))
    : Number(amount);
  if (isNaN(n)) return '₹0.00';
  return n.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Never call formatINR() and then also write "₹" before it.
// Never use `₹${someAlreadyFormattedString}`.
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function amountInWords(amount) {
  let n = Math.round(Number(amount));
  if (isNaN(n) || n === 0) return 'Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function below100(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  function below1000(n) {
    if (n < 100) return below100(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '');
  }

  let result = '';
  if (n >= 10000000) {
    result += below1000(Math.floor(n / 10000000)) + ' Crore ';
    n = n % 10000000;
  }
  if (n >= 100000) {
    result += below1000(Math.floor(n / 100000)) + ' Lakh ';
    n = n % 100000;
  }
  if (n >= 1000) {
    result += below100(Math.floor(n / 1000)) + ' Thousand ';
    n = n % 1000;
  }
  if (n > 0) result += below1000(n);
  return (result.trim() + ' Only').replace(/\s+/g, ' ');
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function VisualInvoice({ invoice, company, client }) {
  if (!invoice) return null;

  const {
    invoice_no, issue_date, due_date, place_of_supply,
    supply_type, status = 'UNPAID',
    subtotal = 0, total_cgst = 0, total_sgst = 0, total_igst = 0,
    rounded_off = 0, total = 0,
    line_items = [],
    terms,
  } = invoice;

  const isInter = supply_type === 'inter';

  return (
    <div style={{
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: 12,
      color: '#111',
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: 4,
      maxWidth: 900,
      margin: '0 auto',
    }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px 12px', borderBottom: '2px solid #e0e0e0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {company?.logo_path
            ? <img src={`/uploads/${company.logo_path}`} alt="logo" style={{ width: 54, height: 54, objectFit: 'contain' }} />
            : <div style={{ width: 54, height: 54, background: '#1a6b5e', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>K</div>
          }
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{company?.name || 'Kraft IT Services'}</div>
            <div style={{ color: '#555', lineHeight: 1.6, marginTop: 2 }}>
              {company?.address && <div>{company.address}</div>}
              {(company?.city || company?.state) && <div>{[company.city, company.state, company.pin].filter(Boolean).join(', ')}</div>}
              {company?.phone && <div>Ph: {company.phone}</div>}
              {company?.email && <div>{company.email}</div>}
              {company?.gstin && <div>GSTIN: <b>{company.gstin}</b></div>}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1, color: '#111' }}>TAX INVOICE</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{invoice_no || '—'}</div>
          <div style={{
            display: 'inline-block', marginTop: 6,
            background: '#1a6b5e', color: '#fff',
            fontSize: 10, fontWeight: 600, padding: '2px 10px',
            borderRadius: 2, letterSpacing: 0.5,
          }}>ORIGINAL COPY</div>
        </div>
      </div>

      {/* ── AMOUNT DUE BANNER ── */}
      <div style={{
        background: '#1a1a2e', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 24px',
      }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount Due</div>
          {/* formatINR already includes ₹ — do NOT prepend it */}
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{formatINR(total)}</div>
        </div>
        <div style={{
          background: status === 'paid' ? '#2e7d32' : '#c62828',
          padding: '4px 14px', borderRadius: 2, fontSize: 11, fontWeight: 700, letterSpacing: 1,
        }}>
          {(status || 'UNPAID').toUpperCase()}
        </div>
      </div>

      {/* ── DATE ROW ── */}
      <div style={{ display: 'flex', gap: 40, padding: '10px 24px', background: '#f8f8f8', borderBottom: '1px solid #e0e0e0', fontSize: 11 }}>
        <div><span style={{ color: '#666' }}>Issue Date: </span><b>{formatDate(issue_date)}</b></div>
        {due_date && <div><span style={{ color: '#666' }}>Due Date: </span><b>{formatDate(due_date)}</b></div>}
        {place_of_supply && <div><span style={{ color: '#666' }}>Place of Supply: </span><b>{place_of_supply}</b></div>}
        <div><span style={{ color: '#666' }}>Supply: </span><b>{isInter ? 'Inter-State' : 'Intra-State'}</b></div>
      </div>

      {/* ── BILL TO / SHIP TO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid #e0e0e0' }}>
        {['Bill To', 'Ship To'].map((label, i) => {
          const actualClient = client || {
            company_name: invoice.client_name,
            billing_address: invoice.client_billing_address,
            shipping_address: invoice.client_shipping_address,
            city: invoice.client_city,
            state: invoice.client_state,
            pin: invoice.client_pin,
            gstin: invoice.client_gstin,
          };
          const isShipTo = i === 1;
          const addressToUse = isShipTo ? (actualClient.shipping_address || actualClient.billing_address) : actualClient.billing_address;
          return (
            <div key={label} style={{
              padding: '12px 24px',
              borderRight: i === 0 ? '1px solid #e0e0e0' : 'none',
            }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 6 }}>{label}</div>
              {actualClient && actualClient.company_name ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{actualClient.company_name}</div>
                  {addressToUse && <div style={{ color: '#555', marginTop: 2 }}>{addressToUse}</div>}
                  {(actualClient.city || actualClient.state) && <div style={{ color: '#555' }}>{[actualClient.city, actualClient.state, actualClient.pin].filter(Boolean).join(', ')}</div>}
                  {actualClient.gstin && <div style={{ marginTop: 4 }}>GSTIN: <b>{actualClient.gstin}</b></div>}
                </>
              ) : (
                <div style={{ color: '#aaa', fontStyle: 'italic' }}>Client details not set</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── LINE ITEMS TABLE ── */}
      <div style={{ padding: '0 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr style={{ background: '#1a6b5e', color: '#fff' }}>
              {['#', 'Item Description', 'HSN/SAC', 'Qty', 'UoM', 'Rate (₹)', 'Taxable (₹)',
                ...(isInter ? ['IGST%', 'IGST (₹)'] : ['CGST%', 'CGST (₹)', 'SGST%', 'SGST (₹)']),
                'Amount (₹)'
              ].map(h => (
                <th key={h} style={{
                  padding: '7px 6px', fontSize: 10, fontWeight: 600,
                  textAlign: h === '#' || h === 'Qty' ? 'center' : 'right',
                  textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap',
                }}>
                  {h === 'Item Description' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {line_items.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f5f9f8', borderBottom: '1px solid #e8e8e8' }}>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                <td style={{ padding: '8px 6px', fontWeight: 500 }}>
                  {item.description}
                  {item.item_description && <div style={{ fontSize: 10, color: '#888' }}>{item.item_description}</div>}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{item.hsn_sac || '—'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#666' }}>{item.unit || 'Nos'}</td>
                {/* ── FIX C: use formatINR, never "₹" + formatINR ── */}
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatINR(item.price)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatINR(item.taxable_value)}</td>
                {isInter ? (
                  <>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{item.igst_pct || 18}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatINR(item.igst_amt)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{item.cgst_pct || 9}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatINR(item.cgst_amt)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{item.sgst_pct || 9}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatINR(item.sgst_amt)}</td>
                  </>
                )}
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{formatINR(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0f4f3', borderTop: '2px solid #1a6b5e' }}>
              <td colSpan={isInter ? 6 : 6} style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11, color: '#555' }}>
                {line_items.length} item{line_items.length !== 1 ? 's' : ''} · @{isInter ? '18' : '18'}%
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{formatINR(subtotal)}</td>
              {isInter ? (
                <>
                  <td />
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{formatINR(total_igst)}</td>
                </>
              ) : (
                <>
                  <td /><td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{formatINR(total_cgst)}</td>
                  <td /><td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{formatINR(total_sgst)}</td>
                </>
              )}
              <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{formatINR(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── TOTALS & BANK ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, padding: '16px 24px', borderTop: '1px solid #e0e0e0', marginTop: 8 }}>

        {/* Bank details */}
        <div>
          {company?.bank_name && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', color: '#666' }}>Bank Details</div>
              <div style={{ lineHeight: 1.8, fontSize: 12 }}>
                <div><b>Bank:</b> {company.bank_name}</div>
                {company.account_no && <div><b>A/C No:</b> {company.account_no}</div>}
                {company.ifsc && <div><b>IFSC:</b> {company.ifsc}</div>}
                {company.branch && <div><b>Branch:</b> {company.branch}</div>}
              </div>
            </div>
          )}

          {/* Amount in words */}
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4, fontSize: 12 }}>
            <b>Total Value (in words):</b> INR {amountInWords(total)}
          </div>

          {terms && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#555' }}>
              <b>Terms & Conditions</b><br />{terms}
            </div>
          )}
        </div>

        {/* Totals box */}
        <div style={{ minWidth: 240 }}>
          {[
            { label: 'Total Taxable Value', value: subtotal },
            ...(isInter
              ? [{ label: `IGST (${line_items[0]?.igst_pct || 18}%)`, value: total_igst }]
              : [
                  { label: `CGST (${line_items[0]?.cgst_pct || 9}%)`, value: total_cgst },
                  { label: `SGST (${line_items[0]?.sgst_pct || 9}%)`, value: total_sgst },
                ]),
            { label: 'Total Tax Amount', value: total_cgst + total_sgst + total_igst },
            ...(rounded_off !== 0 ? [{ label: 'Rounded Off', value: rounded_off }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee', gap: 24 }}>
              <span style={{ color: '#555', fontSize: 12 }}>{row.label}</span>
              {/* formatINR handles ₹ — no manual prefix */}
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatINR(row.value)}</span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 0', borderTop: '2px solid #1a6b5e',
            marginTop: 6, gap: 24,
          }}>
            <span style={{ fontWeight: 700 }}>Total Value (in figure)</span>
            <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>{formatINR(total)}</span>
          </div>
        </div>
      </div>

      {/* ── SIGNATURE ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px 20px', borderTop: '1px solid #e0e0e0' }}>
        <div style={{ textAlign: 'center' }}>
          {company?.signature_path
            ? <img src={`/uploads/${company.signature_path}`} alt="signature" style={{ height: 50, objectFit: 'contain', marginBottom: 4 }} />
            : <div style={{ height: 50, width: 120, borderBottom: '1px solid #aaa', marginBottom: 4 }} />
          }
          <div style={{ fontSize: 11, color: '#666' }}>Authorised Signatory</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{company?.name || ''}</div>
        </div>
      </div>

    </div>
  );
}
