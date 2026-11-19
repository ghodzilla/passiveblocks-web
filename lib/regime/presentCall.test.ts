import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nameIsAtCap } from './presentation';
import { marketRuleCards, presentCall, scrubFalseTheme, topUpLevel, type PresentInput } from './presentCall';

function input(partial: Partial<PresentInput> = {}): PresentInput {
  return {
    status: 'watch',
    verdict: 'Watch — stored sentence',
    role: 'tactical',
    pyramid: 'new',
    weight: 0,
    sleeve: 'Shares',
    gates: [
      { id: 'theme', pass: true, detail: 'No theme.' },
      { id: 'regime', pass: false, detail: 'the market mood must be Supportive' },
      { id: 'trend', pass: true, detail: 'Price is above its 200-day average.' },
      { id: 'momentum', pass: true, detail: 'Up 4.0% over the past year.' },
      { id: 'stretch', pass: true, detail: 'The last 5 days are not a sudden spike.' },
      { id: 'halt', pass: true, detail: 'Yes.' },
    ],
    themeOn: null,
    themeLabels: [],
    owned: false,
    entry: null,
    stop: null,
    currency: 'US$',
    actionable: true,
    atCap: false,
    ...partial,
  };
}

describe('display calls', () => {
  it('reads an owned name as Hold and shows the top-up level', () => {
    assert.equal(topUpLevel({ entry: 180, stop: 166.34, currency: 'US$' }), 'US$193.66');
    const call = presentCall(input({
      status: 'watch',
      verdict: 'Watch — 1 thing in the way: the market mood must be Supportive.',
      owned: true,
      pyramid: 'hold',
      entry: 180,
      stop: 166.34,
    }));
    assert.equal(call.label, 'Hold');
    assert.match(call.sentence, /Top up only above US\$193\.66/);
    assert.doesNotMatch(call.sentence, /Watch/);
  });

  it('does not say Buy when the feed failed or the book is full', () => {
    const feed = presentCall(input({ status: 'confirmed', weight: 0.022, owned: true, actionable: false, verdict: 'Buy — every check passed.' }));
    assert.equal(feed.label, 'Would buy');
    assert.match(feed.sentence, /Would buy, but blocked by: data feed failed/);
    assert.match(feed.sentence, /You already hold this/);
    const cap = presentCall(input({ status: 'confirmed', weight: 0.022, actionable: true, atCap: true }));
    assert.equal(cap.label, 'Would buy');
    assert.match(cap.sentence, /blocked by: at cap/);
    const both = presentCall(input({ status: 'confirmed', weight: 0.022, actionable: false, atCap: true }));
    assert.match(both.sentence, /data feed failed and at cap/);
    assert.equal(both.label, 'Would buy');
  });

  it('does not say a theme is on when that theme is off', () => {
    const scrubbed = scrubFalseTheme('Buy — every check passed. Scarcity is on. theme on.', false, ['Scarcity']);
    assert.doesNotMatch(scrubbed, /Scarcity is on/);
    assert.doesNotMatch(scrubbed, /theme on/i);
    assert.match(scrubbed, /Scarcity is off/);
    const call = presentCall(input({
      status: 'watch',
      themeOn: false,
      themeLabels: ['Scarcity'],
      verdict: 'Watch — Scarcity is on.',
      gates: [
        { id: 'theme', pass: true, detail: 'The Scarcity theme is off. Today’s lean still includes this group, so the theme is not a block.', themeState: 'off-allowed' },
        { id: 'regime', pass: true, detail: 'Allowed today (defensive).' },
        { id: 'trend', pass: false, detail: 'price is below its 200-day average. Scarcity is on.' },
        { id: 'momentum', pass: true, detail: 'Up 1%.' },
        { id: 'stretch', pass: true, detail: 'No spike.' },
        { id: 'halt', pass: true, detail: 'Yes.' },
      ],
    }));
    assert.equal(call.label, 'Watch');
    assert.doesNotMatch(call.sentence, /Scarcity is on|theme on/i);
    assert.match(call.sentence, /200-day/);
  });

  it('explains Avoid as the sleeve, including when the price checks pass', () => {
    const call = presentCall(input({
      status: 'avoid',
      sleeve: 'Shares',
      verdict: 'Avoid — on a no-clear-signal day the rules don\'t buy this group.',
    }));
    assert.equal(call.label, 'Avoid');
    assert.match(call.sentence, /Shares is not bought in this market mood/);
    assert.match(call.sentence, /own checks pass/);
    assert.doesNotMatch(call.sentence, /Watch/);
    const alsoFailing = presentCall(input({
      status: 'avoid',
      sleeve: 'Cyclicals',
      gates: [
        { id: 'regime', pass: false, detail: 'on a no-clear-signal day the rules don\'t buy this group' },
        { id: 'trend', pass: false, detail: 'price is below its 200-day average' },
      ],
    }));
    assert.match(alsoFailing.sentence, /Cyclicals is not bought/);
    assert.match(alsoFailing.sentence, /own checks are also in the way/);
  });

  it('marks the feed-failed card when buys are fail-closed, and Supportive when the mood is open', () => {
    const closed = marketRuleCards({ regime: 'transitional', actionable: false });
    assert.equal(closed.find((card) => card.active)?.id, 'feed');
    const open = marketRuleCards({ regime: 'risk_on', actionable: true });
    assert.equal(open.find((card) => card.active)?.id, 'supportive');
  });

  it('treats a full invested cap as no room, and does not invent one when the book value is missing', () => {
    assert.equal(nameIsAtCap({ role: 'tactical', invested: 0.401, maxGross: 0.4, nonCash: 0.1, maxNet: 0.2 }), true);
    assert.equal(nameIsAtCap({ role: 'tactical', invested: 0.2, maxGross: 0.4, nonCash: 0.2, maxNet: 0.2 }), true);
    assert.equal(nameIsAtCap({ role: 'cash', invested: 0.2, maxGross: 0.4, nonCash: 0.2, maxNet: 0.2 }), false);
    assert.equal(nameIsAtCap({ role: 'tactical', invested: null, maxGross: 0.4, nonCash: null, maxNet: 0.2 }), false);
  });
});
