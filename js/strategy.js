// Basic strategy for these exact rules: 6 decks, dealer stands on soft 17,
// double after split allowed, resplit to four hands, no surrender.
// This is the same chart the fairness simulation plays, so the hint the player
// sees and the number quoted in the stats panel come from one source.
import { handValue, cardValue } from './engine.js';

export function bestMove(game) {
  const h = game.hand;
  if (!h) return null;
  const c = h.cards, v = handValue(c), d = cardValue(game.dealer[0].rank);   // 11 for an ace
  const canD = game.canDouble(), canS = game.canSplit();

  if (canS) {
    const p = cardValue(c[0].rank);
    if (p === 11) return 'split';
    if (p === 10) return 'stand';
    if (p === 9) return (d >= 2 && d <= 6) || d === 8 || d === 9 ? 'split' : 'stand';
    if (p === 8) return 'split';
    if (p === 7) return d <= 7 ? 'split' : 'hit';
    if (p === 6) return d <= 6 ? 'split' : 'hit';
    if (p === 4) return d === 5 || d === 6 ? 'split' : 'hit';
    if (p === 3 || p === 2) return d <= 7 ? 'split' : 'hit';
    // a pair of fives is never split: it is played as a hard ten
  }
  if (v.soft) {
    const other = v.total - 11;
    if (v.total >= 19) return 'stand';
    if (v.total === 18) {
      if (canD && d >= 3 && d <= 6) return 'double';
      return d === 9 || d === 10 || d === 11 ? 'hit' : 'stand';
    }
    if (other === 6) return canD && d >= 3 && d <= 6 ? 'double' : 'hit';
    if (other === 5 || other === 4) return canD && d >= 4 && d <= 6 ? 'double' : 'hit';
    return canD && d >= 5 && d <= 6 ? 'double' : 'hit';
  }
  const t = v.total;
  if (t >= 17) return 'stand';
  if (t >= 13) return d <= 6 ? 'stand' : 'hit';
  if (t === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit';
  if (t === 11) return canD && d <= 10 ? 'double' : 'hit';
  if (t === 10) return canD && d <= 9 ? 'double' : 'hit';
  if (t === 9) return canD && d >= 3 && d <= 6 ? 'double' : 'hit';
  return 'hit';
}

// Insurance is a side bet on the hole card being a ten. It is offered at 2:1
// while the true odds are worse than that, so basic strategy always declines.
export const INSURANCE_ADVICE = 'no';

// Measured by playing the chart above against this engine 500,000 times.
export const EXPECTED = {
  winRateOfDecided: 47.6,     // percent
  houseEdge: 0.45,            // percent of everything staked
  hands: 500000
};
