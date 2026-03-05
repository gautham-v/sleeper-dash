# leaguemate.fyi — Product Strategy Brief

> **Audience:** Product managers evaluating what to build next.
> **As of:** March 2026
> **Source:** Full codebase analysis — routes, data models, analytics, and UI components.

---

## What Is This?

leaguemate.fyi is a free analytics layer built on top of [Sleeper](https://sleeper.com), the most popular fantasy football platform among dynasty players. Sleeper handles live scoring and roster management well — but it provides almost no historical context. It doesn't tell you who the best drafter in your league is, whether a trade was fair, or whether a franchise is on the rise or in decline. leaguemate fills that gap.

The product is a **league analytics tool**: any manager in a Sleeper league can visit leaguemate, enter their Sleeper username, and immediately get multi-year analysis of their league's full history — draft grades, trade intelligence, franchise projections, and all-time records. No signup, no data entry, no installation required.

**What is fantasy football?** A game where participants act as team managers, drafting real NFL players and competing against other managers based on those players' real-world statistical performance (touchdowns, yards, etc.). Leagues run for a full NFL season (~17 weeks), with playoff brackets at the end.

**Redraft vs. dynasty:** In redraft leagues, every manager re-drafts a completely new roster each year. In dynasty leagues, managers keep their players across seasons, making long-term roster construction decisions that reward strategic thinking. Dynasty players are significantly more analytically engaged and have far more to gain from multi-year historical context. leaguemate is optimized for dynasty.

**What is Sleeper?** A free mobile-first platform used by millions of fantasy football players. It handles drafts, live scoring, trades, and waiver wire moves — but its analytics are shallow. There is no cross-season history, no draft grading, and no trade analysis beyond what happened. leaguemate is entirely read-only on top of Sleeper's public API; it does not require a Sleeper account and cannot modify any league data.

---

## Who Uses This?

**The Dynasty Analyst** *(primary)*
Has been in the same league for 3+ years. Wants to understand their franchise's trajectory, evaluate past drafts and trades, and build a strategic case for their next move. Spends time on the Franchise Outlook tab, the WAR trajectory chart, and their Manager Profile. Likely the person who shared the link with their league. The Trade Impact Simulator is built almost exclusively for this user.

**The Competitive Commissioner** *(secondary)*
Maintains a long-running league and wants a single authoritative source for league lore — all-time records, the reigning champion, the best draft ever. Uses Records, Draft Leaderboard, and the Managers page. Most likely to share specific pages or screenshots in league chat. The Franchise Share Card is designed for this sharing behavior.

**The Casual Overviewer** *(tertiary)*
Visits once at the end of the season, checks standings, looks up their luck score, glances at a trade card or two. Doesn't engage with deep analytics but benefits from the League Overview and Trade Analyzer. Can leave the app with a clear picture of how their season went in under two minutes.

---

## Typical User Journey

1. **Entry** — User visits leaguemate.fyi and enters their Sleeper username. The app fetches all leagues they're in for 2024–2025 and redirects to their most recent active league.
2. **Orientation** — League Overview loads: current standings, their personal "My Season" card (rank, record, points for, luck score), and the reigning champion. This is the first context-setting moment.
3. **First depth** — They navigate to Draft Leaderboard or Trade Analyzer to see how they rank in the league. Grade letters and league-relative rankings make this immediately engaging.
4. **Personal deep-dive** — They visit their own Manager Profile to see their Ring of Honor (most-started players ever), career record in the league, and the Franchise Outlook tab with their contender window and a strategy recommendation — now including data-driven rationale that names specific players and positions.
5. **Cross-manager exploration** — They visit another manager's profile to compare, use H2H to settle a debate, or click through the Franchise Analytics page to see all-time WAR trajectory for every franchise.
6. **Trade planning** — Power users use the Trade Impact Simulator to model a hypothetical trade before proposing it, seeing how WAR, tier, contender window, and roster age would change for both sides.
7. **Return behavior** — Power users check Franchise Analytics periodically through the season, or return to the Records page at season end to see if any marks were broken.

---

## What's Actually Shipped

### Page-by-Page Walkthrough

---

#### Home / Entry

**Answers:** Where do I start?

**Shows:** A username input form, a brief feature preview grid (5 capabilities with icons), and a footer with About/Contact links.

**Flow:** The user enters their Sleeper username. The app fetches all leagues they're in for 2024 and 2025 and immediately routes to the most recent one. There is no account creation, no password, and no persistent session — Sleeper username is the only credential.

**Limitations:** Only 2024 and 2025 leagues are discoverable. Older standalone leagues (not renewed year-over-year) cannot be found this way; a user would need to navigate directly by league ID.

---

#### League Overview

**Answers:** How did my league's season go, and where do I stand?

**Shows:**

- **Champion hero card** — reigning champion's name, avatar, and a link to their manager profile
- **My Season card** — the logged-in user's rank badge, win-loss record, points for, and a collapsible section with points against, current streak, power rank, and luck score (color-coded positive/negative)
- **Standings** tab — full league standings table with rank, record, points for/against, playoff indicator, and win streak
- **Power Rankings** tab — algorithmic rankings distinct from the standings record
- **Luck Index** tab — gap between actual wins and simulated expected wins (how much did scheduling affect the record?)
- All tabs support a season dropdown to view any historical season

**Enables:** At-a-glance league orientation; settling debates about who got lucky vs. played well.

**Limitations:** Power rankings and luck index are per-season only; no week-by-week breakdown or trend chart is available.

---

#### Managers

**Answers:** Who are the best managers in this league, all time?

**Shows:**

- **Records Spotlight** — a card featuring 4 all-time superlatives (most titles, longest win streak, highest single-game score, biggest blowout victory), each with the record-holder's name and the value
- **All Managers table** — every manager sorted by career win percentage, with clickable rows that route to their individual Manager Profile

**Enables:** Quick identification of the league's historically best managers; entry point for drilling into any individual profile.

---

#### Manager Profile

**Answers:** Who is this manager, and how have they performed across every dimension in this league?

**Shows:** A header card with the manager's avatar, overall win rate, career record, championships, playoff record, all-time points, biggest rival (with H2H record), draft grade, trade grade, and average roster age. Below that, eight tabs:

1. **Overview** — Championship and last-place finish banners (by year), best/worst season cards, and a table of league records the manager currently holds. CTAs to Franchise Value and Franchise Outlook.
2. **Value** — The franchise trajectory line chart (see Franchise Analytics for detail), scoped to this manager within the full league comparison.
3. **Drafting** — Pick-by-pick draft history across all seasons with WAR and surplus scores, grade breakdown, and career draft stats.
4. **Trades** — Every trade this manager has made, with winner/loser determination and net value scores.
5. **Head-to-Head** — Record vs. each specific opponent in the league.
6. **Season Log** — Year-by-year table of wins, losses, points, playoff finish.
7. **Outlook** — The full Franchise Outlook panel (see Franchise Analytics for detail), scoped to this manager.
8. **Players** — Ring of Honor (top 5 most-started players ever, with career WAR), plus a paginated table of all players ever rostered.

**Enables:** The deepest per-manager analysis in the product. Most power users make this their primary destination.

**Limitations:** Grades are percentile-ranked within this league only; comparisons to managers in other leagues are not meaningful.

---

#### Career Stats

**Answers:** Who am I as a fantasy manager across all leagues, not just this one?

**Shows:** Four tabs:

1. **Overview** — Total career wins/losses, championship count, playoff record, average points per season, trade grade, draft grade, best/worst season highlights, and a per-league breakdown table
2. **Trades** — Career trade record across all leagues; win rate, net value
3. **Drafts** — Career draft performance across all leagues; hit rate, steals, busts
4. **Holdings** — Current player holdings across all leagues this manager is in, with dynasty values

**Enables:** A manager's complete identity as a fantasy player, not tied to any single league. Useful for self-evaluation and bragging rights.

**Limitations:** Tabs 2–4 are lazily loaded (only fetch data when clicked) to keep initial load fast. Cross-league grade comparisons are not normalized for league difficulty.

---

#### Draft Leaderboard

**Answers:** Who drafts best in this league?

**Shows:** Four tabs, all filterable by season or all-time:

1. **Rankings** — Table ranked by draft grade (A+ through F), with Value+ score (how much above/below expected for draft position), hit rate (% of picks that outperformed), average surplus per pick, and bust rate
2. **Classes** — The best single-season drafts ever: top 3 shown as highlight cards (with medal icons and top picks), full paginated table below
3. **Steals** — Paginated list of the best individual picks in league history (most surplus over draft position)
4. **Busts** — Paginated list of the worst individual picks in league history

**Enables:** Identifying who to trust (and distrust) in trade negotiations; comparing draft years; celebrating or lamenting individual picks.

**Limitations:** Grades are retrospective (actual fantasy points scored, not dynasty value), so rookie picks drafted for long-term upside often look like busts in the first year.

---

#### Trade Analyzer

**Answers:** Who wins trades in this league?

**Shows:** Two tabs:

1. **Leaderboard** — Most Active Traders card (top 3 by trade volume), Top 3 Most Impactful Trades cards (showing both sides, winner/loser crowns, and net value), Trade Intelligence Leaderboard table (all managers ranked by net trade value, with grade, win rate, and avg value per trade)
2. **All Trades** — Paginated list of every trade in league history. Each card shows both sides of the trade (players and draft picks), the winner (if determined), and the net value for the winning side. Filterable by season and sortable by recency or impact.

**Enables:** Settling debates about who won a specific trade; identifying which managers are net value donors vs. accumulators; reviewing the full trade history of the league.

**Limitations:** Trades are graded by post-trade fantasy points only — not by expected value at time of decision. A manager who traded away a player who then got injured will appear as the loser regardless of whether the trade was reasonable at the time.

---

#### Franchise Analytics

**Answers:** Whose franchise is most valuable all-time, and where is each franchise headed?

**Shows:** Two tabs:

1. **Franchise Value** — A multi-line chart showing cumulative WAR for every franchise across the league's full history. Each season adds to the running total, so long-tenured franchises with sustained success rise to the top. Lines are color-coded per manager; clicking a manager in the legend highlights their line. A rankings table below shows current franchise value rank, total WAR, and year-over-year change.
2. **Franchise Outlook** — A manager-selectable deep-dive panel with:
  - **Tier banner** (Contender / Fringe / Rebuilding, color-coded) with overall franchise score and rank, plus a **Share My Card** button
  - **Strategy recommendation** (one of five: Push All-In, Win-Now Pivot, Steady State, Asset Accumulation, Full Rebuild) with a **data-driven rationale** and action urgency score
  - **Focus areas** — specific signals flagged as warnings, positives, or information (e.g., "aging WR corps," "strong rookie pipeline")
  - **Summary cards** — roster age, contender window (how many years until peak), peak projected year, roster age risk, future draft pick count
  - **Roster Assets** — Franchise Pillars (top starters by WAR) and Young Pipeline (players 24 or under with dynasty upside)
  - **3-year WAR projection chart** — current performance extended forward with a dashed contender threshold line
  - **Position breakdown** — each position ranked within the league, with age trend (Rising / Prime / Aging)
  - **Rookie Targets**, **Trade Targets** (with seller context), and **Trade Partners** cards — FantasyCalc-powered recommendations for how to improve the roster

**Data-driven strategy rationale:** Strategy recommendation bullets now reference actual roster data — naming the top franchise pillar by age, identifying the weakest position group by WAR rank, counting young assets and future first-round picks, and factoring in luck score context (e.g., "Unlucky record masks true talent — sellers may underestimate you").

**Trade Target Seller Context:** Each trade target card now includes a seller motivation assessment based on the target's tier (Contender / Rebuilder / Fringe), age trajectory, and luck score. Urgency flags (`buy-low`, `closing-window`) surface when elite players show decline curves or when sellers have extra motivation to move assets.

**Share My Card:** From the Franchise Outlook panel, any manager can tap "Share My Card" to open a styled 400×520px franchise card in a modal overlay. The card shows tier badge, strategy headline, key metrics (WAR rank, contender window, peak year, record), franchise pillars, and top rationale bullets — designed for screenshot sharing into league chats. The card always renders in dark mode regardless of app color scheme. A copy-link button in the modal copies the current page URL.

**Enables:** Long-term strategic planning; identifying the right trade partners; communicating franchise health to prospective trade counterparts; sharing franchise identity in league chat.

**Limitations:** Projections assume standard roster configurations; superflex or non-standard formats may produce incorrect age curves. Rookie targets and trade partners require the FantasyCalc API; if unavailable, those cards are absent. The 0.85-per-year discount applied to future pick values is not configurable. The share card copies the current page URL rather than a franchise-specific deep link.

---

#### Trade Impact Simulator

**Answers:** What would happen to my franchise if I made a specific trade?

**Shows:** A two-column (desktop) / tabbed (mobile) asset picker with WAR impact visualization:

- **Counterparty selector** — dropdown of all league managers; clears selections on change
- **Asset columns** — searchable player lists (QB, RB, WR, TE only) and future draft picks for each side; selected assets appear as removable chips. Player cards show position badge, age, WAR, and dynasty value.
- **Delta Summary Card** — before/after comparison across: Franchise Score (total WAR), Tier (with transition label, e.g., "Rebuilder → Contender"), Contender Window (years), Peak Year, and Weighted Roster Age. Each metric is color-coded (green = improvement, red = decline, gray = unchanged).
- **WAR Trajectory Chart** — 5-year projection showing before (gray dashed) and after (cyan/red) lines, with an indigo contender threshold reference line.
- **Counterparty Outlook** — mirrored delta summary and WAR chart for the other team in the trade, enabling bilateral evaluation.

**How it works:** The simulator clones the current league state snapshot (`FranchiseOutlookRawContext`), applies roster and pick mutations for the proposed trade, recalculates all-league position ranks and WAR ranks, then runs the full `computeFranchiseOutlook()` engine for both teams. Results are debounced 300ms to prevent excessive recomputation during rapid asset selection.

**Enables:** Evaluating trades before proposing them; understanding second-order effects (how trading away a WR affects position ranking relative to the whole league); seeing both sides of a trade simultaneously.

**Limitations:** Only QB, RB, WR, TE positions modeled (kickers and defenses excluded). Strictly bilateral — multi-team trades not supported. Uses a static league state snapshot at page load; changes made by others during a session won't be reflected until refresh. Future pick values are implicit in WAR projections rather than displayed as a dollar figure.

---

#### Records

**Answers:** What are the most remarkable things that have ever happened in this league?

**Shows:** A record book with 12+ categories across all-time and individual seasons:

- Most championships
- Longest win streak and worst losing streak
- Highest and lowest single-season points totals
- Biggest blowout victory and closest game
- Most points in a single week and fewest
- Other notable superlatives (most trades, highest playoff record, etc.)

Each record entry shows the record-holder, the value, and the season it was set. Filterable by season.

**Enables:** League lore, trash talk ammunition, and end-of-season celebrations.

**Limitations:** Records are computed from available historical data; leagues with broken historical chains (where a prior season wasn't linked) will show incomplete record sets.

---

#### H2H Comparison

**Answers:** What is the all-time record between these two specific managers?

**Shows:** A dual manager selector. Once two managers are chosen:

- Head-to-head record (W–L)
- Total points scored by each side across all H2H matchups
- Game-by-game history listing every matchup (week, season, scores, winner)

**Enables:** Settling the "I always beat you" debate with actual data going back to the league's first season.

**Limitations:** Only covers managers within the same league; there is no cross-league H2H comparison.

---

### No Significant Stubs

Every major page and component is fully wired to real data. The only exception is the `/career` route, which is a redirect to career stats and carries no functionality of its own.

---

## Data Model Summary

### Entities and What They Track


| Entity                 | What It Represents                                                                                                   | Key Relationships                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **League**             | A single fantasy league season, including format, scoring settings, and a pointer to the previous season's league ID | Links historically to form a multi-year chain          |
| **Team / Roster**      | One manager's team in one season: current players, season record (wins, losses, points scored, points allowed)       | Belongs to a League; owned by a User                   |
| **User**               | A Sleeper account: username, display name, avatar                                                                    | Can own multiple Rosters across many Leagues           |
| **Weekly Matchup**     | A single game between two teams in a given week, including each player's score                                       | Links Rosters within a League for a week               |
| **Transaction**        | Any roster move: trade, waiver pickup, or free agent claim                                                           | Trades include both players and draft picks as assets  |
| **Draft / Draft Pick** | A league's annual draft event and each selection within it, including player metadata at time of pick                | Picks link to Players and to Teams (via roster ID)     |
| **Traded Draft Pick**  | A future draft pick that has changed hands via a trade                                                               | Links to a future season, the original and new owner   |
| **Player**             | An NFL player: name, position, age, team                                                                             | Referenced in picks, transactions, and roster holdings |
| **Historical Season**  | A reconstructed snapshot of a past season: all teams, matchups, champion, and playoff finishes                       | Assembled from the League chain (previous_league_id)   |


### Computed Entities (analytics layer)


| Computed Entity                  | What It Calculates                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WAR (Wins Above Replacement)** | How many additional wins a team generates compared to a league-average roster. The central currency of all analysis.                                                     |
| **Draft Surplus**                | Whether a draft pick outperformed or underperformed expectations for its slot.                                                                                           |
| **Analyzed Trade**               | Post-trade fantasy points for both sides of every trade, to determine who "won."                                                                                         |
| **Franchise Outlook**            | 3-year projection of a team's WAR, incorporating current roster age, future draft picks, and position-specific aging curves.                                             |
| **Franchise Outlook Raw Context** | A full immutable snapshot of the league state at a point in time: all rosters, player WAR map, pick ownership, position rankings, display names, dynasty values. Used as the input to Trade Impact Simulation. |
| **Trade Simulator Result**       | Before/after delta across five franchise metrics (WAR, tier, contender window, peak year, roster age) after a proposed bilateral trade. Computed by mutating a Raw Context clone and re-running computeFranchiseOutlook. |
| **Seller Context**               | Per-trade-target motivation profile: tier-adjusted willingness to sell, age-based urgency flags (`buy-low`, `closing-window`), and luck-adjusted pricing. Surfaced in Trade Targets cards. |
| **Luck Index**                   | Gap between actual wins and "expected wins" (simulated record if you played every other team each week).                                                                 |
| **Strategy Recommendation**      | One of five actionable labels (Push All-In, Win-Now Pivot, Steady State, Asset Accumulation, Full Rebuild) derived from a team's tier, contender window, and risk score. Rationale bullets now reference named players, specific position weaknesses, young asset counts, and luck context. |
| **All-Time Records**             | 12+ career superlatives computed across every historical season in the league.                                                                                           |


### Key Architectural Assumption: The League Chain

The product's historical analysis depends entirely on each Sleeper league being linked to the previous year's league via a `previous_league_id` field. If a league was renamed, migrated, or re-created rather than renewed, the historical chain breaks and multi-year analytics disappear. This is a silent failure — the app simply shows fewer seasons of history.

---

## Implicit Product Decisions

These choices are baked into the code without explicit documentation but reveal clear product direction.

**1. Dynasty-first orientation**
The franchise outlook, contender window, future pick valuation, age curves, and FantasyCalc integration all assume dynasty-style play. Redraft league users get data but miss the features that make the product most useful.

**2. WAR as the single truth**
Every analytical surface — draft grades, trade grades, franchise projections, strategy recommendations — ultimately converts back to WAR. This creates a coherent, unified analytical language, but it also means the entire product's credibility rests on WAR being a trusted metric.

**3. Evaluation is retrospective by design (with a forward-looking simulator as complement)**
Trades are graded by actual post-trade fantasy production. Draft picks are graded by actual season points vs. replacement level. There is no forward-looking "expected value at time of decision" model for historical grades. However, the Trade Impact Simulator deliberately offers the forward-looking counterpart: before you make a trade, you can simulate its WAR impact. The product now covers both temporal modes — judge outcomes for the past, project impact for the future.

**4. The app is a league analytics tool, not a team management tool**
There are no waiver wire recommendations, no lineup optimizer, no sit/start advice, and no injury alerts. The product deliberately sits upstream of in-season decisions and focuses on historical intelligence and long-term strategy.

**5. Grades are relative, not absolute**
Draft and trade grades (A+ through F) are percentile rankings within a league. An A+ trade in one league might be a C in another. This is correct for competitive context but means grades lose meaning when shared outside the league.

**6. The product assumes continuity of league membership**
Luck scores, power rankings, career records, and franchise outlooks all presume the same managers have been in the same league for multiple seasons. Expansion, contraction, or high manager turnover degrades the experience.

**7. Seasons 2024 and 2025 are the only entry points**
The landing page fetches only these two seasons from Sleeper. Users in leagues that started earlier cannot discover older leagues through the app's onboarding — they must navigate directly by league ID if they know it.

**8. FantasyCalc is a critical, non-redundant dependency**
Rookie draft targets, trade target values, and trade partner compatibility all require FantasyCalc's dynasty values. If FantasyCalc is unavailable, these features silently degrade. There is no fallback value system.

**9. Trade simulation is exploratory, not prescriptive**
The simulator places no guardrails on what trades can be modeled — a user can simulate trading 5 stars for 1 rookie. It does not suggest fair trades or flag imbalanced deals. This is intentional: the product informs, it does not judge in-progress decisions.

---

## Conspicuous Gaps

### Features the Architecture Implies But Doesn't Have

**Waiver wire analysis**
All transactions — including waiver pickups and free agent claims — are fetched and stored. But the only analytical surface built on them is trades. There is no "best waiver adds," "most aggressive waivers manager," or "waiver wire impact" analysis, despite the data being fully available.

**Keeper league support**
Every draft pick in the system has an `is_keeper` flag. It is tracked but never surfaced. There is no keeper-specific analysis, no "best keepers," no evaluation of keeper decisions over time. Given the dynasty orientation of the product, keeper league support seems like an obvious next surface.

**In-season alerts or push notifications**
The data model supports real-time use (matchup scores, waiver moves, trades are all available weekly), but the product has no notification or alert layer. There is no "your trade just resolved," "your power ranking dropped," or "you're the luckiest team this week" moment.

**Scoring format customization**
Sleeper's scoring settings (PPR vs. half-PPR, passing TD values, bonus points) are fetched but not deeply modeled. The WAR calculation uses raw fantasy points, which means leagues with unusual scoring formats may see distorted grades compared to standard leagues.

**Cross-league leaderboards**
Career stats exist on a per-user basis, but there is no way to compare two managers from different leagues, or rank all users of the app by any metric. The product is fully siloed to individual leagues.

**Playoff-specific analytics**
Playoff wins and losses are tracked in career stats. But there is no "playoff performance" analysis — no clutch scoring, no bracket luck, no analysis of who consistently underperforms or overperforms in the postseason.

**Mock draft or draft prep tools**
The product analyzes past drafts in detail but has no forward-looking draft tools: no player board, no draft simulator, no ADP comparison. The Trade Impact Simulator fills the forward-looking gap for trades specifically, but the draft equivalent does not exist.

**Historical power rankings or luck trends**
Power rankings and luck scores are computed for the current season only. There is no week-by-week historical chart, no "power ranking trajectory," no way to see how a team rose or fell over the course of a season.

**Multi-team trade simulation**
The Trade Impact Simulator is strictly bilateral. Three-way (or larger) trades — common in dynasty leagues — cannot be modeled.

**Franchise-specific share URLs**
The "Share My Card" feature copies the current page URL, not a direct link to a specific manager's franchise outlook. There is no deep-linkable URL that routes to a specific manager's card.

---

## Technical Constraints on Product Direction

### What Would Be Easy to Build

- **More record types** — The records system is modular. New categories (e.g., "most waiver pickups," "most trades," "longest blowout streak") can be added with minimal work.
- **Waiver wire analytics** — The transaction data is already fetched; only the analytical layer and UI need to be built.
- **More projection years** — The franchise outlook currently projects 3 years forward. Extending to 5 years or adding confidence intervals would be straightforward.
- **Additional manager profile tabs** — The tab system in Manager Profile is designed to accept new tabs. A "Season Timeline" or "Roster History" tab could be added independently.
- **Keeper flag surfacing** — The data is already in every draft pick. Exposing keeper analysis is primarily a UI task.
- **Expanded glossary and onboarding** — A glossary already exists in the codebase. Contextual help, tooltips, and onboarding flows can be layered on without structural changes.
- **Multi-team trade simulation** — The `FranchiseOutlookRawContext` snapshot pattern used by the bilateral simulator could extend to 3+ teams with moderate effort, since the mutation-and-recompute pattern is already in place.
- **Franchise-specific deep links** — The share card already has a `shareUrl` prop designed for this; generating and passing a manager-scoped URL is the only missing piece.

### What Would Require Significant Work

- **Real-time or near-real-time updates** — The entire data layer is REST polling with cached results. Adding live score tickers or push notifications would require infrastructure (WebSocket server, notification service) that doesn't exist today.
- **Redraft league optimization** — The product's analytical model (age curves, contender windows, future pick valuation) is built around dynasty. Accurately serving redraft leagues would require a separate analytical model with different assumptions about player value and roster evaluation.
- **Cross-league comparisons** — Career stats exist but are aggregated per user, not normalized across leagues. Meaningful cross-league comparison requires normalizing for league size, scoring format, and competition level — a non-trivial modeling problem.
- **Salary cap support** — The Sleeper API does not expose salary cap data. Supporting cap-based leagues would require a new data source or user-provided input.
- **Predictive rankings (not descriptive)** — Current analytics are retrospective. Building forward-looking power rankings or win probability models would require training data and a statistical modeling layer.
- **Social or community features** — There is no user account system, authentication, or data persistence layer beyond Sleeper's API. Building league chat, public profiles, or sharing with access controls would require backend infrastructure from scratch.

---

## Open Questions

**1. Who is the intended primary user?**
The product serves both casual overviewers (standings, records) and deep analysts (franchise outlook, WAR charts, trade simulator). It's unclear which user is primary. The navigation gives equal weight to both, which may dilute focus.

**2. How should grade calibration be communicated?**
Grades are percentile-ranked within a league. A user who transfers to a stronger league will see their grade drop even if their absolute performance didn't change. This isn't documented anywhere for the user.

**3. Is WAR the right metric to center the product on?**
WAR is computed as starter points above league median. It advantages managers who start high-variance players and leagues with high overall scoring. It may not resonate with users familiar with traditional fantasy metrics (points for, point differential, win percentage). The product's entire credibility rests on user adoption of WAR as meaningful.

**4. What happens to multi-year metrics when a manager leaves a league?**
The data model links rosters to users, and historical chains to previous leagues. But if a manager leaves mid-history and a new manager takes over their team, the WAR trajectory chart and career records would attribute old seasons to the new manager. This edge case is unhandled.

**5. The trade evaluation model is retrospective and the simulator is forward-looking — do users understand they're different tools?**
Trades are graded historically by actual post-trade fantasy points. The Trade Impact Simulator projects forward using WAR modeling. A trade that the Analyzer grades as a loss (because the player got injured) might still show as a WAR improvement in the simulator. These two surfaces produce different answers to different questions, but the product doesn't clearly communicate that distinction.

**6. What is the upgrade or monetization path?**
The product has no account system, paywall, premium tier, or rate limiting. It's unclear whether the intent is to remain free, introduce a freemium model (e.g., gate franchise outlook or trade simulator behind a premium tier), or pursue B2B (league commissioner tools). The architecture would need significant changes to support any monetization model.

**7. Are strategy recommendations trusted by users, or does "AI strategy advice" create skepticism?**
The franchise outlook produces deterministic, rule-based recommendations labeled as strategy guidance. The data-driven rationale (naming players, positions, luck scores) adds credibility, but users sophisticated enough to question the assumptions (e.g., "why does 0.85 discount apply to my Round 1 pick?") have no way to inspect or override the model. The product doesn't acknowledge its own uncertainty.

**8. How does the product handle leagues with non-standard roster configurations?**
Franchise outlook projections assume standard starting lineups (1 QB, 2 RB, 2 WR, 1 TE). Superflex leagues (2 QBs), tight end premium leagues, or IDP leagues would produce incorrect age curves and projections. The Trade Impact Simulator similarly excludes non-standard positions (kickers, defenses) by design. The product fetches scoring settings but doesn't always use them in the analytical models.

**9. What is the experience for brand-new leagues with no history?**
The all-time records, franchise trajectory, draft leaderboard, and trade grades all require multiple seasons of history. For a league in its first year, most of these surfaces will be empty or trivial. There is no "new league" onboarding or reduced feature set that communicates gracefully what becomes available over time.

**10. Should Career Stats and Manager Profiles be the same product surface?**
Career Stats (cross-league) and Manager Profile (per-league) overlap significantly. A user viewing their own profile in a league and then clicking "Career Stats" sees similar data at different scopes. The distinction between "who am I in this league" vs. "who am I as a fantasy manager" is architecturally correct but may create navigational confusion for non-power users.

**11. Does the Trade Impact Simulator create unrealistic expectations?**
The simulator shows WAR impact but not win probability or playoff odds. A trade that improves WAR by 0.5 might feel significant in the UI but be statistically marginal. Users may over-index on simulated improvements without context for what WAR delta actually matters.
