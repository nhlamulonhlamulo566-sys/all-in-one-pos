require('dotenv/config');

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROTECTED_EMAIL = 'jeff@gmail.com';
const PROTECTED_PASSWORD = 'Password1';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

async function deleteCollection(collectionRef) {
  const snapshot = await collectionRef.get();
  const deletions = [];

  for (const doc of snapshot.docs) {
    const nestedCollections = await doc.ref.listCollections();
    for (const nestedCollection of nestedCollections) {
      await deleteCollection(nestedCollection);
    }
    deletions.push(doc.ref.delete());
  }

  await Promise.all(deletions);
}

async function clearFirestore() {
  const collections = await db.listCollections();
  for (const collectionRef of collections) {
    await deleteCollection(collectionRef);
  }
}

async function cleanupAuthUsers() {
  const userPage = await auth.listUsers(1000);
  const promises = [];

  for (const user of userPage.users) {
    const email = user.email?.trim().toLowerCase();
    if (email !== PROTECTED_EMAIL) {
      promises.push(auth.deleteUser(user.uid));
    }
  }

  await Promise.all(promises);

  let protectedUser;
  try {
    protectedUser = await auth.getUserByEmail(PROTECTED_EMAIL);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  if (protectedUser) {
    await auth.updateUser(protectedUser.uid, {
      password: PROTECTED_PASSWORD,
      displayName: 'Jeff Super Administrator',
      emailVerified: true,
    });
  } else {
    await auth.createUser({
      email: PROTECTED_EMAIL,
      password: PROTECTED_PASSWORD,
      displayName: 'Jeff Super Administrator',
      emailVerified: true,
    });
  }

  const finalProtectedUser = await auth.getUserByEmail(PROTECTED_EMAIL);
  return finalProtectedUser;
}

async function seedProtectedSuperAdmin(uid) {
  const profileRef = db.collection('users').doc(uid);
  const existingProfile = await profileRef.get();
  await profileRef.set(
    {
      id: uid,
      name: 'Jeff',
      surname: 'Super Administrator',
      email: PROTECTED_EMAIL,
      role: 'super administrator',
      hiddenFromUserList: true,
      mustChangePassword: false,
      createdAt: existingProfile.exists ? existingProfile.get('createdAt') : Timestamp.now(),
    },
    { merge: true }
  );

  await db.collection('roles_admin').doc(uid).set({});
  await db.collection('roles_super_admin').doc(uid).set({});
}

async function main() {
  console.log('Starting real database reset...');

  const protectedUser = await cleanupAuthUsers();
  await clearFirestore();
  await seedProtectedSuperAdmin(protectedUser.uid);

  console.log('Reset complete. Protected super admin preserved: ' + PROTECTED_EMAIL);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
