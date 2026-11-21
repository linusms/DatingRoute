import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSharedCourse } from '@/lib/db';
import { computeDayTimeline, dateOfDay, formatClock, WEEKDAYS_KO } from '@/lib/timeline';
import { kakaoRouteUrl, naverSearchUrl } from '@/lib/links';
import { FACILITY_ICONS, type CoursePlace } from '@/lib/types';
import { parseCategoryToFacility, stripHtml } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ shareId: string }> };

function placeSummary(places: CoursePlace[]): string {
  const dayPlaces = places.filter((p) => (p.day ?? 0) > 0);
  const list = (dayPlaces.length > 0 ? dayPlaces : places).map((p) => stripHtml(p.title));
  return list.slice(0, 6).join(' → ') + (list.length > 6 ? ` 외 ${list.length - 6}곳` : '');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareId } = await params;
  const course = await getSharedCourse(shareId);
  if (!course) return { title: '코스를 찾을 수 없어요 - DatingRoute' };
  const description = course.description || placeSummary(course.places) || 'DatingRoute로 만든 데이트 코스';
  return {
    title: `${course.name} - DatingRoute`,
    description,
    openGraph: { title: course.name, description, type: 'website', siteName: 'DatingRoute' },
    robots: { index: false, follow: false },
  };
}

function formatDayLabel(iso: string | null, day: number): string {
  if (!iso) return `Day ${day}`;
  const d = new Date(`${iso}T00:00:00`);
  return `Day ${day} · ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS_KO[d.getDay()]})`;
}

/** Public, read-only view of a course (no memos, reactions or photos). */
export default async function SharedCoursePage({ params }: PageProps) {
  const { shareId } = await params;
  const course = await getSharedCourse(shareId);
  if (!course) notFound();

  const dayPlaces = course.places.filter((p) => (p.day ?? 0) > 0);
  const source = dayPlaces.length > 0 ? dayPlaces : course.places.map((p) => ({ ...p, day: 1 }));
  const days = new Map<number, CoursePlace[]>();
  for (const p of source) {
    const d = p.day ?? 1;
    (days.get(d) ?? days.set(d, []).get(d)!).push(p);
  }
  const dayNumbers = Array.from(days.keys()).sort((a, b) => a - b);

  return (
    <main className="share-page">
      <div className="share-page-inner">
        <header className="share-page-header">
          <Link href="/" className="share-page-brand">💕 DatingRoute</Link>
          <h1>{course.name}</h1>
          {course.description && <p className="share-page-desc">{course.description}</p>}
          {course.schedule?.startDate && (
            <p className="share-page-meta">
              📅 {course.schedule.startDate}
              {course.schedule.endDate && course.schedule.endDate !== course.schedule.startDate ? ` ~ ${course.schedule.endDate}` : ''}
              {' · '}{course.schedule.startTime}~{course.schedule.endTime}
            </p>
          )}
        </header>

        {dayNumbers.map((day) => {
          const list = days.get(day)!;
          const timeline = computeDayTimeline(list, course.schedule, 'driving');
          return (
            <section key={day} className="share-page-day">
              {(dayNumbers.length > 1 || course.schedule) && (
                <h2 className="share-page-day-title">{formatDayLabel(dateOfDay(course.schedule, day), day)}</h2>
              )}
              <ol className="share-page-list">
                {list.map((place, i) => {
                  const t = timeline.get(place.id);
                  const next = list[i + 1];
                  return (
                    <li key={place.id}>
                      <div className="share-page-place">
                        <span className="share-page-num">{i + 1}</span>
                        <div className="share-page-place-body">
                          <div className="share-page-place-head">
                            <a href={naverSearchUrl(place.title)} target="_blank" rel="noreferrer" className="share-page-place-name">
                              {FACILITY_ICONS[parseCategoryToFacility(place.category)]} {stripHtml(place.title)}
                            </a>
                            {t && <span className="share-page-time">{formatClock(t.arrival)}–{formatClock(t.departure)}</span>}
                          </div>
                          <div className="share-page-addr">{place.roadAddress || place.address}</div>
                          {place.category && <div className="share-page-cat">{place.category}</div>}
                        </div>
                      </div>
                      {next && (
                        <div className="share-page-leg">
                          <span>↓ {t?.travelNext ? `약 ${t.travelNext}분` : '이동'}</span>
                          <a href={kakaoRouteUrl(place, next, 'traffic')} target="_blank" rel="noreferrer">대중교통 길찾기</a>
                          <a href={kakaoRouteUrl(place, next, 'car')} target="_blank" rel="noreferrer">자동차</a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        <div className="share-page-cta">
          <Link className="btn btn-primary" href={`/?copy=${encodeURIComponent(course.shareId)}`}>이 코스로 시작하기</Link>
          <p>내 코스로 복사해서 날짜와 장소를 바꿔볼 수 있어요.</p>
        </div>
      </div>
    </main>
  );
}
