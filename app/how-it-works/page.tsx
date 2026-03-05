import {
  BarChart2, TrendingUp, Timer, Users, Target, Activity,
  DollarSign, Zap, Clock,
} from 'lucide-react';
import { BackLink } from './BackLink';

const HTC_DIMENSIONS = [
  {
    icon: BarChart2,
    label: 'Starting Value',
    description:
      'Measures how much a player contributes to your team relative to a replacement-level starter at their position — using WAR (Wins Above Replacement). A player who barely beats the wire is barely worth the roster spot.',
  },
  {
    icon: TrendingUp,
    label: 'Dynasty Clock',
    description:
      "Compares a player's projected future value to their current value, then cross-references where they sit in their historical age-curve peak window. Rising players score high; players past peak score low.",
  },
  {
    icon: Timer,
    label: 'Market Timing',
    description:
      "Flags when a player's trade value is declining and now may be the best time to sell. Crucially, ascending players always score near-zero here — the signal only fires when it actually matters.",
  },
  {
    icon: Users,
    label: 'Roster Fit',
    description:
      "Considers your positional WAR rankings, the specific starter slots your league uses, and positional scarcity. SuperFlex leagues apply a QB premium that meaningfully adjusts verdicts for quarterbacks.",
  },
  {
    icon: Target,
    label: 'Team Direction',
    description:
      "Adapts scoring weights and decision thresholds to your team's strategy mode: Full Rebuild, Asset Accumulation, Balanced, Contender, or Push All-In. A player who's a clear hold for a rebuilder might be a trade candidate for an all-in team.",
  },
  {
    icon: Activity,
    label: 'Current Status',
    description:
      'Incorporates real-time information: injury status, depth chart position, and years of experience. Injured starters are protected; depth chart risers get a boost.',
  },
];

const HTC_OVERRIDES = [
  'High-WAR players on IR are shielded from cut recommendations',
  'Top-3 WAR contributors on your roster are always held',
  'Young players with strong upside floors are protected regardless of score',
  'SuperFlex QBs receive a positional premium that raises the HOLD floor',
  "Required lineup starters can't be recommended for a cut",
  'High-confidence young assets are flagged for holds',
];

const DRAFT_FACTORS = [
  {
    icon: DollarSign,
    label: 'Market Value',
    description:
      'Current consensus dynasty rankings and trade values from FantasyCalc. Dynasty value is the primary anchor — it dominates the final score because markets aggregate a lot of information.',
  },
  {
    icon: Zap,
    label: 'Prospect Pedigree',
    description:
      'College production metrics — specifically target share and air yards dominance relative to teammates — and combine athletic testing. Rewards both production and measurables, weighted by position.',
  },
  {
    icon: Users,
    label: 'Roster Need',
    description:
      'The vacancy severity at each position on your roster. A critical positional gap meaningfully boosts a prospect\'s fit score; a position where you\'re already stacked barely moves the needle.',
  },
  {
    icon: Clock,
    label: 'Development Timeline',
    description:
      "How quickly this position typically contributes relative to your team's competitive window. RBs are immediate; WRs peak in year 2; QBs and TEs have year 3+ curves. A rebuilding team values year-2 contributors differently than a team pushing all-in.",
  },
  {
    icon: TrendingUp,
    label: 'Pick Value',
    description:
      'Whether the draft capital cost to acquire this player is above or below expected value for their class position. A surplus means you\'re getting more player than the pick typically returns.',
  },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold text-foreground mb-1">{children}</h2>
  );
}

function DimensionCardLarge({
  icon: Icon,
  label,
  description,
}: {
  icon: typeof BarChart2;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3.5 bg-card-bg border border-card-border rounded-xl p-4">
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
        <Icon size={15} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground leading-snug">{label}</div>
        <div className="text-sm text-muted-foreground leading-relaxed mt-1">{description}</div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-base-bg text-foreground font-sans">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-16">

        {/* Back link */}
        <BackLink />

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-3">
            Built to actually help you make decisions
          </h1>
          <p className="text-muted-foreground leading-relaxed text-base">
            Most fantasy tools show you stats. Leaguemate tells you what to do — and explains why.
            The engines below analyze your specific roster, your league's format, and your team's strategy
            to give you actionable verdicts, not raw numbers.
          </p>
          <p className="text-muted-foreground mt-3 text-sm font-medium">
            No accounts. No paywalls. No black boxes.
          </p>
        </div>

        {/* Section 1: HTC Engine */}
        <section className="mb-14">
          <div className="mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Engine 1
            </span>
          </div>
          <SectionHeading>Hold / Trade / Cut</SectionHeading>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Every player on your roster is analyzed across six dimensions and receives a HOLD, TRADE, or CUT
            verdict with a confidence score and plain-language reason. Weights and decision thresholds shift
            based on your team's strategy — a rebuilding team's HOLD is much harder to earn than a contender's.
          </p>

          {/* Strategy mode callout */}
          <div className="bg-card-bg border border-card-border rounded-xl p-4 mb-6">
            <div className="text-sm font-semibold text-foreground mb-1.5">Strategy Mode adjusts everything</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Five strategy modes are supported: <span className="text-foreground">Full Rebuild</span>,{' '}
              <span className="text-foreground">Asset Accumulation</span>,{' '}
              <span className="text-foreground">Balanced</span>,{' '}
              <span className="text-foreground">Contender</span>, and{' '}
              <span className="text-foreground">Push All-In</span>. Each mode applies different scoring weights
              across the six dimensions and different thresholds for each verdict — so the same player can
              correctly get different recommendations on different teams.
            </p>
          </div>

          {/* Six dimensions */}
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            6 Signal Dimensions
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {HTC_DIMENSIONS.map((d) => (
              <DimensionCardLarge key={d.label} icon={d.icon} label={d.label} description={d.description} />
            ))}
          </div>

          {/* Overrides */}
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Protective Overrides
          </div>
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              Six hard-coded rules prevent the engine from recommending bad cuts, regardless of composite score:
            </p>
            <ul className="space-y-2">
              {HTC_OVERRIDES.map((rule) => (
                <li key={rule} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="flex-shrink-0 mt-0.5">·</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* Confidence */}
          <div className="mt-4 bg-card-bg border border-card-border rounded-xl p-4">
            <div className="text-sm font-semibold text-foreground mb-1">About Confidence</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Confidence is calculated from how far the composite score sits from the nearest decision boundary.
              A high-confidence verdict is a clear signal. A low-confidence verdict is worth revisiting next month
              — conditions may be changing.
            </p>
          </div>
        </section>

        {/* Section 2: Draft Board */}
        <section className="mb-14">
          <div className="mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Engine 2
            </span>
          </div>
          <SectionHeading>Rookie Intelligence & Draft Board</SectionHeading>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Prospects are scored and ranked using a five-factor formula personalized to your roster. Dynasty
            market value anchors the score — raw talent metrics, roster need, timeline fit, and pick surplus
            adjust from there. The result is a draft board built for your team, not the generic consensus.
          </p>

          {/* Five factors */}
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            5 Scoring Factors
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {DRAFT_FACTORS.map((d) => (
              <DimensionCardLarge key={d.label} icon={d.icon} label={d.label} description={d.description} />
            ))}
          </div>

          {/* Historical comps */}
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Historical Comps
          </div>
          <div className="bg-card-bg border border-card-border rounded-xl p-4 mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each prospect is matched to similar players from{' '}
              <span className="text-foreground font-medium">10 years of NFL Draft history</span> (2015–2025,
              over 1,100 players). Matching uses position rank within the draft class, log-transformed pick
              number distance (so early picks are more differentiated), breakout age, and college usage metrics.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              The resulting probability distributions — P(elite starter), P(starter), P(rotational), P(bust)
              — show how players with similar profiles historically performed. They are not predictions about
              any individual player. Bayesian shrinkage toward position-specific base rates prevents
              over-fitting on small comp samples. Low-confidence comps are clearly labeled.
            </p>
          </div>

          {/* Timeline badges */}
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Timeline Badges
          </div>
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-sm font-medium w-24 flex-shrink-0">⚡ Immediate</span>
                <span className="text-sm text-muted-foreground">RBs who typically contribute in year one</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-yellow-400 text-sm font-medium w-24 flex-shrink-0">📈 Year 2</span>
                <span className="text-sm text-muted-foreground">WRs who typically need a season to develop</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-sm font-medium w-24 flex-shrink-0">🕐 Year 3+</span>
                <span className="text-sm text-muted-foreground">QBs and TEs with longer development curves</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-card-border">
              Timeline badges are position-based norms derived from historical data — not individual predictions.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-card-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Questions or feedback?{' '}
            <a href="mailto:gvem@duck.com" className="text-foreground hover:underline">
              gvem@duck.com
            </a>
          </p>
          <BackLink />
        </div>

      </div>
    </div>
  );
}
