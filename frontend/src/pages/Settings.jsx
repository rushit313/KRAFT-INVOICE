import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Save, Upload, Building2 } from 'lucide-react';
import Topbar from '../components/Topbar';

export default function Settings() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const logoRef = useRef();
  const sigRef = useRef();

  useEffect(() => {
    axios.get('/api/company').then(r => { setForm(r.data || {}); setLoading(false); });
  }, []);

  const save = async () => {
    setSaving(true);
    await axios.put('/api/company', form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const uploadFile = async (type, file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await axios.post(`/api/company/${type}`, fd);
    setForm(f => ({ ...f, [`${type}_path`]: res.data[`${type}_path`] }));
  };

  const sections = [
    {
      title: 'Company Information',
      fields: [
        ['Company Name *', 'name', 'col-span-2'],
        ['Address', 'address', 'col-span-2'],
        ['City', 'city'], ['State', 'state'],
        ['PIN Code', 'pin'], ['Phone', 'phone'],
        ['Email', 'email', 'col-span-2'],
      ]
    },
    {
      title: 'Tax Information',
      fields: [
        ['GSTIN', 'gstin'], ['PAN', 'pan'],
        ['Financial Year Start Month', 'financial_year_start'],
      ]
    },
    {
      title: 'Bank Details',
      fields: [
        ['Bank Name', 'bank_name'], ['Branch', 'branch'],
        ['Account Number', 'account_no'], ['IFSC Code', 'ifsc'],
      ]
    },
    {
      title: 'Default Terms',
      fields: [
        ['Default Terms & Conditions', 'terms_default', 'col-span-2', true],
      ]
    }
  ];

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Company Settings"
        subtitle="Configure your company profile"
        actions={[{ label: saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Changes', icon: Save, primary: true, onClick: save }]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Logo & Signature */}
          <div className="kraft-card p-5">
            <div className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-4">Branding</div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-[#888] mb-2">Company Logo</div>
                <div className="w-32 h-20 rounded-lg bg-kraft-surface2 border border-[#2e2e36] flex items-center justify-center mb-2 overflow-hidden">
                  {form.logo_path ? <img src={form.logo_path} alt="logo" className="max-h-full max-w-full object-contain" /> : <Building2 size={24} className="text-[#444]" />}
                </div>
                <button onClick={() => logoRef.current?.click()} className="flex items-center gap-1.5 text-xs text-kraft-accent hover:underline">
                  <Upload size={12} /> Upload Logo
                </button>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadFile('logo', e.target.files[0])} />
              </div>
              <div>
                <div className="text-xs text-[#888] mb-2">Signature Image</div>
                <div className="w-32 h-20 rounded-lg bg-kraft-surface2 border border-[#2e2e36] flex items-center justify-center mb-2 overflow-hidden">
                  {form.signature_path ? <img src={form.signature_path} alt="signature" className="max-h-full max-w-full object-contain" /> : <span className="text-[#444] text-xs">No signature</span>}
                </div>
                <button onClick={() => sigRef.current?.click()} className="flex items-center gap-1.5 text-xs text-kraft-accent hover:underline">
                  <Upload size={12} /> Upload Signature
                </button>
                <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadFile('signature', e.target.files[0])} />
              </div>
            </div>
          </div>

          {sections.map(section => (
            <div key={section.title} className="kraft-card p-5">
              <div className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-4">{section.title}</div>
              <div className="grid grid-cols-2 gap-4">
                {section.fields.map(([label, key, span, isTextarea]) => (
                  <div key={key} className={span || ''}>
                    <label className="block text-xs text-[#888] mb-1">{label}</label>
                    {isTextarea ? (
                      <textarea
                        value={form[key] || ''}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36] resize-none"
                      />
                    ) : (
                      <input
                        value={form[key] || ''}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36]"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button onClick={save} disabled={saving} className="w-full py-3 bg-kraft-accent text-kraft-bg font-bold rounded-xl hover:bg-kraft-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={16} />
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
