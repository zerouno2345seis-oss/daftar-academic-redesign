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
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

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
