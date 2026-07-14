import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — PassiveBlocks",
  description: "How PassiveBlocks collects and uses data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: July 2026</p>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h2>
            <p>
              When you subscribe to our newsletter, we collect your email address. When you visit our site,
              we use Vercel Analytics to collect anonymous usage data (page views, referrers, device type).
              We do not use tracking cookies, advertising pixels, or fingerprinting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. How We Use Your Data</h2>
            <p>
              Your email address is used solely to deliver the PassiveBlocks newsletter. Anonymous analytics
              help us understand which content is most useful. We never sell, rent, or share your data with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Third-Party Services</h2>
            <p>
              We use the following third-party services: Vercel (hosting and analytics) and ConvertKit (newsletter delivery).
              Each has its own privacy policy governing how they handle data on our behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Your Rights</h2>
            <p>
              You can unsubscribe from our newsletter at any time via the link in every email. To request deletion
              of your data, email us at the address listed on our Contact page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Contact</h2>
            <p>
              For privacy-related questions, visit our Contact page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
