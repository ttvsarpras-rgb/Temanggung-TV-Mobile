# Firestore Security Specification — Temanggung TV

## 1. Data Invariants
1. **Strict Ownership Isolation**: A `FavoriteBroadcast` at `/users/{userId}/favorites/{favoriteId}` or a `PlaybackPreference` at `/users/{userId}/preferences/{prefId}` belongs strictly to the authenticated, email-verified user whose `request.auth.uid == userId` AND whose document field `userId == request.auth.uid`.
2. **Verified Identity & Anti-Spoofing**: All reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`. No user can read, list, create, update, or delete documents under another user's `{userId}` path.
3. **Immutable Ownership & Creation Timestamp**: On update, `userId` and `createdAt` (for favorites) and `itemId`/`itemType` must remain unchanged. Timestamps (`createdAt`, `updatedAt`) MUST equal `request.time`.
4. **Strict Schema & Volumetric Bounds**: All strings enforce exact `min`/`max` `.size()` bounds matching `firebase-blueprint.json`, IDs match `^[a-zA-Z0-9_\-]+$`, `itemType` is constrained to `['channel', 'program', 'moment']`, `preferredQuality` is constrained to `['auto', '1080p', '720p', '480p']`, and `prefId` is restricted to `'playback'`. Shadow/ghost keys are rejected via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `user = null`, attempt `get` or `create` on `/users/u1/favorites/fav1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth.uid = 'u1'`, `email_verified = false`, attempt `create` on `/users/u1/favorites/fav1` -> `PERMISSION_DENIED`.
3. **Cross-User Path Escalation**: `auth.uid = 'u1'`, attempt `create` or `get` on `/users/u2/favorites/fav1` -> `PERMISSION_DENIED`.
4. **Identity Spoofing in Body**: `auth.uid = 'u1'`, path `/users/u1/favorites/fav1`, body sets `userId: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Create**: `auth.uid = 'u1'`, valid favorite + `{ isAdmin: true }` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection on Update**: `auth.uid = 'u1'`, update `{ note: 'ok', isVerified: true, updatedAt: serverTimestamp() }` -> `PERMISSION_DENIED`.
7. **ID Poisoning (Path)**: `favoriteId` = 200-char string or `'bad/id$!'` -> `PERMISSION_DENIED`.
8. **Resource Poisoning (Oversized String)**: `title` > 120 chars or `note` > 240 chars or `streamUrl` > 240 chars -> `PERMISSION_DENIED`.
9. **Invalid Enum Injection**: `itemType: 'admin_override'` or `preferredQuality: '8k_ultra'` -> `PERMISSION_DENIED`.
10. **Forged Client Timestamp**: `createdAt: new Date('2020-01-01')` instead of `request.time` -> `PERMISSION_DENIED`.
11. **Ownership Mutation on Update**: `auth.uid = 'u1'`, attempt updating `userId` or `createdAt` -> `PERMISSION_DENIED`.
12. **Cross-User List Scraping**: `auth.uid = 'u1'`, attempt `list` on `/users/u2/favorites` -> `PERMISSION_DENIED`.
