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

  const nameFontSize = leagueName.length > 35 ? 52 : leagueName.length > 22 ? 64 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090b',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 56,
          paddingBottom: 56,
          paddingLeft: 80,
          paddingRight: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', marginBottom: 36 }}>
          <div
            style={{
              background: '#18181b',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#27272a',
              borderRadius: 6,
              paddingTop: 6,
              paddingBottom: 6,
              paddingLeft: 18,
              paddingRight: 18,
              color: '#a1a1aa',
              fontSize: 18,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {season + ' Season'}
          </div>
        </div>

        <div
          style={{
            fontSize: nameFontSize,
            fontWeight: 800,
            color: '#fafafa',
            lineHeight: 1.1,
            maxWidth: 1000,
            flexGrow: 1,
          }}
        >
          {leagueName}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ color: '#52525b', fontSize: 22 }}>Fantasy Football Analytics</div>
          <div style={{ display: 'flex' }}>
            <div style={{ color: '#fafafa', fontSize: 28, fontWeight: 700 }}>leaguemate</div>
            <div style={{ color: '#a1a1aa', fontSize: 28, fontWeight: 700 }}>.fyi</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
