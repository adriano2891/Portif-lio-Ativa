export interface VideoSettings {
  id: string;
  video_original_url: string;
  video_file_id: string;
  video_preview_url: string;
  title: string;
  subtitle: string;
  description: string;
  cover_image: string;
  is_active: boolean;
  page_name: string;
  logo_url: string;
  text_above: string;
  text_below: string;
  og_title: string;
  og_description: string;
  og_image: string;
  aspect_ratio?: 'auto' | '9:16' | '16:9' | '1:1';
  created_at: string;
  updated_at: string;
}

export type EventType = 'page_view' | 'video_play';

export interface VideoAnalytics {
  id: string;
  event_type: EventType;
  session_id: string;
  created_at: string;
}

export interface AnalyticsSummary {
  page_views: number;
  video_plays: number;
  last_access: string | null;
  recent_events: VideoAnalytics[];
}

export interface GoogleDriveParseResult {
  isValid: boolean;
  fileId: string | null;
  previewUrl: string | null;
  errorMessage?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  token?: string;
  username?: string;
}
