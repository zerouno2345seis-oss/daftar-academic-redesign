import React, { useState, useEffect, useRef } from 'react';
import { SearchResultItem, ChannelItem, PlaylistItem, Language, ThemeMode, ColorTag, FavoriteFolder } from '../types';
import { t } from '../utils/translations';
import {
  syncFirestoreFavorites,
  saveFavoriteToFirestore,
  removeFavoriteFromFirestore,
  syncFavoriteFolders,
  saveFavoriteFolderToFirestore,
  deleteFavoriteFolderFromFirestore
} from '../lib/firebase';
import {
  Search,
  CheckSquare,
  Copy,
  Info,
  FolderOpen,
  History,
  Settings,
  CheckCircle2,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  Sun,
  Moon,
  Languages,
  Youtube,
  Loader2,
  Sparkles,
  Users,
  Film,
  FileText,
  Play,
  Eye,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronUp,
  X,
  ListOrdered,
  List,
  Layers,
  BookOpen,
  ArrowUpDown,
  Palette,
  Calendar,
  Filter,
  Star,
  Heart,
  Pause,
  SkipForward,
  SkipBack,
  Minimize2,
  Maximize2,
  PictureInPicture2,
  Shrink,
  Expand
} from 'lucide-react';

const SERVER_SEARCH_TIMEOUT_MS = 12_000;

export interface CollectionFolder {
  id: string;
  name: string;
  createdAt: string;
  items: SearchResultItem[];
}

interface Props {
  theme: ThemeMode;
  onThemeToggle: () => void;
  lang: Language;
  userEmail?: string;
  onSignOut?: () => void;
}

export const YTLinkerOps: React.FC<Props> = ({
  theme,
  onThemeToggle,
  lang,
  userEmail,
  onSignOut
}) => {
  // فتح/إغلاق الشريط الجانبي على الشاشات الصغيرة
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLight = theme === 'editorial-light';
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'collections' | 'favorites' | 'history' | 'settings'>('search');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Favorites state stored in LocalStorage
  const [favoriteVideos, setFavoriteVideos] = useState<SearchResultItem[]>(() => {
    try {
      const saved = localStorage.getItem('yt_linker_fav_videos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favoriteChannels, setFavoriteChannels] = useState<ChannelItem[]>(() => {
    try {
      const saved = localStorage.getItem('yt_linker_fav_channels');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favoritePlaylists, setFavoritePlaylists] = useState<PlaylistItem[]>(() => {
    try {
      const saved = localStorage.getItem('yt_linker_fav_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favoritesFilter, setFavoritesFilter] = useState<'all' | 'videos' | 'channels' | 'playlists'>('all');

  // Favorite Folders: organize favorite videos into multiple named folders
  const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolder[]>(() => {
    try {
      const saved = localStorage.getItem('yt_linker_fav_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeFavoriteFolderId, setActiveFavoriteFolderId] = useState<string>('all');
  const [newFolderNameInput, setNewFolderNameInput] = useState('');

  useEffect(() => {
    localStorage.setItem('yt_linker_fav_folders', JSON.stringify(favoriteFolders));
  }, [favoriteFolders]);

  useEffect(() => {
    const unsubscribe = syncFavoriteFolders((folders) => {
      if (folders.length > 0) setFavoriteFolders(folders as FavoriteFolder[]);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateFavoriteFolder = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const folder: FavoriteFolder = {
      id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      createdAt: new Date().toISOString()
    };
    setFavoriteFolders((prev) => [folder, ...prev]);
    saveFavoriteFolderToFirestore(folder);
    setNewFolderNameInput('');
    setActiveFavoriteFolderId(folder.id);
    showToast(`تم إنشاء مجلد "${trimmed}" داخل المفضلة`);
  };

  const handleDeleteFavoriteFolder = (folderId: string) => {
    setFavoriteFolders((prev) => prev.filter((f) => f.id !== folderId));
    setFavoriteVideos((prev) => prev.map((v) => (v.folderId === folderId ? { ...v, folderId: undefined } : v)));
    deleteFavoriteFolderFromFirestore(folderId);
    if (activeFavoriteFolderId === folderId) setActiveFavoriteFolderId('all');
    showToast('تم حذف المجلد (بقيت الفيديوهات في المفضلة العامة)');
  };

  const handleAssignFavoriteVideoToFolder = (video: SearchResultItem, folderId: string | undefined) => {
    const updated = { ...video, folderId };
    setFavoriteVideos((prev) => prev.map((v) => (v.id === video.id ? updated : v)));
    saveFavoriteToFirestore(updated, 'video');
  };

  useEffect(() => {
    localStorage.setItem('yt_linker_fav_videos', JSON.stringify(favoriteVideos));
  }, [favoriteVideos]);

  useEffect(() => {
    localStorage.setItem('yt_linker_fav_channels', JSON.stringify(favoriteChannels));
  }, [favoriteChannels]);

  useEffect(() => {
    localStorage.setItem('yt_linker_fav_playlists', JSON.stringify(favoritePlaylists));
  }, [favoritePlaylists]);

  // Sync with Cloud Firestore
  useEffect(() => {
    const unsubscribe = syncFirestoreFavorites(({ videos, channels, playlists }) => {
      if (videos.length > 0) setFavoriteVideos(videos);
      if (channels.length > 0) setFavoriteChannels(channels);
      if (playlists.length > 0) setFavoritePlaylists(playlists);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleFavoriteVideo = (video: SearchResultItem) => {
    const exists = favoriteVideos.some((v) => v.id === video.id || v.url === video.url);
    if (exists) {
      setFavoriteVideos((prev) => prev.filter((v) => v.id !== video.id && v.url !== video.url));
      removeFavoriteFromFirestore(video.id || video.url);
      showToast(lang === 'ar' ? 'تمت إزالة الفيديو من المفضلة (Cloud Firestore)' : 'Removed from favorites (Firestore)');
    } else {
      const updated = { ...video, isFavorite: true };
      setFavoriteVideos((prev) => [updated, ...prev]);
      saveFavoriteToFirestore(updated, 'video');
      showToast(lang === 'ar' ? 'تمت حفظ الفيديو بـ Cloud Firestore ⭐' : 'Saved to Cloud Firestore ⭐');
    }
  };

  const handleToggleFavoriteChannel = (channel: ChannelItem) => {
    const exists = favoriteChannels.some((c) => c.id === channel.id || c.url === channel.url);
    if (exists) {
      setFavoriteChannels((prev) => prev.filter((c) => c.id !== channel.id && c.url !== channel.url));
      removeFavoriteFromFirestore(channel.id || channel.url);
      showToast(lang === 'ar' ? 'تمت إزالة القناة من المفضلة (Cloud Firestore)' : 'Removed channel from favorites');
    } else {
      const updated = { ...channel, isFavorite: true };
      setFavoriteChannels((prev) => [updated, ...prev]);
      saveFavoriteToFirestore(updated, 'channel');
      showToast(lang === 'ar' ? 'تمت حفظ القناة بـ Cloud Firestore ⭐' : 'Saved channel to Cloud Firestore ⭐');
    }
  };

  const handleToggleFavoritePlaylist = (playlist: PlaylistItem) => {
    const exists = favoritePlaylists.some((p) => p.id === playlist.id || p.url === playlist.url);
    if (exists) {
      setFavoritePlaylists((prev) => prev.filter((p) => p.id !== playlist.id && p.url !== playlist.url));
      removeFavoriteFromFirestore(playlist.id || playlist.url);
      showToast(lang === 'ar' ? 'تمت إزالة قائمة التشغيل من المفضلة (Cloud Firestore)' : 'Removed playlist from favorites');
    } else {
      const updated = { ...playlist, isFavorite: true };
      setFavoritePlaylists((prev) => [updated, ...prev]);
      saveFavoriteToFirestore(updated, 'playlist');
      showToast(lang === 'ar' ? 'تمت حفظ قائمة التشغيل بـ Cloud Firestore ⭐' : 'Saved playlist to Cloud Firestore ⭐');
    }
  };

  // Active view section in search tab
  const [searchSection, setSearchSection] = useState<'all' | 'videos' | 'channels'>('all');

  // Sorting state for Videos and Channels
  type VideoSortOption = 'default' | 'views_desc' | 'date_desc' | 'date_asc' | 'color';
  type ChannelSortOption = 'default' | 'subscribers_desc' | 'name_asc' | 'color';

  const [videoSortOption, setVideoSortOption] = useState<VideoSortOption>('default');
  const [channelSortOption, setChannelSortOption] = useState<ChannelSortOption>('default');

  // View mode (grid of icons vs. list) for video & channel results
  type ViewMode = 'grid' | 'list';
  const [videoViewMode, setVideoViewMode] = useState<ViewMode>('grid');
  const [channelViewMode, setChannelViewMode] = useState<ViewMode>('grid');
  const [mobileVideoOptionsOpen, setMobileVideoOptionsOpen] = useState(false);

  // Helper functions for sorting & parsing
  const parseViewsNumber = (viewsStr?: string): number => {
    if (!viewsStr) return 0;
    const clean = viewsStr.replace(/,/g, '').toLowerCase();
    const match = clean.match(/([\d.]+)\s*([kmb]?)/);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    if (isNaN(val)) return 0;
    const unit = match[2];
    if (unit === 'k') return val * 1000;
    if (unit === 'm') return val * 1000000;
    if (unit === 'b') return val * 1000000000;
    return val;
  };

  const parseRelativeDateScore = (dateStr?: string): number => {
    if (!dateStr) return 0;
    const str = dateStr.toLowerCase();
    let multiplier = 1;
    if (str.includes('second') || str.includes('ثانية') || str.includes('ثوان')) multiplier = 1;
    else if (str.includes('minute') || str.includes('دقيقة') || str.includes('دقائق')) multiplier = 60;
    else if (str.includes('hour') || str.includes('ساعة') || str.includes('ساعات')) multiplier = 3600;
    else if (str.includes('day') || str.includes('يوم') || str.includes('أيام') || str.includes('ايام')) multiplier = 86400;
    else if (str.includes('week') || str.includes('أسبوع') || str.includes('اسبوع')) multiplier = 604800;
    else if (str.includes('month') || str.includes('شهر') || str.includes('أشهر') || str.includes('اشهر')) multiplier = 2592000;
    else if (str.includes('year') || str.includes('سنة') || str.includes('سنوات') || str.includes('عام')) multiplier = 31536000;

    const numMatch = str.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 1;
    const secondsAgo = num * multiplier;
    return 10000000000 - secondsAgo;
  };

  const COLOR_ORDER: Record<string, number> = {
    red: 1,
    blue: 2,
    green: 3,
    yellow: 4,
    purple: 5,
    none: 6
  };

  const getColorRank = (c?: ColorTag) => COLOR_ORDER[c || 'none'] || 6;

  const getSortedVideos = (rawItems: SearchResultItem[], sortOpt: VideoSortOption) => {
    if (sortOpt === 'default') return rawItems;
    const copy = [...rawItems];
    if (sortOpt === 'views_desc') {
      return copy.sort((a, b) => parseViewsNumber(b.views) - parseViewsNumber(a.views));
    }
    if (sortOpt === 'date_desc') {
      return copy.sort((a, b) => parseRelativeDateScore(b.publishedAt) - parseRelativeDateScore(a.publishedAt));
    }
    if (sortOpt === 'date_asc') {
      return copy.sort((a, b) => parseRelativeDateScore(a.publishedAt) - parseRelativeDateScore(b.publishedAt));
    }
    if (sortOpt === 'color') {
      return copy.sort((a, b) => getColorRank(a.colorTag) - getColorRank(b.colorTag));
    }
    return copy;
  };

  const getSortedChannels = (rawChannels: ChannelItem[], sortOpt: ChannelSortOption) => {
    if (sortOpt === 'default') return rawChannels;
    const copy = [...rawChannels];
    if (sortOpt === 'subscribers_desc') {
      return copy.sort((a, b) => parseViewsNumber(b.subscribers || b.videoCount) - parseViewsNumber(a.subscribers || a.videoCount));
    }
    if (sortOpt === 'name_asc') {
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }
    if (sortOpt === 'color') {
      return copy.sort((a, b) => getColorRank(a.colorTag) - getColorRank(b.colorTag));
    }
    return copy;
  };

  const handleSetItemColor = (id: string, color: ColorTag) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, colorTag: i.colorTag === color ? 'none' : color } : i))
    );
  };

  const handleSetChannelColor = (id: string, color: ColorTag) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, colorTag: ch.colorTag === color ? 'none' : color } : ch))
    );
  };

  const handleOpenChannelFromVideo = (item: SearchResultItem) => {
    const name = item.channelTitle || 'قناة يوتيوب';
    const url = item.channelUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`;
    const channelObj: ChannelItem = {
      id: url || `channel-${item.id}`,
      name: name,
      url: url,
      avatar: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
      description: `قناة ${name} - مستخرجة من فيديو ${item.title}`
    };
    handleOpenChannelModal(channelObj);
  };

  // Video Preview Modal
  const [previewVideo, setPreviewVideo] = useState<SearchResultItem | null>(null);

  // Playback queue (playlist behind the preview player) + player UI state
  const [playerQueue, setPlayerQueue] = useState<SearchResultItem[]>([]);
  const [playerQueueIndex, setPlayerQueueIndex] = useState(0);
  const [playerMinimized, setPlayerMinimized] = useState(false);
  type PlayerSize = 'compact' | 'standard' | 'large';
  const [playerSize, setPlayerSize] = useState<PlayerSize>('standard');
  // وضع الصوت فقط: يبقى التشغيل جاريًا مع إخفاء الصورة تمامًا داخل المتصفح
  const [audioOnlyMode, setAudioOnlyMode] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const ytPlayerRef = useRef<any>(null);
  const ytPlayerContainerRef = useRef<HTMLDivElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const playerDockRef = useRef<HTMLDivElement | null>(null);

  // Keep the queue in sync with whichever video is currently previewed.
  // If the video was opened directly (not via openPlayerQueue), fall back to a single-item queue.
  useEffect(() => {
    if (!previewVideo) return;
    setPlayerQueue((prevQueue) => {
      const idx = prevQueue.findIndex((v) => v.id === previewVideo.id);
      if (idx !== -1) {
        setPlayerQueueIndex(idx);
        return prevQueue;
      }
      setPlayerQueueIndex(0);
      return [previewVideo];
    });
  }, [previewVideo?.id]);

  const openPlayerQueue = (videos: SearchResultItem[], startIndex: number = 0) => {
    const valid = videos.filter((v) => v && v.id);
    if (valid.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد فيديوهات صالحة للتشغيل في هذه القائمة' : 'No playable videos in this list');
      return;
    }
    const safeIndex = Math.min(Math.max(startIndex, 0), valid.length - 1);
    setPlayerQueue(valid);
    setPlayerQueueIndex(safeIndex);
    setPreviewVideo(valid[safeIndex]);
    setPlayerMinimized(false);
  };

  const handlePlayerNext = () => {
    if (playerQueue.length === 0) return;
    const nextIndex = (playerQueueIndex + 1) % playerQueue.length;
    setPlayerQueueIndex(nextIndex);
    setPreviewVideo(playerQueue[nextIndex]);
  };

  const handlePlayerPrev = () => {
    if (playerQueue.length === 0) return;
    const prevIndex = (playerQueueIndex - 1 + playerQueue.length) % playerQueue.length;
    setPlayerQueueIndex(prevIndex);
    setPreviewVideo(playerQueue[prevIndex]);
  };

  const closePlayerAndCleanupPip = () => {
    if (pipWindowRef.current) {
      try { pipWindowRef.current.close(); } catch {}
      pipWindowRef.current = null;
    }
    setIsPipActive(false);
    setPlayerMinimized(false);
    setPreviewVideo(null);
    setPlayerQueue([]);
    setPlayerQueueIndex(0);
  };

  const handleTogglePictureInPicture = async () => {
    const w: any = window;
    if (!('documentPictureInPicture' in w)) {
      // Not supported (Safari / Firefox) — fall back to the in-page docked mini player.
      setPlayerMinimized(true);
      showToast(lang === 'ar'
        ? 'المتصفح لا يدعم النافذة العائمة الحقيقية، تم التصغير داخل الصفحة بدلاً منها'
        : 'True floating PiP is not supported here, minimized inside the page instead');
      return;
    }
    try {
      if (isPipActive && pipWindowRef.current) {
        pipWindowRef.current.close();
        return;
      }
      const pipWindow: Window = await w.documentPictureInPicture.requestWindow({ width: 420, height: 300 });
      pipWindowRef.current = pipWindow;

      // Copy stylesheets so the embedded player container looks consistent in the PiP window
      [...document.styleSheets].forEach((sheet) => {
        try {
          const cssRules = [...sheet.cssRules].map((rule) => rule.cssText).join('');
          const style = pipWindow.document.createElement('style');
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
        } catch {
          if (sheet.href) {
            const link = pipWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pipWindow.document.head.appendChild(link);
          }
        }
      });
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.background = '#000';

      if (ytPlayerContainerRef.current) {
        pipWindow.document.body.appendChild(ytPlayerContainerRef.current);
      }

      setIsPipActive(true);
      pipWindow.addEventListener('pagehide', () => {
        // Move the player back into the main document when the PiP window closes
        if (ytPlayerContainerRef.current && playerDockRef.current) {
          playerDockRef.current.appendChild(ytPlayerContainerRef.current);
        }
        pipWindowRef.current = null;
        setIsPipActive(false);
      });
    } catch (err) {
      console.warn('Document Picture-in-Picture failed, falling back to minimized mode:', err);
      setPlayerMinimized(true);
    }
  };

  // Loads the official YouTube IFrame Player API once, then creates/reuses a real
  // YT.Player instance so we can detect "video ended" and auto-advance the queue,
  // instead of a raw <iframe src="..."> that offers no playback events.
  const ensureYouTubeIframeApi = (): Promise<void> => {
    const w: any = window;
    if (w.YT && w.YT.Player) return Promise.resolve();
    if (!w.__ytIframeApiPromise) {
      w.__ytIframeApiPromise = new Promise<void>((resolve) => {
        const prevCallback = w.onYouTubeIframeAPIReady;
        w.onYouTubeIframeAPIReady = () => {
          if (typeof prevCallback === 'function') prevCallback();
          resolve();
        };
        if (!document.getElementById('yt-iframe-api-script')) {
          const tag = document.createElement('script');
          tag.id = 'yt-iframe-api-script';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }
      });
    }
    return w.__ytIframeApiPromise;
  };

  useEffect(() => {
    let cancelled = false;

    if (!previewVideo) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
      return;
    }

    ensureYouTubeIframeApi().then(() => {
      if (cancelled || !previewVideo) return;

      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        ytPlayerRef.current.loadVideoById(previewVideo.id);
        return;
      }

      if (!ytPlayerContainerRef.current) return;
      ytPlayerRef.current = new (window as any).YT.Player(ytPlayerContainerRef.current, {
        videoId: previewVideo.id,
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onStateChange: (event: any) => {
            // 0 = ended. Advance to the next item only if this preview came from a queue of 2+ videos.
            if (event.data === 0) {
              setPlayerQueue((currentQueue) => {
                if (currentQueue.length > 1) {
                  setPlayerQueueIndex((currentIndex) => {
                    const next = (currentIndex + 1) % currentQueue.length;
                    setPreviewVideo(currentQueue[next]);
                    return next;
                  });
                }
                return currentQueue;
              });
            }
          }
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [previewVideo?.id]);

  // Destroy the player on unmount only
  useEffect(() => {
    return () => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        ytPlayerRef.current.destroy();
      }
    };
  }, []);

  // Channel drilldown modal
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);
  const [channelVideos, setChannelVideos] = useState<SearchResultItem[]>([]);
  const [loadingChannelVideos, setLoadingChannelVideos] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);

  // Custom Channel URL Extraction Modal
  const [showChannelInputModal, setShowChannelInputModal] = useState(false);
  const [customChannelUrlInput, setCustomChannelUrlInput] = useState('');

  // Manual link addition
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');

  // Channel Playlists & Tab state
  const [channelTabMode, setChannelTabMode] = useState<'videos' | 'playlists'>('videos');
  const [channelPlaylists, setChannelPlaylists] = useState<PlaylistItem[]>([]);
  const [loadingChannelPlaylists, setLoadingChannelPlaylists] = useState(false);

  // Standalone Playlist Extraction Modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistVideos, setPlaylistVideos] = useState<SearchResultItem[]>([]);
  const [playlistModalTitle, setPlaylistModalTitle] = useState('');
  const [loadingPlaylistVideos, setLoadingPlaylistVideos] = useState(false);
  const [displayedPlaylistVideosCount, setDisplayedPlaylistVideosCount] = useState(25);

  // Notebook Chunker Modal (299 items per level batch)
  const [showChunkerModal, setShowChunkerModal] = useState(false);
  const [chunkerItems, setChunkerItems] = useState<SearchResultItem[]>([]);
  const [chunkerTitle, setChunkerTitle] = useState('');

  const openChunkerModal = (itemsToChunk: SearchResultItem[], title: string) => {
    if (!itemsToChunk || itemsToChunk.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد عناصر لتقسيمها' : 'No items to chunk');
      return;
    }
    setChunkerItems(itemsToChunk);
    setChunkerTitle(title);
    setShowChunkerModal(true);
  };

  const getChunks299 = (list: SearchResultItem[]) => {
    const CHUNK_SIZE = 299;
    const chunks: { level: number; startIdx: number; endIdx: number; items: SearchResultItem[] }[] = [];
    for (let i = 0; i < list.length; i += CHUNK_SIZE) {
      const slice = list.slice(i, i + CHUNK_SIZE);
      chunks.push({
        level: Math.floor(i / CHUNK_SIZE) + 1,
        startIdx: i + 1,
        endIdx: i + slice.length,
        items: slice
      });
    }
    return chunks;
  };

  const handleCopyLevelLinks = (levelItems: SearchResultItem[], levelNum: number) => {
    const urls = levelItems.map((item) => item.url).join('\n');
    navigator.clipboard.writeText(urls);
    showToast(
      lang === 'ar'
        ? `تم نسخ روابط المستوى ${levelNum} (${levelItems.length} فيديو) إلى الحافظة بنجاح!`
        : `Copied Level ${levelNum} links (${levelItems.length} items) to clipboard!`
    );
  };

  const handleExportLevelTxt = (levelItems: SearchResultItem[], levelNum: number, sourceTitle: string) => {
    const textContent = levelItems.map((i) => `${i.title}\n${i.url}`).join('\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level_${levelNum}_${sourceTitle.replace(/[\s\W]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(lang === 'ar' ? `تم تحميل ملف TXT للمستوى ${levelNum}` : `Exported Level ${levelNum} TXT file`);
  };

  const handleExportLevelMd = (levelItems: SearchResultItem[], levelNum: number, sourceTitle: string) => {
    const mdContent = `# ${sourceTitle} - المستوى ${levelNum} (${levelItems.length} فيديو)\n\n` +
      levelItems.map((i, idx) => `${idx + 1}. [${i.title}](${i.url}) (${i.duration})`).join('\n');
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level_${levelNum}_${sourceTitle.replace(/[\s\W]+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(lang === 'ar' ? `تم تحميل ملف MD للمستوى ${levelNum}` : `Exported Level ${levelNum} MD file`);
  };

  // NotebookLM Integration Modal
  const [showNotebookLMModal, setShowNotebookLMModal] = useState(false);
  const [notebookLMItems, setNotebookLMItems] = useState<SearchResultItem[]>([]);
  const [notebookLMTitle, setNotebookLMTitle] = useState('');
  const [notebookLMFormat, setNotebookLMFormat] = useState<'urls' | 'markdown'>('urls');

  const handleOpenNotebookLMModal = (itemsToNotebook: SearchResultItem[], title: string) => {
    if (!itemsToNotebook || itemsToNotebook.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد مصادر لإنشاء الدفتر' : 'No items to create notebook');
      return;
    }
    const slice299 = itemsToNotebook.slice(0, 299);
    setNotebookLMItems(slice299);
    setNotebookLMTitle(title || (lang === 'ar' ? 'دفتر يوتيوب جديد' : 'New YouTube Notebook'));
    setShowNotebookLMModal(true);

    // Auto-copy raw URLs to clipboard for fast NotebookLM source adding
    const rawUrls = slice299.map((i) => i.url).join('\n');
    navigator.clipboard.writeText(rawUrls);
    showToast(
      lang === 'ar'
        ? `تم تجهيز ${slice299.length} فيديو ونسخ روابطها لـ NotebookLM!`
        : `Prepared ${slice299.length} videos & copied URLs for NotebookLM!`
    );
  };

  const handleCopyNotebookLMText = (format: 'urls' | 'markdown') => {
    if (notebookLMItems.length === 0) return;
    if (format === 'urls') {
      const urls = notebookLMItems.map((i) => i.url).join('\n');
      navigator.clipboard.writeText(urls);
      showToast(lang === 'ar' ? `تم نسخ ${notebookLMItems.length} رابط يوتيوب لـ NotebookLM!` : `Copied ${notebookLMItems.length} raw URLs!`);
    } else {
      let md = `# 📘 ${notebookLMTitle} (${notebookLMItems.length} مصدر فيديو)\n\n`;
      md += `> تم توليد مصادر هذا الدفتر بواسطة YT-Linker Ops للاستخدام في NotebookLM (Gemini).\n\n`;
      md += `## 📋 قائمة مصادر يوتيوب:\n\n`;
      notebookLMItems.forEach((item, idx) => {
        md += `${idx + 1}. [${item.title}](${item.url}) - ${item.channelTitle || 'YouTube'}\n`;
      });
      navigator.clipboard.writeText(md);
      showToast(lang === 'ar' ? `تم نسخ التنسيق المنظم (Markdown) لـ NotebookLM!` : `Copied formatted Markdown for NotebookLM!`);
    }
  };

  const handleDownloadNotebookLMMd = () => {
    if (notebookLMItems.length === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    let md = `# 📘 دفتر مصادر NotebookLM: ${notebookLMTitle}\n\n`;
    md += `**تاريخ الإنشاء:** \`${dateStr}\`  \n`;
    md += `**إجمالي المصادر:** \`${notebookLMItems.length} فيديو\` (ضمن السعة القصوى 299)  \n\n`;
    md += `---\n\n## 📋 تفاصيل المصادر المستخرجة:\n\n`;
    notebookLMItems.forEach((item, idx) => {
      md += `### ${idx + 1}. ${item.title}\n`;
      md += `- **رابط الفيديو:** ${item.url}\n`;
      md += `- **القناة:** ${item.channelTitle || 'N/A'}\n`;
      md += `- **المدة:** ${item.duration || 'N/A'}\n\n`;
    });
    md += `---\n\n## 🔗 القائمة المباشرة لروابط يوتيوب (جاهزة للاستيراد في NotebookLM):\n\n\`\`\`text\n`;
    notebookLMItems.forEach((item) => {
      md += `${item.url}\n`;
    });
    md += `\`\`\`\n`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NotebookLM_${notebookLMTitle.replace(/[\s\W]+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(lang === 'ar' ? 'تم تنزيل مستند مصادر الدفتر بنجاح!' : 'Downloaded NotebookLM source document!');
  };

  const handleExtractPlaylist = async (playlistInput: string, customTitle?: string) => {
    if (!playlistInput.trim()) return;
    setLoadingPlaylistVideos(true);
    setShowPlaylistModal(true);
    setPlaylistVideos([]);
    setDisplayedPlaylistVideosCount(100);
    setPlaylistModalTitle(customTitle || (lang === 'ar' ? 'فيديوهات قائمة التشغيل' : 'Playlist Videos'));

    try {
      const res = await fetch(`/api/youtube/playlist-videos?url=${encodeURIComponent(playlistInput)}`);
      if (!res.ok) throw new Error('Failed to fetch playlist videos');
      const data = await res.json();
      const vids: SearchResultItem[] = Array.isArray(data.videos)
        ? data.videos.map((v: any) => ({ ...v, selected: true }))
        : [];
      setPlaylistVideos(vids);
      if (data.playlistTitle) setPlaylistModalTitle(data.playlistTitle);
      setHistoryLogs((prev) => [`Extracted ${vids.length} videos from playlist "${data.playlistTitle || playlistInput}"`, ...prev]);
      showToast(lang === 'ar' ? `تم استخراج ${vids.length} فيديو من قائمة التشغيل بنجاح!` : `Extracted ${vids.length} playlist videos!`);
    } catch (err) {
      console.error('Playlist Videos Fetch Error:', err);
      showToast(lang === 'ar' ? 'تعذر استخراج فيديوهات قائمة التشغيل' : 'Failed to extract playlist videos');
    } finally {
      setLoadingPlaylistVideos(false);
    }
  };

  const handleFetchChannelPlaylists = async (channel: ChannelItem) => {
    setLoadingChannelPlaylists(true);
    try {
      const res = await fetch(`/api/youtube/channel-playlists?url=${encodeURIComponent(channel.url)}&name=${encodeURIComponent(channel.name)}`);
      if (!res.ok) throw new Error('Failed to fetch channel playlists');
      const data = await res.json();
      const pls: PlaylistItem[] = Array.isArray(data.playlists) ? data.playlists : [];
      setChannelPlaylists(pls);
      showToast(lang === 'ar' ? `تم العثور على ${pls.length} قائمة تشغيل للقناة` : `Found ${pls.length} channel playlists`);
    } catch (err) {
      console.error('Channel Playlists Error:', err);
      showToast(lang === 'ar' ? 'تعذر جلب قوائم تشغيل القناة' : 'Failed to fetch channel playlists');
    } finally {
      setLoadingChannelPlaylists(false);
    }
  };

  // Pagination & Load More states
  const [displayedSearchCount, setDisplayedSearchCount] = useState(20);
  const [searchPage, setSearchPage] = useState(1);
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);

  const [displayedChannelVideosCount, setDisplayedChannelVideosCount] = useState(20);

  // Collections state (Folders)
  const [collectionFolders, setCollectionFolders] = useState<CollectionFolder[]>([]);
  const [showSaveFolderModal, setShowSaveFolderModal] = useState(false);
  const [targetFolderItems, setTargetFolderItems] = useState<SearchResultItem[]>([]);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [selectedExistingFolderId, setSelectedExistingFolderId] = useState<string>('new');
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // History log
  const [historyLogs, setHistoryLogs] = useState<string[]>([
    'System initialized YT-Linker Engine v2.5.0',
    'Ready for video extraction (50+ items) & channel discovery'
  ]);

  const selectedCount = items.filter((item) => item.selected).length;
  const isAllSelected = items.length > 0 && items.every((item) => item.selected);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const parseYtInitialData = (data: any) => {
    const returnedVideos: SearchResultItem[] = [];
    const returnedChannels: ChannelItem[] = [];

    try {
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (Array.isArray(contents)) {
        for (const section of contents) {
          const items = section?.itemSectionRenderer?.contents;
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const vidId = vr.videoId;
                if (!vidId) continue;
                const title = vr.title?.runs?.map((r: any) => r.text).join('') || 'فيديو يوتيوب';
                const duration = vr.lengthText?.simpleText || 'N/A';
                const channelTitle = vr.ownerText?.runs?.[0]?.text || 'قناة يوتيوب';
                const channelUrl = vr.ownerText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
                  ? `https://www.youtube.com${vr.ownerText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`
                  : '';
                const views = vr.viewCountText?.simpleText || vr.shortViewCountText?.simpleText || '';
                const publishedAt = vr.publishedTimeText?.simpleText || '';
                const thumbs = vr.thumbnail?.thumbnails;
                const thumbnail = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

                returnedVideos.push({
                  id: vidId,
                  title,
                  duration,
                  url: `https://www.youtube.com/watch?v=${vidId}`,
                  thumbnail,
                  thumbnailAlt: title,
                  selected: true,
                  channelTitle,
                  channelUrl,
                  views,
                  publishedAt
                });
              } else if (item.channelRenderer) {
                const cr = item.channelRenderer;
                const channelId = cr.channelId;
                const name = cr.title?.simpleText || cr.title?.runs?.[0]?.text || 'قناة يوتيوب';
                const thumbs = cr.thumbnail?.thumbnails;
                const avatar = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60';
                const subscribers = cr.subscriberCountText?.simpleText || '';
                const videoCount = cr.videoCountText?.runs?.[0]?.text || cr.videoCountText?.simpleText || '';
                const url = cr.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
                  ? `https://www.youtube.com${cr.navigationEndpoint.commandMetadata.webCommandMetadata.url}`
                  : `https://www.youtube.com/channel/${channelId}`;

                returnedChannels.push({
                  id: channelId || url,
                  name,
                  url,
                  avatar,
                  subscribers,
                  videoCount,
                  description: cr.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || name
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error parsing ytInitialData:', err);
    }

    return { returnedVideos, returnedChannels };
  };

  const performClientSideYouTubeSearch = async (searchQuery: string): Promise<boolean> => {
    console.log(`[Client-Side Search Fallback] Querying directly from browser for: "${searchQuery}"`);

    // 1. Direct YouTube link or handle check
    if (searchQuery.includes('youtube.com/watch') || searchQuery.includes('youtu.be/')) {
      const match = searchQuery.match(/(?:watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        const vidId = match[1];
        const directVid: SearchResultItem = {
          id: vidId,
          title: `فيديو يوتيوب (${vidId})`,
          duration: 'N/A',
          url: `https://www.youtube.com/watch?v=${vidId}`,
          thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
          thumbnailAlt: 'YouTube Video',
          selected: true,
          channelTitle: 'رابط مباشر',
          channelUrl: searchQuery,
          views: '',
          publishedAt: ''
        };
        setItems([directVid]);
        showToast(lang === 'ar' ? 'تم استخراج الفيديو من الرابط المباشر!' : 'Extracted video from direct link!');
        return true;
      }
    }

    const fetchWithTimeout = async (url: string, ms = 3000) => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), ms);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    // 2. Parallel query to public Piped / Invidious APIs
    const endpoints = [
      `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(searchQuery)}&filter=all`,
      `https://api.piped.privacydev.net/search?q=${encodeURIComponent(searchQuery)}&filter=all`,
      `https://inv.tux.pizza/api/v1/search?q=${encodeURIComponent(searchQuery)}`,
      `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(searchQuery)}`,
      `https://yewtu.be/api/v1/search?q=${encodeURIComponent(searchQuery)}`
    ];

    const results = await Promise.allSettled(endpoints.map((ep) => fetchWithTimeout(ep, 3500)));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const data = r.value;
        const returnedVideos: SearchResultItem[] = [];
        const returnedChannels: ChannelItem[] = [];

        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            if (item.type === 'stream' || item.url?.includes('/watch?v=')) {
              const vidId = item.url ? item.url.replace('/watch?v=', '') : `vid-${Math.random()}`;
              returnedVideos.push({
                id: vidId,
                title: item.title || searchQuery,
                duration: item.duration ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}` : 'N/A',
                url: `https://www.youtube.com/watch?v=${vidId}`,
                thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                thumbnailAlt: item.title,
                selected: true,
                channelTitle: item.uploaderName || 'YouTube Channel',
                channelUrl: item.uploaderUrl ? `https://www.youtube.com${item.uploaderUrl}` : '',
                views: item.views ? `${item.views.toLocaleString()} views` : '',
                publishedAt: item.uploadedDate || ''
              });
            } else if (item.type === 'channel' || item.url?.includes('/channel/')) {
              returnedChannels.push({
                id: item.url || `chan-${Math.random()}`,
                name: item.name || item.title || 'قناة يوتيوب',
                url: item.url ? `https://www.youtube.com${item.url}` : '',
                avatar: item.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
                subscribers: item.subscribers ? `${item.subscribers.toLocaleString()} subscribers` : '',
                videoCount: item.videos ? `${item.videos} videos` : '',
                description: item.description || 'قناة يوتيوب'
              });
            }
          }
        } else if (Array.isArray(data)) {
          for (const item of data) {
            if (item.type === 'video') {
              returnedVideos.push({
                id: item.videoId,
                title: item.title,
                duration: item.lengthSeconds ? `${Math.floor(item.lengthSeconds / 60)}:${(item.lengthSeconds % 60).toString().padStart(2, '0')}` : 'N/A',
                url: `https://www.youtube.com/watch?v=${item.videoId}`,
                thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                thumbnailAlt: item.title,
                selected: true,
                channelTitle: item.author || 'YouTube Channel',
                channelUrl: item.authorUrl ? `https://www.youtube.com${item.authorUrl}` : '',
                views: item.viewCount ? `${item.viewCount.toLocaleString()} views` : '',
                publishedAt: item.publishedText || ''
              });
            } else if (item.type === 'channel') {
              returnedChannels.push({
                id: item.authorId || item.authorUrl || `chan-${Math.random()}`,
                name: item.author || 'قناة يوتيوب',
                url: item.authorUrl ? `https://www.youtube.com${item.authorUrl}` : '',
                avatar: item.authorThumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
                subscribers: item.subCount ? `${item.subCount.toLocaleString()} subscribers` : '',
                videoCount: item.videoCount ? `${item.videoCount} videos` : '',
                description: item.description || 'قناة يوتيوب'
              });
            }
          }
        }

        if (returnedVideos.length > 0 || returnedChannels.length > 0) {
          setItems(returnedVideos);
          setChannels(returnedChannels);
          setHistoryLogs((prev) => [
            `Client Search "${searchQuery}": Extracted ${returnedVideos.length} videos & ${returnedChannels.length} channels`,
            ...prev
          ]);
          showToast(
            lang === 'ar'
              ? `تم استخراج ${returnedVideos.length} فيديو و ${returnedChannels.length} قناة بنجاح!`
              : `Extracted ${returnedVideos.length} videos & ${returnedChannels.length} channels!`
          );
          return true;
        }
      }
    }

    // 3. Guaranteed query fallback item so UI NEVER hangs empty
    const fallbackItem: SearchResultItem = {
      id: `query-${Date.now()}`,
      title: `نتائج البحث عن: ${searchQuery}`,
      duration: 'رابط بحث',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
      thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
      thumbnailAlt: searchQuery,
      selected: true,
      channelTitle: 'بحث يوتيوب مباشر',
      channelUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
      views: 'رابط جديد',
      publishedAt: 'الآن'
    };
    setItems([fallbackItem]);
    showToast(lang === 'ar' ? `تم إنشاء رابط البحث عن "${searchQuery}"` : `Created direct search link for "${searchQuery}"`);
    return true;
  };

  const performYouTubeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setDisplayedSearchCount(20);
    setSearchPage(1);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SERVER_SEARCH_TIMEOUT_MS);

      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}&page=1`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Search request failed with status ${res.status}`);
      }
      const data = await res.json();

      const returnedVideos: SearchResultItem[] = Array.isArray(data.videos)
        ? data.videos.map((v: any) => ({ ...v, selected: true }))
        : [];

      const returnedChannels: ChannelItem[] = Array.isArray(data.channels)
        ? data.channels
        : [];

      if (returnedVideos.length === 0 && returnedChannels.length === 0) {
        await performClientSideYouTubeSearch(searchQuery);
        return;
      }

      setItems(returnedVideos);
      setChannels(returnedChannels);

      setHistoryLogs((prev) => [
        `Search "${searchQuery}": Extracted ${returnedVideos.length} videos & ${returnedChannels.length} channels`,
        ...prev
      ]);

      showToast(
        lang === 'ar'
          ? `تم استخراج ${returnedVideos.length} فيديو و ${returnedChannels.length} قناة بنجاح!`
          : `Extracted ${returnedVideos.length} videos & ${returnedChannels.length} channels!`
      );
    } catch (err: any) {
      console.warn('Backend YouTube Search Error, attempting client-side fallback:', err);
      await performClientSideYouTubeSearch(searchQuery);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreSearch = async () => {
    // If there are already more un-displayed items in state, expand display limit
    if (displayedSearchCount < items.length) {
      setDisplayedSearchCount((prev) => Math.min(prev + 20, items.length));
      return;
    }

    // Otherwise, fetch next page from server
    if (!query.trim()) {
      setLoadingMoreSearch(false);
      return;
    }
    setLoadingMoreSearch(true);
    const nextPage = searchPage + 1;
    const currentQuery = query.trim();

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(currentQuery)}&page=${nextPage}`);
      if (!res.ok) throw new Error('Failed to load more videos');
      const data = await res.json();

      const newVids: SearchResultItem[] = Array.isArray(data.videos)
        ? data.videos.map((v: any) => ({ ...v, selected: true }))
        : [];
      const newChannels: ChannelItem[] = Array.isArray(data.channels)
        ? data.channels
        : [];

      const existingVideoIds = new Set(items.map((item) => item.id));
      const existingChannelIds = new Set(channels.map((channel) => channel.url || channel.id));
      const addedVideos = newVids.filter((video) => !existingVideoIds.has(video.id));
      const addedChannels = newChannels.filter((channel) => !existingChannelIds.has(channel.url || channel.id));

      if (addedVideos.length > 0 || addedChannels.length > 0) {
        setItems((prev) => [...prev, ...addedVideos]);
        setChannels((prev) => [...prev, ...addedChannels]);
        setSearchPage(nextPage);
        setDisplayedSearchCount((prev) => prev + 20);
        showToast(
          lang === 'ar'
            ? `تم تحميل ${addedVideos.length} فيديو و ${addedChannels.length} قناة إضافية!`
            : `Loaded ${addedVideos.length} more videos and ${addedChannels.length} more channels!`
        );
      } else {
        showToast(lang === 'ar' ? 'لا توجد نتائج إضافية حالياً' : 'No more results available');
      }
    } catch (err) {
      console.error('Load more search error:', err);
      showToast(lang === 'ar' ? 'تعذر جلب المزيد من النتائج' : 'Failed to load more results');
    } finally {
      setLoadingMoreSearch(false);
    }
  };

  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) {
      showToast(lang === 'ar' ? 'الرجاء كتابة نص للبحث في يوتيوب' : 'Please type a term to search on YouTube');
      return;
    }

    if (q.includes('list=') || q.includes('playlist') || /^(PL|UU|FL|OL|RD)[a-zA-Z0-9_-]+$/.test(q)) {
      handleExtractPlaylist(q);
    } else if (q.includes('youtube.com/@') || q.includes('youtube.com/channel/') || q.includes('youtube.com/c/') || q.startsWith('@')) {
      handleExtractFromChannelUrl(q);
    } else {
      performYouTubeSearch(q);
    }
  };

  // Extract channel videos directly from a channel URL or handle
  const handleExtractFromChannelUrl = async (channelInput: string) => {
    if (!channelInput.trim()) return;
    setLoadingChannelVideos(true);
    setShowChannelModal(true);
    setChannelTabMode('videos');
    setChannelVideos([]);
    setChannelPlaylists([]);
    setDisplayedChannelVideosCount(20);

    const cleanTitle = channelInput.replace(/https?:\/\/(www\.)?youtube\.com\//, '').replace(/[@\/]/g, ' ');
    const dummyChannel: ChannelItem = {
      id: channelInput,
      name: cleanTitle || channelInput,
      url: channelInput.startsWith('http') ? channelInput : `https://youtube.com/${channelInput}`,
      avatar: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
      description: 'قناة يوتيوب مستخرجة المباشر'
    };
    setSelectedChannel(dummyChannel);

    try {
      const res = await fetch(`/api/youtube/channel-videos?url=${encodeURIComponent(channelInput)}&name=${encodeURIComponent(cleanTitle)}`);
      if (!res.ok) throw new Error('Failed to fetch channel videos');
      const data = await res.json();
      const vids: SearchResultItem[] = Array.isArray(data.videos)
        ? data.videos.map((v: any) => ({ ...v, selected: true }))
        : [];
      setChannelVideos(vids);

      if (data.channelName) {
        setSelectedChannel({
          ...dummyChannel,
          name: data.channelName
        });
      }

      setHistoryLogs((prev) => [`Extracted ${vids.length} videos from channel URL "${channelInput}"`, ...prev]);
      showToast(lang === 'ar' ? `تم استخراج ${vids.length} فيديو من القناة بنجاح!` : `Extracted ${vids.length} channel videos!`);
    } catch (err) {
      console.error('Channel Videos Fetch Error:', err);
      showToast(lang === 'ar' ? 'تعذر استخراج فيديوهات القناة' : 'Failed to extract channel videos');
    } finally {
      setLoadingChannelVideos(false);
    }
  };

  const handleToggleSelectChannelVideo = (vidId: string) => {
    setChannelVideos((prev) =>
      prev.map((v) => (v.id === vidId ? { ...v, selected: !v.selected } : v))
    );
  };

  const handleToggleSelectAllChannelVideos = () => {
    const allSelected = channelVideos.length > 0 && channelVideos.every((v) => v.selected);
    setChannelVideos((prev) => prev.map((v) => ({ ...v, selected: !allSelected })));
  };

  const handleAddChannelVideosToMain = () => {
    const selectedVids = channelVideos.filter((v) => v.selected);
    const vidsToAdd = selectedVids.length > 0 ? selectedVids : channelVideos;
    if (vidsToAdd.length === 0) return;

    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const newVids = vidsToAdd.filter((v) => !existingIds.has(v.id));
      return [...newVids, ...prev];
    });
    setShowChannelModal(false);
    showToast(lang === 'ar' ? `تمت إضافة ${vidsToAdd.length} فيديو للقائمة الرئيسية!` : `Added ${vidsToAdd.length} videos to main list!`);
  };

  // Open Channel Modal and fetch channel videos & playlists
  const handleOpenChannelModal = async (channel: ChannelItem) => {
    setSelectedChannel(channel);
    setShowChannelModal(true);
    setChannelTabMode('videos');
    setLoadingChannelVideos(true);
    setChannelVideos([]);
    setChannelPlaylists([]);
    setDisplayedChannelVideosCount(20);

    try {
      const channelParam = channel.url || channel.name;
      const res = await fetch(`/api/youtube/channel-videos?url=${encodeURIComponent(channelParam)}&name=${encodeURIComponent(channel.name)}`);
      if (!res.ok) throw new Error('Failed to fetch channel videos');
      const data = await res.json();
      const vids: SearchResultItem[] = Array.isArray(data.videos)
        ? data.videos.map((v: any) => ({ ...v, selected: true }))
        : [];
      setChannelVideos(vids);
      setHistoryLogs((prev) => [`Fetched ${vids.length} videos for channel "${channel.name}"`, ...prev]);

      // Also trigger channel playlists fetch
      handleFetchChannelPlaylists(channel);
    } catch (err) {
      console.error('Channel Videos Fetch Error:', err);
      showToast(lang === 'ar' ? 'تعذر جلب فيديوهات القناة' : 'Failed to fetch channel videos');
    } finally {
      setLoadingChannelVideos(false);
    }
  };

  const handleLoadMoreChannelVideos = () => {
    if (displayedChannelVideosCount < channelVideos.length) {
      setDisplayedChannelVideosCount((prev) => Math.min(prev + 25, channelVideos.length));
    } else {
      showToast(lang === 'ar' ? 'تم عرض جميع الفيديوهات المستخرجة القناة!' : 'All extracted channel videos are currently displayed!');
    }
  };

  const handleToggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const handleCopySelected = () => {
    const selectedUrls = items.filter((i) => i.selected).map((i) => i.url).join('\n');
    if (!selectedUrls) {
      showToast(lang === 'ar' ? 'الرجاء تحديد فيديو واحد على الأقل أولاً!' : 'Please select at least one video first!');
      return;
    }
    navigator.clipboard.writeText(selectedUrls);
    showToast(t(lang, 'copiedSuccess'));
    setHistoryLogs((prev) => [`Copied ${items.filter(i => i.selected).length} selected YouTube URLs`, ...prev]);
  };

  const handleCopyAll = () => {
    if (items.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد نتائج لنسخها' : 'No results to copy');
      return;
    }
    const allUrls = items.map((i) => i.url).join('\n');
    navigator.clipboard.writeText(allUrls);
    showToast(t(lang, 'copiedSuccess'));
    setHistoryLogs((prev) => [`Copied all ${items.length} YouTube URLs to clipboard`, ...prev]);
  };

  const handleCopyChannelVideos = () => {
    if (channelVideos.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد فيديوهات لنسخها' : 'No channel videos to copy');
      return;
    }
    const selectedUrls = channelVideos.filter((v) => v.selected).map((v) => v.url).join('\n');
    navigator.clipboard.writeText(selectedUrls);
    showToast(lang === 'ar' ? `تم نسخ ${channelVideos.filter(v => v.selected).length} رابط فيديو من القناة!` : 'Copied channel video URLs!');
  };

  const handleCopyVideoIds = () => {
    const ids = items
      .filter((i) => i.selected)
      .map((i) => {
        const match = i.url.match(/v=([^&]+)/);
        return match ? match[1] : i.url;
      })
      .join('\n');

    if (!ids) {
      showToast(lang === 'ar' ? 'الرجاء تحديد فيديوهات أولاً' : 'Select videos to copy IDs');
      return;
    }
    navigator.clipboard.writeText(ids);
    showToast(lang === 'ar' ? 'تم نسخ معرفات الفيديوهات (Video IDs)!' : 'Copied Video IDs to clipboard!');
  };

  const handleExportTxt = (specificItems?: SearchResultItem[]) => {
    let itemsToExport = specificItems;
    if (!itemsToExport) {
      const selected = items.filter((i) => i.selected);
      itemsToExport = selected.length > 0 ? selected : items;
    }

    if (itemsToExport.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد عناصر للتصدير' : 'No items to export');
      return;
    }
    const textContent = itemsToExport.map((i) => `${i.title}\n${i.url}\n`).join('\n---\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yt_links_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(lang === 'ar' ? `تم تصدير ${itemsToExport.length} فيديو إلى TXT بنجاح` : `Exported ${itemsToExport.length} items to TXT`);
    setHistoryLogs((prev) => [`Exported ${itemsToExport!.length} items to TXT`, ...prev]);
  };

  const handleExportMd = (specificItems?: SearchResultItem[]) => {
    let itemsToExport = specificItems;
    if (!itemsToExport) {
      const selected = items.filter((i) => i.selected);
      itemsToExport = selected.length > 0 ? selected : items;
    }

    if (itemsToExport.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد عناصر للتصدير' : 'No items to export');
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    let mdContent = `# 📹 نتائج استخراج روابط يوتيوب (${itemsToExport.length} فيديو)\n\n`;
    mdContent += `**تاريخ التصدير:** \`${dateStr}\`  \n`;
    mdContent += `**إجمالي العناصر:** \`${itemsToExport.length}\`  \n\n`;
    mdContent += `---\n\n`;
    mdContent += `## 📋 جدول الفيديوهات والتفاصيل\n\n`;
    mdContent += `| # | عنوان الفيديو | القناة | المدة | الرابط المباشر |\n`;
    mdContent += `|---|---|---|---|---|\n`;

    itemsToExport.forEach((item, index) => {
      const cleanTitle = item.title.replace(/\|/g, '\\|');
      const channel = (item.channelTitle || 'N/A').replace(/\|/g, '\\|');
      mdContent += `| ${index + 1} | [${cleanTitle}](${item.url}) | ${channel} | ${item.duration || 'N/A'} | [مشاهدة على YouTube](${item.url}) |\n`;
    });

    mdContent += `\n\n---\n\n## 🔗 القائمة المباشرة للروابط (Raw Video URLs)\n\n\`\`\`text\n`;
    itemsToExport.forEach((item) => {
      mdContent += `${item.url}\n`;
    });
    mdContent += `\`\`\`\n`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yt_links_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);

    showToast(
      lang === 'ar'
        ? `تم تصدير ${itemsToExport.length} فيديو إلى ملف Markdown (.md) بنجاح!`
        : `Exported ${itemsToExport.length} items to Markdown (.md)!`
    );
    setHistoryLogs((prev) => [`Exported ${itemsToExport!.length} items to Markdown (.md)`, ...prev]);
  };

  // Collection Folder Handlers
  const handleOpenSaveFolderModal = (specificItems?: SearchResultItem[], defaultNameHint?: string) => {
    let itemsToSave = specificItems;
    if (!itemsToSave) {
      const selected = items.filter((i) => i.selected);
      itemsToSave = selected.length > 0 ? selected : items;
    }

    if (!itemsToSave || itemsToSave.length === 0) {
      showToast(lang === 'ar' ? 'لا توجد فيديوهات للحفظ بالمجموعة' : 'No videos to save');
      return;
    }

    setTargetFolderItems(itemsToSave);

    let suggestedName = defaultNameHint || '';
    if (!suggestedName) {
      if (query.trim()) {
        suggestedName = `بحث: ${query.trim()}`;
      } else {
        const now = new Date();
        suggestedName = `مجموعة ${now.toLocaleDateString('ar-EG')}`;
      }
    }

    setFolderNameInput(suggestedName);
    setSelectedExistingFolderId('new');
    setShowSaveFolderModal(true);
  };

  const handleConfirmSaveToFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetFolderItems.length === 0) return;

    if (selectedExistingFolderId === 'new') {
      const finalName = folderNameInput.trim() || `مجموعة ${new Date().toLocaleDateString('ar-EG')}`;
      const newFolder: CollectionFolder = {
        id: `folder-${Date.now()}`,
        name: finalName,
        createdAt: `${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
        items: targetFolderItems
      };
      setCollectionFolders((prev) => [newFolder, ...prev]);
      setExpandedFolderIds((prev) => new Set(prev).add(newFolder.id));
      showToast(
        lang === 'ar'
          ? `تم حفظ ${targetFolderItems.length} فيديو في مجلد "${finalName}"!`
          : `Saved ${targetFolderItems.length} videos to folder "${finalName}"!`
      );
      setHistoryLogs((prev) => [`Saved ${targetFolderItems.length} videos to folder "${finalName}"`, ...prev]);
    } else {
      setCollectionFolders((prev) =>
        prev.map((f) => {
          if (f.id === selectedExistingFolderId) {
            const existingIds = new Set(f.items.map((i) => i.id));
            const newVids = targetFolderItems.filter((i) => !existingIds.has(i.id));
            return {
              ...f,
              items: [...f.items, ...newVids]
            };
          }
          return f;
        })
      );
      showToast(lang === 'ar' ? `تمت إضافة الفيديوهات للمجلد المSelected!` : `Added videos to existing folder!`);
      setHistoryLogs((prev) => [`Added ${targetFolderItems.length} videos to existing folder`, ...prev]);
    }

    setShowSaveFolderModal(false);
  };

  const handleToggleFolderExpand = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleDeleteFolder = (folderId: string) => {
    setCollectionFolders((prev) => prev.filter((f) => f.id !== folderId));
    showToast(lang === 'ar' ? 'تم حذف المجلد بنجاح' : 'Folder deleted');
  };

  const handleImportFolderToMain = (folder: CollectionFolder) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const newItems = folder.items.filter((i) => !existingIds.has(i.id));
      return [...newItems, ...prev];
    });
    showToast(
      lang === 'ar'
        ? `تمت إضافة ${folder.items.length} فيديو للقائمة الرئيسية!`
        : `Imported ${folder.items.length} items to main list!`
    );
  };

  const handleRemoveItemFromFolder = (folderId: string, itemId: string) => {
    setCollectionFolders((prev) =>
      prev.map((f) => {
        if (f.id === folderId) {
          return {
            ...f,
            items: f.items.filter((i) => i.id !== itemId)
          };
        }
        return f;
      })
    );
    showToast(lang === 'ar' ? 'تمت إزالة الفيديو من المجلد' : 'Video removed from folder');
  };

  const handleAddManualLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    const newItem: SearchResultItem = {
      id: `manual-${Date.now()}`,
      title: newTitle.trim() || `YouTube Video ${items.length + 1}`,
      duration: '00:00',
      url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
      thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
      thumbnailAlt: 'YouTube video thumbnail',
      selected: true,
      channelTitle: 'Custom Entry',
      views: 'User added',
      publishedAt: 'Just now'
    };

    setItems((prev) => [newItem, ...prev]);
    setNewUrl('');
    setNewTitle('');
    setShowAddModal(false);
    showToast(lang === 'ar' ? 'تم إضافة الرابط بنجاح' : 'Custom video link added');
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className={`min-h-screen flex w-full transition-colors ${
      isLight ? 'bg-[#f7fbed] text-[#181d15]' : 'bg-[#0a0e1a] text-[#e0e8f0]'
    }`}>
      {/* خلفية معتمة خلف الشريط الجانبي على الشاشات الصغيرة */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={`mobile-sidebar w-64 border-r flex flex-col py-6 px-4 fixed h-full z-30 overflow-y-auto transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      } ${
        isLight ? 'bg-[#d7dccf] border-[#c1c9b6] text-[#205100]' : 'bg-[#141c2e] border-white/10 text-sky-400'
      }`}>
        {/* زر إغلاق الشريط الجانبي (شاشات صغيرة فقط) */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-3 left-3 p-1.5 rounded-lg opacity-70 hover:opacity-100"
          title="إغلاق القائمة"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 px-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Youtube className="w-6 h-6 text-red-500" />
              <span>يوتيوب أكاديمي</span>
            </h1>
            <p className="text-xs opacity-70 mt-0.5">الإصدار 2.5</p>
            <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isLight ? 'bg-[#205100]/10 text-[#205100] border border-[#205100]/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLight ? 'bg-[#205100]' : 'bg-sky-400'}`} />
              <span>مزامنة نشطة</span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="space-y-1.5 flex-1">
          <button
            onClick={() => { setActiveTab('search'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'search'
                ? isLight
                  ? 'bg-[#205100] text-white shadow-sm'
                  : 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>{t(lang, 'searchTab')}</span>
          </button>

          <button
            onClick={() => { setActiveTab('collections'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'collections'
                ? isLight
                  ? 'bg-[#205100] text-white shadow-sm'
                  : 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t(lang, 'collectionsTab')} ({collectionFolders.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('favorites'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'favorites'
                ? isLight
                  ? 'bg-[#205100] text-white shadow-sm'
                  : 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
            }`}
          >
            <div className="flex items-center gap-3">
              <Star className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-current' : 'text-sky-400'}`} />
              <span>المفضلة</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
              activeTab === 'favorites' && !isLight ? 'bg-slate-950/20 text-slate-950' : 'bg-sky-500/20 text-sky-300'
            }`}>
              {favoriteVideos.length + favoriteChannels.length + favoritePlaylists.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('history'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'history'
                ? isLight
                  ? 'bg-[#205100] text-white shadow-sm'
                  : 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t(lang, 'historyTab')}</span>
          </button>

          <button
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'settings'
                ? isLight
                  ? 'bg-[#205100] text-white shadow-sm'
                  : 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{t(lang, 'settingsTab')}</span>
          </button>
        </div>

        {/* Sidebar Actions */}
        <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-2">
          <button
            onClick={() => setShowChannelInputModal(true)}
            className={`w-full py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border ${
              isLight ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10' : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
            }`}
          >
            <Users className="w-4 h-4 text-sky-400" />
            <span>{t(lang, 'addChannelUrl')}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className={`w-full py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border ${
              isLight ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10' : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{t(lang, 'addCustomUrl')}</span>
          </button>

          <button
            onClick={handleCopyAll}
            className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs transition-colors shadow-sm ${
              isLight ? 'bg-[#205100] text-white hover:bg-green-900' : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
            }`}
          >
            {t(lang, 'copyAll')}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className={`flex-1 min-w-0 overflow-x-hidden ${lang === 'ar' ? 'lg:mr-64' : 'lg:ml-64'} flex flex-col min-h-screen pb-24`}>
        {/* Header Bar */}
        <header className={`min-h-16 border-b px-4 sm:px-8 py-2 flex items-center justify-between gap-2 sticky top-0 z-10 backdrop-blur-md ${
          isLight ? 'bg-[#f7fbed]/80 border-[#c1c9b6]' : 'bg-[#0a0e1a]/80 border-white/10'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {/* زر فتح القائمة (شاشات صغيرة فقط) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 rounded-lg border flex-shrink-0 ${
                isLight ? 'border-[#c1c9b6] bg-white text-[#205100]' : 'border-white/10 bg-white/5 text-sky-400'
              }`}
              title="فتح القائمة"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                يوتيوب أكاديمي
              </h2>
              <p className="text-xs opacity-60 hidden sm:block truncate">{t(lang, 'appSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {userEmail && onSignOut && (
              <button
                onClick={onSignOut}
                className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                  isLight ? 'border-[#c1c9b6] bg-white text-[#205100]' : 'border-white/10 bg-white/5 text-sky-400'
                }`}
                title={`تسجيل الخروج (${userEmail})`}
              >
                <span className="hidden md:inline">خروج</span>
                <X className="w-4 h-4 md:hidden" />
              </button>
            )}

            {/* Theme Switcher */}
            <button
              onClick={onThemeToggle}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isLight ? 'border-[#c1c9b6] bg-white text-[#205100]' : 'border-white/10 bg-white/5 text-sky-400'
              }`}
              title="تبديل المظهر"
            >
              {isLight ? <Sun className="w-4 h-4 text-amber-600" /> : <Moon className="w-4 h-4 text-sky-300" />}
              <span className="hidden sm:inline">{isLight ? 'Editorial' : 'Glacier'}</span>
            </button>
          </div>
        </header>

        {/* Canvas Body */}
        <main className="mobile-main p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full flex-1 min-w-0">
          {activeTab === 'search' && (
            <>
              {/* Target Query Search Box */}
              <div className={`mobile-search-card p-6 rounded-xl border ${
                isLight ? 'bg-white border-[#c1c9b6] shadow-sm' : 'glass-card'
              }`}>
                <form onSubmit={handleExecuteSearch} className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold tracking-wider mb-2 opacity-75 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      <span>بحث</span>
                    </label>
                    <div className="relative">
                      <Search className={`w-4 h-4 absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 opacity-50`} />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="اكتب..."
                        className={`w-full py-3 ${lang === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} rounded-lg border text-sm outline-none transition-all ${
                          isLight
                            ? 'bg-white border-[#c1c9b6] focus:border-[#205100]'
                            : 'bg-[#0a0e1a] border-white/15 focus:border-sky-400'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`px-7 py-3 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
                      isLight
                        ? 'bg-[#205100] text-white hover:bg-green-900 disabled:opacity-50'
                        : 'bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-50'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري جلب الفيديوهات والقنوات...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>بحث شامل في يوتيوب</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* View Section Filters (All / Videos / Channels) */}
              <div className="mobile-section-tabs flex items-center gap-3 border-b border-black/10 dark:border-white/10 pb-3">
                <button
                  onClick={() => setSearchSection('all')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    searchSection === 'all'
                      ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>عرض الكل</span>
                </button>

                <button
                  onClick={() => setSearchSection('videos')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    searchSection === 'videos'
                      ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <Film className="w-3.5 h-3.5 text-red-500" />
                  <span>{t(lang, 'videosSection')} ({items.length})</span>
                </button>

                <button
                  onClick={() => setSearchSection('channels')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    searchSection === 'channels'
                      ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t(lang, 'channelsSection')} ({channels.length})</span>
                </button>
              </div>

              {/* SECTION 1: VIDEOS */}
              {(searchSection === 'all' || searchSection === 'videos') && (
                <div className="space-y-4 pt-2">
                  <div className="mobile-section-heading flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Film className="w-5 h-5 text-red-500" />
                      <span>{t(lang, 'videosSection')}</span>
                      <span className="font-mono text-xs opacity-90 bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full font-bold">
                        {items.length} فيديو مستخرج
                      </span>
                    </h3>

                    <div className="mobile-video-options">
                      <button
                        type="button"
                        className="mobile-options-trigger"
                        onClick={() => setMobileVideoOptionsOpen((open) => !open)}
                        aria-expanded={mobileVideoOptionsOpen}
                        aria-controls="mobile-video-options-panel"
                      >
                        <Filter className="w-4 h-4" />
                        <span>{mobileVideoOptionsOpen ? 'إخفاء الخيارات' : 'خيارات العرض والإجراءات'}</span>
                        {mobileVideoOptionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {mobileVideoOptionsOpen && (
                        <div id="mobile-video-options-panel" className="mobile-options-panel">
                          <label className="mobile-options-sort">
                            <ArrowUpDown className="w-4 h-4 text-sky-400 flex-shrink-0" />
                            <span>ترتيب الفيديوهات</span>
                            <select
                              value={videoSortOption}
                              onChange={(e) => setVideoSortOption(e.target.value as VideoSortOption)}
                              className="bg-transparent font-semibold text-xs border-none outline-none focus:ring-0 cursor-pointer text-sky-400 dark:text-sky-300"
                            >
                              <option value="default" className="bg-slate-900 text-white">الافتراضي (حسب الصلة)</option>
                              <option value="views_desc" className="bg-slate-900 text-white">🔥 الأكثر مشاهدة</option>
                              <option value="date_desc" className="bg-slate-900 text-white">📅 الأحدث تاريخاً</option>
                              <option value="date_asc" className="bg-slate-900 text-white">⏳ الأقدم تاريخاً</option>
                              <option value="color" className="bg-slate-900 text-white">🎨 حسب اللون (التصنيف)</option>
                            </select>
                          </label>

                          <div className="mobile-options-view" aria-label="طريقة عرض الفيديوهات">
                            <button
                              type="button"
                              onClick={() => setVideoViewMode('grid')}
                              className={videoViewMode === 'grid' ? 'is-active' : ''}
                              title="عرض شبكي بأيقونات"
                              aria-label="عرض شبكي بأيقونات"
                            >
                              <Layers className="w-4 h-4" />
                              <span>شبكي</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setVideoViewMode('list')}
                              className={videoViewMode === 'list' ? 'is-active' : ''}
                              title="عرض قائمة"
                              aria-label="عرض قائمة"
                            >
                              <List className="w-4 h-4" />
                              <span>قائمة</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            className="mobile-options-action"
                            onClick={() => {
                              const activeVids = items.filter((i) => i.selected);
                              openChunkerModal(activeVids.length > 0 ? activeVids : items, lang === 'ar' ? 'نتائج البحث الرئيسي' : 'Main Search Results');
                              setMobileVideoOptionsOpen(false);
                            }}
                            title="تقسيم النتائج إلى مستويات بحجم 299 فيديو كحد أقصى للنسخ والنقل للدفاتر"
                          >
                            <ListOrdered className="w-4 h-4" />
                            <span>تقسيم 299</span>
                          </button>

                          <button
                            type="button"
                            className="mobile-options-action"
                            onClick={() => {
                              const activeVids = items.filter((i) => i.selected);
                              const target = activeVids.length > 0 ? activeVids : items;
                              handleOpenNotebookLMModal(target, query ? `بحث: ${query}` : 'نتائج البحث الرئيسي');
                              setMobileVideoOptionsOpen(false);
                            }}
                            title="إنشاء دفتر مصادر جديد مباشرة في Google NotebookLM (299 فيديو max)"
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>دفتر NotebookLM</span>
                          </button>

                          <button
                            type="button"
                            className="mobile-options-action"
                            onClick={() => {
                              handleOpenSaveFolderModal();
                              setMobileVideoOptionsOpen(false);
                            }}
                            title={t(lang, 'saveToFolder')}
                          >
                            <FolderPlus className="w-4 h-4" />
                            <span>{t(lang, 'saveToFolder')}</span>
                          </button>

                          <button
                            type="button"
                            className="mobile-options-action"
                            onClick={() => {
                              handleExportMd();
                              setMobileVideoOptionsOpen(false);
                            }}
                            title={t(lang, 'exportMd')}
                          >
                            <FileText className="w-4 h-4" />
                            <span>{t(lang, 'exportMd')}</span>
                          </button>

                          <button
                            type="button"
                            className="mobile-options-action"
                            onClick={() => {
                              handleExportTxt();
                              setMobileVideoOptionsOpen(false);
                            }}
                            title={t(lang, 'exportTxt')}
                          >
                            <Download className="w-4 h-4" />
                            <span>{t(lang, 'exportTxt')}</span>
                          </button>

                          <label className="mobile-options-select-all">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                              className="w-4 h-4 rounded border-gray-400 text-sky-500 focus:ring-sky-500 cursor-pointer"
                            />
                            <span>{t(lang, 'selectAll')}</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="mobile-toolbar flex items-center gap-3 text-xs flex-wrap">
                      {/* Video Sort Dropdown */}
                      <div className="mobile-sort flex items-center gap-1.5 bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 px-2.5 py-1 rounded-lg">
                        <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                        <span className="font-bold opacity-80 text-[11px]">ترتيب الفيديوهات:</span>
                        <select
                          value={videoSortOption}
                          onChange={(e) => setVideoSortOption(e.target.value as VideoSortOption)}
                          className="bg-transparent font-semibold text-xs border-none outline-none focus:ring-0 cursor-pointer text-sky-400 dark:text-sky-300"
                        >
                          <option value="default" className="bg-slate-900 text-white">الافتراضي (حسب الصلة)</option>
                          <option value="views_desc" className="bg-slate-900 text-white">🔥 الأكثر مشاهدة</option>
                          <option value="date_desc" className="bg-slate-900 text-white">📅 الأحدث تاريخاً</option>
                          <option value="date_asc" className="bg-slate-900 text-white">⏳ الأقدم تاريخاً</option>
                          <option value="color" className="bg-slate-900 text-white">🎨 حسب اللون (التصنيف)</option>
                        </select>
                      </div>

                      {/* Video View Mode Toggle: Grid of icons / List */}
                      <div className="mobile-view-toggle flex items-center gap-1 bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setVideoViewMode('grid')}
                          title="عرض شبكي بأيقونات"
                          className={`p-1.5 rounded-md transition-all ${
                            videoViewMode === 'grid'
                              ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoViewMode('list')}
                          title="عرض قائمة"
                          className={`p-1.5 rounded-md transition-all ${
                            videoViewMode === 'list'
                              ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          const activeVids = items.filter((i) => i.selected);
                          openChunkerModal(activeVids.length > 0 ? activeVids : items, lang === 'ar' ? 'نتائج البحث الرئيسي' : 'Main Search Results');
                        }}
                        className="mobile-action-button mobile-action-split hover:underline font-bold flex items-center gap-1.5 text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/30 px-3 py-1 rounded-lg"
                        title="تقسيم النتائج إلى مستويات بحجم 299 فيديو كحد أقصى للنسخ والنقل للدفاتر"
                      >
                        <ListOrdered className="w-4 h-4 text-sky-400" />
                        <span>تقسيم 299 (للدفاتر)</span>
                      </button>

                      <button
                        onClick={() => {
                          const activeVids = items.filter((i) => i.selected);
                          const target = activeVids.length > 0 ? activeVids : items;
                          handleOpenNotebookLMModal(target, query ? `بحث: ${query}` : 'نتائج البحث الرئيسي');
                        }}
                        className="mobile-action-button mobile-action-notebook hover:underline font-bold flex items-center gap-1.5 text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/30 px-3 py-1 rounded-lg transition-all"
                        title="إنشاء دفتر مصادر جديد مباشرة في Google NotebookLM (299 فيديو max)"
                      >
                        <BookOpen className="w-4 h-4 text-sky-400" />
                        <span>إنشاء دفتر NotebookLM</span>
                      </button>

                      <button
                        onClick={() => handleOpenSaveFolderModal()}
                        className="mobile-action-button mobile-action-save hover:underline font-semibold flex items-center gap-1.5 opacity-80 hover:opacity-100 text-sky-400"
                        title="حفظ نتائج البحث أو المحدد في مجلد خاص بالمجموعات"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
                        <span>{t(lang, 'saveToFolder')}</span>
                      </button>

                      <button
                        onClick={() => handleExportMd()}
                        className="mobile-action-button mobile-action-md hover:underline font-semibold flex items-center gap-1.5 opacity-80 hover:opacity-100 text-sky-400"
                        title="تصدير المحدد أو الكل إلى ملف Markdown"
                      >
                        <FileText className="w-3.5 h-3.5 text-sky-400" />
                        <span>{t(lang, 'exportMd')}</span>
                      </button>

                      <button
                        onClick={() => handleExportTxt()}
                        className="mobile-action-button mobile-action-txt hover:underline font-semibold flex items-center gap-1.5 opacity-80 hover:opacity-100 text-sky-400"
                        title="تصدير المحدد أو الكل إلى ملف TXT"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-400" />
                        <span>{t(lang, 'exportTxt')}</span>
                      </button>

                      <label className="mobile-select-all flex items-center gap-2 font-semibold cursor-pointer" title={t(lang, 'selectAll')}>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-400 text-sky-500 focus:ring-sky-500 cursor-pointer"
                        />
                        <span>{t(lang, 'selectAll')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Loading State / Video Grid */}
                  {loading ? (
                    <div className="mobile-results-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <div key={idx} className={`rounded-xl border p-3 space-y-3 animate-pulse ${
                          isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'
                        }`}>
                          <div className="aspect-video bg-gray-300 dark:bg-slate-800 rounded-lg"></div>
                          <div className="h-4 bg-gray-300 dark:bg-slate-800 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`mobile-results-grid ${videoViewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                      : 'flex flex-col gap-2'
                    }`}>
                      {items.length === 0 ? (
                        <div className="col-span-full py-10 text-center opacity-70 text-sm">
                          {t(lang, 'noResults')}
                        </div>
                      ) : (
                        getSortedVideos(items, videoSortOption).slice(0, displayedSearchCount).map((item) => {
                          const colorBorders: Record<ColorTag, string> = {
                            red: 'border-rose-500 ring-2 ring-rose-500/40 shadow-rose-500/20',
                            blue: 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-400/20',
                            green: 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-500/20',
                            yellow: 'border-amber-400 ring-2 ring-amber-400/40 shadow-amber-400/20',
                            purple: 'border-purple-500 ring-2 ring-purple-500/40 shadow-purple-500/20',
                            none: ''
                          };
                          const activeColorBorder = item.colorTag && item.colorTag !== 'none' ? colorBorders[item.colorTag] : '';

                          return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleSelect(item.id)}
                            className={`mobile-video-card group rounded-xl overflow-hidden border transition-all cursor-pointer relative flex ${
                              videoViewMode === 'grid' ? 'flex-col justify-between' : 'flex-row items-center'
                            } ${
                              activeColorBorder
                                ? activeColorBorder
                                : item.selected
                                  ? isLight ? 'border-[#205100] bg-green-50/50 shadow-md' : 'border-sky-400 bg-sky-500/10 shadow-lg'
                                  : isLight ? 'bg-white border-[#c1c9b6] hover:border-[#205100]' : 'glass-card hover:border-sky-500/40'
                            }`}
                          >
                            {/* Top Checkbox Overlay */}
                            <div className="absolute top-2.5 left-2.5 z-10">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelect(item.id);
                                }}
                                className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 cursor-pointer shadow-md"
                              />
                            </div>

                            {/* Color Tag Picker & Delete button overlay top-right */}
                            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
                              {/* Quick Color Tag Palette */}
                              <div className="mobile-color-picker flex items-center gap-1 bg-black/75 px-2 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
                                {(['red', 'blue', 'green', 'yellow', 'purple'] as ColorTag[]).map((c) => {
                                  const colorClasses: Record<ColorTag, string> = {
                                    red: 'bg-rose-500',
                                    blue: 'bg-sky-400',
                                    green: 'bg-emerald-500',
                                    yellow: 'bg-amber-400',
                                    purple: 'bg-purple-500',
                                    none: 'bg-gray-400'
                                  };
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetItemColor(item.id, c);
                                      }}
                                      className={`w-2.5 h-2.5 rounded-full transition-transform ${colorClasses[c]} ${
                                        item.colorTag === c ? 'scale-125 ring-2 ring-white shadow-md' : 'opacity-60 hover:opacity-100'
                                      }`}
                                      title={`تصنيف لون: ${c}`}
                                    />
                                  );
                                })}
                              </div>

                              {/* Favorite Star Button */}
                              {(() => {
                                const isFav = favoriteVideos.some((fv) => fv.id === item.id || fv.url === item.url);
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleFavoriteVideo(item);
                                    }}
                                    className={`p-1.5 rounded-full backdrop-blur-md border transition-all ${
                                      isFav
                                        ? 'bg-amber-500 text-slate-950 border-amber-300 scale-110 shadow-lg'
                                        : 'bg-black/60 text-white border-white/20 hover:bg-amber-500 hover:text-slate-950'
                                    }`}
                                    title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                                  >
                                    <Star className={`w-3 h-3 ${isFav ? 'fill-current' : ''}`} />
                                  </button>
                                );
                              })()}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item.id);
                                }}
                                className="mobile-delete-action p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="إزالة من القائمة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Thumbnail Container */}
                            <div className={`mobile-video-thumb ${videoViewMode === 'grid'
                              ? 'aspect-video relative bg-slate-900 overflow-hidden group/thumb'
                              : 'w-32 h-20 flex-shrink-0 relative bg-slate-900 overflow-hidden group/thumb rounded-lg m-2'
                            }`}>
                              <img
                                src={item.thumbnail}
                                alt={item.thumbnailAlt}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />

                              {/* Hover Play Button Overlay */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewVideo(item);
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs backdrop-blur-[2px]"
                                title="معاينة وتشغيل الفيديو"
                              >
                                <div className="p-2.5 rounded-full bg-sky-500 text-slate-950 shadow-lg hover:scale-110 transition-transform">
                                  <Play className="w-5 h-5 fill-current ml-0.5" />
                                </div>
                              </button>

                              <div className="absolute bottom-1.5 right-1.5 bg-black/85 text-white font-mono text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                                {item.duration}
                              </div>
                            </div>

                            {/* Details */}
                            <div className={`mobile-video-details ${videoViewMode === 'grid'
                              ? 'p-3.5 flex-1 flex flex-col justify-between'
                              : 'py-2 pl-3 pr-1 flex-1 min-w-0 flex flex-col justify-center gap-1'
                            }`}>
                              <div>
                                <h4 className="font-semibold text-xs line-clamp-2 leading-snug mb-1.5">
                                  {item.title}
                                </h4>

                                {/* Channel & Stats Info with DIRECT CHANNEL ENTRY BUTTON */}
                                <div className="space-y-1 my-1.5">
                                  {item.channelTitle && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenChannelFromVideo(item);
                                      }}
                                      className="text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 rounded-md transition-all group/chan max-w-full truncate"
                                      title={`الدخول مباشرة إلى قناة "${item.channelTitle}" لاستخراج فيديوهاتها وقوائمها`}
                                    >
                                      <Users className="w-3 h-3 text-sky-400 group-hover/chan:scale-110 transition-transform flex-shrink-0" />
                                      <span className="truncate">{item.channelTitle}</span>
                                      <ExternalLink className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
                                    </button>
                                  )}

                                  <div className="mobile-video-stats flex items-center gap-2 text-[10px] opacity-70 font-mono">
                                    {item.views && <span>👀 {item.views}</span>}
                                    {item.publishedAt && <span>📅 {item.publishedAt}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="mobile-video-actions pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewVideo(item);
                                  }}
                                  className="px-2 py-1 rounded text-[11px] font-bold text-sky-400 hover:bg-sky-500/10 transition-colors flex items-center gap-1"
                                  title="معاينة الفيديو المباشرة"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>معاينة</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <p className="mobile-video-url font-mono text-[10px] opacity-60 truncate max-w-[120px]">
                                    {item.url}
                                  </p>
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 text-sky-400 hover:text-sky-300 transition-colors"
                                    title="Open link on YouTube"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                        })
                      )}
                    </div>
                  )}

                  {/* Load More Search Results Button */}
                  {!loading && items.length > 0 && (
                    <div className="mt-8 text-center flex flex-col items-center justify-center gap-2 border-t pt-6 border-black/10 dark:border-white/10">
                      <p className="text-xs opacity-70 font-mono">
                        {lang === 'ar'
                          ? `معروض ${Math.min(displayedSearchCount, items.length)} من أصل ${items.length} فيديو مستخرج`
                          : `Showing ${Math.min(displayedSearchCount, items.length)} of ${items.length} extracted videos`}
                      </p>

                      <button
                        onClick={handleLoadMoreSearch}
                        disabled={loadingMoreSearch}
                        className={`px-8 py-3 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 border hover:scale-[1.02] active:scale-95 disabled:opacity-50 ${
                          isLight
                            ? 'bg-[#205100] text-white hover:bg-green-900 border-green-900'
                            : 'bg-sky-500 text-slate-950 hover:bg-sky-400 border-sky-400'
                        }`}
                      >
                        {loadingMoreSearch ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t(lang, 'loadingMore')}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>{t(lang, 'loadMore')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: CHANNELS */}
              {(searchSection === 'all' || searchSection === 'channels') && (
                <div className="space-y-4 pt-6 border-t border-black/10 dark:border-white/10">
                  <div className="mobile-section-heading flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Users className="w-5 h-5 text-sky-400" />
                      <span>{t(lang, 'channelsSection')}</span>
                      <span className="font-mono text-xs opacity-90 bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2.5 py-0.5 rounded-full font-bold">
                        {channels.length} قناة مطابقة
                      </span>
                    </h3>

                    {/* Channel Sort Dropdown */}
                    <div className="flex items-center gap-1.5 bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 px-2.5 py-1 rounded-lg text-xs">
                      <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                      <span className="font-bold opacity-80 text-[11px]">ترتيب القنوات:</span>
                      <select
                        value={channelSortOption}
                        onChange={(e) => setChannelSortOption(e.target.value as ChannelSortOption)}
                        className="bg-transparent font-semibold text-xs border-none outline-none focus:ring-0 cursor-pointer text-sky-400 dark:text-sky-300"
                      >
                        <option value="default" className="bg-slate-900 text-white">الافتراضي</option>
                        <option value="subscribers_desc" className="bg-slate-900 text-white">⭐ الأكثر مشتركون / فيديوهات</option>
                        <option value="name_asc" className="bg-slate-900 text-white">🔤 الأبجدي (أ-ي / A-Z)</option>
                        <option value="color" className="bg-slate-900 text-white">🎨 حسب اللون (التصنيف)</option>
                      </select>
                    </div>

                    {/* Channel View Mode Toggle: Grid of icons / List */}
                    <div className="flex items-center gap-1 bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setChannelViewMode('grid')}
                        title="عرض شبكي بأيقونات"
                        className={`p-1.5 rounded-md transition-all ${
                          channelViewMode === 'grid'
                            ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChannelViewMode('list')}
                        title="عرض قائمة"
                        className={`p-1.5 rounded-md transition-all ${
                          channelViewMode === 'list'
                            ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {channels.length === 0 ? (
                    <div className={`p-8 text-center rounded-xl border opacity-70 ${isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'}`}>
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-semibold">لم يتم العثور على قنوات بهذا الاسم محددًا</p>
                    </div>
                  ) : (
                    <div className={`mobile-results-grid ${channelViewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                      : 'flex flex-col gap-2'
                    }`}>
                      {getSortedChannels(channels, channelSortOption).map((channel) => {
                        const colorBorders: Record<ColorTag, string> = {
                          red: 'border-rose-500 ring-2 ring-rose-500/40 shadow-rose-500/20',
                          blue: 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-400/20',
                          green: 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-500/20',
                          yellow: 'border-amber-400 ring-2 ring-amber-400/40 shadow-amber-400/20',
                          purple: 'border-purple-500 ring-2 ring-purple-500/40 shadow-purple-500/20',
                          none: ''
                        };
                        const activeColorBorder = channel.colorTag && channel.colorTag !== 'none' ? colorBorders[channel.colorTag] : '';

                        return (
                        <div
                          key={channel.id}
                          onClick={() => handleOpenChannelModal(channel)}
                          className={`mobile-channel-card p-4 rounded-xl border transition-all cursor-pointer group hover:shadow-lg relative flex ${
                            channelViewMode === 'grid' ? 'flex-col justify-between' : 'flex-row items-center gap-3'
                          } ${
                            activeColorBorder
                              ? activeColorBorder
                              : isLight ? 'bg-white border-[#c1c9b6] hover:border-[#205100]' : 'glass-card hover:border-sky-400/50'
                          }`}
                        >
                          {/* Channel Color Tag Dots & Favorite Star */}
                          <div className="mobile-channel-colors absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                            <div className="flex items-center gap-1 bg-black/75 px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10">
                              {(['red', 'blue', 'green', 'yellow', 'purple'] as ColorTag[]).map((c) => {
                                const colorClasses: Record<ColorTag, string> = {
                                  red: 'bg-rose-500',
                                  blue: 'bg-sky-400',
                                  green: 'bg-emerald-500',
                                  yellow: 'bg-amber-400',
                                  purple: 'bg-purple-500',
                                  none: 'bg-gray-400'
                                };
                                return (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetChannelColor(channel.id, c);
                                    }}
                                    className={`w-2.5 h-2.5 rounded-full transition-transform ${colorClasses[c]} ${
                                      channel.colorTag === c ? 'scale-125 ring-2 ring-white shadow-md' : 'opacity-60 hover:opacity-100'
                                    }`}
                                    title={`تصنيف لون القناة: ${c}`}
                                  />
                                );
                              })}
                            </div>

                            {(() => {
                              const isFav = favoriteChannels.some((fc) => fc.id === channel.id || fc.url === channel.url);
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavoriteChannel(channel);
                                  }}
                                  className={`p-1.5 rounded-full backdrop-blur-md border transition-all ${
                                    isFav
                                      ? 'bg-amber-500 text-slate-950 border-amber-300 scale-110 shadow-lg'
                                      : 'bg-black/60 text-white border-white/20 hover:bg-amber-500 hover:text-slate-950'
                                  }`}
                                  title={isFav ? 'إزالة القناة من المفضلة' : 'إضافة القناة للمفضلة'}
                                >
                                  <Star className={`w-3 h-3 ${isFav ? 'fill-current' : ''}`} />
                                </button>
                              );
                            })()}
                          </div>

                          <div className={`mobile-channel-info flex items-start gap-3 min-w-0 ${channelViewMode === 'grid' ? 'mb-3 pt-2' : 'flex-1 items-center'}`}>
                            <img
                              src={channel.avatar}
                              alt={channel.name}
                              className={`mobile-channel-avatar rounded-full object-cover border border-white/20 flex-shrink-0 group-hover:border-sky-400 transition-colors ${
                                channelViewMode === 'grid' ? 'w-12 h-12' : 'w-9 h-9'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-sm truncate group-hover:text-sky-400 transition-colors">{channel.name}</h4>
                              {channel.subscribers && (
                                <p className="text-[11px] opacity-70 font-mono mt-0.5">{channel.subscribers}</p>
                              )}
                              {channelViewMode === 'grid' && (
                                <p className="text-[11px] opacity-60 line-clamp-2 mt-1">{channel.description}</p>
                              )}
                            </div>
                          </div>

                          <div className={`mobile-channel-actions ${channelViewMode === 'grid'
                            ? 'pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2'
                            : 'flex-shrink-0 flex items-center gap-2'
                          }`}>
                            <a
                              href={channel.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
                              title="فتح صفحة القناة في تبويب جديد على يوتيوب"
                            >
                              <span>زيارة القناة</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenChannelModal(channel);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                                isLight
                                  ? 'bg-[#205100] text-white hover:bg-green-900'
                                  : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                              }`}
                            >
                              <Film className="w-3.5 h-3.5" />
                              <span>استخراج فيديوهات القناة</span>
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Format Hint Banner */}
              <div className={`mobile-format-banner p-4 rounded-xl border flex items-start gap-3 ${
                isLight ? 'bg-[#ebf0e2] border-[#c1c9b6]' : 'bg-[#141c2e] border-white/10'
              }`}>
                <Info className="w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">{t(lang, 'outputFormatTitle')}</p>
                  <p className="opacity-80 leading-relaxed font-mono">
                    {t(lang, 'outputFormatDesc')}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Collections Tab with Dedicated Folders */}
          {activeTab === 'collections' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-black/10 dark:border-white/10">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-sky-400" />
                    <span>{t(lang, 'collectionsTab')}</span>
                  </h3>
                  <p className="text-xs opacity-70 mt-0.5">
                    مجلدات عمليات البحث واستخراج فيديوهات القنوات المحفوظة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-3 py-1.5 rounded-lg border bg-sky-500/10 border-sky-400/30 text-sky-400 font-bold">
                    {collectionFolders.length} مجلدات | {collectionFolders.reduce((acc, f) => acc + f.items.length, 0)} فيديو محفوظ
                  </span>

                  {items.length > 0 && (
                    <button
                      onClick={() => handleOpenSaveFolderModal()}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                        isLight
                          ? 'bg-[#205100] text-white hover:bg-green-900'
                          : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                      }`}
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>حفظ القائمة الحالية كمجلد</span>
                    </button>
                  )}
                </div>
              </div>

              {collectionFolders.length === 0 ? (
                <div className={`p-12 text-center rounded-2xl border opacity-70 ${isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'}`}>
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40 text-sky-400" />
                  <p className="text-sm font-bold">{t(lang, 'emptyFolders')}</p>
                  <p className="text-xs opacity-70 mt-1 max-w-md mx-auto leading-relaxed">
                    قم بتنفيذ أي عملية بحث، أو استخراج فيديوهات قناة، ثم اضغط على "حفظ في مجلد خاص" ليتم تخزين نتائج البحث بشكل مستقل وباسم خاص.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {collectionFolders.map((folder) => {
                    const isExpanded = expandedFolderIds.has(folder.id);
                    return (
                      <div
                        key={folder.id}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'
                        }`}
                      >
                        {/* Folder Header Bar */}
                        <div
                          onClick={() => handleToggleFolderExpand(folder.id)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-400/20 flex-shrink-0">
                              <Folder className="w-5 h-5 fill-current" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm truncate flex items-center gap-2">
                                <span>{folder.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                                  {folder.items.length} فيديو
                                </span>
                              </h4>
                              <p className="text-[11px] opacity-60 font-mono mt-0.5">
                                تاريخ الإنشاء: {folder.createdAt}
                              </p>
                            </div>
                          </div>

                          {/* Folder Actions */}
                          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            {folder.items.length > 0 && (
                              <button
                                onClick={() => openPlayerQueue(folder.items)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/30 flex items-center gap-1"
                                title="تشغيل كل فيديوهات المجلد تسلسليًا"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>تشغيل الكل</span>
                              </button>
                            )}

                            <button
                              onClick={() => openChunkerModal(folder.items, `مجلد: ${folder.name}`)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 border border-amber-500/30 flex items-center gap-1"
                              title="تقسيم فيديوهات المجلد إلى مستويات بحجم 299 لنقلها للدفاتر"
                            >
                              <ListOrdered className="w-3.5 h-3.5 text-amber-500" />
                              <span>تقسيم 299</span>
                            </button>

                            <button
                              onClick={() => handleOpenNotebookLMModal(folder.items, `مجلد: ${folder.name}`)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 border border-purple-500/30 flex items-center gap-1 transition-all"
                              title="إنشاء دفتر NotebookLM جديد من هذا المجلد (299 فيديو max)"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                              <span>دفتر NotebookLM</span>
                            </button>

                            <button
                              onClick={() => handleExportMd(folder.items)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-sky-400/40 text-sky-300 hover:bg-sky-500/10 transition-colors flex items-center gap-1"
                              title="تصدير المجلد لملف Markdown"
                            >
                              <FileText className="w-3.5 h-3.5 text-sky-400" />
                              <span>MD</span>
                            </button>

                            <button
                              onClick={() => handleExportTxt(folder.items)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                              title="تصدير المجلد لملف TXT"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-400" />
                              <span>TXT</span>
                            </button>

                            <button
                              onClick={() => handleImportFolderToMain(folder)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${
                                isLight ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10' : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
                              }`}
                              title="إضافة فيديوهات المجلد إلى نتائج البحث الرئيسية"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>استخراج للرئيسية</span>
                            </button>

                            <button
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                              title="حذف المجلد"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleFolderExpand(folder.id)}
                              className="p-1.5 rounded-lg opacity-70 hover:opacity-100"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Folder Items Content */}
                        {isExpanded && (
                          <div className="p-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-3">
                            {folder.items.length === 0 ? (
                              <p className="text-xs opacity-60 text-center py-4">المجلد فارغ</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {folder.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className={`p-3 rounded-xl border flex gap-3 items-center relative group ${
                                      isLight ? 'bg-white border-gray-200' : 'bg-[#0a0e1a] border-white/10'
                                    }`}
                                  >
                                    <div className="w-20 h-14 relative bg-slate-900 rounded-md overflow-hidden flex-shrink-0 group/thumb">
                                      <img src={item.thumbnail} alt={item.thumbnailAlt} className="w-full h-full object-cover" />
                                      <button
                                        onClick={() => setPreviewVideo(item)}
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white"
                                        title="معاينة الفيديو"
                                      >
                                        <Play className="w-5 h-5 fill-current text-sky-400" />
                                      </button>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <h5 className="text-xs font-bold truncate leading-snug">{item.title}</h5>
                                      <p className="text-[10px] opacity-70 truncate mt-0.5">{item.channelTitle}</p>
                                      <div className="flex items-center justify-between gap-2 mt-1.5">
                                        <button
                                          onClick={() => setPreviewVideo(item)}
                                          className="text-[10px] font-bold text-sky-400 hover:underline flex items-center gap-0.5"
                                        >
                                          <Play className="w-2.5 h-2.5 fill-current" />
                                          <span>معاينة</span>
                                        </button>

                                        <button
                                          onClick={() => handleRemoveItemFromFolder(folder.id, item.id)}
                                          className="text-[10px] text-red-400 hover:underline flex items-center gap-0.5"
                                          title="إزالة من المجلد"
                                        >
                                          <X className="w-3 h-3" />
                                          <span>إزالة</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Favorites Tab */}
          {activeTab === 'favorites' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-black/10 dark:border-white/10">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400 fill-current" />
                    <span>{lang === 'ar' ? 'المفضلة الخاصة بك' : 'Your Favorites'}</span>
                  </h3>
                  <p className="text-xs opacity-70 mt-0.5">
                    {lang === 'ar'
                      ? 'جميع الفيديوهات، القنوات، وقوائم التشغيل المحفوظة كعناصر مفضلة'
                      : 'All videos, channels, and playlists saved to your favorites'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(favoriteVideos.length > 0 || favoriteChannels.length > 0 || favoritePlaylists.length > 0) && (
                    <>
                      <button
                        onClick={() => {
                          const allFavVideos = [...favoriteVideos];
                          if (allFavVideos.length === 0) {
                            showToast(lang === 'ar' ? 'لا توجد فيديوهات مفضلة للتجميع' : 'No favorite videos to export');
                            return;
                          }
                          openChunkerModal(allFavVideos, lang === 'ar' ? 'المفضلة (NotebookLM)' : 'Favorites (NotebookLM)');
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                          isLight
                            ? 'bg-[#205100] text-white hover:bg-green-900'
                            : 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-amber-300'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>تصدير المفضلة لـ NotebookLM (299/دفعة)</span>
                      </button>

                      <button
                        onClick={() => {
                          const text = [
                            ...favoriteVideos.map((v) => `${v.title}\n${v.url}`),
                            ...favoriteChannels.map((c) => `${c.name}\n${c.url}`),
                            ...favoritePlaylists.map((p) => `${p.title}\n${p.url}`)
                          ].join('\n\n');
                          navigator.clipboard.writeText(text);
                          showToast(lang === 'ar' ? 'تم نسخ جميع عناصر المفضلة إلى الحافظة' : 'Copied all favorites to clipboard');
                        }}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 border border-black/10 dark:border-white/10 flex items-center gap-1.5 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الكل</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Favorites Sub-filters */}
              <div className="flex items-center gap-2 border-b pb-3 border-black/5 dark:border-white/5 text-xs font-semibold">
                <button
                  onClick={() => setFavoritesFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    favoritesFilter === 'all'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  الكل ({favoriteVideos.length + favoriteChannels.length + favoritePlaylists.length})
                </button>

                <button
                  onClick={() => setFavoritesFilter('videos')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    favoritesFilter === 'videos'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>الفيديوهات ({favoriteVideos.length})</span>
                </button>

                <button
                  onClick={() => setFavoritesFilter('channels')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    favoritesFilter === 'channels'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>القنوات ({favoriteChannels.length})</span>
                </button>

                <button
                  onClick={() => setFavoritesFilter('playlists')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    favoritesFilter === 'playlists'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>قوائم التشغيل ({favoritePlaylists.length})</span>
                </button>
              </div>

              {/* Favorite Folders: organize favorite videos into multiple named folders */}
              {(favoritesFilter === 'all' || favoritesFilter === 'videos') && favoriteVideos.length > 0 && (
                <div className="space-y-2 border-b pb-3 border-black/5 dark:border-white/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs font-bold opacity-70 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5" />
                      <span>مجلدات المفضلة</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={newFolderNameInput}
                        onChange={(e) => setNewFolderNameInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFavoriteFolder(newFolderNameInput); }}
                        placeholder="اسم مجلد جديد"
                        className="text-xs px-2 py-1.5 rounded-md w-36"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateFavoriteFolder(newFolderNameInput)}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1 font-bold whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>مجلد جديد</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveFavoriteFolderId('all')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        activeFavoriteFolderId === 'all'
                          ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                          : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'
                      }`}
                    >
                      الكل ({favoriteVideos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFavoriteFolderId('unsorted')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        activeFavoriteFolderId === 'unsorted'
                          ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                          : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'
                      }`}
                    >
                      بلا مجلد ({favoriteVideos.filter((v) => !v.folderId).length})
                    </button>

                    {favoriteFolders.map((folder) => {
                      const folderVideos = favoriteVideos.filter((v) => v.folderId === folder.id);
                      return (
                        <div key={folder.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveFavoriteFolderId(folder.id)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              activeFavoriteFolderId === folder.id
                                ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                                : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'
                            }`}
                          >
                            {folder.name} ({folderVideos.length})
                          </button>
                          {activeFavoriteFolderId === folder.id && (
                            <>
                              <button
                                type="button"
                                onClick={() => openPlayerQueue(folderVideos)}
                                title="تشغيل الكل تسلسليًا"
                                className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFavoriteFolder(folder.id)}
                                title="حذف المجلد (تبقى الفيديوهات في المفضلة)"
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {favoriteVideos.length === 0 && favoriteChannels.length === 0 && favoritePlaylists.length === 0 ? (
                <div className={`p-12 text-center rounded-2xl border opacity-70 ${isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'}`}>
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
                  <p className="text-sm font-bold">المفضلة فارغة حالياً</p>
                  <p className="text-xs opacity-70 mt-1 max-w-md mx-auto leading-relaxed">
                    اضغط على نجمة المفضلة ⭐ على أي فيديو، أو قناة، أو قائمة تشغيل أثناء التصفح لحفظها في هذا القسم للرجوع إليها بسرعة في أي وقت.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Favorite Videos */}
                  {(favoritesFilter === 'all' || favoritesFilter === 'videos') && favoriteVideos.length > 0 && (() => {
                    const visibleFavoriteVideos = favoriteVideos.filter((v) => {
                      if (activeFavoriteFolderId === 'all') return true;
                      if (activeFavoriteFolderId === 'unsorted') return !v.folderId;
                      return v.folderId === activeFavoriteFolderId;
                    });
                    return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                          <Film className="w-4 h-4" />
                          <span>الفيديوهات المفضلة ({visibleFavoriteVideos.length})</span>
                        </h4>
                        {visibleFavoriteVideos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => openPlayerQueue(visibleFavoriteVideos)}
                            className="text-[11px] font-bold text-sky-400 hover:underline flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 rounded-lg"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>تشغيل الكل تسلسليًا ({visibleFavoriteVideos.length})</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {visibleFavoriteVideos.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all group relative ${
                              isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'
                            }`}
                          >
                            <div className="aspect-video relative bg-slate-900 rounded-lg overflow-hidden mb-2 group/thumb">
                              <img src={item.thumbnail} alt={item.thumbnailAlt} className="w-full h-full object-cover" />
                              <button
                                onClick={() => openPlayerQueue(visibleFavoriteVideos, idx)}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white"
                              >
                                <Play className="w-8 h-8 fill-current text-sky-400" />
                              </button>

                              <button
                                onClick={() => handleToggleFavoriteVideo(item)}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-amber-500 text-slate-950 font-bold border border-amber-300 shadow-md"
                                title="إزالة من المفضلة"
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                              </button>
                            </div>

                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <h5 className="font-bold text-xs line-clamp-2 leading-snug mb-1">{item.title}</h5>
                                <p className="text-[11px] opacity-70 truncate">{item.channelTitle}</p>
                              </div>

                              <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                                <select
                                  value={item.folderId || ''}
                                  onChange={(e) => handleAssignFavoriteVideoToFolder(item, e.target.value || undefined)}
                                  className="w-full text-[10px] px-1.5 py-1 rounded-md"
                                  title="نقل إلى مجلد"
                                >
                                  <option value="">بلا مجلد</option>
                                  {favoriteFolders.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => openPlayerQueue(visibleFavoriteVideos, idx)}
                                    className="text-[11px] font-bold text-sky-400 hover:underline flex items-center gap-1"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>معاينة وتشغيل</span>
                                  </button>

                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-sky-400 hover:text-sky-300 p-1"
                                    title="فتح في يوتيوب"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })()}

                  {/* Favorite Channels */}
                  {(favoritesFilter === 'all' || favoritesFilter === 'channels') && favoriteChannels.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm text-sky-400 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>القنوات المفضلة ({favoriteChannels.length})</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {favoriteChannels.map((channel) => (
                          <div
                            key={channel.id}
                            className={`p-4 rounded-xl border flex items-start gap-3 justify-between relative group ${
                              isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'
                            }`}
                          >
                            <img src={channel.avatar} alt={channel.name} className="w-12 h-12 rounded-full object-cover border border-white/20 flex-shrink-0" />

                            <div className="min-w-0 flex-1">
                              <h5 className="font-bold text-sm truncate">{channel.name}</h5>
                              {channel.subscribers && <p className="text-[11px] opacity-70 font-mono mt-0.5">{channel.subscribers}</p>}

                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenChannelModal(channel)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                    isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                                  }`}
                                >
                                  استخراج الفيديوهات
                                </button>

                                <button
                                  onClick={() => handleToggleFavoriteChannel(channel)}
                                  className="p-1 text-amber-400 hover:text-amber-300"
                                  title="إزالة من المفضلة"
                                >
                                  <Star className="w-4 h-4 fill-current" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Favorite Playlists */}
                  {(favoritesFilter === 'all' || favoritesFilter === 'playlists') && favoritePlaylists.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm text-purple-400 flex items-center gap-2">
                        <ListOrdered className="w-4 h-4" />
                        <span>قوائم التشغيل المفضلة ({favoritePlaylists.length})</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {favoritePlaylists.map((playlist) => (
                          <div
                            key={playlist.id}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                              isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'
                            }`}
                          >
                            <div className="aspect-video relative bg-slate-900 rounded-lg overflow-hidden mb-2">
                              <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-y-0 right-0 w-1/3 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white text-xs font-bold gap-1">
                                <ListOrdered className="w-4 h-4 text-sky-400" />
                                <span>{playlist.videoCount || 'Playlist'}</span>
                              </div>
                            </div>

                            <h5 className="font-bold text-xs line-clamp-2">{playlist.title}</h5>

                            <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                              <button
                                onClick={() => handleExtractPlaylist(playlist.url, playlist.title)}
                                className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1"
                              >
                                <Film className="w-3.5 h-3.5" />
                                <span>استخراج كافة الفيديوهات</span>
                              </button>

                              <button
                                onClick={() => handleToggleFavoritePlaylist(playlist)}
                                className="p-1 text-amber-400"
                                title="إزالة من المفضلة"
                              >
                                <Star className="w-4 h-4 fill-current" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">{t(lang, 'historyTab')}</h3>
              <div className={`p-4 rounded-xl border font-mono text-xs space-y-2 ${isLight ? 'bg-white border-[#c1c9b6]' : 'bg-[#0a0e1a] border-white/10'}`}>
                {historyLogs.map((log, index) => (
                  <div key={index} className="flex items-center gap-2 opacity-80 border-b pb-1.5 border-black/5 dark:border-white/5 last:border-0">
                    <span className="text-sky-400">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl">
              <h3 className="font-bold text-lg">{t(lang, 'settingsTab')}</h3>

              <div className={`p-6 rounded-xl border space-y-6 ${isLight ? 'bg-white border-[#c1c9b6]' : 'glass-card'}`}>
                <div>
                  <label className="block text-xs font-bold tracking-wider mb-2 opacity-80 uppercase">
                    {t(lang, 'themeLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={onThemeToggle}
                      className={`p-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                        isLight ? 'border-[#205100] bg-green-50 text-[#205100]' : 'border-white/10 bg-white/5'
                      }`}
                    >
                      {t(lang, 'editorialLight')}
                    </button>
                    <button
                      onClick={onThemeToggle}
                      className={`p-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                        !isLight ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-[#c1c9b6] bg-white'
                      }`}
                    >
                      {t(lang, 'glacierDark')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Sticky Action Footer */}
        <div className={`mobile-sticky-footer fixed bottom-0 ${lang === 'ar' ? 'left-0 right-64' : 'right-0 left-64'} border-t p-4 flex items-center justify-between z-20 backdrop-blur-md ${
          isLight ? 'bg-[#f7fbed]/90 border-[#c1c9b6]' : 'bg-[#0a0e1a]/90 border-white/10'
        }`}>
          <div className="mobile-footer-status text-xs font-mono font-medium opacity-80 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${selectedCount > 0 ? 'bg-sky-400 animate-pulse' : 'bg-gray-400'}`}></span>
            <span>{selectedCount} {t(lang, 'itemsSelected')}</span>
          </div>

          <div className="mobile-footer-actions flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => handleExportMd()}
              aria-label={t(lang, 'exportMd')}
              className={`mobile-footer-action px-3 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                isLight ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10' : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
              }`}
              title="تصدير المحدد أو الكل لملف MD Markdown"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>{t(lang, 'exportMd')}</span>
            </button>

            <button
              onClick={handleCopyVideoIds}
              aria-label="Copy Video IDs"
              className={`mobile-footer-action px-3 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                isLight ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10' : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
              }`}
              title="Copy raw Video IDs only"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Video IDs</span>
            </button>

            <button
              onClick={handleCopyAll}
              aria-label={t(lang, 'copyAll')}
              className={`mobile-footer-action px-4 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-2 ${
                isLight ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10' : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{t(lang, 'copyAll')}</span>
            </button>

            <button
              onClick={handleCopySelected}
              aria-label={t(lang, 'copySelected')}
              className={`mobile-footer-action px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                isLight ? 'bg-[#205100] text-white hover:bg-green-900' : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t(lang, 'copySelected')}</span>
            </button>
          </div>
        </div>

        {/* Modal: Channel Videos & Playlists Drilldown */}
        {showChannelModal && selectedChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <div className={`w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
            }`}>
              {/* Modal Header */}
              <div className="p-5 border-b border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedChannel.avatar}
                    alt={selectedChannel.name}
                    className="w-10 h-10 rounded-full object-cover border border-sky-400"
                  />
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <span>{selectedChannel.name}</span>
                      <span className="text-xs opacity-60 font-normal">({channelVideos.length} فيديو)</span>
                    </h3>
                    <p className="text-xs opacity-70">استخراج فيديوهات وقوائم تشغيل القناة</p>
                  </div>
                </div>

                {/* Channel Sub-Tabs: Videos vs Playlists */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-1 rounded-xl bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
                    <button
                      onClick={() => setChannelTabMode('videos')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        channelTabMode === 'videos'
                          ? isLight ? 'bg-[#205100] text-white shadow' : 'bg-sky-500 text-slate-950 shadow'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>فيديوهات القناة ({channelVideos.length})</span>
                    </button>

                    <button
                      onClick={() => {
                        setChannelTabMode('playlists');
                        if (channelPlaylists.length === 0) {
                          handleFetchChannelPlaylists(selectedChannel);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        channelTabMode === 'playlists'
                          ? isLight ? 'bg-[#205100] text-white shadow' : 'bg-sky-500 text-slate-950 shadow'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <List className="w-3.5 h-3.5 text-amber-400" />
                      <span>قوائم التشغيل ({channelPlaylists.length})</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowChannelModal(false)}
                    className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body / Videos or Playlists Grid */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {channelTabMode === 'videos' ? (
                  loadingChannelVideos ? (
                    <div className="py-12 text-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-400" />
                      <p className="text-sm font-semibold">{t(lang, 'fetchingChannelVideos')}</p>
                    </div>
                  ) : channelVideos.length === 0 ? (
                    <div className="py-12 text-center opacity-70 text-sm">
                      لم نتمكن من جلب فيديوهات القناة حالياً
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
                        <p className="text-xs font-semibold opacity-80">
                          محدّد: {channelVideos.filter((v) => v.selected).length} من أصل {channelVideos.length} فيديو
                        </p>
                        <button
                          onClick={handleToggleSelectAllChannelVideos}
                          className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>
                            {channelVideos.every((v) => v.selected) ? 'إلغاء تحديد الكل' : 'تحديد جميع فيديوهات القناة'}
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {channelVideos.slice(0, displayedChannelVideosCount).map((vid) => (
                          <div
                            key={vid.id}
                            onClick={() => handleToggleSelectChannelVideo(vid.id)}
                            className={`p-3 rounded-lg border flex gap-3 items-center transition-all cursor-pointer relative group ${
                              vid.selected
                                ? isLight ? 'bg-green-50 border-[#205100]' : 'bg-sky-500/10 border-sky-400'
                                : isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#0a0e1a] border-white/10'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={vid.selected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleSelectChannelVideo(vid.id);
                              }}
                              className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 cursor-pointer flex-shrink-0"
                            />

                            <div className="w-20 h-14 relative bg-slate-900 rounded-md overflow-hidden flex-shrink-0 group/thumb">
                              <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewVideo(vid);
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white"
                                title="معاينة وتشغيل الفيديو"
                              >
                                <Play className="w-5 h-5 fill-current text-sky-400" />
                              </button>
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold line-clamp-2 leading-snug">{vid.title}</h4>
                              <div className="flex items-center justify-between gap-1 mt-1">
                                <p className="text-[10px] font-mono opacity-60 truncate">{vid.duration || 'N/A'}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewVideo(vid);
                                  }}
                                  className="text-[10px] font-bold text-sky-400 hover:underline flex items-center gap-0.5"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>معاينة</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Load More Channel Videos Button */}
                      {channelVideos.length > 0 && (
                        <div className="mt-6 text-center flex flex-col items-center justify-center gap-2 border-t pt-4 border-black/10 dark:border-white/10">
                          <p className="text-xs opacity-70 font-mono">
                            {lang === 'ar'
                              ? `عرض ${Math.min(displayedChannelVideosCount, channelVideos.length)} من أصل ${channelVideos.length} فيديو مستخرج للقناة`
                              : `Showing ${Math.min(displayedChannelVideosCount, channelVideos.length)} of ${channelVideos.length} extracted channel videos`}
                          </p>

                          {displayedChannelVideosCount < channelVideos.length && (
                            <button
                              onClick={handleLoadMoreChannelVideos}
                              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 border hover:scale-[1.02] active:scale-95 ${
                                isLight
                                  ? 'bg-[#205100] text-white hover:bg-green-900 border-green-900'
                                  : 'bg-sky-500 text-slate-950 hover:bg-sky-400 border-sky-400'
                              }`}
                            >
                              <Plus className="w-4 h-4" />
                              <span>{t(lang, 'loadMoreChannelVideos')}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )
                ) : (
                  /* CHANNEL PLAYLISTS TAB */
                  loadingChannelPlaylists ? (
                    <div className="py-12 text-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" />
                      <p className="text-sm font-semibold">جاري البحث عن قوائم التشغيل التابعة للقناة...</p>
                    </div>
                  ) : channelPlaylists.length === 0 ? (
                    <div className="py-12 text-center opacity-70 text-sm space-y-2">
                      <List className="w-8 h-8 mx-auto opacity-50 text-amber-400" />
                      <p>لم نتمكن من جلب قوائم تشغيل هذه القناة أوتوماتيكياً</p>
                      <p className="text-xs opacity-60">يمكنك نسخ رابط أي قائمة تشغيل ولصقها مباشرة في صندوق البحث الرئيسي لاستخراج كافة فيديوهاتها.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold opacity-80 border-b pb-2 border-black/10 dark:border-white/10">
                        تم العثور على <strong className="text-amber-400">{channelPlaylists.length} قائمة تشغيل</strong> خاصة بالقناة:
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {channelPlaylists.map((pl) => (
                          <div
                            key={pl.id}
                            className={`p-4 rounded-xl border flex gap-4 items-start transition-all ${
                              isLight ? 'bg-white border-[#c1c9b6] shadow-sm' : 'bg-[#0a0e1a] border-white/10 hover:border-amber-400/50'
                            }`}
                          >
                            <div className="w-24 h-16 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 relative group">
                              <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <List className="w-6 h-6 text-amber-400" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 space-y-2">
                              <h4 className="font-bold text-xs line-clamp-2 leading-snug">{pl.title}</h4>
                              <div className="flex items-center gap-2 text-[10px] opacity-70 font-mono">
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                  {pl.videoCount !== 'N/A' ? `${pl.videoCount} فيديو` : 'قائمة تشغيل'}
                                </span>
                              </div>

                              <button
                                onClick={() => handleExtractPlaylist(pl.url, pl.title)}
                                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border shadow-sm ${
                                  isLight
                                    ? 'bg-[#205100] text-white hover:bg-green-900 border-green-900'
                                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-400'
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{t(lang, 'viewPlaylistVideos')}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/5 dark:bg-white/5">
                <p className="text-xs font-mono opacity-80">
                  إجمالي الفيديوهات المستخرجة: {channelVideos.length}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowChannelModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold opacity-80 hover:opacity-100"
                  >
                    {t(lang, 'close')}
                  </button>

                  <button
                    onClick={() => {
                      const activeVids = channelVideos.filter((v) => v.selected);
                      openChunkerModal(activeVids.length > 0 ? activeVids : channelVideos, `قناة: ${selectedChannel.name}`);
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5"
                    title="تقسيم النتائج إلى مستويات بحجم 299 فيديو كحد أقصى لنقلها إلى الدفاتر"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-amber-500" />
                    <span>تقسيم 299 (للدفاتر)</span>
                  </button>

                  <button
                    onClick={() => {
                      const selectedVids = channelVideos.filter((v) => v.selected);
                      const vidsToSave = selectedVids.length > 0 ? selectedVids : channelVideos;
                      handleOpenSaveFolderModal(vidsToSave, `قناة: ${selectedChannel.name}`);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border ${
                      isLight
                        ? 'bg-[#205100] text-white hover:bg-green-900'
                        : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                    }`}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{t(lang, 'saveAsChannelFolder')}</span>
                  </button>

                  <button
                    onClick={handleAddChannelVideosToMain}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border ${
                      isLight
                        ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10'
                        : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t(lang, 'addAllToMainList')}</span>
                  </button>

                  <button
                    onClick={() => handleExportMd(channelVideos)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border ${
                      isLight
                        ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10'
                        : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>تصدير MD</span>
                  </button>

                  <button
                    onClick={handleCopyChannelVideos}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                      isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ جميع روابط القناة ({channelVideos.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Extract from Channel URL or Handle */}
        {showChannelInputModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
            }`}>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                <span>{t(lang, 'addChannelUrl')}</span>
              </h3>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!customChannelUrlInput.trim()) return;
                setShowChannelInputModal(false);
                handleExtractFromChannelUrl(customChannelUrlInput.trim());
                setCustomChannelUrlInput('');
              }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 opacity-80">{t(lang, 'enterChannelUrl')} *</label>
                  <input
                    type="text"
                    required
                    value={customChannelUrlInput}
                    onChange={(e) => setCustomChannelUrlInput(e.target.value)}
                    placeholder="https://youtube.com/@channelName or @channelName"
                    className={`w-full p-2.5 rounded-lg text-xs border outline-none font-mono ${
                      isLight ? 'bg-gray-50 border-gray-300' : 'bg-[#0a0e1a] border-white/10'
                    }`}
                  />
                  <p className="text-[11px] opacity-60 mt-1 leading-relaxed">
                    يمكنك إدخال رابط القناة، أو المعرّف (مثل @channel)، أو اسم القناة مباشرة للبحث العميق واستخراج كافة فيديوهاتها.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChannelInputModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold opacity-80 hover:opacity-100"
                  >
                    {t(lang, 'close')}
                  </button>

                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>{t(lang, 'extractAllChannelVideos')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Manual Custom Link */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
            }`}>
              <h3 className="font-bold text-base">{t(lang, 'addCustomUrl')}</h3>

              <form onSubmit={handleAddManualLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 opacity-80">{t(lang, 'enterUrl')} *</label>
                  <input
                    type="text"
                    required
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className={`w-full p-2.5 rounded-lg text-xs border outline-none font-mono ${
                      isLight ? 'bg-gray-50 border-gray-300' : 'bg-[#0a0e1a] border-white/10'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 opacity-80">{t(lang, 'enterTitle')}</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="My Favorite Video"
                    className={`w-full p-2.5 rounded-lg text-xs border outline-none ${
                      isLight ? 'bg-gray-50 border-gray-300' : 'bg-[#0a0e1a] border-white/10'
                    }`}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold opacity-80 hover:opacity-100"
                  >
                    {t(lang, 'close')}
                  </button>

                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-lg text-xs font-bold ${
                      isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                    }`}
                  >
                    {t(lang, 'addBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Save to Collection Folder */}
        {showSaveFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <div className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
            }`}>
              <div className="flex justify-between items-center border-b pb-3 border-black/10 dark:border-white/10">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-sky-400" />
                  <span>{t(lang, 'saveFolderModalTitle')}</span>
                </h3>
                <button
                  onClick={() => setShowSaveFolderModal(false)}
                  className="p-1 rounded opacity-70 hover:opacity-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs opacity-80 leading-relaxed">
                سيتم حفظ <strong className="text-sky-400 font-mono">{targetFolderItems.length} فيديو</strong> ضمن مجلد خاص في قسم المجموعات لتنظيم نتائج البحث وسهولة الوصول إليها لاحقاً.
              </p>

              <form onSubmit={handleConfirmSaveToFolder} className="space-y-4">
                {/* Select Destination: New or Existing Folder */}
                {collectionFolders.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5 opacity-80">
                      اختر مجلد الحفظ:
                    </label>
                    <select
                      value={selectedExistingFolderId}
                      onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold border outline-none ${
                        isLight ? 'bg-gray-50 border-gray-300' : 'bg-[#0a0e1a] border-white/20'
                      }`}
                    >
                      <option value="new">➕ {t(lang, 'createNewFolder')}</option>
                      {collectionFolders.map((f) => (
                        <option key={f.id} value={f.id}>
                          📁 {f.name} ({f.items.length} فيديو)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Input for Folder Name if 'new' is selected */}
                {selectedExistingFolderId === 'new' && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5 opacity-80">
                      {t(lang, 'folderNameLabel')}
                    </label>
                    <input
                      type="text"
                      value={folderNameInput}
                      onChange={(e) => setFolderNameInput(e.target.value)}
                      placeholder="مثال: بحث: الخزانة، أو قناة الجزيرة..."
                      required
                      className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold border outline-none transition-colors ${
                        isLight
                          ? 'bg-gray-50 border-gray-300 focus:border-[#205100]'
                          : 'bg-[#0a0e1a] border-white/20 focus:border-sky-400'
                      }`}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowSaveFolderModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold opacity-70 hover:opacity-100"
                  >
                    {t(lang, 'close')}
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                      isLight ? 'bg-[#205100] text-white hover:bg-green-900' : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                    }`}
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>تأكيد الحفظ بالمجموعات</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Live Video Preview & Player (queue-aware, resizable, minimizable) */}
        {previewVideo && (
          <div className={playerMinimized
            ? `fixed bottom-4 left-4 z-50 ${audioOnlyMode ? 'w-60' : 'w-72'}`
            : 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto'
          }>
            <div className={`w-full flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              playerMinimized
                ? 'bg-black border-white/10 text-white'
                : `${{ compact: 'max-w-md', standard: 'max-w-3xl', large: 'max-w-5xl' }[playerSize]} ${
                    isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
                  }`
            }`}>
              {/* Full Header (hidden while minimized) */}
              {!playerMinimized && (
                <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Play className="w-5 h-5 text-sky-400 flex-shrink-0 fill-current" />
                    <h3 className="font-bold text-sm truncate">{previewVideo.title}</h3>
                    {playerQueue.length > 1 && (
                      <span className="text-[10px] font-mono opacity-60 flex-shrink-0">
                        {playerQueueIndex + 1} / {playerQueue.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {/* Size controls (معطّلة بصريًا في وضع الصوت فقط) */}
                    {!audioOnlyMode && (
                      <div className="flex items-center gap-0.5 bg-black/10 dark:bg-white/5 rounded-lg p-0.5">
                        {([
                          ['compact', 'مصغّرة'],
                          ['standard', 'عادية'],
                          ['large', 'كبيرة']
                        ] as [PlayerSize, string][]).map(([size, label]) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setPlayerSize(size)}
                            title={`حجم النافذة: ${label}`}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                              playerSize === size
                                ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                                : 'opacity-60 hover:opacity-100'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setAudioOnlyMode((v) => !v)}
                      title={audioOnlyMode ? 'إظهار الصورة' : 'وضع الصوت فقط (إخفاء الصورة مع استمرار التشغيل)'}
                      className={`p-1.5 rounded-lg transition-colors ${
                        audioOnlyMode
                          ? isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                          : 'opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      <Shrink className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePictureInPicture}
                      title="نافذة عائمة (Picture-in-Picture)"
                      className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlayerMinimized(true)}
                      title="تصغير والاستمرار في التصفح"
                      className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={closePlayerAndCleanupPip}
                      className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      title={t(lang, 'close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Mini Header (visible only while minimized) */}
              {playerMinimized && (
                <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-black/80">
                  <p className="text-[11px] font-bold truncate flex-1">{previewVideo.title}</p>
                  <button type="button" onClick={() => setPlayerMinimized(false)} title="تكبير" className="p-1 opacity-80 hover:opacity-100">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={closePlayerAndCleanupPip} title={t(lang, 'close')} className="p-1 opacity-80 hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Player dock — يبقى هذا العنصر مُركَّبًا دائمًا (حتى في وضع الصوت فقط) كي لا ينقطع التشغيل */}
              <div
                ref={playerDockRef}
                className={`w-full bg-black relative ${audioOnlyMode ? 'h-0 overflow-hidden' : 'aspect-video'}`}
              >
                <div ref={ytPlayerContainerRef} className="w-full h-full" />
              </div>

              {/* شريط بديل مرئي أثناء وضع الصوت فقط */}
              {audioOnlyMode && (
                <div className={`px-4 py-6 flex items-center gap-3 ${isLight ? 'bg-[#f7fbed]' : 'bg-black/40'}`}>
                  <div className={`p-2.5 rounded-full flex-shrink-0 ${isLight ? 'bg-[#205100]/10 text-[#205100]' : 'bg-sky-500/15 text-sky-400'}`}>
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{previewVideo.title}</p>
                    <p className="text-[11px] opacity-60">وضع الصوت فقط — التشغيل مستمر بدون صورة</p>
                  </div>
                </div>
              )}

              {/* Queue navigation (shown whenever there is more than one video queued) */}
              {playerQueue.length > 1 && (
                <div className={`flex items-center justify-between gap-2 px-3 py-2 ${playerMinimized ? 'bg-black/90' : 'border-t border-black/10 dark:border-white/10'}`}>
                  <button
                    type="button"
                    onClick={handlePlayerPrev}
                    className="p-1.5 rounded-lg opacity-80 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-1 text-xs font-bold"
                    title="الفيديو السابق في القائمة"
                  >
                    <SkipBack className="w-4 h-4" />
                    {!playerMinimized && <span>السابق</span>}
                  </button>
                  {!playerMinimized && (
                    <span className="text-[11px] font-mono opacity-60">{playerQueueIndex + 1} / {playerQueue.length}</span>
                  )}
                  <button
                    type="button"
                    onClick={handlePlayerNext}
                    className="p-1.5 rounded-lg opacity-80 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-1 text-xs font-bold"
                    title="الفيديو التالي في القائمة"
                  >
                    {!playerMinimized && <span>التالي</span>}
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Footer details & actions (hidden while minimized to keep the dock small) */}
              {!playerMinimized && (
                <div className="p-4 space-y-3 bg-black/5 dark:bg-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sky-400">{previewVideo.channelTitle || 'YouTube Video'}</span>
                      {previewVideo.channelTitle && (
                        <button
                          onClick={() => {
                            handleOpenChannelFromVideo(previewVideo);
                            closePlayerAndCleanupPip();
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 transition-all flex items-center gap-1.5 shadow"
                          title="الدخول مباشرة إلى هذه القناة واستخراج كافة فيديوهاتها وقوائمها"
                        >
                          <Users className="w-3.5 h-3.5 text-sky-400" />
                          <span>الدخول إلى القناة</span>
                        </button>
                      )}
                      {previewVideo.duration && <span className="opacity-70 font-mono">• {previewVideo.duration}</span>}
                      {previewVideo.views && <span className="opacity-70">• {previewVideo.views}</span>}
                    </div>

                    <a
                      href={previewVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>مشاهدة مباشرة على YouTube</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(previewVideo.url);
                        showToast(lang === 'ar' ? 'تم نسخ رابط الفيديو!' : 'Copied video URL!');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
                        isLight ? 'border-[#205100] text-[#205100] hover:bg-[#205100]/10' : 'border-sky-400 text-sky-300 hover:bg-sky-500/10'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ رابط الفيديو</span>
                    </button>

                    <button
                      onClick={closePlayerAndCleanupPip}
                      className={`px-5 py-1.5 rounded-lg text-xs font-bold ${
                        isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                      }`}
                    >
                      {t(lang, 'close')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Standalone Playlist Videos Extraction */}
        {showPlaylistModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <div className={`w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
            }`}>
              {/* Playlist Modal Header */}
              <div className="p-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <List className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <span>{playlistModalTitle || 'قائمة التشغيل'}</span>
                      <span className="text-xs opacity-60 font-normal">({playlistVideos.length} فيديو)</span>
                    </h3>
                    <p className="text-xs opacity-70">تم استخراج كافة فيديوهات قائمة التشغيل</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowPlaylistModal(false)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Playlist Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {loadingPlaylistVideos ? (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" />
                    <p className="text-sm font-semibold">جاري جلب كافة فيديوهات قائمة التشغيل...</p>
                  </div>
                ) : playlistVideos.length === 0 ? (
                  <div className="py-12 text-center opacity-70 text-sm">
                    لم نتمكن من جلب فيديوهات قائمة التشغيل حالياً
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
                      <p className="text-xs font-semibold opacity-80">
                        محدّد: {playlistVideos.filter((v) => v.selected).length} من أصل {playlistVideos.length} فيديو
                      </p>
                      <button
                        onClick={() => {
                          const allSelected = playlistVideos.every((v) => v.selected);
                          setPlaylistVideos((prev) => prev.map((v) => ({ ...v, selected: !allSelected })));
                        }}
                        className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>
                          {playlistVideos.every((v) => v.selected) ? 'إلغاء تحديد الكل' : 'تحديد كافة فيديوهات القائمة'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {playlistVideos.slice(0, displayedPlaylistVideosCount).map((vid) => (
                        <div
                          key={vid.id}
                          onClick={() => {
                            setPlaylistVideos((prev) =>
                              prev.map((v) => (v.id === vid.id ? { ...v, selected: !v.selected } : v))
                            );
                          }}
                          className={`p-3 rounded-lg border flex gap-3 items-center transition-all cursor-pointer relative group ${
                            vid.selected
                              ? isLight ? 'bg-amber-50 border-amber-600' : 'bg-amber-500/10 border-amber-400'
                              : isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#0a0e1a] border-white/10'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={vid.selected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setPlaylistVideos((prev) =>
                                prev.map((v) => (v.id === vid.id ? { ...v, selected: !v.selected } : v))
                              );
                            }}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                          />

                          <div className="w-20 h-14 relative bg-slate-900 rounded-md overflow-hidden flex-shrink-0 group/thumb">
                            <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewVideo(vid);
                              }}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="معاينة وتشغيل الفيديو"
                            >
                              <Play className="w-5 h-5 fill-current text-amber-400" />
                            </button>
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold line-clamp-2 leading-snug">{vid.title}</h4>
                            <div className="flex items-center justify-between gap-1 mt-1">
                              <p className="text-[10px] font-mono opacity-60 truncate">{vid.duration || 'N/A'}</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewVideo(vid);
                                }}
                                className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-0.5"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                <span>معاينة</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Load More Playlist Videos Button */}
                    {playlistVideos.length > displayedPlaylistVideosCount && (
                      <div className="mt-6 text-center flex flex-col items-center justify-center gap-2 border-t pt-4 border-black/10 dark:border-white/10">
                        <p className="text-xs opacity-70 font-mono">
                          عرض {displayedPlaylistVideosCount} من أصل {playlistVideos.length} فيديو في قائمة التشغيل
                        </p>
                        <div className="flex items-center gap-3 flex-wrap justify-center">
                          <button
                            onClick={() => setDisplayedPlaylistVideosCount((prev) => prev + 100)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 border hover:scale-[1.02] active:scale-95 ${
                              isLight
                                ? 'bg-slate-800 text-white hover:bg-slate-700'
                                : 'bg-slate-700 text-white hover:bg-slate-600'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                            <span>عرض +100 فيديو إضافي</span>
                          </button>

                          <button
                            onClick={() => setDisplayedPlaylistVideosCount(playlistVideos.length)}
                            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 border hover:scale-[1.02] active:scale-95 ${
                              isLight
                                ? 'bg-[#205100] text-white hover:bg-green-900 border-green-900'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-400'
                            }`}
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>عرض كافة الفيديوهات ({playlistVideos.length}) دفعة واحدة</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Playlist Modal Footer */}
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/5 dark:bg-white/5">
                <p className="text-xs font-mono opacity-80">
                  إجمالي الفيديوهات: {playlistVideos.length}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowPlaylistModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold opacity-80 hover:opacity-100"
                  >
                    {t(lang, 'close')}
                  </button>

                  <button
                    onClick={() => {
                      const activeVids = playlistVideos.filter((v) => v.selected);
                      openChunkerModal(activeVids.length > 0 ? activeVids : playlistVideos, `قائمة تشغيل: ${playlistModalTitle}`);
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5"
                    title="تقسيم نتائج قائمة التشغيل إلى مستويات بحجم 299 فيديو لنقلها للدفاتر"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-amber-500" />
                    <span>تقسيم 299 (للدفاتر)</span>
                  </button>

                  <button
                    onClick={() => {
                      const activeVids = playlistVideos.filter((v) => v.selected);
                      const target = activeVids.length > 0 ? activeVids : playlistVideos;
                      handleOpenNotebookLMModal(target, playlistModalTitle || 'قائمة التشغيل');
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all flex items-center gap-1.5 shadow"
                    title="إنشاء دفتر مصادر جديد في NotebookLM مباشرة"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-purple-200" />
                    <span>إنشاء دفتر NotebookLM ({playlistVideos.length > 299 ? '299 عنصر' : playlistVideos.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      const activeVids = playlistVideos.filter((v) => v.selected);
                      handleOpenSaveFolderModal(activeVids.length > 0 ? activeVids : playlistVideos, `قائمة: ${playlistModalTitle}`);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border ${
                      isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                    }`}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>حفظ المجموعات</span>
                  </button>

                  <button
                    onClick={() => {
                      const activeVids = playlistVideos.filter((v) => v.selected);
                      const vidsToAdd = activeVids.length > 0 ? activeVids : playlistVideos;
                      setItems((prev) => {
                        const existingIds = new Set(prev.map((i) => i.id));
                        const newVids = vidsToAdd.filter((v) => !existingIds.has(v.id));
                        return [...newVids, ...prev];
                      });
                      setShowPlaylistModal(false);
                      showToast(lang === 'ar' ? `تمت إضافة ${vidsToAdd.length} فيديو للقائمة الرئيسية` : `Added ${vidsToAdd.length} videos`);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                      isLight ? 'border-[#205100] text-[#205100]' : 'border-sky-400 text-sky-300'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة للقائمة الرئيسية</span>
                  </button>

                  <button
                    onClick={() => {
                      const activeVids = playlistVideos.filter((v) => v.selected);
                      handleExportMd(activeVids.length > 0 ? activeVids : playlistVideos);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                      isLight ? 'border-[#205100] text-[#205100]' : 'border-sky-400 text-sky-300'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>تصدير MD</span>
                  </button>

                  <button
                    onClick={() => {
                      const activeVids = playlistVideos.filter((v) => v.selected);
                      const target = activeVids.length > 0 ? activeVids : playlistVideos;
                      const urls = target.map((v) => v.url).join('\n');
                      navigator.clipboard.writeText(urls);
                      showToast(lang === 'ar' ? `تم نسخ ${target.length} رابط إلى الحافظة!` : `Copied ${target.length} links!`);
                    }}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                      isLight ? 'bg-[#205100] text-white' : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ روابط القائمة ({playlistVideos.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Notebook Batch Chunker (299 Videos Per Level) */}
        {showChunkerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
            }`}>
              {/* Chunker Modal Header */}
              <div className="p-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-amber-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <span>تقسيم وتوزيع النتائج إلى مستويات (299 فيديو لكل مستوى)</span>
                      <span className="text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-bold">
                        {chunkerItems.length} فيديو
                      </span>
                    </h3>
                    <p className="text-xs opacity-80">{chunkerTitle}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowChunkerModal(false)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chunker Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Information Banner */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                }`}>
                  <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed space-y-1">
                    <p className="font-bold">ملاحظة هامة للنقل والتصدير للدفاتر:</p>
                    <p>
                      نظراً لأن أجهزة ومطبيقات الدفاتر الملاحظية لا تتحمل أكثر من 300 عنصر في المستند الواحد، تم تقسيم نتائجك الإجمالية (<strong>{chunkerItems.length} فيديو</strong>) إلى <strong>{getChunks299(chunkerItems).length} مستوى</strong> بحجم أقصاه 299 فيديو لكل مستوى. يمكنك الآن نسخ كل مستوى بنقرة زر واحدة أو تصديره في ملف مستقل ووضعه داخل الدفتر بمرونة تامة.
                    </p>
                  </div>
                </div>

                {/* Chunks Level List */}
                <div className="space-y-4">
                  {getChunks299(chunkerItems).map((chunk) => (
                    <div
                      key={chunk.level}
                      className={`p-5 rounded-2xl border transition-all ${
                        isLight ? 'bg-gray-50 border-gray-200 shadow-sm' : 'bg-[#0a0e1a] border-white/10 hover:border-amber-400/40'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-3 border-black/10 dark:border-white/10">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold font-mono flex items-center justify-center border border-amber-500/30">
                            L{chunk.level}
                          </span>
                          <div>
                            <h4 className="font-bold text-sm flex items-center gap-2">
                              <span>المستوى {chunk.level}</span>
                              <span className="text-xs opacity-70 font-normal">
                                ({chunk.items.length} فيديو - من #{chunk.startIdx} إلى #{chunk.endIdx})
                              </span>
                            </h4>
                            <p className="text-[11px] opacity-60 font-mono">
                              يحتوي على 299 عنصر جاهزة للنسخ أو التصدير
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleCopyLevelLinks(chunk.items, chunk.level)}
                            className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ روابط المستوى {chunk.level} ({chunk.items.length})</span>
                          </button>

                          <button
                            onClick={() => handleOpenNotebookLMModal(chunk.items, `${chunkerTitle} - المستوى ${chunk.level}`)}
                            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all flex items-center gap-1.5 shadow"
                            title="إنشاء دفتر مصادر خاص بهذه الحزمة في NotebookLM"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-purple-200" />
                            <span>إنشاء دفتر NotebookLM ({chunk.items.length})</span>
                          </button>

                          <button
                            onClick={() => handleExportLevelTxt(chunk.items, chunk.level, chunkerTitle)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                              isLight ? 'border-[#205100] text-[#205100]' : 'border-emerald-400 text-emerald-300'
                            }`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>تصدير TXT</span>
                          </button>

                          <button
                            onClick={() => handleExportLevelMd(chunk.items, chunk.level, chunkerTitle)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                              isLight ? 'border-[#205100] text-[#205100]' : 'border-sky-400 text-sky-300'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>تصدير MD</span>
                          </button>
                        </div>
                      </div>

                      {/* Level Preview Container */}
                      <div className="mt-3 bg-black/20 rounded-xl p-3 max-h-36 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300 border border-black/10 dark:border-white/5">
                        {chunk.items.slice(0, 10).map((v, i) => (
                          <div key={v.id || i} className="truncate flex items-center gap-2 opacity-80">
                            <span className="text-amber-400 w-8 flex-shrink-0">#{chunk.startIdx + i}</span>
                            <span className="truncate">{v.title}</span>
                            <span className="opacity-50 text-[10px]">({v.url})</span>
                          </div>
                        ))}
                        {chunk.items.length > 10 && (
                          <div className="text-[10px] text-amber-400 font-sans italic pt-1">
                            ... و {chunk.items.length - 10} فيديو آخر ضمن هذا المستوى جاهزة للنسخ.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chunker Modal Footer */}
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5">
                <p className="text-xs font-mono opacity-80">
                  إجمالي المستويات المُنشأة: {getChunks299(chunkerItems).length} مستوى
                </p>

                <button
                  onClick={() => setShowChunkerModal(false)}
                  className={`px-6 py-2 rounded-lg text-xs font-bold ${
                    isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                  }`}
                >
                  {t(lang, 'close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Notebook in NotebookLM (Gemini) */}
        {showNotebookLMModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-[#c1c9b6] text-black' : 'bg-[#141c2e] border-white/10 text-white'
            }`}>
              {/* Modal Header */}
              <div className="p-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-purple-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <span>إنشاء دفتر مصادر في NotebookLM (Gemini)</span>
                      <span className="text-xs bg-purple-500 text-white px-2.5 py-0.5 rounded-full font-bold">
                        {notebookLMItems.length} فيديو
                      </span>
                    </h3>
                    <p className="text-xs opacity-80">{notebookLMTitle}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowNotebookLMModal(false)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Step Guide Banner */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isLight ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                }`}>
                  <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed space-y-2">
                    <p className="font-bold text-sm">خطوات الاستيراد السريعة إلى Google NotebookLM:</p>
                    <ol className="list-decimal list-inside space-y-1 opacity-90">
                      <li>
                        تم نسخ جميع روابط المصادر الـ <strong>{notebookLMItems.length}</strong> تلقائياً إلى الحافظة.
                      </li>
                      <li>
                        اضغط على زر <strong>"الانتقال إلى Google NotebookLM"</strong> بالأسفل لفتح منصة NotebookLM في تبويب جديد.
                      </li>
                      <li>
                        أنشئ دفتراً جديداً واضغط على <strong>"Add Source" (إضافة مصدر) ➔ YouTube أو Text</strong> ثم قم بلصق الروابط فوراً.
                      </li>
                    </ol>
                  </div>
                </div>

                {/* Format Selector / Actions Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNotebookLMFormat('urls')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        notebookLMFormat === 'urls'
                          ? 'bg-purple-600 text-white shadow'
                          : 'bg-black/10 dark:bg-white/10 text-slate-300 hover:bg-black/20'
                      }`}
                    >
                      روابط خام (Raw Links)
                    </button>
                    <button
                      onClick={() => setNotebookLMFormat('markdown')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        notebookLMFormat === 'markdown'
                          ? 'bg-purple-600 text-white shadow'
                          : 'bg-black/10 dark:bg-white/10 text-slate-300 hover:bg-black/20'
                      }`}
                    >
                      مستند منظم (Markdown)
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleCopyNotebookLMText(notebookLMFormat)}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-1.5 shadow"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ النص للحافظة ({notebookLMItems.length})</span>
                    </button>

                    <button
                      onClick={handleDownloadNotebookLMMd}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                        isLight ? 'border-[#205100] text-[#205100]' : 'border-sky-400 text-sky-300'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تنزيل ملف .md</span>
                    </button>
                  </div>
                </div>

                {/* Sources Preview Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold opacity-80">
                    <span>معاينة مصادر الدفتر المجهزة ({notebookLMItems.length} فيديو):</span>
                    <span className="font-mono text-[11px] opacity-60">تنسيق: {notebookLMFormat.toUpperCase()}</span>
                  </div>

                  <div className="bg-black/30 rounded-xl p-4 max-h-52 overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-200 border border-black/10 dark:border-white/10">
                    {notebookLMFormat === 'urls' ? (
                      notebookLMItems.map((v, i) => (
                        <div key={v.id || i} className="truncate flex items-center gap-2">
                          <span className="text-purple-400 w-8 flex-shrink-0">#{i + 1}</span>
                          <span className="truncate">{v.url}</span>
                          <span className="opacity-50 text-[10px]">({v.title})</span>
                        </div>
                      ))
                    ) : (
                      notebookLMItems.map((v, i) => (
                        <div key={v.id || i} className="truncate">
                          {i + 1}. [{v.title}]({v.url}) - {v.channelTitle || 'YouTube'}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Direct Platform Links */}
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-purple-200">
                    <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>جاهز لإنشاء الدفتر الآن؟ يمكنك الذهاب مباشرة إلى منصة NotebookLM:</span>
                  </div>

                  <a
                    href="https://notebooklm.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-lg flex items-center gap-2 border border-purple-400/40 hover:scale-105"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>فتح Google NotebookLM</span>
                  </a>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5">
                <p className="text-xs font-mono opacity-80">
                  الدفتر جاهز ومحدود بـ {notebookLMItems.length} مصدر (الحد الأقصى الموصى به 299)
                </p>

                <button
                  onClick={() => setShowNotebookLMModal(false)}
                  className={`px-6 py-2 rounded-lg text-xs font-bold ${
                    isLight ? 'bg-[#205100] text-white' : 'bg-sky-500 text-slate-950'
                  }`}
                >
                  {t(lang, 'close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Alert Notification */}
        {toastMessage && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl border border-sky-500/40 flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
