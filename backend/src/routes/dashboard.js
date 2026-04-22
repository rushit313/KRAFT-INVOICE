const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  // Metrics
  const totalInvoiced = db.prepare(`SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE status != 'draft'`).get().v;
  const now = new Date();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const received90d = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM payments WHERE payment_date >= ?`).get(ninetyDaysAgo).v;
  const outstanding = db.prepare(`SELECT COALESCE(SUM(i.total - COALESCE(p.paid,0)),0) as v FROM invoices i LEFT JOIN (SELECT invoice_id, SUM(amount) as paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id WHERE i.status IN ('unpaid','partial')`).get().v;
  const overdue = db.prepare(`SELECT COALESCE(SUM(i.total - COALESCE(p.paid,0)),0) as v FROM invoices i LEFT JOIN (SELECT invoice_id, SUM(amount) as paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id WHERE i.status IN ('unpaid','partial') AND i.due_date < ?`).get(now.toISOString().split('T')[0]).v;

  // Entity counts
  const countClients = db.prepare(`SELECT COUNT(*) as v FROM clients`).get().v;
  const countItems = db.prepare(`SELECT COUNT(*) as v FROM items`).get().v;
  const countInvoices = db.prepare(`SELECT COUNT(*) as v FROM invoices WHERE status != 'draft'`).get().v;
  const countPurchases = db.prepare(`SELECT COUNT(*) as v FROM purchase_bills`).get().v;

  // Recent invoices
  const recentInvoices = db.prepare(`SELECT i.*, c.company_name as client_name FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.created_at DESC LIMIT 5`).all();

  // Recent purchases
  const recentPurchases = db.prepare(`SELECT pb.* FROM purchase_bills pb ORDER BY pb.created_at DESC LIMIT 5`).all();

  // Monthly chart: last 6 months
  const monthlyChart = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const invoiced = db.prepare(`SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE strftime('%Y-%m', issue_date) = ? AND status != 'draft'`).get(monthStr).v;
    const collected = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM payments WHERE strftime('%Y-%m', payment_date) = ?`).get(monthStr).v;
    monthlyChart.push({ month: monthStr, invoiced, collected });
  }

  // GST preview for current month
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const dateFrom = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const dateTo = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;

  const salesGST = db.prepare(`SELECT COALESCE(SUM(total_cgst),0) as cgst, COALESCE(SUM(total_sgst),0) as sgst, COALESCE(SUM(total_igst),0) as igst FROM invoices WHERE issue_date >= ? AND issue_date <= ? AND status != 'draft'`).get(dateFrom, dateTo);
  const purchGST = db.prepare(`SELECT COALESCE(SUM(total_cgst),0) as cgst, COALESCE(SUM(total_sgst),0) as sgst, COALESCE(SUM(total_igst),0) as igst FROM purchase_bills WHERE issue_date >= ? AND issue_date <= ?`).get(dateFrom, dateTo);

  const gstPreview = {
    output_cgst: salesGST.cgst, output_sgst: salesGST.sgst, output_igst: salesGST.igst,
    itc_cgst: purchGST.cgst, itc_sgst: purchGST.sgst, itc_igst: purchGST.igst,
    net_cgst: Math.max(0, salesGST.cgst - purchGST.cgst),
    net_sgst: Math.max(0, salesGST.sgst - purchGST.sgst),
    net_igst: Math.max(0, salesGST.igst - purchGST.igst),
  };
  gstPreview.total_payable = gstPreview.net_cgst + gstPreview.net_sgst + gstPreview.net_igst;

  res.json({ metrics: { total_invoiced: totalInvoiced, received_90d: received90d, outstanding, overdue }, counts: { clients: countClients, items: countItems, invoices: countInvoices, purchases: countPurchases }, recent_invoices: recentInvoices, recent_purchases: recentPurchases, monthly_chart: monthlyChart, gst_preview: gstPreview });
});

module.exports = router;
