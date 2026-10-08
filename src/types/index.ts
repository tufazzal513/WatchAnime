export type ContentType = 'movie' | 'anime' | 'series';
export type ContentStatus = 'published' | 'draft' | 'upcoming';
export type SubDubType = 'Sub' | 'Dub' | 'Dual Audio';

export interface VideoServer {
  id: string;
  serverName: string;
  embedUrl: string;
  quality?: string; // 1080p, 720p, 4K
  subDub?: SubDubType;
  language?: string;
  priority?: number;
  isDefault?: boolean;
}

export interface Episode {
  id: string;
  contentId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: string;
  videoServers: VideoServer[];
  releaseDate?: string;
  createdAt?: string;
}

export interface ContentItem {
  id: string;
  title: string;
  originalTitle?: string;
  slug: string;
  type: ContentType;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  releaseYear: number;
  genres: string[];
  rating: number; // e.g. 8.7
  voteCount?: number;
  runtime?: string; // e.g. "24m" or "2h 15m"
  country?: string;
  audioLanguage?: string;
  subtitles?: string[];
  status: ContentStatus;
  featured?: boolean;
  trending?: boolean;
  totalSeasons?: number;
  totalEpisodes?: number;
  cast?: string[];
  director?: string;
  videoServers?: VideoServer[]; // For standalone movies
  createdAt?: string;
  updatedAt?: string;
}

export interface WatchlistItem {
  contentId: string;
  title: string;
  posterUrl: string;
  type: ContentType;
  rating?: number;
  addedAt: string;
}

export interface WatchHistoryItem {
  contentId: string;
  episodeId?: string;
  title: string;
  posterUrl: string;
  type?: ContentType;
  episodeNumber?: number;
  seasonNumber?: number;
  progressSeconds?: number;
  durationSeconds?: number;
  lastWatchedAt: string;
}

export interface ContentRequest {
  id: string;
  userId: string;
  userEmail?: string;
  title: string;
  type: ContentType;
  releaseYear?: number;
  description?: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
}

export interface VideoReport {
  id: string;
  contentId: string;
  contentTitle: string;
  episodeNumber?: number;
  serverName?: string;
  reason: string;
  reportedBy?: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
}

export interface SiteSettings {
  siteName: string;
  logoUrl?: string;
  announcement?: string;
  defaultLanguage: 'en' | 'bn';
  adsEnabled: boolean;
  bannerAdTop?: string;
  bannerAdBottom?: string;
  allowedEmbedHosts: string[];
  // Social links
  telegramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  discordUrl?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'release' | 'system';
  linkUrl?: string;
  targetContentId?: string;
  createdAt: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt?: string;
  lastActive?: string;
  status: 'active' | 'banned';
  role?: 'admin' | 'user';
}

export interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  contentId?: string;
  badge?: string;
  active: boolean;
  order?: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
}
