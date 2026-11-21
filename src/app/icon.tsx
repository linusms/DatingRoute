import { ImageResponse } from 'next/og';
import { AppIconArt } from './appIcon';

export function generateImageMetadata() {
  return [
    { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const px = Number(await id) || 192;
  return new ImageResponse(<AppIconArt size={px} />, { width: px, height: px });
}
