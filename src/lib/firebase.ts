import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

type FavoriteKind = 'video' | 'channel' | 'playlist';

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const getFirestoreDocumentId = (item: { firestoreId?: unknown; id?: unknown; url?: unknown } | string) => {
  const candidate = typeof item === 'string'
    ? item
    : String(item.firestoreId || item.id || item.url || '');
  return candidate.replace(/[\/.#$\[\]]/g, '_');
};

const getNormalizedHttpUrl = (...candidates: unknown[]) => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim();
    if (!value) continue;
    if (YOUTUBE_VIDEO_ID_PATTERN.test(value)) {
      return `https://www.youtube.com/watch?v=${value}`;
    }

    const withProtocol = /^www\./i.test(value) ? `https://${value}` : value;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
    } catch {
      // Try the next legacy field. Old favorites used several URL field names.
    }
  }
  return '';
};

/**
 * Make cloud favorites written by older app versions playable as well. Some
 * early share-target records used `link`, `videoUrl`, or only a YouTube id.
 * Keeping the normalizer at the Firestore boundary means every device gets a
 * consistent, safe-to-open object before it reaches the UI.
 */
export const normalizeFirestoreFavorite = <T extends object>(
  item: T,
  type: FavoriteKind,
  firestoreId?: string
) => {
  const source = item as Record<string, any>;
  const url = getNormalizedHttpUrl(
    source.url,
    source.videoUrl,
    source.link,
    source.href,
    source.videoId,
    type === 'video' ? source.id : ''
  );
  const youtubeId = YOUTUBE_VIDEO_ID_PATTERN.test(String(source.videoId || ''))
    ? String(source.videoId)
    : YOUTUBE_VIDEO_ID_PATTERN.test(String(source.id || ''))
      ? String(source.id)
      : '';
  const id = String(source.id || youtubeId || firestoreId || url);
  const fallbackTitle = type === 'video' ? 'فيديو محفوظ' : type === 'channel' ? 'قناة محفوظة' : 'قائمة تشغيل محفوظة';
  const fallbackThumbnail = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60';

  return {
    ...source,
    id,
    url,
    firestoreId: firestoreId || source.firestoreId || getFirestoreDocumentId(source),
    title: source.title || source.name || fallbackTitle,
    duration: source.duration || 'N/A',
    thumbnail: source.thumbnail || source.image || fallbackThumbnail,
    thumbnailAlt: source.thumbnailAlt || source.title || source.name || fallbackTitle,
    selected: source.selected !== false
  };
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const signOutUser = async () => fbSignOut(auth);

export const watchAuthState = (cb: (user: User | null) => void) =>
  onAuthStateChanged(auth, cb);

// Use custom firestoreDatabaseId if configured
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

export const syncFirestoreFavorites = (
  onFavoritesUpdate: (favs: { videos: any[]; channels: any[]; playlists: any[] }) => void
) => {
  try {
    const q = query(collection(db, 'favorites'));
    return onSnapshot(
      q,
      (snapshot) => {
        const videos: any[] = [];
        const channels: any[] = [];
        const playlists: any[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const normalized = normalizeFirestoreFavorite(data, data.type, docSnap.id);
          if (data.type === 'video') videos.push(normalized);
          else if (data.type === 'channel') channels.push(normalized);
          else if (data.type === 'playlist') playlists.push(normalized);
        });

        onFavoritesUpdate({ videos, channels, playlists });
      },
      (error) => {
        console.warn('Firestore snapshot listener error:', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to Firestore favorites:', err);
    return () => {};
  }
};

export const saveFavoriteToFirestore = async (
  item: any,
  type: FavoriteKind
) => {
  try {
    const docId = getFirestoreDocumentId(item);
    if (!docId) throw new Error('A favorite needs an id or URL before it can be saved.');
    const docRef = doc(db, 'favorites', docId);
    const normalized = normalizeFirestoreFavorite(item, type, docId);
    await setDoc(docRef, {
      ...normalized,
      type,
      createdAt: item.createdAt || new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error('Error saving favorite to Firestore:', err);
  }
};

export const removeFavoriteFromFirestore = async (item: { firestoreId?: unknown; id?: unknown; url?: unknown } | string) => {
  try {
    const docId = getFirestoreDocumentId(item);
    if (!docId) return;
    const docRef = doc(db, 'favorites', docId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error removing favorite from Firestore:', err);
  }
};

export const syncFavoriteTrash = (onUpdate: (items: any[]) => void) => {
  try {
    return onSnapshot(
      query(collection(db, 'favoriteTrash')),
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => items.push(docSnap.data()));
        onUpdate(items);
      },
      (error) => console.warn('Firestore favoriteTrash snapshot error:', error)
    );
  } catch (err) {
    console.warn('Failed to subscribe to Firestore favorite trash:', err);
    return () => {};
  }
};

export const saveFavoriteToTrash = async (item: any) => {
  try {
    const docId = String(item.id).replace(/[\/\.#$\[\]]/g, '_');
    await setDoc(doc(db, 'favoriteTrash', docId), {
      ...item,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving favorite to trash:', err);
  }
};

export const deleteFavoriteFromTrash = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'favoriteTrash', id));
  } catch (err) {
    console.error('Error deleting favorite from trash:', err);
  }
};

// Favorite Folders (multiple named folders inside Favorites, distinct from
// the general "Collections" feature)
export const syncFavoriteFolders = (
  onUpdate: (folders: any[]) => void
) => {
  try {
    const q = query(collection(db, 'favoriteFolders'));
    return onSnapshot(
      q,
      (snapshot) => {
        const folders: any[] = [];
        snapshot.forEach((docSnap) => folders.push(docSnap.data()));
        onUpdate(folders);
      },
      (error) => {
        console.warn('Firestore favoriteFolders listener error:', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to Firestore favorite folders:', err);
    return () => {};
  }
};

export const saveFavoriteFolderToFirestore = async (folder: { id: string; name: string; createdAt: string }) => {
  try {
    const docRef = doc(db, 'favoriteFolders', folder.id);
    await setDoc(docRef, folder);
  } catch (err) {
    console.error('Error saving favorite folder to Firestore:', err);
  }
};

export const deleteFavoriteFolderFromFirestore = async (id: string) => {
  try {
    const docRef = doc(db, 'favoriteFolders', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting favorite folder from Firestore:', err);
  }
};

// Collection folders contain the full list of saved items in each folder.
// Keeping them in their own collection makes folder structure and membership
// available on every signed-in device, just like individual favorites.
export const syncCollectionFolders = (onUpdate: (folders: any[]) => void) => {
  try {
    return onSnapshot(
      query(collection(db, 'collections')),
      (snapshot) => {
        const folders: any[] = [];
        snapshot.forEach((docSnap) => folders.push(docSnap.data()));
        onUpdate(folders);
      },
      (error) => {
        console.warn('Firestore collections listener error:', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to Firestore collections:', err);
    return () => {};
  }
};

export const saveCollectionFolderToFirestore = async (folder: any) => {
  try {
    await setDoc(doc(db, 'collections', folder.id), {
      ...folder,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving collection folder to Firestore:', err);
  }
};

export const deleteCollectionFolderFromFirestore = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'collections', id));
  } catch (err) {
    console.error('Error deleting collection folder from Firestore:', err);
  }
};
