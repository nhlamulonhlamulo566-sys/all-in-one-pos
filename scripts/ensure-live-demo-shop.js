require('dotenv/config');

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const crypto = require('crypto');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Firebase Admin env vars in .env');
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

function normalizeShopId(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(normalized)) {
    throw new Error(`Invalid shop id: ${value}`);
  }
  return normalized;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function nextBillingDate(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

async function ensureUser(email, password, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password,
      displayName,
      emailVerified: true,
    });
    return existing;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }
    return auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
  }
}

async function main() {
  const shopId = normalizeShopId('shop-001');
  const shopName = 'Demo Shop';
  const ownerEmail = 'shopowner1@example.com';
  const ownerPassword = 'Password1';
  const now = Timestamp.now();

  const owner = await ensureUser(ownerEmail, ownerPassword, 'Demo Shop Owner');
  const activationToken = `SPAZA-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const shopRef = db.collection('shops').doc(shopId);
  const userRef = db.collection('users').doc(owner.uid);

  await db.runTransaction(async (transaction) => {
    const existingShop = await transaction.get(shopRef);
    if (!existingShop.exists) {
      transaction.set(shopRef, {
        shopName,
        ownerEmail,
        ownerUid: owner.uid,
        billingStatus: 'active',
        billingExpiresAt: Timestamp.fromDate(nextBillingDate()),
        maxUsersAllowed: 3,
        maxDevicesAllowed: 3,
        createdAt: now,
        createdBy: 'system-onboarding',
        activationTokenHash: hashToken(activationToken),
        activationTokenCreatedAt: now,
        activationTokenExpiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      });
      console.log(`Created shop ${shopId}`);
    } else {
      transaction.update(shopRef, {
        activationTokenHash: hashToken(activationToken),
        activationToken,
        activationTokenCreatedAt: now,
        activationTokenExpiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      });
      console.log(`Shop ${shopId} already exists`);
    }

    transaction.set(userRef, {
      id: owner.uid,
      name: 'Demo',
      surname: 'Shop Owner',
      email: ownerEmail,
      role: 'shop owner',
      shopId,
      mustChangePassword: true,
      createdAt: now,
    }, { merge: true });

    transaction.set(db.collection('roles_admin').doc(owner.uid), { shopId, createdAt: now }, { merge: true });
    transaction.delete(db.collection('roles_super_admin').doc(owner.uid));

    for (let index = 1; index <= 3; index += 1) {
      const seatRef = db.collection('device_seats').doc(`${shopId}_seat_${index}`);
      transaction.set(seatRef, {
        shopId,
        seatNumber: index,
        hardwareId: null,
        status: 'available',
        createdAt: now,
      }, { merge: true });
    }
  });

  const shops = await db.collection('shops').limit(10).get();
  console.log('shop_count=' + shops.size);
  console.log('activation_token=' + activationToken);
  console.log('owner_email=' + ownerEmail);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
