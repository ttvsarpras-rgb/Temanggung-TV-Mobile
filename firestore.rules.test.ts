/**
 * Payload-First Security Test Specification (Dirty Dozen Adversarial Suite)
 * Matches security_spec.md and validates invariants for /users/{userId}/favorites/{favoriteId}
 * and /users/{userId}/preferences/playback.
 */

export interface DirtyDozenCase {
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const dirtyDozenCases: DirtyDozenCase[] = [
  {
    name: '1. Unauthenticated read/create',
    path: '/users/u1/favorites/fav1',
    operation: 'create',
    auth: null,
    payload: { userId: 'u1', itemId: 'fav1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email spoof',
    path: '/users/u1/favorites/fav1',
    operation: 'create',
    auth: { uid: 'u1', email_verified: false },
    payload: {
      userId: 'u1',
      itemId: 'fav1',
      itemType: 'channel',
      title: 'Temanggung TV',
      category: 'Siaran Langsung',
      scheduleTime: '24 Jam',
      streamUrl: 'srt://103.79.90.150:5320',
      reminderEnabled: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '3. Cross-user path escalation',
    path: '/users/u2/favorites/fav1',
    operation: 'get',
    auth: { uid: 'u1', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '4. Identity spoofing in body',
    path: '/users/u1/favorites/fav1',
    operation: 'create',
    auth: { uid: 'u1', email_verified: true },
    payload: {
      userId: 'u2',
      itemId: 'fav1',
      itemType: 'program',
      title: 'Kabar Temanggung',
      category: 'Berita',
      scheduleTime: '19:00 WIB',
      streamUrl: 'srt://103.79.90.150:5320',
      reminderEnabled: false,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow field injection on create',
    path: '/users/u1/favorites/fav1',
    operation: 'create',
    auth: { uid: 'u1', email_verified: true },
    payload: {
      userId: 'u1',
      itemId: 'fav1',
      itemType: 'program',
      title: 'Kabar Temanggung',
      category: 'Berita',
      scheduleTime: '19:00 WIB',
      streamUrl: 'srt://103.79.90.150:5320',
      reminderEnabled: false,
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '6. Shadow field injection on update',
    path: '/users/u1/favorites/fav1',
    operation: 'update',
    auth: { uid: 'u1', email_verified: true },
    payload: {
      note: 'Catat jam tayang',
      isVerified: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '7. ID poisoning in document ID',
    path: '/users/u1/favorites/' + 'a'.repeat(200),
    operation: 'create',
    auth: { uid: 'u1', email_verified: true },
    payload: { userId: 'u1', itemId: 'fav1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '8. Oversized string resource poisoning',
    path: '/users/u1/favorites/fav1',
    operation: 'create',
    auth: { uid: 'u1', email_verified: true },
    payload: {
      userId: 'u1',
      itemId: 'fav1',
      itemType: 'program',
      title: 'X'.repeat(200),
      category: 'Berita',
      scheduleTime: '19:00 WIB',
      streamUrl: 'srt://103.79.90.150:5320',
      reminderEnabled: false,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '9. Invalid enum injection',
    path: '/users/u1/preferences/playback',
    operation: 'create',
    auth: { uid: 'u1', email_verified: true },
    payload: {
      userId: 'u1',
      preferredQuality: '8k_ultra',
      dataSaver: false,
      autoPlay: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '10. Forged client timestamp',
    path: '/users/u1/favorites/fav1',
    operation: 'create',
    auth: { uid: 'u1', email_verified: true },
    payload: {
      userId: 'u1',
      itemId: 'fav1',
      itemType: 'channel',
      title: 'Temanggung TV',
      category: 'Siaran Langsung',
      scheduleTime: '24 Jam',
      streamUrl: 'srt://103.79.90.150:5320',
      reminderEnabled: true,
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '11. Ownership mutation on update',
    path: '/users/u1/favorites/fav1',
    operation: 'update',
    auth: { uid: 'u1', email_verified: true },
    payload: { userId: 'u2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '12. Cross-user list scraping',
    path: '/users/u2/favorites',
    operation: 'list',
    auth: { uid: 'u1', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
