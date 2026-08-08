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
          if (data.type === 'video') videos.push(data);
          else if (data.type === 'channel') channels.push(data);
          else if (data.type === 'playlist') playlists.push(data);
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
  type: 'video' | 'channel' | 'playlist'
) => {
  try {
    const docId = String(item.id || item.url).replace(/[\/\.#$\[\]]/g, '_');
    const docRef = doc(db, 'favorites', docId);
    await setDoc(docRef, {
      ...item,
      type,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving favorite to Firestore:', err);
  }
};

export const removeFavoriteFromFirestore = async (idOrUrl: string) => {
  try {
    const docId = String(idOrUrl).replace(/[\/\.#$\[\]]/g, '_');
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
