'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { CoursePlace, Place, TransitMode } from '@/lib/types';
import { katechToWgs84 } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver: any;
  }
}

interface NaverMapProps {
  coursePlaces: CoursePlace[];
  highlightPlace: Place | null;
  routePath: Array<[number, number]> | null;
  transitMode: TransitMode;
}

export default function NaverMap({
  coursePlaces,
  highlightPlace,
  routePath,
  transitMode,
}: NaverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const highlightMarkerRef = useRef<any>(null);

  const clientId = process.env.NEXT_PUBLIC_NCP_CLIENT_ID;

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  const clearPolyline = useCallback(() => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  }, []);

  const clearHighlight = useCallback(() => {
    if (highlightMarkerRef.current) {
      highlightMarkerRef.current.setMap(null);
      highlightMarkerRef.current = null;
    }
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.naver) return;
    if (mapObjRef.current) return;

    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(37.5665, 126.978),
      zoom: 13,
      mapTypeControl: false,
      scaleControl: false,
      logoControl: true,
      mapDataControl: false,
      zoomControl: true,
      zoomControlOptions: {
        position: window.naver.maps.Position.RIGHT_CENTER,
        style: window.naver.maps.ZoomControlStyle.SMALL,
      },
    });

    mapObjRef.current = map;
  }, []);

  // Update course markers + polyline
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.naver) return;

    clearMarkers();
    clearPolyline();

    if (coursePlaces.length === 0) return;

    const bounds = new window.naver.maps.LatLngBounds();

    coursePlaces.forEach((place, idx) => {
      const { lng, lat } = katechToWgs84(place.mapx, place.mapy);
      const pos = new window.naver.maps.LatLng(lat, lng);
      bounds.extend(pos);

      const marker = new window.naver.maps.Marker({
        map,
        position: pos,
        icon: {
          content: `
            <div style="
              width:32px;height:32px;
              display:flex;align-items:center;justify-content:center;
              border-radius:50%;
              background:linear-gradient(135deg,#f472b6,#c084fc);
              color:white;font-weight:700;font-size:13px;
              box-shadow:0 2px 8px rgba(244,114,182,0.5);
              border:2px solid white;
            ">${idx + 1}</div>
          `,
          size: new window.naver.maps.Size(32, 32),
          anchor: new window.naver.maps.Point(16, 16),
        },
        zIndex: 100 + idx,
      });

      const iw = new window.naver.maps.InfoWindow({
        content: `
          <div style="
            padding:10px 14px;
            font-family:Pretendard,sans-serif;
            font-size:13px;
            background:#1a1520;
            color:#f5f0ff;
            border:1px solid rgba(244,114,182,0.3);
            border-radius:10px;
            box-shadow:0 4px 16px rgba(0,0,0,0.5);
            max-width:220px;
          ">
            <div style="font-weight:600;margin-bottom:4px;">${place.title}</div>
            <div style="font-size:11px;color:#8b7fa8;">${place.roadAddress || place.address}</div>
          </div>
        `,
        borderWidth: 0,
        backgroundColor: 'transparent',
        disableAnchor: true,
        pixelOffset: new window.naver.maps.Point(0, -20),
      });

      window.naver.maps.Event.addListener(marker, 'click', () => {
        if (iw.getMap()) {
          iw.close();
        } else {
          iw.open(map, marker);
        }
      });

      markersRef.current.push(marker);
    });

    // Draw route polyline
    if (routePath && routePath.length > 1) {
      const path = routePath.map(
        ([lng, lat]: [number, number]) => new window.naver.maps.LatLng(lat, lng)
      );

      polylineRef.current = new window.naver.maps.Polyline({
        map,
        path,
        strokeColor: '#f472b6',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        strokeStyle: 'solid',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      });
    } else if (coursePlaces.length > 1) {
      const path = coursePlaces.map((place) => {
        const { lng, lat } = katechToWgs84(place.mapx, place.mapy);
        return new window.naver.maps.LatLng(lat, lng);
      });

      polylineRef.current = new window.naver.maps.Polyline({
        map,
        path,
        strokeColor: '#f472b6',
        strokeOpacity: 0.8,
        strokeWeight: 5,
        strokeStyle: 'dash',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      });
    }

    // Fit bounds
    if (coursePlaces.length === 1) {
      const { lng, lat } = katechToWgs84(coursePlaces[0].mapx, coursePlaces[0].mapy);
      map.setCenter(new window.naver.maps.LatLng(lat, lng));
      map.setZoom(15);
    } else {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [coursePlaces, routePath, transitMode, clearMarkers, clearPolyline]);

  // Highlight place on hover from search results
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.naver) return;

    clearHighlight();

    if (!highlightPlace) return;

    const { lng, lat } = katechToWgs84(highlightPlace.mapx, highlightPlace.mapy);
    const pos = new window.naver.maps.LatLng(lat, lng);

    highlightMarkerRef.current = new window.naver.maps.Marker({
      map,
      position: pos,
      icon: {
        content: `
          <div style="
            width:20px;height:20px;
            border-radius:50%;
            background:rgba(244,114,182,0.4);
            border:3px solid #f472b6;
            box-shadow:0 0 12px rgba(244,114,182,0.6);
            animation:pulse 1.5s infinite;
          "></div>
        `,
        size: new window.naver.maps.Size(20, 20),
        anchor: new window.naver.maps.Point(10, 10),
      },
      zIndex: 200,
    });

    map.panTo(pos);
  }, [highlightPlace, clearHighlight]);

  return (
    <div className="map-container">
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
        strategy="afterInteractive"
        onReady={initMap}
      />
      <div ref={mapRef} className="map-inner" />
    </div>
  );
}
