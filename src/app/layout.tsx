import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'DatingRoute - 데이트 코스 플래너',
  description:
    '나만의 데이트 코스를 계획하고 경로를 확인하세요. 장소 검색, 코스 생성, 경로 안내, YouTube/블로그 후기까지 한 곳에서.',
  keywords: ['데이트', '코스', '플래너', '맛집', '카페', '서울', '데이트코스'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Preconnect & DNS-prefetch for external map, font, and SDK CDNs to eliminate initial render blocking */}
        <link rel="preconnect" href="https://oapi.map.naver.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://oapi.map.naver.com" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://t1.kakaocdn.net" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
