'use client';

import { useState } from 'react';

export function CopyOrders({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        setState(ok ? 'copied' : 'failed');
      } catch {
        setState('failed');
      }
    }
    window.setTimeout(() => setState('idle'), 2000);
  }

  const label = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f4f7fb] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34d399]"
    >
      <span className="sr-only">Copy the order list as plain text. </span>
      {label}
    </button>
  );
}
