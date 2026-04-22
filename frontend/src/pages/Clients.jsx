import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Building2, Phone, Mail, Edit, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Topbar from '../components/Topbar';

function ClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState(client || { company_name: '', contact_person: '', phone: '', email: '', gstin: '', pan: '', gst_treatment: 'regular', billing_address: '', city: '', state: 'Maharashtra', pin: '' });
  const [saving, setSaving] = useState(false);
  const [captchaModal, setCaptchaModal] = useState(null); // { image: '', sid: '' }
  const [captchaInput, setCaptchaInput] = useState('');
  const [validatingGst, setValidatingGst] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (client?.id) await axios.put(`/api/clients/${client.id}`, form);
      else await axios.post('/api/clients', form);
      onSaved();
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const fetchCaptcha = async () => {
    setValidatingGst(true);
    try {
      const sid = Math.random().toString(36).substring(7);
      const res = await axios.get(`/api/gst/verify/captcha?sid=${sid}`);
      setCaptchaModal({ ...res.data, sid });
      setCaptchaInput('');
    } catch (e) { alert('Failed to fetch captcha'); }
    finally { setValidatingGst(false); }
  };

  const submitGstVerify = async () => {
    if (!captchaInput) return;
    setValidatingGst(true);
    try {
      const res = await axios.post('/api/gst/verify/details', {
        gstin: form.gstin.toUpperCase(),
        captcha: captchaInput,
        sid: captchaModal.sid
      });
      
      if (res.data && res.data.success) {
        const d = res.data.taxpayerDetails;
        const officialName = d.lgnm || d.tradeNam;
        
        let shouldUpdateName = !form.company_name;
        if (form.company_name && form.company_name.toLowerCase().trim() !== officialName.toLowerCase().trim()) {
          shouldUpdateName = window.confirm(`Official Name: "${officialName}"\nUpdate to official name?`);
        }

        setForm(f => ({
          ...f,
          company_name: shouldUpdateName ? officialName : f.company_name,
          billing_address: f.billing_address || (d.pradr ? `${d.pradr.addr.bnm || ''} ${d.pradr.addr.st || ''} ${d.pradr.addr.loc || ''}`.trim() : ''),
          city: f.city || (d.pradr ? d.pradr.addr.dst : ''),
          state: f.state || (d.pradr ? d.pradr.addr.stc : ''),
          pin: f.pin || (d.pradr ? d.pradr.addr.pncd : ''),
          pan: f.pan || form.gstin.substring(2, 12),
          gst_verified: true
        }));
        setCaptchaModal(null);
      } else {
        alert(res.data?.error || 'Invalid Captcha. Refreshing...');
        fetchCaptcha();
      }
    } catch (e) {
      alert('Verification failed. Captcha might be incorrect.');
      fetchCaptcha();
    } finally {
      setValidatingGst(false);
    }
  };

  const fields = [
    ['Company Name *', 'company_name'], ['Contact Person', 'contact_person'],
    ['Phone', 'phone'], ['Email', 'email'],
    ['GSTIN', 'gstin'], ['PAN', 'pan'],
    ['Address', 'billing_address'], ['City', 'city'],
    ['State', 'state'], ['PIN', 'pin'],
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-kraft-surface border border-[#2a2a32] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
        <div className="px-6 py-4 border-b border-[#2a2a32] flex items-center justify-between">
          <div className="font-semibold text-white">{client ? 'Edit Client' : 'New Client'}</div>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {fields.map(([label, key]) => (
            <div key={key} className={key === 'billing_address' ? 'col-span-2' : ''}>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-[#888]">{label}</label>
                {key === 'gstin' && (
                  <div className="flex items-center gap-1.5">
                    {form.gst_verified && <div className="text-[10px] text-green-500 font-bold flex items-center gap-0.5">✓ Verified</div>}
                    <button 
                      onClick={() => fetchCaptcha()} 
                      disabled={validatingGst}
                      className="text-[10px] text-kraft-accent hover:underline disabled:opacity-50"
                    >
                      {validatingGst ? 'Capturing...' : 'Verify @ Official Portal'}
                    </button>
                  </div>
                )}
              </div>
              <input 
                value={form[key] || ''} 
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value, gst_verified: key === 'gstin' ? false : f.gst_verified }))} 
                className={`w-full px-3 py-2 text-sm rounded-lg border ${key === 'gstin' && form.gst_verified ? 'border-green-500/50 bg-green-500/5 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'border-[#2e2e36]'}`} 
              />
            </div>
          ))}
          {captchaModal && (
            <div className="col-span-2 p-5 bg-kraft-surface2 rounded-2xl border-2 border-kraft-accent/30 animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_40px_rgba(200,169,110,0.15)] mt-2">
              <div className="text-[11px] text-kraft-accent font-black uppercase tracking-[0.2em] mb-4 text-center">🔐 Solve Official GST Portal Captcha</div>
              <div className="flex flex-col gap-4 items-center">
                <div className="bg-white p-2.5 rounded-xl shadow-inner border-2 border-kraft-accent/30 flex items-center justify-center overflow-hidden">
                  <img src={captchaModal.image} alt="captcha" className="h-16 w-48 object-contain contrast-125 brightness-110" />
                </div>
                <div className="w-full flex gap-2">
                  <input 
                    autoFocus
                    placeholder="Enter exactly as shown" 
                    value={captchaInput} 
                    onChange={e => setCaptchaInput(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && submitGstVerify()}
                    className="flex-1 bg-kraft-surface border-2 border-kraft-accent/20 text-center text-lg font-black tracking-widest px-4 py-3 rounded-xl focus:border-kraft-accent outline-none"
                  />
                  <button 
                    onClick={submitGstVerify}
                    disabled={validatingGst || !captchaInput}
                    className="px-8 bg-kraft-accent text-kraft-bg font-black rounded-xl hover:bg-kraft-accent/90 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-kraft-accent/20"
                  >
                    VERIFY
                  </button>
                </div>
                <button onClick={fetchCaptcha} className="text-[10px] text-[#666] hover:text-white underline">Regenerate Captcha</button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-[#888] mb-1">GST Treatment</label>
            <select value={form.gst_treatment} onChange={e => setForm(f => ({ ...f, gst_treatment: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36]">
              {['regular','composition','unregistered','consumer','overseas'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-kraft-accent text-kraft-bg font-bold rounded-lg hover:bg-kraft-accent/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Client'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-kraft-surface2 text-[#888] rounded-lg hover:text-white">Cancel</button>
          {client && client.id && (
            <button 
              onClick={(e) => { 
                e.preventDefault();
                axios.delete(`/api/clients/${client.id}`).then(()=>onSaved()).catch(e=>console.log(e));
              }} 
              className="px-4 py-2.5 bg-red-950/30 text-kraft-red rounded-lg hover:bg-red-900/50 hover:text-white border border-red-900/30 flex items-center justify-center"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | client object
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const fetch = () => {
    const params = search ? { search } : {};
    axios.get('/api/clients', { params }).then(r => { setClients(r.data); setLoading(false); });
  };

  useEffect(() => { fetch(); }, [search]);

  const doDeleteClient = async () => {
    if (!confirmDeleteId) return;
    try {
      await axios.delete(`/api/clients/${confirmDeleteId}`);
      setConfirmDeleteId(null);
      fetch();
    } catch (e) {
      alert(e.response?.data?.error || 'Cannot delete client. They might have active invoices preventing deletion.');
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await axios.delete('/api/clients');
      setConfirmDeleteAll(false);
      fetch();
      alert('All clients and associated records deleted');
    } catch (e) {
      alert('Failed to delete all clients: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleExport = () => {
    const headers = ['Company Name', 'Contact Person', 'Phone', 'Email', 'GSTIN', 'City', 'State'];
    const rows = clients.map(c => [
      c.company_name, c.contact_person, c.phone, c.email, c.gstin, c.city, c.state
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "clients_export.csv";
    link.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isExcel = file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        let rows = [];
        if (isExcel) {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        } else {
          const text = evt.target.result;
          const wb = XLSX.read(text, { type: 'string' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        }

        const payload = rows.map(row => {
          const c = {};
          const entries = Object.entries(row);
          const find = (keywords) => {
            const entry = entries.find(([k]) => keywords.some(kw => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''))));
            return entry ? entry[1] : '';
          };

          c.company_name = find(['clientname', 'companyname', 'customername', 'name']);
          c.contact_person = find(['contactname', 'contactperson', 'primarycontact']);
          c.email = find(['email', 'emailaddress']);
          c.phone = find(['phone', 'mobile', 'tele']);
          c.billing_address = find(['billingaddress', 'address', 'street']);
          c.pin = find(['billingzip', 'billingpin', 'zip', 'pin', 'postal']);
          c.city = find(['billingcity', 'city']);
          c.state = find(['billingstate', 'state']);
          c.shipping_address = find(['shippingaddress', 'shippingstreet']);
          c.gstin = find(['gstin', 'gstno', 'taxregistration']);
          c.pan = find(['pan', 'panno']);

          if (c.email && !c.email.toString().includes('@')) {
            if (!c.phone) c.phone = c.email;
            c.email = '';
          }

          if (c.gstin && c.gstin.toString().length > 20) {
            if (!c.billing_address) c.billing_address = c.gstin;
            c.gstin = '';
          }

          return c;
        }).filter(c => c.company_name);

        if (payload.length === 0) return alert('No valid client rows found');
        await axios.post('/api/clients/bulk', { clients: payload });
        fetch();
        alert(`Successfully imported ${payload.length} clients`);
      } catch (err) {
        alert('Import failed: ' + (err.response?.data?.error || err.message));
      }
    };

    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center fade-in">
          <div className="bg-kraft-surface border border-[#3a3a44] p-6 rounded-xl w-80 text-center shadow-2xl">
            <Trash2 size={32} className="mx-auto text-kraft-red mb-4" />
            <h3 className="text-white font-bold mb-2">Delete Client?</h3>
            <p className="text-[#888] text-sm mb-6">This action cannot be undone. Associated records will be securely removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 rounded bg-[#2e2e36] text-white hover:bg-[#3e3e46]">Cancel</button>
              <button onClick={doDeleteClient} className="flex-1 py-2 rounded bg-kraft-red text-white hover:bg-red-600 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteAll && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center fade-in">
          <div className="bg-kraft-surface border border-red-900/50 p-8 rounded-2xl w-96 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} className="text-kraft-red animate-pulse" />
            </div>
            <h3 className="text-white text-xl font-bold mb-3">Purge Client Database?</h3>
            <p className="text-[#888] text-sm mb-8 leading-relaxed">
              This will <strong className="text-white">permanently delete all clients</strong> and their associated invoices, items, and payments. Ensure you have a backup before proceeding.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDeleteAll} className="w-full py-3 rounded-xl bg-kraft-red text-white hover:bg-red-600 font-bold shadow-lg shadow-red-900/20">Yes, Purge All Data</button>
              <button onClick={() => setConfirmDeleteAll(false)} className="w-full py-3 rounded-xl bg-[#2e2e36] text-[#888] hover:text-white hover:bg-[#3e3e46]">Nevermind, Go Back</button>
            </div>
          </div>
        </div>
      )}
      <input type="file" accept=".csv,.xls,.xlsx" className="hidden" ref={fileRef} onChange={handleImport} />
      {modal && <ClientModal client={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetch(); }} />}
      <Topbar
        title="Clients"
        subtitle="Manage your customer database"
        actions={[
          { label: 'Delete All', icon: Trash2, danger: true, onClick: () => setConfirmDeleteAll(true) },
          { label: 'Export CSV', onClick: handleExport },
          { label: 'Import XLS/CSV', primary: true, onClick: () => fileRef.current?.click() },
          { label: 'New Client', icon: Plus, primary: true, onClick: () => setModal('new') }
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#2e2e36]" />
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {clients.map(c => (
              <div key={c.id} className="kraft-card p-5 cursor-pointer hover:border-[#3a3a44] transition-all group" onClick={() => navigate(`/clients/${c.id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-kraft-accent/15 flex items-center justify-center">
                    <Building2 size={18} className="text-kraft-accent" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={e => { e.stopPropagation(); setModal(c); }} className="p-1.5 rounded hover:bg-white/10 text-[#666] hover:text-white"><Edit size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }} className="p-1.5 rounded hover:bg-red-950/50 text-[#666] hover:text-kraft-red"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="font-semibold text-white">{c.company_name}</div>
                {c.contact_person && <div className="text-xs text-[#888] mt-0.5">{c.contact_person}</div>}
                <div className="mt-3 space-y-1">
                  {c.phone && <div className="flex items-center gap-1.5 text-xs text-[#666]"><Phone size={11} />{c.phone}</div>}
                  {c.email && <div className="flex items-center gap-1.5 text-xs text-[#666]"><Mail size={11} />{c.email}</div>}
                  {c.gstin && <div className="text-xs font-mono text-kraft-accent/80 mt-2">{c.gstin}</div>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-[#555]">{c.city}, {c.state}</span>
                  <span className={`badge text-[10px] ${c.gst_treatment === 'regular' ? 'bg-kraft-blue/20 text-kraft-blue' : 'bg-gray-800 text-gray-500'}`}>
                    {c.gst_treatment}
                  </span>
                </div>
              </div>
            ))}
            {!clients.length && (
              <div className="col-span-3 text-center py-16 text-[#555]">
                No clients found. <button className="text-kraft-accent hover:underline" onClick={() => setModal('new')}>Add one?</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
