import { ImageResponse } from 'next/og';
import { sleeperApi } from '@/api/sleeper';

export const alt = 'League Analytics on leaguemate.fyi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  let leagueName = 'Fantasy Football League';
  let season = '2025';

  try {
    const league = await sleeperApi.getLeague(leagueId);
    if (league) {
      leagueName = league.name;
      season = league.season;
    }
  } catch {
    // use fallback values
  }

  const nameFontSize = leagueName.length > 35 ? 64 : leagueName.length > 22 ? 80 : 96;

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
          overflow: 'hidden',
        }}
      >
        {/* Purple glow */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, #7c3aed 0%, #4c1d95 40%, transparent 70%)',
            opacity: 0.5,
          }}
        />

        {/* Season badge */}
        <div
          style={{
            display: 'flex',
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 6,
            padding: '6px 18px',
            color: '#a1a1aa',
            fontSize: 18,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 28,
          }}
        >
          {season} Season
        </div>

        {/* League name */}
        <div
          style={{
            fontSize: nameFontSize,
            fontWeight: 800,
            color: '#fafafa',
            lineHeight: 1.1,
            textAlign: 'center',
            maxWidth: 1000,
            letterSpacing: '-2px',
            marginBottom: 28,
          }}
        >
          {leagueName}
        </div>

        {/* Tagline */}
        <div style={{ color: '#a1a1aa', fontSize: 22, marginBottom: 0 }}>
          Talk trash. Back it up.
        </div>

        {/* Brand */}
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            display: 'flex',
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: '#fafafa', fontSize: 28, fontWeight: 700 }}>leaguemate</span>
          <span style={{ color: '#a1a1aa', fontSize: 28, fontWeight: 700 }}>.fyi</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
