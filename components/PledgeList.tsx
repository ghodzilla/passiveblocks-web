const pledges = [
  {
    icon: '◆',
    title: 'Real capital behind the research',
    desc: "Every opportunity we cover is something we've evaluated or deployed real money into.",
  },
  {
    icon: '◆',
    title: 'Zero affiliate/sponsored picks',
    desc: 'Our rankings are never influenced by affiliate commissions or paid placements.',
  },
  {
    icon: '◆',
    title: 'We cost the downside in dollars',
    desc: 'Every recommendation includes a plain-English risk estimate — not just upside promises.',
  },
]

export function PledgeList() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">Our Pledge</p>
          <h2 className="text-2xl font-extrabold text-white">How we earn your trust</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {pledges.map((p) => (
            <div key={p.title} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
              <div className="text-blue-400 text-xl mb-3">{p.icon}</div>
              <h3 className="font-bold text-white mb-2 text-sm">{p.title}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
