require('dotenv/config');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const firestore = getFirestore();
const collections = ['products', 'customers', 'discounts', 'store_credits', 'layaways', 'cash_drawers', 'locations', 'inventories', 'stock_counts', 'low_stock_alerts'];
const shopId = process.argv[2];
const shouldApply = process.argv.includes('--apply');

async function main() {
  if (!shopId) throw new Error('Usage: node scripts/migrate-shop-data.js <shop-id> [--apply]');
  const shop = await firestore.collection('shops').doc(shopId).get();
  if (!shop.exists) throw new Error(`Shop ${shopId} was not found.`);
  let total = 0;
  for (const collectionName of collections) {
    const snapshot = await firestore.collection(collectionName).get();
    const legacy = snapshot.docs.filter((document) => !document.data().shopId);
    if (!legacy.length) continue;
    console.log(`${collectionName}: ${legacy.length} records without shopId`);
    total += legacy.length;
    if (shouldApply) {
      let batch = firestore.batch();
      let writes = 0;
      for (const document of legacy) {
        batch.update(document.ref, { shopId });
        writes += 1;
        if (writes === 400) {
          await batch.commit();
          batch = firestore.batch();
          writes = 0;
        }
      }
      if (writes) await batch.commit();
    }
  }
  console.log(shouldApply ? `Updated ${total} records.` : `Dry run complete. No records changed. Re-run with --apply to update ${total} records.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
