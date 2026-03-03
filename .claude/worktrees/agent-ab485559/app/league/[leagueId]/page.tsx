import { redirect } from 'next/navigation';

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  redirect(`/league/${leagueId}/overview`);
}
