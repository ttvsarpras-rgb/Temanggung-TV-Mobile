export type StreamQuality = 'auto' | '1080p' | '720p' | '480p';

export type FavoriteItemType = 'channel' | 'program' | 'moment';

export interface BroadcastChannel {
  id: string;
  name: string;
  tagline: string;
  srtUrl: string;
  category: string;
  posterUrl: string;
}

export interface ProgramItem {
  id: string;
  title: string;
  category: string;
  startTime: string; // HH:mm in WIB
  endTime: string;   // HH:mm in WIB
  description: string;
  host: string;
  thumbnailUrl: string;
  streamUrl: string;
}

export interface FavoriteBroadcast {
  id: string;
  userId: string;
  itemId: string;
  itemType: FavoriteItemType;
  title: string;
  category: string;
  scheduleTime: string;
  streamUrl: string;
  note?: string;
  reminderEnabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PlaybackPreference {
  preferredQuality: StreamQuality;
  dataSaver: boolean;
  autoPlay: boolean;
}

export interface StreamTelemetry {
  state: 'idle' | 'connecting' | 'live' | 'buffering' | 'error';
  activeQualityLabel: string;
  bitrateKbps: number | null;
  bufferSec: number;
  errorMessage: string | null;
}
