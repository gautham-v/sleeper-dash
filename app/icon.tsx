import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#0d1424',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          border: '2px solid #06b6d4',
        }}
      >
        <span
          style={{
            color: '#06b6d4',
            fontSize: 19,
            fontWeight: 800,
            fontFamily: 'sans-serif',
            lineHeight: 1,
          }}
        >
          L
        </span>
      </div>
    ),
    { width: 32, height: 32 }
  );
}
