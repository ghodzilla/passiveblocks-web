/**
 * Single source of truth for pillar accent colours.
 * - `accent`      : dark hex used ONLY for the 2px card top-border (CSS inline style)
 * - `textClass`   : bright Tailwind *-400 class for badge text (passes WCAG AA on #08080f)
 * - `borderClass` : matching border opacity class for the badge ring
 */
export const PILLARS = {
  'crypto-yield': {
    accent: '#1c6b47',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-400/30',
  },
  'stocks': {
    accent: '#b7791f',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-400/30',
  },
  'airdrops': {
    accent: '#6d4aa8',
    textClass: 'text-violet-400',
    borderClass: 'border-violet-400/30',
  },
  'ai-crypto': {
    accent: '#4338ca',
    textClass: 'text-indigo-400',
    borderClass: 'border-indigo-400/30',
  },
} as const

export type PillarSlug = keyof typeof PILLARS
