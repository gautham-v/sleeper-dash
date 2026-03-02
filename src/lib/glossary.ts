export type GlossaryKey =
  | 'war' | 'surplus' | 'grade' | 'franchiseScore'
  | 'contenderWindow' | 'rosterAgeRisk' | 'hitRate'
  | 'bustRate' | 'netValue' | 'winRate'
  | 'luckScore' | 'youngPipeline';

export interface GlossaryEntry { name: string; description: string; }

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  war: {
    name: 'WAR — Wins Above Replacement',
    description: 'Measures how many more wins your team generates compared to a baseline replacement-level team. Positive = above average; computed from weekly matchup point totals.',
  },
  surplus: {
    name: 'Surplus (Value+)',
    description: 'How much better or worse a draft pick performed versus the average player taken at the same draft position. Positive = pick outperformed expectations for that round.',
  },
  grade: {
    name: 'Letter Grade',
    description: 'A+ through F rating based on percentile rank within the league. Draft grades use average surplus per pick; trade grades use net value percentile.',
  },
  franchiseScore: {
    name: 'Franchise Score',
    description: "Your roster's WAR — the projected wins your active players add above a replacement-level lineup. Used to rank teams and project future contention windows.",
  },
  contenderWindow: {
    name: 'Contender Window',
    description: "The number of consecutive future seasons your team is projected to remain above the league's contender threshold, based on player age curves and roster WAR projections.",
  },
  rosterAgeRisk: {
    name: 'Roster Age Risk',
    description: 'A 0–100 score indicating reliance on older players approaching decline. Low (0–25) = young/safe; Extreme (75–100) = heavily dependent on aging veterans.',
  },
  hitRate: {
    name: 'Hit Rate',
    description: 'Percentage of your draft picks that finished in the top 30% of performers for their round. Higher = more picks exceeded round expectations.',
  },
  bustRate: {
    name: 'Bust Rate',
    description: 'Percentage of your draft picks that finished in the bottom 30% of performers for their round. Lower is better.',
  },
  netValue: {
    name: 'Net Value',
    description: "Post-trade fantasy points received minus sent. Picks resolve to the drafted player's season total when available. Positive = you got the better side.",
  },
  winRate: {
    name: 'Trade Win Rate',
    description: 'Percentage of your trades where you received more fantasy value than you gave up. Above 50% indicates consistent value extraction.',
  },
  luckScore: {
    name: 'Luck Score',
    description: 'Wins rank minus WAR rank. Positive = your record is better than your roster deserves; negative = you\'re underperforming your talent.',
  },
  youngPipeline: {
    name: 'Young Pipeline',
    description: 'Rostered skill-position players age 24 or under, ranked by age-curve upside (how much room to grow relative to their position\'s peak). Dynasty value shown where available from FantasyCalc.',
  },
};
