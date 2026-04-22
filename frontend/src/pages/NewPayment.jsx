import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Check, ArrowLeft, AlertCircle } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';

export default function NewPayment() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState('bank');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  
  // allocations: key=invoice_id, val=allocated amount string
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch clients
  useEffect(() => {
    axios.get('/api/clients').then(res => setClients(res.data)).catch(console.error);
  }, []);

  // Fetch unpaid invoices when client changes
  useEffect(() => {
    if (!selectedClient) {
      setUnpaidInvoices([]);
      setAllocations({});
      return;
    }
    axios.get(`/api/payments/unpaid?client_id=${selectedClient}`).then(res => {
      setUnpaidInvoices(res.data);
      setAllocations({}); // reset allocations on new client
    }).catch(console.error);
  }, [selectedClient]);

  // Handle auto-allocation
  const handleAutoAllocate = (amountVal) => {
    let remaining = amountVal;
    const newAlloc = {};
    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const allocate = Math.min(inv.balance_due, remaining);
      newAlloc[inv.id] = String(allocate);
      remaining -= allocate;
    }
    setAllocations(newAlloc);
  };

  const handleTotalAmountChange = (e) => {
    setTotalAmountStr(e.target.value);
    const val = parseFloat(e.target.value || '0');
    if (val > 0) handleAutoAllocate(val);
    else setAllocations({});
  };

  const handleAllocationChange = (id, val) => {
    setAllocations(prev => ({ ...prev, [id]: val }));
  };

  const totalAmount = parseFloat(totalAmountStr || '0');
  const allocatedAmount = Object.values(allocations).reduce((sum, val) => sum + parseFloat(val || '0'), 0);
  const excessAmount = totalAmount - allocatedAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return setError('Please select a client.');
    if (totalAmount <= 0) return setError('Please enter a valid amount.');
    if (excessAmount < 0) return setError('Allocated amount exceeds total payment amount.');

    const payload = unpaidInvoices
      .map(inv => ({
        invoice_id: inv.id,
        payment_date: date,
        amount: parseFloat(allocations[inv.id] || '0'),
        method,
        reference_no: reference,
        notes
      }))
      .filter(alloc => alloc.amount > 0);

    if (payload.length === 0) return setError('Please allocate payment to at least one invoice.');

    setLoading(true);
    setError('');
    try {
      await axios.post('/api/payments', { allocations: payload });
      navigate('/payments');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-kraft-bg">
      <Topbar
        title="Add New Payment Received"
        subtitle="Record payment against multiple invoices"
        actions={[
          { label: 'Cancel', icon: ArrowLeft, onClick: () => navigate('/payments') },
          { label: 'Save Receipt', icon: Check, primary: true, onClick: handleSubmit, disabled: loading }
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-400">
            <AlertCircle size={18} />
            <div className="text-sm">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Form Fields */}
          <div className="kraft-card p-6 grid grid-cols-3 gap-6">
            <div className="col-span-1 space-y-4">
              <div>
                <label className="block text-xs text-[#888] uppercase tracking-wide mb-2 font-semibold">Client</label>
                <select
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[#3a3a45] bg-[#1c1c21] text-white focus:outline-none focus:border-kraft-accent focus:ring-1 focus:ring-kraft-accent/50"
                  required
                >
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#888] uppercase tracking-wide mb-2 font-semibold">Amount Received</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmountStr}
                  onChange={handleTotalAmountChange}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[#3a3a45] bg-[#1c1c21] text-white font-mono focus:outline-none focus:border-kraft-accent focus:ring-1 focus:ring-kraft-accent/50"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="col-span-1 space-y-4">
              <div>
                <label className="block text-xs text-[#888] uppercase tracking-wide mb-2 font-semibold">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[#3a3a45] bg-[#1c1c21] text-white focus:outline-none focus:border-kraft-accent focus:ring-1 focus:ring-kraft-accent/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#888] uppercase tracking-wide mb-2 font-semibold">Reference # (Optional)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[#3a3a45] bg-[#1c1c21] text-white focus:outline-none focus:border-kraft-accent focus:ring-1 focus:ring-kraft-accent/50"
                />
              </div>
            </div>

            <div className="col-span-1 space-y-4">
              <div>
                <label className="block text-xs text-[#888] uppercase tracking-wide mb-2 font-semibold">Payment Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[#3a3a45] bg-[#1c1c21] text-white focus:outline-none focus:border-kraft-accent focus:ring-1 focus:ring-kraft-accent/50"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="neft">NEFT</option>
                  <option value="rtgs">RTGS</option>
                  <option value="imps">IMPS</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Unpaid Invoices List */}
          <div className="kraft-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2a2a32] bg-kraft-surface2/50 text-sm font-semibold text-white">
              Unpaid Documents
            </div>
            {!selectedClient ? (
              <div className="p-8 text-center text-[#666] text-sm">Please select a client.</div>
            ) : unpaidInvoices.length === 0 ? (
              <div className="p-8 text-center text-[#666] text-sm">No unpaid invoices for this client.</div>
            ) : (
              <div>
                <table className="kraft-table w-full">
                  <thead>
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Invoice No.</th>
                      <th className="text-right px-6 py-3">Invoice Total</th>
                      <th className="text-right px-6 py-3">Amount Due</th>
                      <th className="text-right px-6 py-3 w-40">Payment Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4 text-xs text-[#888]">{inv.issue_date}</td>
                        <td className="px-6 py-4 mono text-xs text-kraft-accent">{inv.invoice_no}</td>
                        <td className="px-6 py-4 text-right mono text-xs text-[#ccc]">{formatINR(inv.total)}</td>
                        <td className="px-6 py-4 text-right mono text-xs text-amber-400">{formatINR(inv.balance_due)}</td>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={inv.balance_due}
                            value={allocations[inv.id] || ''}
                            onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs text-right rounded border border-[#3a3a45] bg-[#1c1c21] text-white mono focus:outline-none focus:border-kraft-accent"
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Payment Summary Footer */}
            {selectedClient && unpaidInvoices.length > 0 && (
              <div className="p-6 border-t border-[#2a2a32] bg-[#18181c] flex justify-end">
                <div className="w-80 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#888]">Amount received:</span>
                    <span className="mono text-white font-medium">{formatINR(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-[#888]">Amount allocated:</span>
                    {allocatedAmount > totalAmount ? (
                      <span className="mono text-red-400 font-medium">{formatINR(allocatedAmount)}</span>
                    ) : (
                      <span className="mono text-kraft-green font-medium">{formatINR(allocatedAmount)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-[#2a2a32]">
                    <span className="text-[#888]">Amount in excess:</span>
                    <span className={`mono font-medium ${excessAmount < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                      {formatINR(excessAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="kraft-card p-6">
            <label className="block text-xs text-[#888] uppercase tracking-wide mb-3 font-semibold">Memo / Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-lg border border-[#3a3a45] bg-[#1c1c21] text-white focus:outline-none focus:border-kraft-accent focus:ring-1 focus:ring-kraft-accent/50"
              rows={3}
              placeholder="Add any internal notes here..."
            />
          </div>
        </form>
      </div>
    </div>
  );
}
