import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../config/firebase';
import { useAuth } from './AuthContext';
import { WatchlistItem, WatchHistoryItem, ContentItem } from '../types';

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  history: WatchHistoryItem[];
  loadingWatchlist: boolean;
  isInWatchlist: (contentId: string) => boolean;
  toggleWatchlist: (content: ContentItem) => Promise<void>;
  updateProgress: (
    content: ContentItem,
    episodeId?: string,
    episodeNumber?: number,
    progressSec?: number,
    durationSec?: number
  ) => Promise<void>;
  clearHistoryItem: (contentId: string) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType>({
  watchlist: [],
  history: [],
  loadingWatchlist: false,
  isInWatchlist: () => false,
  toggleWatchlist: async () => {},
  updateProgress: async () => {},
  clearHistoryItem: async () => {},
});

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);

  // Load from Firestore or local storage
  const loadUserData = useCallback(async () => {
    if (!user) {
      const localW = localStorage.getItem('watchanime_local_watchlist');
      const localH = localStorage.getItem('watchanime_local_history');
      setWatchlist(localW ? JSON.parse(localW) : []);
      setHistory(localH ? JSON.parse(localH) : []);
      return;
    }

    setLoadingWatchlist(true);
    const watchlistPath = `users/${user.uid}/watchlist`;
    const historyPath = `users/${user.uid}/history`;

    try {
      const snapW = await getDocs(collection(db, 'users', user.uid, 'watchlist'));
      const listW: WatchlistItem[] = [];
      snapW.forEach((d) => listW.push(d.data() as WatchlistItem));
      setWatchlist(listW);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, watchlistPath);
    }

    try {
      const snapH = await getDocs(collection(db, 'users', user.uid, 'history'));
      const listH: WatchHistoryItem[] = [];
      snapH.forEach((d) => listH.push(d.data() as WatchHistoryItem));
      // Sort newest first
      listH.sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime());
      setHistory(listH);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, historyPath);
    } finally {
      setLoadingWatchlist(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData().catch((err) => {
      console.warn('Failed to load user data from Firestore:', err);
    });
  }, [loadUserData]);

  const isInWatchlist = (contentId: string): boolean => {
    return watchlist.some((w) => w.contentId === contentId);
  };

  const toggleWatchlist = async (content: ContentItem) => {
    const existing = isInWatchlist(content.id);
    const item: WatchlistItem = {
      contentId: content.id,
      title: content.title,
      posterUrl: content.posterUrl,
      type: content.type,
      rating: content.rating ?? 8.0,
      addedAt: new Date().toISOString(),
    };

    if (existing) {
      // Remove
      setWatchlist((prev) => prev.filter((w) => w.contentId !== content.id));
      if (user) {
        const itemPath = `users/${user.uid}/watchlist/${content.id}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'watchlist', content.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, itemPath);
        }
      } else {
        const updated = watchlist.filter((w) => w.contentId !== content.id);
        localStorage.setItem('watchanime_local_watchlist', JSON.stringify(updated));
      }
    } else {
      // Add
      setWatchlist((prev) => [item, ...prev]);
      if (user) {
        const itemPath = `users/${user.uid}/watchlist/${content.id}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'watchlist', content.id), item);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, itemPath);
        }
      } else {
        const updated = [item, ...watchlist];
        localStorage.setItem('watchanime_local_watchlist', JSON.stringify(updated));
      }
    }
  };

  const updateProgress = async (
    content: ContentItem,
    episodeId?: string,
    episodeNumber?: number,
    progressSec = 0,
    durationSec = 0
  ) => {
    const historyItem: WatchHistoryItem = {
      contentId: content.id,
      episodeId: episodeId || '',
      title: content.title,
      posterUrl: content.posterUrl,
      type: content.type,
      episodeNumber: episodeNumber || 1,
      progressSeconds: progressSec,
      durationSeconds: durationSec,
      lastWatchedAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      const filtered = prev.filter((h) => h.contentId !== content.id);
      return [historyItem, ...filtered];
    });

    if (user) {
      const path = `users/${user.uid}/history/${content.id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'history', content.id), historyItem);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } else {
      const filtered = history.filter((h) => h.contentId !== content.id);
      const updated = [historyItem, ...filtered];
      localStorage.setItem('watchanime_local_history', JSON.stringify(updated));
    }
  };

  const clearHistoryItem = async (contentId: string) => {
    setHistory((prev) => prev.filter((h) => h.contentId !== contentId));
    if (user) {
      const path = `users/${user.uid}/history/${contentId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'history', contentId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    } else {
      const updated = history.filter((h) => h.contentId !== contentId);
      localStorage.setItem('watchanime_local_history', JSON.stringify(updated));
    }
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        history,
        loadingWatchlist,
        isInWatchlist,
        toggleWatchlist,
        updateProgress,
        clearHistoryItem,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => useContext(WatchlistContext);
