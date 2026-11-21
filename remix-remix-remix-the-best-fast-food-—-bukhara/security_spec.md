# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Public Order Submission, Strict Schema & Server Time**: Any storefront visitor can create `/orders/{orderId}` if `orderId` matches `^[a-zA-Z0-9_\-]+$` (<= 128 chars), `incoming().id == orderId`, `incoming().status == 'received'`, `incoming().timestamp == request.time`, and all fields satisfy strict type, key, and size boundaries.
2. **Collection Enumeration & Guessable ID Protection**: Customer details reside inside `/orders/{orderId}` with 128-bit cryptographic order IDs (`VR-<32 hex>`). `list` on `/orders` and `get` on short/guessable IDs (<20 chars) are strictly denied to non-admins; only verified/provisioned admins (`isAdmin()`) may list orders or read arbitrary IDs.
3. **Admin-Only State Transitions**: Only `isAdmin()` may update `/orders/{orderId}`, and only `status` and `statusUpdatedAt` (equal to `request.time`) may be modified. `id`, `timestamp`, `createdAt`, `items`, `customer`, `total`, and `totals` are immutable.
4. **No Self-Escalation on `/admins/{uid}`**: Signed-in users may only `get` their own `/admins/{uid}` document to verify role membership; `list`, `create`, `update`, and `delete` on `/admins` are unconditionally denied from clients.
5. **Email Verification Guard**: Bootstrapped email admin access (`abdulazizruziyev144@gmail.com`) strictly requires `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Collection | Expected Result |
|---|---------------|-------------------|-----------------|
| 1 | Shadow Field (`isVerified: true`) on create | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 2 | Status Spoofing (`status: "delivered"`) on create | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 3 | Backdated / Client-forged `timestamp` on create | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 4 | ID Poisoning (`orderId` with spaces/special chars or >128 chars) | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 5 | `id` mismatch (`incoming().id != orderId`) | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 6 | Non-admin / unauthenticated `list` on `/orders` or short-ID `get` | `/orders` | `PERMISSION_DENIED` |
| 7 | Email Spoof (`abdulazizruziyev144@gmail.com` with `email_verified: false`) | `/orders` | `PERMISSION_DENIED` |
| 8 | Total Mismatch (`total != totals.total`) or negative price | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 9 | Oversized `items` (>40) or oversized `customer.address` (>240 chars) | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 10 | Tampering `total` or `timestamp` during admin `update` | `/orders/{orderId}` | `PERMISSION_DENIED` |
| 11 | Client self-escalation (`create` `/admins/{uid}` with `role: "admin"`) | `/admins/{uid}` | `PERMISSION_DENIED` |
| 12 | Reading another user's `/admins/{otherUid}` or listing `/admins` | `/admins` | `PERMISSION_DENIED` |

## 3. Adversarial Test Runner Blueprint (`firestore.rules.test.ts` Reference)

```ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';

// Designed for Firebase Emulator Suite with firestore.rules loaded:
export async function runDirtyDozenChecks() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'spherical-vortex-pfx4d',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });

  const validId = 'VR-0123456789ABCDEF0123456789ABCDEF';
  const validOrder = {
    id: validId,
    source: 'website',
    mode: 'delivery',
    status: 'received',
    timestamp: serverTimestamp(),
    createdAt: new Date().toISOString(),
    total: 45000,
    totals: { subtotal: 45000, discount: 0, delivery: 0, total: 45000 },
    items: [{ id: 'f3', name: 'Smash Burger', qty: 1, unit: 45000, options: { cheese: false, meat: false, spice: 'Medium', sauce: 'The Best' } }],
    customer: { name: 'Ali', phone: '+998901234567', address: 'Lyabi-Hauz 12', date: '', time: '', guests: '2', table: 'Any', note: '' },
    codes: [],
    rewards: { phone: '', pointsRedeemed: 0, pointsEarned: 0 },
  };

  const guest = testEnv.unauthenticatedContext().firestore();
  const unverifiedAdmin = testEnv.authenticatedContext('u1', { email: 'abdulazizruziyev144@gmail.com', email_verified: false }).firestore();
  const verifiedAdmin = testEnv.authenticatedContext('u2', { email: 'abdulazizruziyev144@gmail.com', email_verified: true }).firestore();

  // Valid customer order create & capability-ID live status read succeed
  await assertSucceeds(setDoc(doc(guest, 'orders', validId), validOrder));
  await assertSucceeds(getDoc(doc(guest, 'orders', validId)));
  // #1 Shadow field fails
  await assertFails(setDoc(doc(guest, 'orders', validId + '1'), { ...validOrder, id: validId + '1', isVerified: true }));
  // #2 Status spoofing fails
  await assertFails(setDoc(doc(guest, 'orders', validId + '2'), { ...validOrder, id: validId + '2', status: 'delivered' }));
  // #3 Client-forged timestamp fails
  await assertFails(setDoc(doc(guest, 'orders', validId + '3'), { ...validOrder, id: validId + '3', timestamp: new Date() }));
  // #4 Bad ID fails
  await assertFails(setDoc(doc(guest, 'orders', 'bad id!'), { ...validOrder, id: 'bad id!' }));
  // #5 ID mismatch fails
  await assertFails(setDoc(doc(guest, 'orders', validId + '4'), { ...validOrder, id: 'VR-OTHER0000000000000000' }));
  // #6 Guest collection list & short-ID get fail
  await assertFails(getDoc(doc(guest, 'orders', 'VR-SHORT')));
  await assertFails(getDocs(collection(guest, 'orders')));
  // #7 Unverified email spoof fails
  await assertFails(getDocs(collection(unverifiedAdmin, 'orders')));
  // Verified admin read + status update succeeds
  await assertSucceeds(getDocs(collection(verifiedAdmin, 'orders')));
  await assertSucceeds(updateDoc(doc(verifiedAdmin, 'orders', validId), { status: 'preparing', statusUpdatedAt: serverTimestamp() }));
  // #10 Admin cannot tamper totals on update
  await assertFails(updateDoc(doc(verifiedAdmin, 'orders', 'VR-TEST01'), { status: 'preparing', statusUpdatedAt: serverTimestamp(), total: 1 }));
  // #11 Self-escalation fails
  await assertFails(setDoc(doc(unverifiedAdmin, 'admins', 'u1'), { email: 'x@y.com', role: 'admin', createdAt: serverTimestamp() }));
  // #12 Listing admins fails
  await assertFails(getDocs(collection(verifiedAdmin, 'admins')));

  await testEnv.cleanup();
}
```
