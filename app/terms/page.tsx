import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — PassiveBlocks",
  description: "Terms and conditions for using PassiveBlocks.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: July 2026</p>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Not Financial Advice</h2>
            <p>
              All content on PassiveBlocks — including articles, newsletters, tools, and calculators — is for
              <strong className="text-white"> educational and informational purposes only</strong>. Nothing on this site
              constitutes financial advice, investment advice, trading advice, tax advice, or any other type of
              professional recommendation.
            </p>
            <p className="mt-2">
              PassiveBlocks is <strong className="text-white">not a licensed financial advisor, investment adviser,
              broker-dealer, or tax professional</strong>. We do not hold any financial services licenses. You should
              consult a qualified licensed professional before making any financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. No Guarantees</h2>
            <p>
              Past performance, historical yields, and any examples shown on this site do not guarantee future results.
              Crypto and DeFi carry significant risk including total loss of capital. Equity investments can lose value.
              Yields are variable and not guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Your Responsibility</h2>
            <p>
              You are solely responsible for your own investment decisions. You should do your own research,
              understand the risks, and never invest more than you can afford to lose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Accuracy of Information</h2>
            <p>
              We strive for accuracy but make no warranties about the completeness, reliability, or timeliness
              of any information on this site. Crypto markets move fast — always verify data from primary sources.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Affiliate Links & Sponsorships</h2>
            <p>
              Some links on this site may be affiliate links. We may earn a commission if you use them, at no cost
              to you. Any sponsored content will be clearly disclosed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Intellectual Property</h2>
            <p>
              All content on PassiveBlocks is our intellectual property. You may share and link to our content
              freely, but may not reproduce it for commercial purposes without permission.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
