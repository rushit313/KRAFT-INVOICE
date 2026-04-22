const XLSX = require('xlsx');
const path = 'C:\\Users\\Rushit\\Downloads\\2026-04-07_InvoicesExport_kraft-it-services.xls';
try {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }); // Read raw rows to see headers
  console.log('--- HEADERS ---');
  console.log(JSON.stringify(rows[0]));
  console.log('--- FIRST DATA ROW ---');
  console.log(JSON.stringify(rows[1]));
} catch (e) {
  console.error('Error reading file:', e.message);
}
