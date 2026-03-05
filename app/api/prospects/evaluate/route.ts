import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { evaluateProspect } from '@/utils/prospectEvaluator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string;
      position: string;
      draftRound?: number;
      draftPick?: number;
      persist?: boolean;
      draftYear?: number;
    };

    const { name, position, draftRound, draftPick, persist, draftYear } = body;

    if (!name || !position) {
      return NextResponse.json({ error: 'Missing required fields: name, position' }, { status: 400 });
    }

    if (persist && !draftYear) {
      return NextResponse.json({ error: 'draftYear is required when persist is true' }, { status: 400 });
    }

    // 1. Fetch all historical rookies for this position (paginated past 1000-row limit)
    const historicalPool = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    while (true) {
      const { data, error: fetchError } = await supabase
        .from('historical_rookies')
        .select('*')
        .eq('position', position)
        .range(offset, offset + PAGE_SIZE - 1);
      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
      if (!data || data.length === 0) break;
      historicalPool.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // 2. Run evaluator
    const results = evaluateProspect(
      { position, draftRound, draftPick },
      historicalPool ?? [],
    );

    // 3. Persist if requested
    if (persist && draftYear) {
      const { error: upsertError } = await supabase
        .from('prospect_profiles')
        .upsert(
          {
            name,
            position,
            draft_year: draftYear,
            draft_round: draftRound,
            draft_pick: draftPick,
            comp_results_json: results as unknown as Record<string, unknown>,
            confidence_level: results.confidence,
          },
          { onConflict: 'name,draft_year' },
        );

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
