import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DatingRoute - 데이트 코스 플래너',
  description:
    '나만의 데이트 코스를 계획하고 경로를 확인하세요. 장소 검색, 코스 생성, 경로 안내, YouTube/블로그 후기까지 한 곳에서.',
  keywords: ['데이트', '코스', '플래너', '맛집', '카페', '서울', '데이트코스'],
};

import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
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
