import { ImageResponse } from 'next/og';
import { getSharedCourse } from '@/lib/db';
import { stripHtml } from '@/lib/utils';

export const alt = 'DatingRoute 데이트 코스';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300;

/**
 * Loads a Noto Sans KR subset containing only the glyphs we draw.
 * Google Fonts serves TTF to clients that don't advertise woff2 support.
 */
async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(4000) })).text();
    const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!match) return null;
    const res = await fetch(match[1], { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const course = await getSharedCourse(shareId);
  const name = course?.name || 'DatingRoute 데이트 코스';
  const dayPlaces = course ? course.places.filter((p) => (p.day ?? 0) > 0) : [];
  const titles = (dayPlaces.length > 0 ? dayPlaces : course?.places ?? []).map((p) => stripHtml(p.title)).slice(0, 5);
  const dateText = course?.schedule?.startDate ? course.schedule.startDate.replace(/-/g, '.') : '';

  const allText = `DatingRoute${name}${titles.join('')}${dateText}외곳코스데이트`;
  const font = await loadKoreanFont(allText);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#FCFCFC',
          padding: '64px 72px',
          fontFamily: font ? 'NotoSansKR' : 'sans-serif',
          color: '#1F2220',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, color: '#D96C5C', fontWeight: 700 }}>
          DatingRoute
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.15, marginBottom: 28, display: 'flex' }}>
            {name.length > 22 ? `${name.slice(0, 22)}…` : name}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', fontSize: 32, color: '#6B7270' }}>
            {titles.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'flex',
                    background: '#F5F5F5',
                    border: '2px solid #EAEAEA',
                    borderRadius: 999,
                    padding: '8px 22px',
                    marginBottom: 12,
                  }}
                >
                  {t.length > 12 ? `${t.slice(0, 12)}…` : t}
                </span>
                {i < titles.length - 1 && <span style={{ margin: '0 12px 12px', color: '#D96C5C', display: 'flex' }}>→</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, color: '#9AA09D' }}>
          <span style={{ display: 'flex' }}>{dateText}</span>
          <span style={{ display: 'flex' }}>
            {(dayPlaces.length || course?.places.length || 0) > 0 ? `${dayPlaces.length || course?.places.length}곳 코스` : ''}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'NotoSansKR', data: font, weight: 700, style: 'normal' }] : undefined,
    }
  );
}
