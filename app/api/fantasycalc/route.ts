import { NextResponse } from 'next/server';

const cache = new Map<string, { data: unknown; fetchedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const numQbs = searchParams.get('numQbs') ?? '1';
  const ppr = searchParams.get('ppr') ?? '1';

  const cacheKey = `${numQbs}-${ppr}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const url = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${numQbs}&numTeams=12&ppr=${ppr}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return NextResponse.json({ error: 'FantasyCalc unavailable' }, { status: 502 });

  const data = await res.json();
  cache.set(cacheKey, { data, fetchedAt: Date.now() });
  return NextResponse.json(data);
}
