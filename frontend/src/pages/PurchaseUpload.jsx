import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Upload, FileText, CheckCircle, Sparkles, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';

export default function PurchaseUpload() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    // Whenever the current index shifts, trigger extraction for the new item.
    if (files.length > 0 && currentIndex < files.length && !extracted && !extracting) {
      doExtract();
    }
  }, [currentIndex, files]);

  const handleFiles = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setFiles(Array.from(incomingFiles));
    setCurrentIndex(0);
    setExtracted(null);
    setEditData(null);
    setError('');
  };

  const doExtract = async () => {
    if (files.length === 0 || currentIndex >= files.length) return;
    setExtracting(true);
    setError('');
    const formData = new FormData();
    formData.append('file', files[currentIndex]);
    try {
      const res = await axios.post('/api/purchases/extract', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setExtracted(res.data.extracted);
      setEditData(res.data.extracted);
    } catch (e) {
      setError(e.response?.data?.error || 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  const updateLineItem = (idx, field, value) => {
    setEditData(d => ({ ...d, line_items: d.line_items.map((li, i) => i !== idx ? li : { ...li, [field]: value }) }));
  };

  const confirmExtract = async () => {
    setConfirming(true);
    try {
      const res = await axios.post('/api/purchases/confirm-extract', {
        extracted: editData,
        vendor_id: editData.existing_vendor?.id || null
      });
      
      if (currentIndex < files.length - 1) {
        setExtracted(null);
        setEditData(null);
        setCurrentIndex(currentIndex + 1);
      } else {
        navigate(`/purchases/${res.data.id}`);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create bill');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Upload Purchase Bill"
        subtitle="AI-powered extraction using Claude"
        actions={[
          { label: 'Back', icon: ArrowLeft, onClick: () => navigate('/purchases') }
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Drop Zone */}
          {files.length === 0 && (
            <div
              className={`kraft-card p-10 text-center border-2 border-dashed transition-all cursor-pointer ${dragging ? 'border-kraft-accent bg-kraft-accent/5' : 'border-[#2e2e36] hover:border-[#444]'}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFiles(e.target.files)} />
              <Upload size={32} className="mx-auto text-[#444] mb-3" />
              <div className="text-sm font-medium text-[#888]">Drag & drop or <span className="text-kraft-accent hover:underline">click to upload bulk bills</span></div>
              <div className="text-xs text-[#555] mt-1">PDF, JPG, PNG — multiple allowed</div>
            </div>
          )}

          {files.length > 0 && (
            <div className="kraft-card p-4 flex items-center justify-between border-l-4 border-l-kraft-accent">
               <div className="flex items-center gap-3">
                 <FileText size={24} className="text-kraft-accent" />
                 <div>
                   <div className="font-semibold text-white">Batch Upload in Progress</div>
                   <div className="text-xs text-[#888]">Processing {currentIndex + 1} of {files.length}: <strong>{files[currentIndex]?.name}</strong></div>
                 </div>
               </div>
               {!extracting && !extracted && error && (
                 <button onClick={doExtract} className="px-4 py-1.5 bg-white/10 rounded text-sm hover:bg-white/20">Retry AI Extraction</button>
               )}
            </div>
          )}

          {extracting && (
             <div className="w-full py-4 bg-kraft-accent/10 border border-kraft-accent/30 text-kraft-accent font-bold rounded-xl flex items-center justify-center gap-3">
               <div className="w-5 h-5 border-2 border-kraft-accent border-t-transparent rounded-full spin" />
               Extracting AI Data from file {currentIndex + 1}...
             </div>
          )}

          {error && <div className="px-4 py-3 bg-red-950/50 border border-red-800/50 rounded-lg text-red-400 text-sm">{error}</div>}

          {/* Extracted Form */}
          {editData && (
            <div className="fade-in space-y-4">
              <div className="flex items-center gap-2 text-kraft-green text-sm font-semibold">
                <CheckCircle size={16} />
                Extracted successfully — review and confirm
              </div>

              {editData.existing_vendor && (
                <div className="px-4 py-3 bg-kraft-blue/10 border border-kraft-blue/30 rounded-lg text-kraft-blue text-sm">
                  Vendor matched: <strong>{editData.existing_vendor.company_name}</strong> (GSTIN: {editData.existing_vendor.gstin})
                </div>
              )}

              <div className="kraft-card p-5">
                <div className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-4">Vendor & Bill Details</div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Vendor Name', 'vendor_name'],
                    ['Vendor GSTIN', 'vendor_gstin'],
                    ['Invoice No', 'invoice_no'],
                    ['Invoice Date', 'invoice_date'],
                    ['Place of Supply', 'place_of_supply'],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <label className="block text-xs text-[#888] mb-1">{label}</label>
                      <input
                        value={editData[key] || ''}
                        onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="kraft-card p-5">
                <div className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-4">Line Items</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#555] border-b border-[#2a2a32]">
                        <th className="text-left py-2 pr-2">Description</th>
                        <th className="text-right py-2 pr-2">Qty</th>
                        <th className="text-right py-2 pr-2">Price</th>
                        <th className="text-right py-2 pr-2">Taxable</th>
                        <th className="text-right py-2 pr-2">CGST</th>
                        <th className="text-right py-2 pr-2">SGST</th>
                        <th className="text-right py-2 pr-2">IGST</th>
                        <th className="text-right py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editData.line_items || []).map((li, idx) => (
                        <tr key={idx} className="border-b border-[#1e1e24]">
                          <td className="py-1.5 pr-2">
                            <input value={li.description || ''} onChange={e => updateLineItem(idx, 'description', e.target.value)} className="w-full px-2 py-1 rounded border border-[#2e2e36] text-xs" />
                          </td>
                          <td className="py-1.5 pr-2"><input type="number" value={li.qty || 0} onChange={e => updateLineItem(idx, 'qty', parseFloat(e.target.value))} className="w-16 px-2 py-1 rounded border border-[#2e2e36] text-xs text-right mono" /></td>
                          <td className="py-1.5 pr-2 text-right mono text-[#aaa]">{formatINR(li.price)}</td>
                          <td className="py-1.5 pr-2 text-right mono text-[#aaa]">{formatINR(li.taxable_value)}</td>
                          <td className="py-1.5 pr-2 text-right mono text-[#aaa]">{li.cgst_pct}%/{formatINR(li.cgst_amt)}</td>
                          <td className="py-1.5 pr-2 text-right mono text-[#aaa]">{li.sgst_pct}%/{formatINR(li.sgst_amt)}</td>
                          <td className="py-1.5 pr-2 text-right mono text-[#aaa]">{li.igst_pct}%/{formatINR(li.igst_amt)}</td>
                          <td className="py-1.5 text-right mono font-bold text-white">{formatINR(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="kraft-card p-5">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  {[['Subtotal', 'subtotal'],['CGST', 'total_cgst'],['SGST', 'total_sgst'],['IGST', 'total_igst'],['Total', 'total']].map(([label, key]) => (
                    <div key={key}>
                      <div className="text-xs text-[#666] mb-1">{label}</div>
                      <input type="number" value={editData[key] || 0} onChange={e => setEditData(d => ({ ...d, [key]: parseFloat(e.target.value) }))} className="w-full px-2 py-1.5 text-sm rounded border border-[#2e2e36] mono" />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={confirmExtract}
                disabled={confirming}
                className="w-full py-3 bg-kraft-green/20 text-kraft-green font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-kraft-green/30 border border-kraft-green/30"
              >
                {confirming ? (
                  <><div className="w-4 h-4 border-2 border-kraft-green border-t-transparent rounded-full spin" /> Saving...</>
                ) : (
                  <><CheckCircle size={16} /> {currentIndex < files.length - 1 ? 'Confirm & Process Next Document' : 'Confirm & Create Final Entry'}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
