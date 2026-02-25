import type { Metadata } from 'next';
import { DashboardShell } from '@/components/DashboardShell';
import { sleeperApi } from '@/api/sleeper';

interface Props {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leagueId } = await params;

  try {
    const league = await sleeperApi.getLeague(leagueId);
    const title = league.name;
    const description = `${league.name} — ${league.season} Sleeper fantasy football league analytics`;

    return {
      title,
      description,
      openGraph: {
        title: `${league.name} | leaguemate.fyi`,
        description,
      },
      twitter: {
        card: 'summary',
        title: `${league.name} | leaguemate.fyi`,
        description,
      },
    };
  } catch {
    return {
      title: 'League Dashboard',
    };
  }
}

export default function LeagueLayout({ children }: Props) {
  return <DashboardShell>{children}</DashboardShell>;
}
