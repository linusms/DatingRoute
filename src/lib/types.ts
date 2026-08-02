export interface Place {
  id: string;
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  mapx: number;
  mapy: number;
  link: string;
  description: string;
}

export interface CoursePlace extends Place {
  order: number;
  memo: string;
}

export interface DirectionLeg {
  index: number;
  distance: number; // meters
  duration: number; // milliseconds
  name: string;
}

export interface DirectionResult {
  totalDistance: number;
  totalDuration: number;
  legs: DirectionLeg[];
  fullPath: Array<[number, number]>;
}

export type TransitMode = 'driving' | 'walking';

export interface RouteOption {
  mode: TransitMode;
  result: DirectionResult;
}

declare global {
  interface Window {
    Kakao: any;
  }
}

export interface Course {
  id: string;
  name: string;
  description: string;
  places: CoursePlace[];
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
}

export interface BlogPost {
  title: string;
  description: string;
  link: string;
  bloggername: string;
  postdate: string;
}

export interface ReviewData {
  videos: YouTubeVideo[];
  blogs: BlogPost[];
}

export type PlaceCategory =
  | 'all'
  | 'cafe'
  | 'restaurant'
  | 'movie'
  | 'walk'
  | 'shopping'
  | 'bar'
  | 'activity';

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  all: '전체',
  cafe: '카페',
  restaurant: '레스토랑',
  movie: '영화관',
  walk: '산책',
  shopping: '쇼핑',
  bar: '바/펍',
  activity: '액티비티',
};

export const CATEGORY_ICONS: Record<PlaceCategory, string> = {
  all: '🔍',
  cafe: '☕',
  restaurant: '🍽️',
  movie: '🎬',
  walk: '🌳',
  shopping: '🛍️',
  bar: '🍷',
  activity: '🎯',
};

/* ---- Date Schedule ---- */
export interface DateSchedule {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

/* ---- Festival/Event from TourAPI ---- */
export interface FestivalEvent {
  contentId: string;
  title: string;
  address: string;
  imageUrl: string;
  startDate: string; // YYYYMMDD
  endDate: string;   // YYYYMMDD
  tel: string;
  mapx: number;
  mapy: number;
  category: string;
}

/* ---- Trend Place from Gemini ---- */
export interface TrendPlace {
  title: string;
  reason: string;
  category: string;
  address: string;
  roadAddress: string;
  mapx: number;
  mapy: number;
  link: string;
}

/* ---- Facility Type Badge ---- */
export type FacilityType =
  | 'restaurant'
  | 'cafe'
  | 'culture'
  | 'park'
  | 'shopping'
  | 'bar'
  | 'entertainment'
  | 'accommodation'
  | 'other';

export const FACILITY_ICONS: Record<FacilityType, string> = {
  restaurant: '🍽️',
  cafe: '☕',
  culture: '🏛️',
  park: '🌳',
  shopping: '🛍️',
  bar: '🍷',
  entertainment: '🎯',
  accommodation: '🏨',
  other: '📍',
};

export const FACILITY_LABELS: Record<FacilityType, string> = {
  restaurant: '음식점',
  cafe: '카페',
  culture: '문화시설',
  park: '공원',
  shopping: '쇼핑',
  bar: '바/펍',
  entertainment: '엔터',
  accommodation: '숙박',
  other: '기타',
};

/* ---- Review types (existing, used by ReviewPanel) ---- */
export interface ReviewItem {
  title: string;
  description: string;
  link: string;
  bloggername: string;
  postdate: string;
}

export interface YoutubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
}

/* ---- AI Recommend Tab types ---- */
export interface RecommendedPlace {
  name: string;
  reason: string;
  keywords: string[];
  category: string;
  address: string;
  roadAddress: string;
  mapx: number;
  mapy: number;
  link: string;
}

export interface RegionEvent {
  contentId: string;
  title: string;
  address: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  tel: string;
  mapx: number;
  mapy: number;
  category: string;
}

export interface AIRecommendResult {
  recommendations: RecommendedPlace[];
  events: RegionEvent[];
  summary: string;
}

/* ---- Session / Collaboration ---- */
export type SessionMode = 'dev' | 'personal' | 'invite';

export interface Session {
  id: string;
  inviteCode: string;
  ownerName: string;
  createdAt: string;
  expiresAt: string;
  isPersonal: boolean;
  members: SessionMember[];
}

export interface SessionMember {
  id: string;
  sessionId: string;
  nickname: string;
  joinedAt: string;
  isOwner: boolean;
  isOnline?: boolean;
}

export type SSEEventType =
  | 'place_added'
  | 'place_removed'
  | 'places_reordered'
  | 'course_saved'
  | 'course_deleted'
  | 'member_joined'
  | 'connected';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
  sender: string; // nickname of whoever triggered
}
