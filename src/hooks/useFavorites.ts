import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  FavoriteBroadcast,
  FavoriteItemType,
  PlaybackPreference,
  StreamQuality,
} from '../types/broadcast';

const LOCAL_FAVORITES_KEY = 'ttv_local_favorites_v1';
const LOCAL_PREFS_KEY = 'ttv_local_prefs_v1';

const DEFAULT_PREFS: PlaybackPreference = {
  preferredQuality: 'auto',
  dataSaver: false,
  autoPlay: true,
};

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function sanitizeDocId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned && VALID_ID_REGEX.test(cleaned) ? cleaned : `item_${Date.now()}`;
}

function clampText(raw: string, maxLen: number, fallback: string): string {
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : fallback;
}

function readLocalFavorites(): FavoriteBroadcast[] {
  try {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(items: FavoriteBroadcast[]): void {
  try {
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

function readLocalPrefs(): PlaybackPreference {
  try {
    const raw = localStorage.getItem(LOCAL_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      preferredQuality: ['auto', '1080p', '720p', '480p'].includes(parsed?.preferredQuality)
        ? parsed.preferredQuality
        : 'auto',
      dataSaver: Boolean(parsed?.dataSaver),
      autoPlay: parsed?.autoPlay !== undefined ? Boolean(parsed.autoPlay) : true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeLocalPrefs(prefs: PlaybackPreference): void {
  try {
    localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export interface SaveFavoriteInput {
  itemId: string;
  itemType: FavoriteItemType;
  title: string;
  category: string;
  scheduleTime: string;
  streamUrl: string;
  note?: string;
  reminderEnabled?: boolean;
}

export function useFavorites() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBroadcast[]>(() => readLocalFavorites());
  const [preferences, setPreferences] = useState<PlaybackPreference>(() => readLocalPrefs());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore favorites and preferences when user is signed in
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setFavorites(readLocalFavorites());
      setPreferences(readLocalPrefs());
      return;
    }

    setSyncing(true);
    const favPath = `users/${user.uid}/favorites`;
    const favQuery = query(
      collection(db, favPath),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubFavs = onSnapshot(
      favQuery,
      (snapshot) => {
        const items: FavoriteBroadcast[] = snapshot.docs.map((d) => {
          const data = d.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
          const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : createdAt;
          return {
            id: d.id,
            userId: String(data.userId || user.uid),
            itemId: String(data.itemId || d.id),
            itemType: (data.itemType as FavoriteItemType) || 'program',
            title: String(data.title || ''),
            category: String(data.category || ''),
            scheduleTime: String(data.scheduleTime || ''),
            streamUrl: String(data.streamUrl || ''),
            note: typeof data.note === 'string' ? data.note : undefined,
            reminderEnabled: Boolean(data.reminderEnabled),
            createdAtMs: createdAt,
            updatedAtMs: updatedAt,
          };
        });
        setFavorites(items);
        setSyncing(false);
      },
      (error) => {
        setSyncing(false);
        handleFirestoreError(error, OperationType.LIST, favPath);
      }
    );

    const prefDocPath = `users/${user.uid}/preferences`;
    const prefDocRef = doc(db, prefDocPath, 'playback');
    const unsubPrefs = onSnapshot(
      prefDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const nextPrefs: PlaybackPreference = {
            preferredQuality: ['auto', '1080p', '720p', '480p'].includes(data.preferredQuality)
              ? (data.preferredQuality as StreamQuality)
              : 'auto',
            dataSaver: Boolean(data.dataSaver),
            autoPlay: data.autoPlay !== undefined ? Boolean(data.autoPlay) : true,
          };
          setPreferences(nextPrefs);
          writeLocalPrefs(nextPrefs);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `${prefDocPath}/playback`);
      }
    );

    return () => {
      unsubFavs();
      unsubPrefs();
    };
  }, [authReady, user]);

  // Migrate any locally saved guest favorites into Firestore upon sign-in
  const syncLocalToCloud = useCallback(async (signedInUser: User) => {
    const localItems = readLocalFavorites();
    if (localItems.length === 0) return;

    for (const item of localItems) {
      const safeId = sanitizeDocId(item.itemId || item.id);
      const docPath = `users/${signedInUser.uid}/favorites/${safeId}`;
      try {
        await setDoc(
          doc(db, `users/${signedInUser.uid}/favorites`, safeId),
          {
            userId: signedInUser.uid,
            itemId: safeId,
            itemType: ['channel', 'program', 'moment'].includes(item.itemType) ? item.itemType : 'program',
            title: clampText(item.title, 120, 'Siaran Temanggung TV'),
            category: clampText(item.category, 50, 'Siaran Langsung'),
            scheduleTime: clampText(item.scheduleTime, 60, '24 Jam'),
            streamUrl: clampText(item.streamUrl, 240, 'srt://103.79.90.150:5320'),
            ...(item.note ? { note: item.note.trim().slice(0, 240) } : {}),
            reminderEnabled: Boolean(item.reminderEnabled),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    }
    localStorage.removeItem(LOCAL_FAVORITES_KEY);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await syncLocalToCloud(cred.user);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal masuk dengan Google';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Tidak dapat masuk ke akun Google. Pastikan popup tidak diblokir.');
      }
    }
  }, [syncLocalToCloud]);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const isFavorited = useCallback(
    (itemId: string): boolean => {
      const safeId = sanitizeDocId(itemId);
      return favorites.some((fav) => fav.itemId === safeId || fav.id === safeId);
    },
    [favorites]
  );

  const saveFavorite = useCallback(
    async (input: SaveFavoriteInput) => {
      const safeId = sanitizeDocId(input.itemId);
      const cleanTitle = clampText(input.title, 120, 'Siaran Temanggung TV');
      const cleanCategory = clampText(input.category, 50, 'Siaran Langsung');
      const cleanSchedule = clampText(input.scheduleTime, 60, '24 Jam');
      const cleanStreamUrl = clampText(input.streamUrl, 240, 'srt://103.79.90.150:5320');
      const cleanNote = input.note ? input.note.trim().slice(0, 240) : undefined;
      const reminder = Boolean(input.reminderEnabled);

      if (!user) {
        const now = Date.now();
        const nextItem: FavoriteBroadcast = {
          id: safeId,
          userId: 'local',
          itemId: safeId,
          itemType: input.itemType,
          title: cleanTitle,
          category: cleanCategory,
          scheduleTime: cleanSchedule,
          streamUrl: cleanStreamUrl,
          note: cleanNote,
          reminderEnabled: reminder,
          createdAtMs: now,
          updatedAtMs: now,
        };
        setFavorites((prev) => {
          const filtered = prev.filter((p) => p.itemId !== safeId);
          const next = [nextItem, ...filtered];
          writeLocalFavorites(next);
          return next;
        });
        return;
      }

      const colPath = `users/${user.uid}/favorites`;
      const existingItem = favorites.find((f) => f.itemId === safeId || f.id === safeId);

      try {
        if (existingItem) {
          await updateDoc(doc(db, colPath, existingItem.id), {
            title: cleanTitle,
            category: cleanCategory,
            scheduleTime: cleanSchedule,
            streamUrl: cleanStreamUrl,
            ...(cleanNote !== undefined ? { note: cleanNote } : {}),
            reminderEnabled: reminder,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, colPath, safeId), {
            userId: user.uid,
            itemId: safeId,
            itemType: input.itemType,
            title: cleanTitle,
            category: cleanCategory,
            scheduleTime: cleanSchedule,
            streamUrl: cleanStreamUrl,
            ...(cleanNote !== undefined ? { note: cleanNote } : {}),
            reminderEnabled: reminder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(
          error,
          existingItem ? OperationType.UPDATE : OperationType.CREATE,
          `${colPath}/${safeId}`
        );
      }
    },
    [favorites, user]
  );

  const removeFavorite = useCallback(
    async (itemIdOrDocId: string) => {
      const safeId = sanitizeDocId(itemIdOrDocId);
      if (!user) {
        setFavorites((prev) => {
          const next = prev.filter((item) => item.id !== safeId && item.itemId !== safeId);
          writeLocalFavorites(next);
          return next;
        });
        return;
      }

      const target = favorites.find((f) => f.id === safeId || f.itemId === safeId);
      const docId = target ? target.id : safeId;
      const docPath = `users/${user.uid}/favorites/${docId}`;
      try {
        await deleteDoc(doc(db, `users/${user.uid}/favorites`, docId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [favorites, user]
  );

  const updateFavoriteDetails = useCallback(
    async (docId: string, updates: { note?: string; reminderEnabled?: boolean }) => {
      const safeId = sanitizeDocId(docId);
      const cleanNote = updates.note !== undefined ? updates.note.trim().slice(0, 240) : undefined;

      if (!user) {
        setFavorites((prev) => {
          const next = prev.map((item) => {
            if (item.id !== safeId && item.itemId !== safeId) return item;
            return {
              ...item,
              ...(cleanNote !== undefined ? { note: cleanNote } : {}),
              ...(updates.reminderEnabled !== undefined ? { reminderEnabled: updates.reminderEnabled } : {}),
              updatedAtMs: Date.now(),
            };
          });
          writeLocalFavorites(next);
          return next;
        });
        return;
      }

      const colPath = `users/${user.uid}/favorites`;
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (cleanNote !== undefined) {
        payload.note = cleanNote;
      }
      if (updates.reminderEnabled !== undefined) {
        payload.reminderEnabled = updates.reminderEnabled;
      }

      try {
        await updateDoc(doc(db, colPath, safeId), payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${colPath}/${safeId}`);
      }
    },
    [user]
  );

  const updatePreferences = useCallback(
    async (partial: Partial<PlaybackPreference>) => {
      const merged: PlaybackPreference = {
        ...preferences,
        ...partial,
      };
      setPreferences(merged);
      writeLocalPrefs(merged);

      if (!user) return;

      const docPath = `users/${user.uid}/preferences/playback`;
      try {
        await setDoc(
          doc(db, `users/${user.uid}/preferences`, 'playback'),
          {
            userId: user.uid,
            preferredQuality: merged.preferredQuality,
            dataSaver: merged.dataSaver,
            autoPlay: merged.autoPlay,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    },
    [preferences, user]
  );

  return {
    user,
    authReady,
    authError,
    syncing,
    favorites,
    preferences,
    isFavorited,
    saveFavorite,
    removeFavorite,
    updateFavoriteDetails,
    updatePreferences,
    signInWithGoogle,
    signOutUser,
  };
}
