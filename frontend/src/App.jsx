import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import NewInvoice from './pages/NewInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import EditInvoice from './pages/EditInvoice';
import Purchases from './pages/Purchases';
import PurchaseUpload from './pages/PurchaseUpload';
import PurchaseDetail from './pages/PurchaseDetail';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Vendors from './pages/Vendors';
import Items from './pages/Items';
import GSTSummary from './pages/GSTSummary';
import Settings from './pages/Settings';
import Payments from './pages/Payments';
import NewPayment from './pages/NewPayment';
import GSTR1 from './pages/GSTR1';
import VendorAging from './pages/VendorAging';
import ReportsHub from './pages/ReportsHub';
import MigrateDatabase from './pages/MigrateDatabase';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-kraft-bg">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/import" element={<MigrateDatabase />} />
            <Route path="/invoices/new" element={<NewInvoice />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/invoices/:id/edit" element={<EditInvoice />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/purchases/upload" element={<PurchaseUpload />} />
            <Route path="/purchases/:id" element={<PurchaseDetail />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/items" element={<Items />} />
            <Route path="/gst-summary" element={<GSTSummary />} />
            <Route path="/gstr1" element={<GSTR1 />} />
            <Route path="/reports" element={<ReportsHub />} />
            <Route path="/vendor-aging" element={<VendorAging />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/new" element={<NewPayment />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
