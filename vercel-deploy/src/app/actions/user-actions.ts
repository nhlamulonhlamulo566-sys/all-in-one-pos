
'use server';

import { randomBytes } from 'crypto';
import { initializeFirebaseAdmin } from '@/firebase/server';

const PROTECTED_SUPER_ADMIN_EMAIL = 'jeff@gmail.com';

function isProtectedSuperAdmin(email?: string | null, role?: string) {
  return email?.trim().toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL || role === 'super administrator';
}

async function requireAdmin(idToken: string) {
  const { auth, firestore } = initializeFirebaseAdmin();
  if (!idToken) throw new Error('Authentication token is missing.');
  const decoded = await auth.verifyIdToken(idToken);
  const role = await firestore.collection('roles_admin').doc(decoded.uid).get();
  if (!role.exists) throw new Error('Only shop owners and the super administrator can manage users.');
  return { auth, firestore };
}

interface CreateUserPayload {
  email: string;
  name: string;
  surname: string;
  role: 'shop owner' | 'sales';
  displayName?: string;
  idToken: string;
  shopId?: string;
}

export async function createUserAction(
  payload: CreateUserPayload
): Promise<{ success: boolean; uid?: string; error?: string }> {
  try {
    const { auth: adminAuth, firestore } = await requireAdmin(payload.idToken);
    const decoded = await adminAuth.verifyIdToken(payload.idToken);
    const creatorProfile = await firestore.collection('users').doc(decoded.uid).get();
    const creatorData = creatorProfile.data();
    const shopId = creatorData?.role === 'shop owner' ? creatorData.shopId : payload.shopId;
    if (creatorData?.role === 'shop owner' && (!shopId || payload.shopId !== shopId)) {
      throw new Error('Shop owners can only add users to their own shop.');
    }
    if (shopId) {
      const shop = await firestore.collection('shops').doc(shopId).get();
      const maxUsersAllowed = shop.data()?.maxUsersAllowed;
      if (!shop.exists || !Number.isInteger(maxUsersAllowed) || maxUsersAllowed < 1) {
        throw new Error('Shop subscription is not configured.');
      }
      const users = await firestore.collection('users').where('shopId', '==', shopId).get();
      if (users.size >= maxUsersAllowed) {
        throw new Error(`This shop has reached its limit of ${maxUsersAllowed} user accounts.`);
      }
    }
    const { idToken: _idToken, ...userToCreate } = payload;

    const userRecord = await adminAuth.createUser({
      email: userToCreate.email,
      displayName: userToCreate.displayName,
      // The user replaces this server-generated password through the reset email.
      password: randomBytes(32).toString('base64url'),
    });

    try {
      const now = new Date();
      const profileRef = firestore.collection('users').doc(userRecord.uid);
      const roleRef = firestore.collection('roles_admin').doc(userRecord.uid);
      await firestore.runTransaction(async (transaction) => {
        transaction.create(profileRef, {
          id: userRecord.uid,
          name: payload.name.trim(),
          surname: payload.surname.trim(),
          email: payload.email.trim().toLowerCase(),
          role: payload.role,
          shopId: shopId || null,
          createdAt: now,
        });
        if (payload.role === 'shop owner') {
          transaction.set(roleRef, { shopId: shopId || null, createdAt: now });
        }
      });
    } catch (profileError) {
      await adminAuth.deleteUser(userRecord.uid).catch(() => undefined);
      throw profileError;
    }
    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    console.error('Failed to create user:', error);
    let errorMessage = 'An unexpected error occurred during user creation.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'A user with this email address already exists.';
    } else if (error.code === 'auth/invalid-password') {
      errorMessage =
        'The password must be a string with at least six characters.';
    } else if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'The phone number must be a valid E.164 standard compliant identifier (e.g., +11234567890).';
    } else if (error.message) {
        errorMessage = error.message;
    }
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Deletes a user from Firebase Authentication and their associated data in Firestore.
 * This is a server action and should only be called from a trusted client environment
 * by an authorized administrator. Security is enforced by Firestore rules restricting
 * who can trigger this action.
 *
 * @param userId The UID of the user to delete.
 * @returns A promise that resolves to an object indicating success or failure.
 */
export async function deleteUserAction(
  payload: { userId: string; idToken: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { auth: adminAuth, firestore: adminFirestore } = await requireAdmin(payload.idToken);
    const { userId } = payload;

    const [targetAuth, targetProfile] = await Promise.all([
      adminAuth.getUser(userId),
      adminFirestore.collection('users').doc(userId).get(),
    ]);
    if (isProtectedSuperAdmin(targetAuth.email, targetProfile.data()?.role)) {
      throw new Error('The protected super administrator cannot be deleted.');
    }
    
    // Step 1: Delete from Firebase Authentication
    await adminAuth.deleteUser(userId);

    // Step 2: Delete from 'users' collection in Firestore
    const userDocRef = adminFirestore.collection('users').doc(userId);
    await userDocRef.delete();

    // Step 3: Delete from 'roles_admin' collection if they are an admin
    // It's safe to attempt deletion even if the document doesn't exist.
    const adminRoleDocRef = adminFirestore.collection('roles_admin').doc(userId);
    await adminRoleDocRef.delete();

    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    // Provide a more generic error message to the client for security.
    return {
      success: false,
      error: 'An error occurred while deleting the user. This may be due to insufficient permissions.',
    };
  }
}


interface UpdateUserPayload {
  userId: string;
  idToken: string;
  name: string;
  surname: string;
  role: 'shop owner' | 'super administrator' | 'sales';
}

export async function updateUserAction(
  payload: UpdateUserPayload
): Promise<{ success: boolean; error?: string }> {
  const { userId, name, surname, role } = payload;

  try {
    const { auth: adminAuth, firestore: adminFirestore } = await requireAdmin(payload.idToken);
    if (role === 'super administrator') {
      throw new Error('Only the protected super administrator account may have this role.');
    }

    const [targetAuth, targetProfile] = await Promise.all([
      adminAuth.getUser(userId),
      adminFirestore.collection('users').doc(userId).get(),
    ]);
    if (isProtectedSuperAdmin(targetAuth.email, targetProfile.data()?.role)) {
      throw new Error('The protected super administrator cannot be changed.');
    }
    
    const userDocRef = adminFirestore.collection('users').doc(userId);
    const adminRoleDocRef = adminFirestore.collection('roles_admin').doc(userId);

    // Update display name in Firebase Auth
    await adminAuth.updateUser(userId, {
      displayName: `${name} ${surname}`,
    });

    // Update user profile in Firestore
    await userDocRef.update({
      name,
      surname,
      role,
    });

    // Manage admin role in the roles_admin collection
    if (role === 'shop owner') {
      // Add user to admin roles if not already there
      await adminRoleDocRef.set({});
    } else {
      // Remove user from admin roles if they exist
      await adminRoleDocRef.delete();
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update user:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during user update.',
    };
  }
}

export async function completePasswordSetupAction(payload: {
  idToken: string;
  password: string;
}) {
  try {
    const { auth, firestore } = initializeFirebaseAdmin();
    if (!payload.idToken) throw new Error('Authentication token is missing.');
    const decoded = await auth.verifyIdToken(payload.idToken);
    if (payload.password.length < 6) throw new Error('Password must be at least 6 characters.');
    const targetAuth = await auth.getUser(decoded.uid);
    if (isProtectedSuperAdmin(targetAuth.email)) throw new Error('The protected super administrator cannot change password here.');
    await auth.updateUser(decoded.uid, { password: payload.password });
    await firestore.collection('users').doc(decoded.uid).update({ mustChangePassword: false });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unable to update password.' };
  }
}
