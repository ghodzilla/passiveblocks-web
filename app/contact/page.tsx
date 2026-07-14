import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — PassiveBlocks",
  description: "Get in touch with PassiveBlocks.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-6">Contact</h1>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Email</h2>
            <p>
              For questions, feedback, or partnership inquiries:
              <br />
              <a href="mailto:hello@passiveblocks.io" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                hello@passiveblocks.io
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Newsletter</h2>
            <p>
              Subscribe to get our weekly passive income breakdown — best yields across crypto and stocks,
              tested with real capital. No hype. No sponsored garbage.
              <br />
              <a href="/#subscribe" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                Subscribe here →
              </a>
            </p>
          </section>

          <section className="border-t border-white/10 pt-6 mt-8">
            <p className="text-white/40 text-sm">
              PassiveBlocks is an educational publication. We are not licensed financial advisors.
              Nothing on this site is financial advice. Always do your own research.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
