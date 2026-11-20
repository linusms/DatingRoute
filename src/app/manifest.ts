import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DatingRoute - 데이트 코스 플래너',
    short_name: 'DatingRoute',
    description: '함께 데이트 코스를 짜고, 당일엔 길찾기와 방문 체크까지.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FCFCFC',
    theme_color: '#D96C5C',
    lang: 'ko',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
