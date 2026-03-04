import { ImageResponse } from 'next/og';
import { sleeperApi } from '@/api/sleeper';

export const runtime = 'edge';
export const alt = 'League Analytics on leaguemate.fyi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  let leagueName = 'Fantasy Football League';
  let season = '2025';

  try {
    const league = await sleeperApi.getLeague(leagueId);
    leagueName = league.name;
    season = league.season;
  } catch {
    // use fallback values
  }

  const nameFontSize = leagueName.length > 35 ? 52 : leagueName.length > 22 ? 64 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #080c17 0%, #0d1424 60%, #091220 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 80px',
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

        {/* Season badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 36,
          }}
        >
          <div
            style={{
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              borderRadius: 6,
              padding: '6px 18px',
              color: '#06b6d4',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}
          >
            {season} Season
          </div>
        </div>

        {/* League name */}
        <div
          style={{
            fontSize: nameFontSize,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            maxWidth: 1000,
            letterSpacing: '-2px',
            flex: 1,
          }}
        >
          {leagueName}
        </div>

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 22 }}>Fantasy Football Analytics</div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ color: '#ffffff', fontSize: 28, fontWeight: 700 }}>leaguemate</span>
            <span style={{ color: '#06b6d4', fontSize: 28, fontWeight: 700 }}>.fyi</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
