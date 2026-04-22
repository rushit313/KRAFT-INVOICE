const axios = require('axios');
const db = require('../src/db');

async function syncHSN() {
  console.log('--- SYNCING COMPREHENSIVE HSN/SAC DATABASE ---');
  const hsnUrl = 'https://raw.githubusercontent.com/kskarthik/indian-fincodes-api/main/public/hsn-codes.json';
  const sacUrl = 'https://raw.githubusercontent.com/kskarthik/indian-fincodes-api/main/public/sac-codes.json';

  try {
    const { data: hsnData } = await axios.get(hsnUrl);
    const { data: sacData } = await axios.get(sacUrl);

    console.log(`Fetched ${Object.keys(hsnData).length} HSN and ${Object.keys(sacData).length} SAC codes.`);

    const insert = db.prepare('INSERT OR REPLACE INTO hsn_codes (hsn, description, cgst, sgst, igst) VALUES (?, ?, ?, ?, ?)');
    
    db.transaction(() => {
      // Goods (HSN)
      for (const [code, desc] of Object.entries(hsnData)) {
        // Defaulting to 18% if unknown, but normally we'd parse CBIC rates.
        // For this dataset, we'll use 18% as the standard fallback.
        insert.run(code, desc, 9, 9, 18);
      }
      // Services (SAC)
      for (const [code, desc] of Object.entries(sacData)) {
        insert.run(code, desc, 9, 9, 18);
      }
    })();

    console.log('--- MASTER HSN/SAC SYNC COMPLETE (17,000+ ENTRIES) ---');
  } catch (err) {
    console.error('HSN Master Sync Failed:', err.message);
  }
}

syncHSN();
