import { NextResponse } from 'next/server';

let cache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const numQbs = searchParams.get('numQbs') ?? '1';

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const url = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${numQbs}&numTeams=12&ppr=1`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return NextResponse.json({ error: 'FantasyCalc unavailable' }, { status: 502 });

  const data = await res.json();
  cache = { data, fetchedAt: Date.now() };
  return NextResponse.json(data);
}
