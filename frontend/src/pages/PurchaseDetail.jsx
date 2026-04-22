import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Topbar from '../components/Topbar';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import { formatINR } from '../utils/currency';

export default function PurchaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`/api/purchases/${id}`).then(r => { setBill(r.data); setEditData(r.data); setLoading(false); });
  }, [id]);

  const deleteBill = async () => {
    if (!confirm('Delete this purchase bill?')) return;
    await axios.delete(`/api/purchases/${id}`);
    navigate('/purchases');
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`/api/purchases/${id}`, editData);
      setBill(res.data);
      setEditData(res.data);
      setIsEditing(false);
    } catch (e) {
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const updateLineItem = (idx, field, value) => {
    setEditData(d => ({ ...d, items: d.items.map((li, i) => i !== idx ? li : { ...li, [field]: value }) }));
  };

  const addLineItem = () => {
    setEditData(d => ({
      ...d, 
      items: [...(d.items || []), { description: '', qty: 1, price: 0, taxable_value: 0, cgst_pct: 0, cgst_amt: 0, sgst_pct: 0, sgst_amt: 0, igst_pct: 0, igst_amt: 0, amount: 0 }]
    }));
  };

  const removeLineItem = (idx) => {
    setEditData(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>;
  if (!bill) return <div className="flex-1 flex items-center justify-center text-[#555]">Not found</div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title={bill.bill_no || `PB-${bill.id}`}
        subtitle={bill.vendor_name}
        actions={[
          isEditing 
            ? { label: saving ? 'Saving...' : 'Save Changes', primary: true, onClick: saveChanges }
            : { label: 'Edit Bill', onClick: () => setIsEditing(true) },
          { label: 'Back', icon: ArrowLeft, onClick: () => { if(isEditing) { setIsEditing(false); setEditData(bill); } else navigate('/purchases'); } }
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <div className="kraft-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-[#666] mb-1">Bill No</div>
                  {isEditing ? (
                    <input className="px-3 py-1 bg-[#1a1a20] border border-[#333] text-white font-bold mono rounded" value={editData.bill_no || ''} onChange={e => setEditData({...editData, bill_no: e.target.value})} />
                  ) : (
                    <div className="text-2xl font-bold text-kraft-blue mono">{bill.bill_no || `PB-${bill.id}`}</div>
                  )}
                </div>
                <InvoiceStatusBadge status={bill.status} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4">
                {isEditing ? (
                  <>
                    <div><div className="text-xs text-[#666] mb-1">Vendor Name</div><input className="w-full px-2 py-1 bg-[#1a1a20] border border-[#333] rounded" value={editData.vendor_name || ''} onChange={e => setEditData({...editData, vendor_name: e.target.value})} /></div>
                    <div><div className="text-xs text-[#666] mb-1">GSTIN</div><input className="w-full px-2 py-1 bg-[#1a1a20] border border-[#333] rounded mono text-xs" value={editData.vendor_gstin || ''} onChange={e => setEditData({...editData, vendor_gstin: e.target.value})} /></div>
                    <div><div className="text-xs text-[#666] mb-1">Bill Date</div><input type="date" className="w-full px-2 py-1 bg-[#1a1a20] border border-[#333] rounded" value={editData.issue_date || ''} onChange={e => setEditData({...editData, issue_date: e.target.value})} /></div>
                    <div><div className="text-xs text-[#666] mb-1">Due Date</div><input type="date" className="w-full px-2 py-1 bg-[#1a1a20] border border-[#333] rounded" value={editData.due_date || ''} onChange={e => setEditData({...editData, due_date: e.target.value})} /></div>
                  </>
                ) : (
                  <>
                    <div><div className="text-xs text-[#666]">Vendor</div><div className="font-medium text-white mt-0.5">{bill.vendor_name}</div></div>
                    <div><div className="text-xs text-[#666]">GSTIN</div><div className="font-medium mono text-[#aaa] mt-0.5 text-xs">{bill.vendor_gstin || '—'}</div></div>
                    <div><div className="text-xs text-[#666]">Bill Date</div><div className="font-medium text-white mt-0.5">{bill.issue_date}</div></div>
                    <div><div className="text-xs text-[#666]">Due Date</div><div className="font-medium text-white mt-0.5">{bill.due_date || '—'}</div></div>
                  </>
                )}
              </div>
            </div>

            <div className="kraft-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a32] text-xs font-semibold text-[#666] uppercase tracking-wide flex justify-between items-center">
                Line Items
                {isEditing && <button onClick={addLineItem} className="text-kraft-accent hover:text-white px-2 py-0.5 rounded border border-kraft-accent bg-kraft-accent/10">+ Add Row</button>}
              </div>
              <div className="overflow-x-auto">
                <table className="kraft-table min-w-full">
                  <thead>
                    <tr>
                      <th className="w-8">#</th><th>Description</th>{isEditing && <th>HSN/SAC</th>}
                      <th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Taxable</th>
                      <th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th>
                      <th className="text-right">Amount</th>{isEditing && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing ? editData.items || [] : bill.items || []).map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="text-[#555] text-xs py-2">{idx + 1}</td>
                        {isEditing ? (
                          <>
                            <td className="py-2"><input value={item.description || ''} onChange={e => updateLineItem(idx, 'description', e.target.value)} className="w-full min-w-[150px] px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs" /></td>
                            <td className="py-2"><input value={item.hsn_sac || ''} onChange={e => updateLineItem(idx, 'hsn_sac', e.target.value)} className="w-20 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs mono" /></td>
                            <td className="py-2"><input type="number" value={item.qty || 0} onChange={e => updateLineItem(idx, 'qty', parseFloat(e.target.value))} className="w-16 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-right mono" /></td>
                            <td className="py-2"><input type="number" value={item.price || 0} onChange={e => updateLineItem(idx, 'price', parseFloat(e.target.value))} className="w-20 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-right mono" /></td>
                            <td className="py-2 text-right mono text-sm">{formatINR(item.taxable_value)}</td>
                            <td className="py-2"><input type="number" placeholder="%" value={item.cgst_pct || 0} onChange={e => updateLineItem(idx, 'cgst_pct', parseFloat(e.target.value))} className="w-10 px-1 py-1 mr-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-center mono inline-block" /><span className="text-[#888] mono text-xs">{formatINR(item.cgst_amt)}</span></td>
                            <td className="py-2"><input type="number" placeholder="%" value={item.sgst_pct || 0} onChange={e => updateLineItem(idx, 'sgst_pct', parseFloat(e.target.value))} className="w-10 px-1 py-1 mr-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-center mono inline-block" /><span className="text-[#888] mono text-xs">{formatINR(item.sgst_amt)}</span></td>
                            <td className="py-2"><input type="number" placeholder="%" value={item.igst_pct || 0} onChange={e => updateLineItem(idx, 'igst_pct', parseFloat(e.target.value))} className="w-10 px-1 py-1 mr-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-center mono inline-block" /><span className="text-[#888] mono text-xs">{formatINR(item.igst_amt)}</span></td>
                            <td className="py-2 text-right mono font-bold"><input type="number" value={item.amount || 0} onChange={e => updateLineItem(idx, 'amount', parseFloat(e.target.value))} className="w-24 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-right mono font-bold text-white" /></td>
                            <td className="py-2 text-center"><button onClick={() => removeLineItem(idx)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={14}/></button></td>
                          </>
                        ) : (
                          <>
                            <td className="font-medium text-white">{item.description}</td>
                            <td className="text-right mono text-sm">{item.qty} {item.unit}</td>
                            <td className="text-right mono text-xs text-[#888]">{formatINR(item.price)}</td>
                            <td className="text-right mono text-sm">{formatINR(item.taxable_value)}</td>
                            <td className="text-right mono text-xs text-[#888]">{item.cgst_pct}% / {formatINR(item.cgst_amt)}</td>
                            <td className="text-right mono text-xs text-[#888]">{item.sgst_pct}% / {formatINR(item.sgst_amt)}</td>
                            <td className="text-right mono text-xs text-[#888]">{item.igst_pct}% / {formatINR(item.igst_amt)}</td>
                            <td className="text-right mono font-bold text-white">{formatINR(item.amount)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="kraft-card p-5">
              <div className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-4">Bill Summary</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#888]">Subtotal</span>
                  {isEditing ? <input type="number" className="w-24 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-right mono" value={editData.subtotal || 0} onChange={e => setEditData({...editData, subtotal: parseFloat(e.target.value)})} /> : <span className="mono">{formatINR(bill.subtotal)}</span>}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#888]">CGST (ITC)</span>
                  {isEditing ? <input type="number" className="w-24 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-right mono text-kraft-green" value={editData.total_cgst || 0} onChange={e => setEditData({...editData, total_cgst: parseFloat(e.target.value)})} /> : <span className="mono text-kraft-green">{formatINR(bill.total_cgst)}</span>}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#888]">SGST (ITC)</span>
                  {isEditing ? <input type="number" className="w-24 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-right mono text-kraft-green" value={editData.total_sgst || 0} onChange={e => setEditData({...editData, total_sgst: parseFloat(e.target.value)})} /> : <span className="mono text-kraft-green">{formatINR(bill.total_sgst)}</span>}
                </div>
                {(isEditing || bill.total_igst > 0) && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#888]">IGST (ITC)</span>
                    {isEditing ? <input type="number" className="w-24 px-2 py-1 bg-[#1a1a20] border border-[#333] rounded text-xs text-right mono text-kraft-green" value={editData.total_igst || 0} onChange={e => setEditData({...editData, total_igst: parseFloat(e.target.value)})} /> : <span className="mono text-kraft-green">{formatINR(bill.total_igst)}</span>}
                  </div>
                )}
                <div className="border-t border-[#2a2a32] pt-3 mt-3 flex justify-between items-center font-bold">
                  <span className="text-white">Total</span>
                  {isEditing ? <input type="number" className="w-28 px-2 py-1 bg-[#1a1a20] border border-kraft-accent rounded text-sm text-right mono text-kraft-accent font-bold" value={editData.total || 0} onChange={e => setEditData({...editData, total: parseFloat(e.target.value)})} /> : <span className="mono text-kraft-accent text-lg">{formatINR(bill.total)}</span>}
                </div>
              </div>
            </div>
            {!isEditing && (
              <button onClick={deleteBill} className="w-full py-2 flex items-center justify-center gap-2 text-xs text-kraft-red hover:bg-red-950/30 rounded-lg border border-red-950/50">
                <Trash2 size={13} /> Delete Bill
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
