import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { melbourneDate, sydneyClock } from './time';

describe('Sydney clock', () => {
  it('turns 13:15 UTC on 18 Nov into 12:15:30 am AEDT on 19 Nov', () => {
    const shown = sydneyClock('2026-11-18T13:15:30.000Z');
    assert.equal(shown, '19 Nov 2026, 12:15:30 am AEDT');
    assert.equal(shown.includes('1:15 pm'), false);
    assert.equal(shown.includes('18 Nov'), false);
  });

  it('turns the next 13:15 UTC slot into 12:15:30 am AEDT on 20 Nov', () => {
    assert.equal(sydneyClock('2026-11-19T13:15:30.000Z'), '20 Nov 2026, 12:15:30 am AEDT');
  });

  it('uses AEST when Sydney is on the +10 offset', () => {
    assert.equal(sydneyClock('2026-06-15T02:00:00.000Z'), '15 June 2026, 12:00:00 pm AEST');
  });

  it('keeps the engine today on the Melbourne calendar of that instant', () => {
    assert.equal(melbourneDate(new Date('2026-11-18T13:15:30.000Z')), '2026-11-19');
  });
});
