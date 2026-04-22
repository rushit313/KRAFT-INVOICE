import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import NewInvoice from './NewInvoice';

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/invoices/${id}`).then(r => { setInvoice(r.data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>;
  if (!invoice) return <div className="flex-1 flex items-center justify-center text-[#555]">Not found</div>;

  return <NewInvoice editData={invoice} onSaved={(inv) => navigate(`/invoices/${inv.id}`)} />;
}
