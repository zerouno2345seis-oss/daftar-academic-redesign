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
  colorTag?: ColorTag;
  isFavorite?: boolean;
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

export interface CollectionFolder {
  id: string;
  name: string;
  createdAt: string;
  items: SearchResultItem[];
}
