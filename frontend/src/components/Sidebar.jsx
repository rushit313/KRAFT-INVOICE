import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ShoppingCart, Users, Store,
  Package, Receipt, Settings, ChevronRight, Zap, CreditCard, BarChart2, AlertTriangle, Database
} from 'lucide-react';

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    label: 'Sales',
    items: [
      { to: '/invoices', icon: FileText, label: 'Sales Bills' },
      { to: '/invoices/import', icon: Database, label: 'Migrate Database' },
      { to: '/clients', icon: Users, label: 'Clients' },
      { to: '/payments', icon: CreditCard, label: 'Payments Receipts' },
    ]
  },
  {
    label: 'Purchase',
    items: [
      { to: '/purchases', icon: ShoppingCart, label: 'Purchase Bills' },
      { to: '/vendors', icon: Store, label: 'Vendors' },
      { to: '/vendor-aging', icon: AlertTriangle, label: 'Vendor Aging' },
    ]
  },
  {
    label: 'Catalog',
    items: [
      { to: '/items', icon: Package, label: 'Items & Services' },
    ]
  },
  {
    label: 'GST & Reports',
    items: [
      { to: '/gst-summary', icon: Receipt, label: 'GST Summary' },
      { to: '/gstr1', icon: FileText, label: 'GSTR-1 Report' },
      { to: '/reports', icon: BarChart2, label: 'Reports Hub' },
    ]
  },
  {
    label: 'Settings',
    items: [
      { to: '/settings', icon: Settings, label: 'Company Settings' },
    ]
  }
];

export default function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-kraft-surface border-r border-[#2a2a32] h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2a2a32]">
        <div className="w-8 h-8 rounded-lg bg-kraft-accent/20 flex items-center justify-center">
          <Zap size={16} className="text-kraft-accent" />
        </div>
        <div>
          <div className="text-sm font-bold text-white leading-none">Kraft</div>
          <div className="text-[10px] text-kraft-accent font-medium tracking-wide">INVOICING</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navSections.map(section => (
          <div key={section.label} className="mb-4">
            <div className="text-[10px] font-semibold text-[#555560] uppercase tracking-widest px-3 mb-1">
              {section.label}
            </div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group
                  ${isActive
                    ? 'bg-kraft-accent/15 text-kraft-accent'
                    : 'text-[#888890] hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <item.icon size={15} />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-3 border-t border-[#2a2a32]">
        <div className="text-[10px] text-[#444450]">Kraft Invoicing v1.0</div>
        <div className="text-[10px] text-[#444450]">Indian GST Billing</div>
      </div>
    </aside>
  );
}
