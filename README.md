# Kraft Invoicing

Full-stack Indian GST billing web application built with React + Vite + Node.js + Express + SQLite.

## Tech Stack
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide React
- **Backend:** Node.js, Express, better-sqlite3, Puppeteer, Anthropic SDK
- **Database:** SQLite (via better-sqlite3)

## Setup

### Backend

```bash
cd backend
npm install
node db/seed.js
npm run dev
```

Backend runs at: http://localhost:3001

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

### Environment Variables

Edit `backend/.env`:
```
PORT=3001
ANTHROPIC_API_KEY=your_api_key_here    # Required for AI purchase extraction
DATABASE_PATH=./db/kraft.db
UPLOADS_PATH=./uploads
```

## Features

- **Sales Invoices:** Create GST-compliant tax invoices with auto CGST/SGST/IGST calculation
- **Purchase Bills:** Manual entry or AI-powered extraction from PDF/image using Claude
- **GST Summary:** Monthly/quarterly GST summary with GSTR-3B preview
- **Dashboard:** Revenue metrics, charts, GST preview
- **PDF Generation:** Professional invoice PDFs via Puppeteer
- **Client & Vendor Management:** Full CRUD with history
- **Items Catalog:** Products and services with HSN/SAC codes
- **Reports:** Invoice tax summary CSV, client outstanding

## Seed Data

- Company: Kraft Enterprises (GSTIN: 27AABCK1234M1Z5, Maharashtra)
- 3 Clients: Mehta Traders (MH), Zenith Corp (KA - inter-state), Ray Industries (MH)
- 2 Vendors: Shreya Supplies, Gupta Wholesale
- 5 Items: Web Development, Domain Registration, SSL Certificate, Annual Maintenance, Laptop
- 3 Sample Invoices with payments
- 2 Sample Purchase Bills
