require('dotenv/config');

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const email = 'jeff@gmail.com';
const password = process.env.SUPER_ADMIN_PASSWORD;

if (!password) {
  throw new Error('Set SUPER_ADMIN_PASSWORD before running this script.');
}

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
const firestore = getFirestore();

async function main() {
  let userRecord;

  try {
    userRecord = await auth.getUserByEmail(email);
    userRecord = await auth.updateUser(userRecord.uid, {
      password,
      displayName: 'Jeff Super Administrator',
    });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    userRecord = await auth.createUser({
      email,
      password,
      displayName: 'Jeff Super Administrator',
    });
  }

  const profileRef = firestore.collection('users').doc(userRecord.uid);
  const existingProfile = await profileRef.get();
  await profileRef.set(
    {
      name: 'Jeff',
      surname: 'Super Administrator',
      email,
      role: 'super administrator',
      hiddenFromUserList: true,
      createdAt: existingProfile.exists
        ? existingProfile.get('createdAt')
        : Timestamp.now(),
    },
    { merge: true }
  );

  await firestore.collection('roles_admin').doc(userRecord.uid).set({});
  await firestore.collection('roles_super_admin').doc(userRecord.uid).set({});
  console.log(`Super administrator ready: ${email} (${userRecord.uid})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});