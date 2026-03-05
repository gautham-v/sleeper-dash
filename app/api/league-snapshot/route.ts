import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { leagueId: string; season: number; teamStates: unknown };
    const { leagueId, season, teamStates } = body;

    if (!leagueId || !season || !teamStates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('league_snapshots') as any)
      .upsert(
        {
          league_id: leagueId,
          season,
          team_states_json: teamStates,
        },
        { onConflict: 'league_id,snapshot_date' },
      )
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
