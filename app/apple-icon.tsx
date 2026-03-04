import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #080c17 0%, #0d1424 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
        }}
      >
        <span
          style={{
            color: '#06b6d4',
            fontSize: 110,
            fontWeight: 800,
            fontFamily: 'sans-serif',
            lineHeight: 1,
          }}
        >
          L
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
