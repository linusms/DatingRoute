'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import SearchPanel from '@/components/SearchPanel';
import AIRecommendPanel from '@/components/AIRecommendPanel';
import CourseBuilder from '@/components/CourseBuilder';
import NaverMap from '@/components/NaverMap';
import ReviewPanel from '@/components/ReviewPanel';
import CourseManager from '@/components/CourseManager';
import {
  Place,
  CoursePlace,
  Course,
  DirectionResult,
  TransitMode
} from '@/lib/types';
import {
  saveCourse,
  generateCourseId,
  encodeCourseToUrl,
  decodeCourseFromUrl,
} from '@/lib/courseStorage';
import { katechToWgs84, getStraightLineDistance } from '@/lib/utils';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'search' | 'ai' | 'route'>('search');
  const [coursePlaces, setCoursePlaces] = useState<CoursePlace[]>([]);
  
  // Directions state
  const [directions, setDirections] = useState<DirectionResult | null>(null);
  const [routePath, setRoutePath] = useState<Array<[number, number]> | null>(null);
  
  // New features state
  const [isRouteCreated, setIsRouteCreated] = useState(false);
  const [transitMode, setTransitMode] = useState<TransitMode>('driving');

  const [highlightPlace, setHighlightPlace] = useState<Place | null>(null);
  const [reviewPlace, setReviewPlace] = useState<string | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Initialize Kakao SDK
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (key && key !== 'your_kakao_js_key') {
          window.Kakao.init(key);
        }
      }
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared');
    if (shared) {
      const decoded = decodeCourseFromUrl(shared);
      if (decoded) {
        setCoursePlaces(decoded.places);
        setActiveTab('route');
        showToast(`"${decoded.name}" 공유 코스를 불러왔습니다!`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [showToast]);

  const fetchDirections = useCallback(async (places: CoursePlace[]) => {
    if (places.length < 2) {
      setDirections(null);
      setRoutePath(null);
      return;
    }

    try {
      const coords = places.map((p) => {
        const { lng, lat } = katechToWgs84(p.mapx, p.mapy);
        return `${lng},${lat}`;
      });

      const start = coords[0];
      const goal = coords[coords.length - 1];
      const waypoints = coords.length > 2 ? coords.slice(1, -1).join('|') : undefined;

      let url = `/api/directions?start=${start}&goal=${goal}`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;

      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'API Error');
      }

      if (data.route?.traoptimal?.[0]) {
        const route = data.route.traoptimal[0];
        const summary = route.summary;
        const fullPath: Array<[number, number]> = route.path;

        // Parse section-level leg data for per-waypoint info
        const parsedLegs = data._parsedLegs || [];

        setDirections({
          totalDistance: summary.distance,
          totalDuration: summary.duration,
          legs: parsedLegs,
          fullPath,
        });
        setRoutePath(fullPath);
      }
    } catch {
      // Fallback: Calculate straight-line distance if API fails
      let totalDistMeters = 0;
      const fullPath: Array<[number, number]> = [];
      const coords = places.map((p) => {
        const { lng, lat } = katechToWgs84(p.mapx, p.mapy);
        fullPath.push([lng, lat]);
        return { lng, lat };
      });

      // Build fallback legs from straight-line distances
      const fallbackLegs = [];
      for (let i = 0; i < coords.length - 1; i++) {
        const dist = getStraightLineDistance(
          coords[i].lat,
          coords[i].lng,
          coords[i+1].lat,
          coords[i+1].lng
        );
        totalDistMeters += dist;
        fallbackLegs.push({
          index: i,
          distance: dist,
          duration: (dist / 40000) * 3600000, // ~40km/h estimate
          name: '',
        });
      }
      
      setDirections({
        totalDistance: totalDistMeters,
        totalDuration: (totalDistMeters / 40000) * 3600000,
        legs: fallbackLegs,
        fullPath,
      });
      setRoutePath(fullPath);
      showToast('NCP 길찾기 권한이 없어 예상 직선거리로 경로를 생성했습니다.');
    }
  }, [showToast]);

  const handleCreateRoute = useCallback(() => {
    if (coursePlaces.length < 2) {
      showToast('경로를 만들려면 장소가 2개 이상 필요합니다.');
      return;
    }
    fetchDirections(coursePlaces);
    setIsRouteCreated(true);
  }, [coursePlaces, fetchDirections, showToast]);

  const handleAddPlace = useCallback(
    (place: Place) => {
      const alreadyExists = coursePlaces.some(
        (p) => p.title === place.title
      );
      if (alreadyExists) {
        showToast('이미 코스에 추가된 장소입니다');
        return;
      }

      const coursePlace: CoursePlace = {
        ...place,
        id: place.id || Math.random().toString(36).substring(2, 9),
        order: coursePlaces.length,
        memo: '',
      };

      const updated = [...coursePlaces, coursePlace];
      setCoursePlaces(updated);
      setIsRouteCreated(false); // Reset route when adding
      showToast(`"${place.title.replace(/<[^>]+>/g, '')}" 추가됨`);
    },
    [coursePlaces, showToast]
  );

  const handleRemovePlace = useCallback(
    (id: string) => {
      const updated = coursePlaces
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, order: i }));
      setCoursePlaces(updated);
      setIsRouteCreated(false); // Reset route when removing
    },
    [coursePlaces]
  );

  const handleReorderPlaces = useCallback(
    (newPlaces: CoursePlace[]) => {
      setCoursePlaces(newPlaces);
      if (isRouteCreated) {
        setIsRouteCreated(false);
        setRoutePath(null);
        setDirections(null);
      }
    },
    [isRouteCreated]
  );

  const handleSaveCourse = useCallback(
    (name: string, description: string) => {
      const course: Course = {
        id: generateCourseId(),
        name,
        description,
        places: coursePlaces,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveCourse(course);
      showToast(`"${name}" 저장되었습니다!`);
    },
    [coursePlaces, showToast]
  );

  const handleLoadCourse = useCallback(
    (course: Course) => {
      setCoursePlaces(course.places);
      setActiveTab('route');
      const hasRoute = course.places.length >= 2;
      setIsRouteCreated(hasRoute);
      if (hasRoute) {
        fetchDirections(course.places);
      }
      showToast(`"${course.name}" 불러왔습니다`);
    },
    [showToast, fetchDirections]
  );

  const handleShareCourseUrl = useCallback(() => {
    if (coursePlaces.length === 0) return;
    const course: Course = {
      id: '', name: '공유 코스', description: '', places: coursePlaces, createdAt: '', updatedAt: '',
    };
    const url = encodeCourseToUrl(course);
    navigator.clipboard.writeText(url).then(() => {
      showToast('공유 링크가 클립보드에 복사되었습니다!');
    });
  }, [coursePlaces, showToast]);

  const handleShareKakao = useCallback(() => {
    if (coursePlaces.length === 0) return;
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      showToast('카카오톡 공유가 설정되지 않았습니다. API 키를 확인해주세요.');
      return;
    }
    
    const course: Course = {
      id: '', name: '우리의 데이트 코스 💖', description: '제가 짠 데이트 코스 어때요?', places: coursePlaces, createdAt: '', updatedAt: '',
    };
    const url = encodeCourseToUrl(course);

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: 'DatingRoute - 데이트 코스 제안',
        description: coursePlaces.map(p => p.title.replace(/<[^>]+>/g, '')).join(' ➔ '),
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3238/3238002.png',
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      },
      buttons: [
        {
          title: '코스 확인하기',
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
  }, [coursePlaces, showToast]);

  return (
    <div className="app-layout">
      <Header
        onOpenManager={() => setShowManager(true)}
        courseCount={coursePlaces.length}
      />

      <div className="app-main">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 장소검색
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              ✨ AI 추천
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'route' ? 'active' : ''}`}
              onClick={() => setActiveTab('route')}
            >
              🗺️ 경로 생성
              {coursePlaces.length > 0 && (
                <span className="sidebar-tab-badge">{coursePlaces.length}</span>
              )}
            </button>
          </div>

          <div className="sidebar-content">
            <div style={{ display: activeTab === 'search' ? 'block' : 'none', height: '100%' }}>
              <SearchPanel
                onAddPlace={handleAddPlace}
                onShowReview={(name) => setReviewPlace(name)}
                onHighlightPlace={setHighlightPlace}
              />
            </div>
            <div style={{ display: activeTab === 'ai' ? 'block' : 'none', height: '100%' }}>
              <AIRecommendPanel
                coursePlaces={coursePlaces}
                onAddPlace={handleAddPlace}
                onHighlightPlace={setHighlightPlace}
              />
            </div>
            <div style={{ display: activeTab === 'route' ? 'block' : 'none', height: '100%' }}>
              <CourseBuilder
                places={coursePlaces}
                directions={directions}
                onRemovePlace={handleRemovePlace}
                onReorderPlaces={handleReorderPlaces}
                onShowReview={(name) => setReviewPlace(name)}
                onHighlightPlace={setHighlightPlace}
                onCreateRoute={handleCreateRoute}
                isRouteCreated={isRouteCreated}
                transitMode={transitMode}
                onChangeTransitMode={setTransitMode}
                onShareCourseUrl={handleShareCourseUrl}
                onShareKakao={handleShareKakao}
              />
            </div>
          </div>
        </aside>

        <NaverMap
          coursePlaces={coursePlaces}
          highlightPlace={highlightPlace}
          routePath={isRouteCreated && transitMode === 'driving' ? routePath : null}
          transitMode={transitMode}
        />

        {reviewPlace && (
          <ReviewPanel
            placeName={reviewPlace}
            onClose={() => setReviewPlace(null)}
          />
        )}
      </div>

      {showManager && (
        <CourseManager
          onClose={() => setShowManager(false)}
          onLoadCourse={handleLoadCourse}
          onSaveCourse={handleSaveCourse}
          hasPlaces={coursePlaces.length > 0}
        />
      )}

      {toast && (
        <div className="toast toast-success">
          <span>✅</span> {toast}
        </div>
      )}
    </div>
  );
}
