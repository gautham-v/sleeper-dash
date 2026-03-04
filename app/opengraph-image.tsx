import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'leaguemate.fyi — Fantasy football analytics for your Sleeper leagues';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #080c17 0%, #0d1424 60%, #091220 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 5,
            background: 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
          }}
        />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <span style={{ color: '#ffffff', fontSize: 64, fontWeight: 800, letterSpacing: '-3px' }}>
            leaguemate
          </span>
          <span style={{ color: '#06b6d4', fontSize: 64, fontWeight: 800, letterSpacing: '-3px' }}>
            .fyi
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            color: '#94a3b8',
            fontSize: 26,
            textAlign: 'center',
            maxWidth: 680,
            lineHeight: 1.4,
          }}
        >
          Fantasy football analytics for your Sleeper leagues
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 14, marginTop: 52 }}>
          {['WAR Analytics', 'Trade Intelligence', 'Franchise Outlook', 'Draft Grades'].map(
            (label) => (
              <div
                key={label}
                style={{
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 8,
                  padding: '8px 20px',
                  color: '#06b6d4',
                  fontSize: 17,
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
