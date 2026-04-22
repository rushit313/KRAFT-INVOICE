import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Upload, Plus } from 'lucide-react';
import Topbar from '../components/Topbar';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import { formatINR } from '../utils/currency';

export default function Purchases() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'upload'
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/purchases').then(r => { setBills(r.data); setLoading(false); });
  }, []);

  const sortedBills = [...bills].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.issue_date || 0) - new Date(a.issue_date || 0);
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Purchase Bills"
        subtitle="Manage vendor bills and ITC"
        actions={[
          { label: sortBy === 'date' ? 'Sorted: Bill Date' : 'Sorted: Upload', onClick: () => setSortBy(s => s === 'date' ? 'upload' : 'date') },
          { label: 'Upload & Extract (AI)', icon: Upload, primary: true, onClick: () => navigate('/purchases/upload') },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="kraft-card overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>
          ) : (
            <table className="kraft-table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Vendor GSTIN</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">CGST</th>
                  <th className="text-right">SGST</th>
                  <th className="text-right">IGST</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedBills.map(bill => (
                  <tr key={bill.id} className="cursor-pointer" onClick={() => navigate(`/purchases/${bill.id}`)}>
                    <td className="text-kraft-blue font-mono text-xs font-semibold">{bill.bill_no || `PB-${bill.id}`}</td>
                    <td className="text-[#888] text-xs">{bill.issue_date}</td>
                    <td className="text-white font-medium">{bill.vendor_name}</td>
                    <td className="mono text-xs text-[#888]">{bill.vendor_gstin}</td>
                    <td className="text-right mono text-xs">{formatINR(bill.subtotal)}</td>
                    <td className="text-right mono text-xs text-[#888]">{formatINR(bill.total_cgst)}</td>
                    <td className="text-right mono text-xs text-[#888]">{formatINR(bill.total_sgst)}</td>
                    <td className="text-right mono text-xs text-[#888]">{formatINR(bill.total_igst)}</td>
                    <td className="text-right mono font-bold text-white">{formatINR(bill.total)}</td>
                    <td><InvoiceStatusBadge status={bill.status} /></td>
                  </tr>
                ))}
                {!bills.length && (
                  <tr><td colSpan={10} className="text-center text-[#555] py-16 text-sm">
                    No purchase bills. <button className="text-kraft-accent hover:underline" onClick={() => navigate('/purchases/upload')}>Upload one?</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
