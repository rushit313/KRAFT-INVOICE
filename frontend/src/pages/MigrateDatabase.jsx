/**
 * MigrateDatabase.jsx
 *
 * Drop at: frontend/src/pages/MigrateDatabase.jsx
 *
 * Key fixes:
 *  - Shows correct extracted data from the improved engine
 *  - Editable fields so user can correct before confirming
 *  - Client picker: shows matched client or lets user create new
 *  - formatINR used consistently — no ₹ duplication
 *  - Line items displayed with correct prices
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import VisualInvoice from '../components/VisualInvoice';

// ─── THE ONE TRUE FORMATTER — same logic as backend ─────────────────────────
function formatINR(amount) {
  const n = parseFloat(String(amount).replace(/[₹INR,\s]/g, ''));
  if (isNaN(n)) return '₹0.00';
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
}
// ─────────────────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function MigrateDatabase() {
  const fileInputRef = useRef(null);
  const [files, setFiles]         = useState([]);   // uploaded File objects
  const [results, setResults]     = useState([]);   // extracted data per file
  const [selected, setSelected]   = useState(0);    // which bill is selected
  const [importing, setImporting] = useState({});   // { index: true/false }
  const [imported, setImported]   = useState({});   // { index: invoiceId }
  const [clients, setClients]     = useState([]);
  const [company, setCompany]     = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/clients`).then(r => setClients(r.data)).catch(() => {});
    axios.get(`${API}/api/company`).then(r => setCompany(r.data)).catch(() => {});
  }, []);

  // ── File drop / select ────────────────────────────────────────────────────
  const handleFiles = useCallback(async (newFiles) => {
    const arr = Array.from(newFiles);
    setFiles(prev => [...prev, ...arr]);

    for (const file of arr) {
      const idx = files.length + arr.indexOf(file);
      // Immediately add a loading placeholder
      setResults(prev => [...prev, { _loading: true, _fileName: file.name }]);

      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post(`${API}/api/invoices/extract`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const data = res.data.data;

        setResults(prev => prev.map((r, i) => i === idx ? { ...data, _fileName: file.name, _loading: false } : r));
      } catch (err) {
        setResults(prev => prev.map((r, i) => i === idx
          ? { _error: err.response?.data?.error || err.message, _fileName: file.name, _loading: false }
          : r
        ));
      }
    }
  }, [files.length]);

  const onDrop = useCallback(e => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ── Field update (inline edit) ────────────────────────────────────────────
  function updateField(idx, field, value) {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function updateLineItem(idx, liIdx, field, value) {
    setResults(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const items = r.line_items.map((li, j) => j === liIdx ? { ...li, [field]: value } : li);
      // Recalculate row totals
      const li = items[liIdx];
      const taxable = (parseFloat(li.qty) || 1) * (parseFloat(li.price) || 0) * (1 - (parseFloat(li.discount_pct) || 0) / 100);
      const cgstAmt = Math.round(taxable * (parseFloat(li.cgst_pct) || 9) / 100 * 100) / 100;
      const sgstAmt = Math.round(taxable * (parseFloat(li.sgst_pct) || 9) / 100 * 100) / 100;
      items[liIdx] = { ...li, taxable_value: taxable, cgst_amt: cgstAmt, sgst_amt: sgstAmt, amount: taxable + cgstAmt + sgstAmt };
      // Recalculate invoice totals
      const subtotal   = items.reduce((s, x) => s + (x.taxable_value || 0), 0);
      const total_cgst = items.reduce((s, x) => s + (x.cgst_amt || 0), 0);
      const total_sgst = items.reduce((s, x) => s + (x.sgst_amt || 0), 0);
      const total      = Math.round(subtotal + total_cgst + total_sgst);
      return { ...r, line_items: items, subtotal, total_cgst, total_sgst, total };
    }));
  }

  // ── Confirm import ────────────────────────────────────────────────────────
  async function confirmImport(idx) {
    const result = results[idx];
    if (!result || result._loading || result._error) return;

    setImporting(prev => ({ ...prev, [idx]: true }));
    try {
      const payload = {
        invoice_no:      result.invoice_no,
        issue_date:      result.issue_date,
        due_date:        result.due_date,
        supply_type:     result.supply_type || 'intra',
        place_of_supply: result.place_of_supply || '',
        client_id:       result._selected_client_id || result.client_match?.id || null,
        new_client: !result._selected_client_id && !result.client_match ? {
          company_name:    result.client_name_raw,
          gstin:           result.client_gstin,
          billing_address: '',
        } : null,
        line_items:      result.line_items,
        subtotal:        result.subtotal,
        total_cgst:      result.total_cgst,
        total_sgst:      result.total_sgst,
        total_igst:      result.total_igst || 0,
        total:           result.total,
        rounded_off:     result.rounded_off || 0,
        status:          'unpaid',
        terms:           result.terms || '',
      };

      const res = await axios.post(`${API}/api/invoices/confirm-extract`, payload);
      setImported(prev => ({ ...prev, [idx]: res.data.invoice_id }));
    } catch (err) {
      alert('Import failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(prev => ({ ...prev, [idx]: false }));
    }
  }

  // ── Extract all ───────────────────────────────────────────────────────────
  async function extractAll() {
    const input = fileInputRef.current;
    if (input) { input.click(); }
  }

  async function importAll() {
    for (let i = 0; i < results.length; i++) {
      if (!imported[i] && !importing[i]) await confirmImport(i);
    }
  }

  const currentResult = results[selected];
  const currentClient = currentResult?.client_match
    ? clients.find(c => c.id === currentResult.client_match.id)
    : currentResult?._selected_client_id
      ? clients.find(c => c.id === currentResult._selected_client_id)
      : null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#0f0f11', color: '#f0ede8', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── LEFT: file list ── */}
      <div style={{ width: 280, minWidth: 280, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Upload zone */}
        <div
          style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
        >
          <div
            style={{
              border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 10,
              padding: '20px 12px', textAlign: 'center', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Add PDF or Images</div>
            <div style={{ fontSize: 11, color: '#8a8890', marginTop: 4 }}>PDF, JPG, PNG supported</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={extractAll}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#f0ede8', cursor: 'pointer', fontSize: 12 }}
            >
              → Extract All
            </button>
            <button
              onClick={importAll}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#c8a96e', color: '#1a1508', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              ⬇ Import All ({results.filter((_, i) => !imported[i]).length})
            </button>
          </div>
        </div>

        {/* Bill list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => setSelected(i)}
              style={{
                padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                background: selected === i ? 'rgba(200,169,110,0.08)' : 'transparent',
                borderLeft: selected === i ? '3px solid #c8a96e' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                  background: r._loading ? '#333' : r._error ? '#e05c5c22' : '#4caf7d22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>
                  {r._loading ? '⟳' : r._error ? '⚠' : '📄'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r._loading ? 'Extracting...' : `Bill No ${r.invoice_no || '?'} ${r._fileName?.replace(/\.pdf$/i, '') || ''}`}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    {r._loading
                      ? <span style={{ color: '#8a8890' }}>Reading document...</span>
                      : r._error
                        ? <span style={{ color: '#e05c5c' }}>{r._error.slice(0, 50)}</span>
                        : imported[i]
                          ? <span style={{ color: '#4caf7d' }}>✓ Imported</span>
                          : <>
                              <span style={{ color: r.client_match ? '#4caf7d' : '#e05c5c' }}>
                                {r.client_match ? `✓ Client matched` : '+ New client'}
                              </span>
                              {' · '}
                              <span style={{ color: '#8a8890' }}>
                                {r.issue_date || ''}
                              </span>
                            </>
                    }
                  </div>
                  {!r._loading && !r._error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#8a8890' }}>Invoice {r.invoice_no}</span>
                      <span style={{ fontSize: 10, color: '#8a8890' }}>· Date {r.issue_date}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#5a5860', fontSize: 12 }}>
              Upload PDF or image files to begin extraction
            </div>
          )}
        </div>
      </div>

      {/* ── MIDDLE: extracted form ── */}
      <div style={{ width: 360, minWidth: 360, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: 20 }}>
        {currentResult && !currentResult._loading && !currentResult._error ? (
          <>
            <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#c8a96e' }}>Invoice Details</div>

            {/* Invoice No + Date */}
            <Field label="Invoice No" value={currentResult.invoice_no} onChange={v => updateField(selected, 'invoice_no', v)} />
            <Field label="Issue Date" value={currentResult.issue_date} type="date" onChange={v => updateField(selected, 'issue_date', v)} />
            <Field label="Due Date" value={currentResult.due_date} type="date" onChange={v => updateField(selected, 'due_date', v)} />
            <Field label="Place of Supply" value={currentResult.place_of_supply} onChange={v => updateField(selected, 'place_of_supply', v)} />

            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Supply Type</label>
              <select
                value={currentResult.supply_type || 'intra'}
                onChange={e => updateField(selected, 'supply_type', e.target.value)}
                style={inputStyle}
              >
                <option value="intra">Intra-State (CGST + SGST)</option>
                <option value="inter">Inter-State (IGST)</option>
              </select>
            </div>

            {/* Client */}
            <div style={{ marginBottom: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <label style={labelStyle}>Client</label>
              {currentResult.client_match
                ? <div style={{ padding: '6px 10px', background: 'rgba(76,175,125,0.12)', borderRadius: 8, fontSize: 12, color: '#4caf7d', marginBottom: 6 }}>
                    ✓ Matched: {currentResult.client_match.name}
                  </div>
                : null
              }
              <select
                value={currentResult._selected_client_id || currentResult.client_match?.id || ''}
                onChange={e => updateField(selected, '_selected_client_id', e.target.value ? parseInt(e.target.value) : null)}
                style={inputStyle}
              >
                <option value="">Client / Company Name *</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
                <option value="_new">+ Create New Client</option>
              </select>
              {currentResult.client_gstin && (
                <div style={{ marginTop: 6, padding: '5px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#8a8890' }}>
                  GSTIN: {currentResult.client_gstin}
                </div>
              )}
            </div>

            {/* Line Items */}
            <div style={{ marginBottom: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Line Items</label>
                <button
                  onClick={() => updateField(selected, 'line_items', [
                    ...(currentResult.line_items || []),
                    { description: '', hsn_sac: '', qty: 1, unit: 'Nos', price: 0, taxable_value: 0, cgst_pct: 9, cgst_amt: 0, sgst_pct: 9, sgst_amt: 0, igst_pct: 0, igst_amt: 0, amount: 0 }
                  ])}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#c8a96e', cursor: 'pointer' }}
                >
                  + Add Item
                </button>
              </div>

              {(currentResult.line_items || []).map((li, liIdx) => (
                <div key={liIdx} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#8a8890' }}>Item {liIdx + 1}</span>
                    {li._matched && <span style={{ fontSize: 10, color: '#4caf7d' }}>✓ matched</span>}
                  </div>
                  <input
                    value={li.description}
                    onChange={e => updateLineItem(selected, liIdx, 'description', e.target.value)}
                    placeholder="Description"
                    style={{ ...inputStyle, marginBottom: 6 }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <input value={li.hsn_sac} onChange={e => updateLineItem(selected, liIdx, 'hsn_sac', e.target.value)} placeholder="HSN" style={inputStyle} />
                    <input value={li.qty} type="number" onChange={e => updateLineItem(selected, liIdx, 'qty', e.target.value)} placeholder="Qty" style={inputStyle} />
                    <input value={li.price} type="number" onChange={e => updateLineItem(selected, liIdx, 'price', e.target.value)} placeholder="Rate" style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#8a8890' }}>
                    {/* formatINR — no extra ₹ */}
                    <span>Taxable: {formatINR(li.taxable_value)}</span>
                    <span>CGST: {formatINR(li.cgst_amt)} · SGST: {formatINR(li.sgst_amt)}</span>
                    <span style={{ fontWeight: 600, color: '#e8c98e' }}>{formatINR(li.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals summary */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
              {[
                ['Subtotal (Taxable)', currentResult.subtotal],
                ['CGST', currentResult.total_cgst],
                ['SGST', currentResult.total_sgst],
                ...(currentResult.total_igst ? [['IGST', currentResult.total_igst]] : []),
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#8a8890' }}>
                  <span>{lbl}</span><span style={{ fontFamily: 'monospace' }}>{formatINR(val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, fontWeight: 700, color: '#e8c98e' }}>
                <span>Total</span><span style={{ fontFamily: 'monospace' }}>{formatINR(currentResult.total)}</span>
              </div>
            </div>

            {/* Confirm button */}
            {imported[selected]
              ? <div style={{ textAlign: 'center', padding: '12px 0', color: '#4caf7d', fontWeight: 600 }}>✓ Imported as Invoice #{imported[selected]}</div>
              : <button
                  onClick={() => confirmImport(selected)}
                  disabled={importing[selected]}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                    background: importing[selected] ? '#888' : '#c8a96e',
                    color: '#1a1508', fontWeight: 700, fontSize: 14, cursor: importing[selected] ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importing[selected] ? 'Importing...' : '⬇ Confirm & Import Invoice'}
                </button>
            }
          </>
        ) : currentResult?._loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#8a8890' }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
            Extracting...
          </div>
        ) : currentResult?._error ? (
          <div style={{ padding: 20, color: '#e05c5c', fontSize: 12 }}>
            <b>Extraction failed:</b><br />{currentResult._error}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#5a5860', fontSize: 13 }}>
            Select a bill from the left to view details
          </div>
        )}
      </div>

      {/* ── RIGHT: live preview ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f5f5f5' }}>
        {currentResult && !currentResult._loading && !currentResult._error ? (
          <VisualInvoice
            invoice={{
              ...currentResult,
              line_items: currentResult.line_items || [],
            }}
            company={company}
            client={currentClient}
          />
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 80, color: '#aaa' }}>
            Invoice preview will appear here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared input styles ──────────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#8a8890', marginBottom: 4,
};
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '7px 10px', color: '#f0ede8',
  fontFamily: "'DM Sans', sans-serif", fontSize: 12, outline: 'none', boxSizing: 'border-box',
  marginBottom: 8,
};

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}
