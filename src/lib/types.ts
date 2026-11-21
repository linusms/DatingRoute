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
  /** 0 = 보관함, 1..N = Day N */
  day?: number;
  isHold?: boolean;
  reactions?: Record<string, string>; // userId -> emoji
  addedBy?: string;
  /** 머무는 시간(분). 비어 있으면 시설 종류별 기본값을 씁니다. */
  stayMinutes?: number | null;
  /** 1인 기준이 아닌, 이 장소의 예상 총비용(원) */
  cost?: number | null;
  visitedAt?: string | null;
  rating?: number | null;
  review?: string;
  photoUrl?: string | null; // 서버가 발급한 서명 URL (읽기 전용)
}

/** PATCH로 바꿀 수 있는 장소 필드 */
export type PlaceUpdatableFields = Partial<Pick<CoursePlace, 'memo' | 'isHold' | 'stayMinutes' | 'cost' | 'visitedAt' | 'rating' | 'review'>>;

export interface DirectionLeg {
  index: number;
  distance: number; // meters
  duration: number; // milliseconds
  name: string;
  fromId?: string;
  toId?: string;
}

export interface DirectionResult {
  totalDistance: number;
  totalDuration: number;
  legs: DirectionLeg[];
  fullPath: Array<[number, number]>;
}

export type TransitMode = 'driving' | 'walking';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Kakao: any;
  }
}

export interface Course {
  id: string;
  name: string;           // internal name (저장된 경로) or '저장되지 않은 경로'
  displayName?: string;   // user-set label for live courses
  description: string;
  places: CoursePlace[];
  schedule?: DateSchedule;
  roomId?: string;
  isCollaborative?: boolean;
  isLive?: boolean;       // true = live (auto-saved) course, false = named snapshot
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
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

/** 시설 종류별 기본 체류 시간(분) */
export const DEFAULT_STAY_MINUTES: Record<FacilityType, number> = {
  restaurant: 90,
  cafe: 60,
  culture: 90,
  park: 60,
  shopping: 60,
  bar: 90,
  entertainment: 90,
  accommodation: 0,
  other: 60,
};

/* ---- Date Schedule ---- */
export interface DateSchedule {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

/* ---- Review types (ReviewPanel) ---- */
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
  category: string;
  reason: string;
  keywords: string[];
  sourceType: string;
  address?: string;
  roadAddress?: string;
  mapx?: number;
  mapy?: number;
  link?: string;
  mentionCount?: number;
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

/* ---- AI course draft ---- */
export interface AICourseItem {
  place: Place;
  stayMinutes: number;
  reason: string;
}

export interface AICourseDraft {
  title: string;
  summary: string;
  items: AICourseItem[];
}

/* ---- Opening hours (TourAPI) ---- */
export interface PlaceInfo {
  found: boolean;
  hours?: string;
  restDate?: string;
  source?: string;
}

/* ---- Users & Collaboration ---- */
export interface User {
  id: string;
  nickname: string;
  createdAt?: string;
  isGuest?: boolean;
}

export interface Room {
  id: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  expiresAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  joinedAt: string;
  isOwner: boolean;
  nickname?: string;
}

/** Memories view: one visited place with a rating, review or photo */
export interface Memory {
  roomId: string;
  courseName: string;
  placeId: string;
  title: string;
  address: string;
  day: number;
  visitedAt: string | null;
  rating: number | null;
  review: string;
  photoUrl: string | null;
}

/** Supabase Realtime Broadcast event name used on channel `session-<roomId>` */
export const ROOM_EVENT = 'room_event';

/** Types sent inside ROOM_EVENT broadcasts */
export type RoomEventType = 'places_changed' | 'course_updated' | 'member_joined';

export type PlacesChangeAction = 'added' | 'removed' | 'updated' | 'reordered' | 'reacted';

export interface PlacesChangedData {
  action: PlacesChangeAction;
  titles?: string[];
  count?: number;
}

export interface CourseUpdatedData {
  displayName?: string;
  description?: string;
  schedule?: DateSchedule | null;
}
