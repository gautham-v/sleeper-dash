import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get('year');

    if (!yearParam) {
      return NextResponse.json({ error: 'Missing required query param: year' }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year)) {
      return NextResponse.json({ error: 'year must be a number' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('prospect_profiles')
      .select('*')
      .eq('draft_year', year)
      .order('overall_rank', { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
