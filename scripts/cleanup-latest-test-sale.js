require('dotenv/config');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const firestore = getFirestore();
async function main() {
  const candidates = await firestore.collection('sales').where('salespersonId', '==', 'AeYINQSx7DXWo0LUfUaXAbneZ0j1').get();
  const sale = candidates.docs.sort((a,b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis())[0];
  if (!sale) throw new Error('No Jeff sales found; nothing deleted.');
  const data = sale.data();
  if (data.total !== 485.99 || Date.now() - data.createdAt.toMillis() > 15 * 60 * 1000) throw new Error('Latest sale did not match the test transaction; nothing deleted.');
  const batch = firestore.batch();
  const items = await sale.ref.collection('items').get();
  items.docs.forEach((doc) => batch.delete(doc.ref));
  const returns = await sale.ref.collection('returns').get();
  returns.docs.forEach((doc) => batch.delete(doc.ref));
  const movements = await firestore.collection('inventory_transactions').where('referenceId', '==', sale.id).get();
  movements.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(sale.ref);
  await batch.commit();
  console.log(`Deleted test sale ${sale.id}.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
