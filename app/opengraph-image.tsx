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
          background: '#09090b',
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
        {/* Subtle border at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: '#27272a',
          }}
        />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <span style={{ color: '#fafafa', fontSize: 64, fontWeight: 800, letterSpacing: '-3px' }}>
            leaguemate
          </span>
          <span style={{ color: '#a1a1aa', fontSize: 64, fontWeight: 800, letterSpacing: '-3px' }}>
            .fyi
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            color: '#a1a1aa',
            fontSize: 26,
            textAlign: 'center',
            maxWidth: 680,
            lineHeight: 1.4,
          }}
        >
          Fantasy football analytics for your Sleeper leagues
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 12, marginTop: 52 }}>
          {['WAR Analytics', 'Trade Intelligence', 'Franchise Outlook', 'Draft Grades'].map(
            (label) => (
              <div
                key={label}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: 8,
                  padding: '8px 20px',
                  color: '#a1a1aa',
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
