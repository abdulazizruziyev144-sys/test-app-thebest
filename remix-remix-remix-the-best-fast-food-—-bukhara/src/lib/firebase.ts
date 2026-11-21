import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Order, OrderStatus, UserProfile } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function isAuthorizedAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.email === 'abdulazizruziyev144@gmail.com' && user.emailVerified) {
    return true;
  }
  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function loginAdmin(email: string, password: string): Promise<{ user: User; token: string }> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const allowed = await isAuthorizedAdmin(cred.user);
  if (!allowed) {
    await signOut(auth);
    throw new Error('This account is not authorized for admin access or its email is unverified.');
  }
  const token = await cred.user.getIdToken();
  return { user: cred.user, token };
}

export async function loginAdminWithGoogle(): Promise<{ user: User; token: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const allowed = await isAuthorizedAdmin(result.user);
  if (!allowed) {
    throw new Error('Access denied. Only authorized Owner & Kitchen accounts can unlock this console.');
  }
  const token = await result.user.getIdToken();
  return { user: result.user, token };
}

export async function getAdminSession(): Promise<{ user: User; token: string } | null> {
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const allowed = await isAuthorizedAdmin(user);
    if (!allowed) return null;
    const token = await user.getIdToken();
    return { user, token };
  } catch {
    return null;
  }
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid || uid),
      displayName: String(data.displayName || '').slice(0, 80),
      email: String(data.email || '').slice(0, 120),
      photoURL: String(data.photoURL || '').slice(0, 500),
      phone: String(data.phone || '').slice(0, 24),
      defaultAddress: String(data.defaultAddress || '').slice(0, 240),
      favorites: Array.isArray(data.favorites)
        ? data.favorites.slice(0, 50).map((f) => String(f).slice(0, 40))
        : [],
      updatedAt: String(data.updatedAt || new Date().toISOString()),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  const payload = {
    uid: String(profile.uid).slice(0, 128),
    displayName: String(profile.displayName || '').trim().slice(0, 80),
    email: String(profile.email || '').trim().slice(0, 120),
    photoURL: String(profile.photoURL || '').trim().slice(0, 500),
    phone: String(profile.phone || '').trim().slice(0, 24),
    defaultAddress: String(profile.defaultAddress || '').trim().slice(0, 240),
    favorites: Array.isArray(profile.favorites)
      ? Array.from(new Set(profile.favorites.map((f) => String(f).slice(0, 40)))).slice(0, 50)
      : [],
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'users', profile.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserOrdersFromFirestore(uid: string): Promise<Order[]> {
  const path = 'orders';
  try {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', uid),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => {
        const data = d.data();
        const tsIso =
          data.timestamp && typeof data.timestamp.toDate === 'function'
            ? data.timestamp.toDate().toISOString()
            : data.createdAt;
        const parsedNotes = parseOrderNotes(data.customer?.note);
        const isDineIn =
          typeof data.customer?.table === 'string' && data.customer.table.startsWith('Dine-in');
        return {
          ...(data as Order),
          id: data.id || d.id,
          mode: isDineIn ? 'dine-in' : (data.mode as Order['mode']),
          createdAt: tsIso || data.createdAt,
          deliveryInstructions: data.deliveryInstructions || parsedNotes.deliveryInstructions,
          dietaryNotes: data.dietaryNotes || parsedNotes.dietaryNotes,
        };
      })
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function encodeOrderNotes(deliveryInstructions?: string, dietaryNotes?: string, fallbackNote?: string): string {
  const del = String(deliveryInstructions || '').trim();
  const diet = String(dietaryNotes || '').trim();
  if (!del && !diet) {
    return String(fallbackNote || '').trim().slice(0, 240);
  }
  return [del ? `Delivery: ${del}` : '', diet ? `Dietary: ${diet}` : '']
    .filter(Boolean)
    .join(' | ')
    .slice(0, 240);
}

export function parseOrderNotes(note?: string): { deliveryInstructions?: string; dietaryNotes?: string } {
  const raw = String(note || '').trim();
  if (!raw) return {};
  const parts = raw.split(/\s+\|\s+/);
  let deliveryInstructions: string | undefined;
  let dietaryNotes: string | undefined;
  for (const part of parts) {
    if (part.startsWith('Delivery:')) {
      deliveryInstructions = part.slice('Delivery:'.length).trim();
    } else if (part.startsWith('Dietary:')) {
      dietaryNotes = part.slice('Dietary:'.length).trim();
    }
  }
  return {
    ...(deliveryInstructions ? { deliveryInstructions } : {}),
    ...(dietaryNotes ? { dietaryNotes } : {}),
  };
}

export async function saveOrderToFirestore(saved: Order): Promise<void> {
  const path = `orders/${saved.id}`;
  const encodedNote = encodeOrderNotes(saved.deliveryInstructions, saved.dietaryNotes, saved.customer?.note);
  const firestoreMode = saved.mode === 'dine-in' ? 'reservation' : String(saved.mode || 'delivery');
  const rawTable = String(saved.customer?.table || '').trim();
  const firestoreTable =
    saved.mode === 'dine-in'
      ? (rawTable.startsWith('Dine-in') ? rawTable : `Dine-in ${rawTable ? `#${rawTable}` : ''}`.trim()).slice(0, 20)
      : rawTable.slice(0, 20);
  const currentUid = auth.currentUser?.uid;
  const payload = {
    id: String(saved.id),
    ...(saved.userId && currentUid && saved.userId === currentUid
      ? { userId: String(saved.userId).slice(0, 128) }
      : {}),
    source: 'website',
    mode: firestoreMode,
    status: 'received',
    timestamp: serverTimestamp(),
    createdAt: String(saved.createdAt || new Date().toISOString()),
    ...(saved.scheduledDeliveryTime
      ? { scheduledDeliveryTime: String(saved.scheduledDeliveryTime).trim().slice(0, 40) }
      : {}),
    ...(saved.paymentMethod
      ? { paymentMethod: saved.paymentMethod }
      : {}),
    ...(saved.deliveryCoords &&
    typeof saved.deliveryCoords.lat === 'number' &&
    typeof saved.deliveryCoords.lng === 'number'
      ? {
          deliveryCoords: {
            lat: Number(saved.deliveryCoords.lat),
            lng: Number(saved.deliveryCoords.lng),
            ...(typeof saved.deliveryCoords.distanceKm === 'number'
              ? { distanceKm: Number(saved.deliveryCoords.distanceKm) }
              : {}),
            ...(typeof saved.deliveryCoords.etaMinutes === 'number'
              ? { etaMinutes: Number(saved.deliveryCoords.etaMinutes) }
              : {}),
          },
        }
      : {}),
    total: Math.round(Number(saved.totals?.total) || 0),
    totals: {
      subtotal: Math.round(Number(saved.totals?.subtotal) || 0),
      discount: Math.round(Number(saved.totals?.discount) || 0),
      delivery: Math.round(Number(saved.totals?.delivery) || 0),
      total: Math.round(Number(saved.totals?.total) || 0),
    },
    items: Array.isArray(saved.items)
      ? saved.items.slice(0, 40).map((item) => ({
          id: String(item.id || '').slice(0, 40),
          name: String(item.name || '').slice(0, 120),
          qty: Math.max(1, Math.min(99, Math.round(Number(item.qty) || 1))),
          unit: Math.max(0, Math.round(Number(item.unit) || 0)),
          options: item.options && typeof item.options === 'object' ? item.options : {},
          ...(Array.isArray(item.bundle) && item.bundle.length === 3
            ? { bundle: item.bundle.map(String) }
            : {}),
        }))
      : [],
    customer: {
      name: String(saved.customer?.name || '').slice(0, 80),
      phone: String(saved.customer?.phone || '').slice(0, 24),
      address: String(saved.customer?.address || '').slice(0, 240),
      date: String(saved.customer?.date || '').slice(0, 20),
      time: String(saved.customer?.time || '').slice(0, 10),
      guests: String(saved.customer?.guests || '').slice(0, 10),
      table: firestoreTable,
      note: encodedNote,
    },
    codes: Array.isArray(saved.codes) ? saved.codes.slice(0, 3).map((c) => String(c).slice(0, 20)) : [],
    rewards: {
      phone: String(saved.rewards?.phone || '').slice(0, 24),
      pointsRedeemed: Math.max(0, Math.round(Number(saved.rewards?.pointsRedeemed) || 0)),
      pointsEarned: Math.max(0, Math.round(Number(saved.rewards?.pointsEarned) || 0)),
    },
  };

  try {
    await setDoc(doc(db, 'orders', saved.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchOrdersFromFirestore(): Promise<Order[]> {
  const path = 'orders';
  try {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      const tsIso =
        data.timestamp && typeof data.timestamp.toDate === 'function'
          ? data.timestamp.toDate().toISOString()
          : data.createdAt;
      const parsedNotes = parseOrderNotes(data.customer?.note);
      const isDineIn = typeof data.customer?.table === 'string' && data.customer.table.startsWith('Dine-in');
      return {
        ...(data as Order),
        id: data.id || d.id,
        mode: isDineIn ? 'dine-in' : (data.mode as Order['mode']),
        createdAt: tsIso || data.createdAt,
        deliveryInstructions: data.deliveryInstructions || parsedNotes.deliveryInstructions,
        dietaryNotes: data.dietaryNotes || parsedNotes.dietaryNotes,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateOrderStatusInFirestore(
  orderId: string,
  status: OrderStatus,
  kitchenNote?: string
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      ...(typeof kitchenNote === 'string' ? { kitchenNote: kitchenNote.trim().slice(0, 160) } : {}),
      statusUpdatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderKitchenNoteInFirestore(
  orderId: string,
  kitchenNote: string
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      kitchenNote: kitchenNote.trim().slice(0, 160),
      statusUpdatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeOrderStatus(
  orderId: string,
  onUpdate: (orderId: string, status: string | null, exists: boolean, kitchenNote?: string) => void
): () => void {
  if (!orderId || !/^[a-zA-Z0-9_-]{20,128}$/.test(orderId)) return () => {};
  const path = `orders/${orderId}`;
  return onSnapshot(
    doc(db, 'orders', orderId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(orderId, null, false);
        return;
      }
      const data = snap.data();
      onUpdate(
        orderId,
        data?.status ?? null,
        true,
        typeof data?.kitchenNote === 'string' ? data.kitchenNote : undefined
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Error already logged as structured JSON by handleFirestoreError; avoid crashing async listener
      }
    }
  );
}
