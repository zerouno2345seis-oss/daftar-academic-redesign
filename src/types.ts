export type ThemeMode = 'glacier-dark' | 'editorial-light';
export type Language = 'ar' | 'en';

export type ColorTag = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'none';

export interface SearchResultItem {
  id: string;
  title: string;
  duration: string;
  url: string;
  thumbnail: string;
  thumbnailAlt: string;
  selected: boolean;
  channelTitle?: string;
  channelUrl?: string;
  views?: string;
  publishedAt?: string;
  description?: string;
  colorTag?: ColorTag;
  isFavorite?: boolean;
  folderId?: string;
}

export interface FavoriteFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChannelItem {
  id: string;
  name: string;
  url: string;
  avatar: string;
  subscribers?: string;
  videoCount?: string;
  description?: string;
  colorTag?: ColorTag;
  isFavorite?: boolean;
}

export interface PlaylistItem {
  id: string;
  title: string;
  videoCount?: string;
  url: string;
  thumbnail: string;
  channelTitle?: string;
  isFavorite?: boolean;
}

export type FavoriteItemType = 'video' | 'channel' | 'playlist';

export interface TrashedFavorite {
  id: string;
  type: FavoriteItemType;
  item: SearchResultItem | ChannelItem | PlaylistItem;
  deletedAt: string;
  expiresAt: string;
}

export interface CollectionFolder {
  id: string;
  name: string;
  createdAt: string;
  items: SearchResultItem[];
}
