import { BackLink } from '../how-it-works/BackLink';

export const metadata = {
  title: 'Terms of Service',
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-foreground mb-2 mt-8">{children}</h2>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-base-bg text-foreground font-sans">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-16">

        <BackLink />

        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 2026
          </p>
        </div>

        {/* Disclaimer box */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4 mb-8">
          <div className="text-sm font-semibold text-foreground mb-1">Third-Party Disclaimer</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            leaguemate.fyi is an independent, fan-made tool and is{' '}
            <span className="text-foreground font-medium">not affiliated with, endorsed by, or sponsored by Sleeper</span>{' '}
            or any other fantasy sports platform. Sleeper is a trademark of Sleeper Holdings Inc.
            All league data displayed on this site is fetched directly from the public Sleeper API on
            your behalf and is owned by you and Sleeper.
          </p>
        </div>

        <SectionHeading>1. Acceptance of Terms</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          By accessing or using leaguemate.fyi (the &ldquo;Service&rdquo;), you agree to be bound by these Terms of
          Service. If you do not agree, please do not use the Service.
        </p>

        <SectionHeading>2. Description of Service</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          leaguemate.fyi is a free, read-only fantasy football analytics tool. It retrieves publicly
          available data from the Sleeper API using your Sleeper username, and uses that data to
          generate personalized dynasty strategy analysis, player recommendations, draft projections,
          and trade simulations. The Service does not require account creation, does not store your
          personal information, and does not interact with your Sleeper account beyond reading
          publicly available data.
        </p>

        <SectionHeading>3. No Affiliation with Sleeper</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          leaguemate.fyi is an independent project and is not affiliated with, partnered with, or
          approved by Sleeper Holdings Inc. or any of its subsidiaries. Use of the Sleeper API is
          subject to Sleeper&apos;s own terms of service. leaguemate.fyi makes no representations on
          behalf of Sleeper.
        </p>

        <SectionHeading>4. Data and Privacy</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          leaguemate.fyi does not collect, store, or sell personal information. Your Sleeper
          username is stored only in your browser&apos;s session storage and is never transmitted to our
          servers. League and roster data is fetched directly from the Sleeper public API on demand.
          We may collect anonymous, aggregated usage analytics (e.g. page views) via PostHog to
          improve the Service.
        </p>

        <SectionHeading>5. Accuracy Disclaimer</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          All analysis, verdicts, projections, and recommendations provided by leaguemate.fyi are
          generated algorithmically and are intended for informational and entertainment purposes
          only. They do not constitute professional sports or financial advice. Accuracy is not
          guaranteed. Fantasy sports involve inherent uncertainty, and no tool can reliably predict
          player performance or trade outcomes.
        </p>

        <SectionHeading>6. Limitation of Liability</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. leaguemate.fyi and its
          operators shall not be liable for any direct, indirect, incidental, or consequential
          damages arising from your use of or inability to use the Service, including any decisions
          made based on analysis provided by the Service.
        </p>

        <SectionHeading>7. Intellectual Property</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The leaguemate.fyi name, design, and original content are the property of the Service
          operator. Sleeper, Sleeper-related trademarks, and all associated intellectual property
          belong to their respective owners. Third-party data sources (including FantasyCalc dynasty
          values) are subject to their own terms.
        </p>

        <SectionHeading>8. Changes to These Terms</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          These terms may be updated at any time. Continued use of the Service after changes are
          posted constitutes your acceptance of the revised terms. The &ldquo;last updated&rdquo; date at the top
          of this page will reflect the most recent revision.
        </p>

        <SectionHeading>9. Contact</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Questions about these terms can be directed to{' '}
          <a href="mailto:gvem@duck.com" className="text-foreground hover:underline">
            gvem@duck.com
          </a>.
        </p>

        {/* Footer */}
        <div className="border-t border-card-border pt-8 mt-12 text-center">
          <BackLink />
        </div>

      </div>
    </div>
  );
}
