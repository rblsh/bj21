// node test/engine.test.mjs
import { Game, handValue, isBlackjack, createShoe } from '../js/engine.js';

let fails = 0;
function eq(a, b, msg) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) { fails++; console.log('FAIL', msg, '\n  got', JSON.stringify(a), '\n  want', JSON.stringify(b)); }
  else console.log('ok  ', msg);
}
const C = (rank, suit = 'S') => ({ rank, suit });
const last = ev => ev[ev.length - 1];
const outcomes = ev => ev.filter(e => e.type === 'result').map(e => e.outcome);

// rigged game: the shoe pops from the END, so list cards in deal order
function rigged(cards, bankroll = 1000) {
  const g = new Game({ bankroll });
  g.shoe = cards.slice().reverse();
  g.cutCard = -1;
  g.needsShuffle = false;
  return g;
}

// ---------------- hand values ----------------
eq(handValue([C('A'), C('K')]).total, 21, 'A+K = 21');
eq(handValue([C('A'), C('A')]).total, 12, 'A+A = 12');
eq(handValue([C('A'), C('6')]).soft, true, 'soft 17');
eq(handValue([C('A'), C('6'), C('10')]).total, 17, 'A+6+10 hard 17');
eq(handValue([C('K'), C('Q'), C('5')]).bust, true, 'bust');
eq(handValue([C('K'), C('10')]).pair, true, 'K+10 is a splittable pair by value');
eq(handValue([C('9'), C('10')]).pair, false, '9+10 is not a pair');
eq(isBlackjack({ cards: [C('A'), C('K')], split: false }), true, 'natural blackjack');
eq(isBlackjack({ cards: [C('A'), C('K')], split: true }), false, '21 after a split is not a blackjack');
eq(createShoe(6, () => 0.5).length, 312, '6 decks = 312 cards');

// ---------------- basic outcomes ----------------
{ // deal order is player, dealer, player, dealer
  const g = rigged([C('A'), C('9'), C('K'), C('7')]);
  g.addBet(100);
  const ev = g.deal();
  eq(outcomes(ev), ['blackjack'], 'player blackjack');
  eq(g.bankroll, 1150, 'blackjack pays 3:2');
  eq(last(ev), { type: 'done', net: 150 }, 'round net');
}
{
  const g = rigged([C('A'), C('K'), C('K'), C('A')]);
  g.addBet(100); const ev = g.deal();   // dealer upcard is a king, so no insurance is offered
  eq(outcomes(ev), ['push'], 'blackjack against blackjack pushes');
  eq(g.bankroll, 1000, 'push returns the stake');
}
{ // dealer blackjack under a ten: no insurance offered, hand ends at once
  const g = rigged([C('9'), C('K'), C('9'), C('A')]);
  g.addBet(50); const ev = g.deal();
  eq(outcomes(ev), ['lose'], 'dealer blackjack under a ten');
  eq(ev.some(e => e.type === 'reveal'), true, 'hole card revealed');
  eq(g.bankroll, 950, 'stake lost');
}
{
  const g = rigged([C('10'), C('6'), C('5'), C('10'), C('9')]);
  g.addBet(100); g.deal();
  const ev = g.hit();
  eq(outcomes(ev), ['bust'], 'bust on hit');
  eq(g.bankroll, 900, 'bust loses the stake');
}
{
  const g = rigged([C('10'), C('6'), C('8'), C('A')]);   // dealer 6+A = soft 17
  g.addBet(100); g.deal();
  const ev = g.stand();
  eq(g.dealer.length, 2, 'dealer stands on soft 17');
  eq(outcomes(ev), ['win'], '18 beats soft 17');
  eq(g.bankroll, 1100, 'win pays 1:1');
}
{
  const g = rigged([C('10'), C('10'), C('8'), C('6'), C('9')]);
  g.addBet(100); g.deal();
  const ev = g.stand();
  eq(g.dealer.length, 3, 'dealer hits 16');
  eq(outcomes(ev), ['dealer_bust'], 'dealer busts');
  eq(g.bankroll, 1100, 'dealer bust pays 1:1');
}
{ // player blackjack, dealer shows a ten but has no blackjack: dealer must not draw
  const g = rigged([C('A'), C('K'), C('K'), C('7')]);
  g.addBet(100); const ev = g.deal();
  eq(g.dealer.length, 2, 'dealer does not draw against a lone blackjack');
  eq(outcomes(ev), ['blackjack'], 'blackjack paid');
}

// ---------------- double ----------------
{
  const g = rigged([C('5'), C('10'), C('6'), C('7'), C('10')]);   // player 11, dealer 17
  g.addBet(100); g.deal();
  eq(g.canDouble(), true, 'double on two cards');
  const ev = g.double();
  eq(ev[0], { type: 'bet', hand: 0, bet: 200 }, 'bet doubled');
  eq(g.hands[0].cards.length, 3, 'exactly one card on double');
  eq(g.canHit(), false, 'no hit after double');
  eq(outcomes(ev), ['win'], '21 beats 17 after double');
  eq(g.bankroll, 1200, 'double win pays 200');
}
{
  const g = rigged([C('5'), C('10'), C('6'), C('7')], 100);
  g.addBet(100); g.deal();
  eq(g.canDouble(), false, 'no double without the bankroll for it');
}

// ---------------- split ----------------
{ // 8,8 vs 9: split, first hand 8+3=11 hit to 21, second 8+10=18; dealer 9+7=16, draws 5 -> 21
  const g = rigged([C('8'), C('9'), C('8'), C('7'), /*split draws*/ C('3'), C('10'), /*hit*/ C('10'), /*dealer*/ C('5')]);
  g.addBet(100); g.deal();
  eq(g.canSplit(), true, 'pair can be split');
  const ev = g.split();
  eq(g.hands.length, 2, 'two hands after split');
  eq(g.hands[0].cards.map(c => c.rank), ['8', '3'], 'first hand keeps one card and draws');
  eq(g.hands[1].cards.map(c => c.rank), ['8', '10'], 'second hand takes the moved card and draws');
  eq(g.bankroll, 800, 'second bet taken from the bankroll');
  eq(g.active, 0, 'play continues on the first hand');
  eq(last(ev), { type: 'focus', hand: 0 }, 'focus stays on the first hand');
  const ev2 = g.hit();            // 8+3+10 = 21 -> auto-stand, moves to hand 2
  eq(g.hands[0].done, true, '21 finishes the first hand');
  eq(last(ev2), { type: 'focus', hand: 1 }, 'focus moves to the second hand');
  const ev3 = g.stand();          // dealer 16 -> draws 5 -> 21
  eq(outcomes(ev3), ['push', 'lose'], '21 pushes, 18 loses to 21');
  eq(g.bankroll, 900, 'push returns one stake, the other is lost');
}
{ // split aces: one card each, both done immediately
  const g = rigged([C('A'), C('10'), C('A'), C('7'), C('K'), C('5')]);   // dealer 17
  g.addBet(100); g.deal();
  const ev = g.split();
  eq(g.hands.map(h => h.cards.length), [2, 2], 'one card to each split ace');
  eq(g.hands.map(h => h.done), [true, true], 'split aces are done at once');
  eq(isBlackjack(g.hands[0]), false, 'A+K after a split is 21, not a blackjack');
  eq(outcomes(ev), ['win', 'lose'], '21 wins, soft 16 loses to 17');
  eq(g.bankroll, 1000, '+200 on one hand, -100 on the other');
}
{ // resplit up to four hands, then the cap holds
  const g = rigged([C('8'), C('9'), C('8'), C('7'), C('8'), C('8'), C('8'), C('8'), C('2')]);
  g.addBet(100); g.deal();
  g.split(); eq(g.hands.length, 2, 'split 1');
  eq(g.canSplit(), true, 'the new pair can be split again');
  g.split(); eq(g.hands.length, 3, 'split 2');
  g.split(); eq(g.hands.length, 4, 'split 3');
  eq(g.canSplit(), false, 'four hands is the cap');
  eq(g.bankroll, 600, 'four bets staked: 1000 - 100 - three splits');
}
{ // double after split
  const g = rigged([C('5'), C('9'), C('5'), C('7'), C('6'), C('6'), C('10'), C('10'), C('10')]);
  g.addBet(100); g.deal(); g.split();
  eq(g.canDouble(), true, 'double after split allowed');
  const ev = g.double();
  eq(g.hands[0].bet, 200, 'first hand doubled');
  eq(last(ev), { type: 'focus', hand: 1 }, 'focus moves on after doubling');
}
{ // no split without the bankroll
  const g = rigged([C('8'), C('9'), C('8'), C('7')], 100);
  g.addBet(100); g.deal();
  eq(g.canSplit(), false, 'no split without the bankroll for it');
}

// ---------------- insurance ----------------
{ // dealer ace + ten: insurance wins, hand loses, net zero
  const g = rigged([C('9'), C('A'), C('8'), C('K')]);
  g.addBet(100);
  const ev = g.deal();
  eq(g.phase, 'insurance', 'insurance offered on a dealer ace');
  eq(last(ev), { type: 'insurance_offer' }, 'offer event');
  eq(g.insuranceCost, 50, 'insurance costs half the bet');
  const ev2 = g.takeInsurance(true);
  eq(ev2.find(e => e.type === 'insurance_result').payout, 150, 'insurance pays 2:1 plus the stake');
  eq(outcomes(ev2), ['lose'], 'the hand still loses to the blackjack');
  eq(g.bankroll, 1000, 'insurance exactly covers the loss');
  eq(last(ev2).net, 0, 'round net is zero');
}
{ // dealer ace, no blackjack: insurance is lost, play continues
  const g = rigged([C('9'), C('A'), C('8'), C('7'), C('4')]);
  g.addBet(100); g.deal();
  const ev = g.takeInsurance(true);
  eq(ev.find(e => e.type === 'insurance_result').won, false, 'insurance lost');
  eq(g.phase, 'player', 'play continues');
  eq(g.bankroll, 850, 'stake and insurance are both out');
  const ev2 = g.stand();          // player 17, dealer A+7 = soft 18, stands
  eq(outcomes(ev2), ['lose'], '17 loses to soft 18');
  eq(last(ev2).net, -150, 'net counts the insurance too');
}
{ // declining insurance leaves the bankroll alone
  const g = rigged([C('9'), C('A'), C('8'), C('7'), C('4')]);
  g.addBet(100); g.deal();
  g.takeInsurance(false);
  eq(g.insuranceBet, 0, 'no insurance taken');
  eq(g.bankroll, 900, 'only the hand is staked');
}
{ // player blackjack against a dealer ace: even money is declined, dealer has no BJ
  const g = rigged([C('A'), C('A'), C('K'), C('7')]);
  g.addBet(100); g.deal();
  const ev = g.takeInsurance(false);
  eq(outcomes(ev), ['blackjack'], 'blackjack paid after the peek');
  eq(g.bankroll, 1150, '3:2');
}
{ // insurance is not offered when the bankroll cannot cover it
  const g = rigged([C('9'), C('A'), C('8'), C('K')], 100);
  g.addBet(100); const ev = g.deal();
  eq(g.phase, 'settled', 'no insurance offer without the money for it');
  eq(outcomes(ev), ['lose'], 'hand resolves straight away');
}

// ---------------- bet guards and flow ----------------
{
  const g = new Game({ bankroll: 30 });
  eq(g.addBet(25), true, 'bet within the bankroll');
  eq(g.addBet(25), false, 'bet beyond the bankroll refused');
  eq(g.canDeal(), true, 'can deal');
  g.deal();
  eq(g.addBet(5), false, 'no betting mid-hand');
}
{
  const g = rigged([C('10'), C('6'), C('5'), C('10'), C('9')], 100);
  g.addBet(100); g.deal(); g.hit();
  eq(g.bankroll, 0, 'broke');
  g.nextHand();
  eq(g.bet, 0, 'bet cleared when it is no longer affordable');
  eq(g.phase, 'betting', 'back to betting');
}
{
  const g = new Game();
  g.shuffle();
  g.shoe.length = g.cutCard + 1;
  g.addBet(5); g.deal();
  eq(g.needsShuffle, true, 'cut card reached');
  while (g.phase === 'player') g.stand();
  if (g.phase === 'insurance') g.takeInsurance(false);
  while (g.phase === 'player') g.stand();
  g.nextHand(); g.addBet(5);
  eq(g.deal()[0].type, 'shuffle', 'shoe reshuffled before the next hand');
}

// ---------------- stats ----------------
{
  const g = rigged([C('A'), C('9'), C('K'), C('7')]);
  g.addBet(100); g.deal();
  eq(g.stats.hands, 1, 'hand counted');
  eq(g.stats.wins, 1, 'win counted');
  eq(g.stats.blackjacks, 1, 'blackjack counted');
  eq(g.stats.peak, 1150, 'peak bankroll tracked');
  eq(g.stats.net, 150, 'net tracked');
  eq(g.stats.wagered, 100, 'wagered tracked');
}

// ---------------- random smoke ----------------
{
  const g = new Game({ bankroll: 1e9 });
  for (let i = 0; i < 3000; i++) {
    g.addBet(10); g.deal();
    if (g.phase === 'insurance') g.takeInsurance(Math.random() < 0.3);
    let guard = 0;
    while (g.phase === 'player') {
      if (++guard > 40) { fails++; console.log('FAIL player phase never ends'); break; }
      const r = Math.random();
      if (r < 0.15 && g.canSplit()) g.split();
      else if (r < 0.25 && g.canDouble()) g.double();
      else if (r < 0.6) g.hit();
      else g.stand();
    }
    if (g.phase !== 'settled') { fails++; console.log('FAIL phase', g.phase); break; }
    const d = handValue(g.dealer);
    if (g.needsDealer() && !d.bust && d.total < 17) { fails++; console.log('FAIL dealer stopped under 17', g.dealer); break; }
    for (const h of g.hands) if (!h.outcome) { fails++; console.log('FAIL hand left unsettled'); break; }
    g.nextHand();
  }
  const s = g.stats;
  if (s.hands !== s.wins + s.losses + s.pushes) { fails++; console.log('FAIL stats do not add up', s); }
  console.log('ok   smoke 3000 rounds,', s.hands, 'hands settled');
}


// ---------------- streaks ----------------
{
  const g = new Game({ bankroll: 1e6 });
  const win = () => { const x = rigged([C('A'), C('9'), C('K'), C('7')]); x.stats = g.stats; x.addBet(10); x.deal(); };
  const lose = () => { const x = rigged([C('9'), C('K'), C('9'), C('A')]); x.stats = g.stats; x.addBet(10); x.deal(); };
  win(); win(); win();
  eq(g.stats.streak, 3, 'three wins in a row');
  lose();
  eq(g.stats.streak, -1, 'a loss flips the streak');
  lose(); lose();
  eq(g.stats.streak, -3, 'three losses in a row');
  eq(g.stats.bestWinStreak, 3, 'best win streak kept');
  eq(g.stats.bestLoseStreak, -3, 'worst losing streak kept');
}


// ---------------- bet shortcuts ----------------
{
  const g = new Game({ bankroll: 1000 });
  eq(g.canDoubleBet(), false, 'nothing to double with no bet');
  g.addBet(25);
  eq(g.doubleBet() && g.bet, 50, 'x2 doubles the bet');
  g.doubleBet(); g.doubleBet(); g.doubleBet();
  eq(g.bet, 400, 'x2 compounds');
  eq(g.canDoubleBet(), true, '800 still fits in a 1000 bankroll');
  g.doubleBet();
  eq(g.bet, 800, 'x2 up to the bankroll');
  eq(g.canDoubleBet(), false, '1600 does not fit');
}
{
  const g = new Game({ bankroll: 600 });
  g.addBet(400);
  eq(g.canDoubleBet(), false, 'x2 refused when it would exceed the bankroll');
  eq(g.maxBet() && g.bet, 600, 'max puts the whole bankroll out');
  eq(g.canMaxBet(), false, 'max is spent once the bet is already the maximum');
}
{ // a blackjack on an odd bet leaves a half unit: max must stay chip-sized
  const g = new Game({ bankroll: 1012.5 });
  g.maxBet();
  eq(g.bet, 1010, 'max rounds down to a multiple of the minimum bet');
  eq(g.canDeal(), true, 'and the rounded bet is dealable');
}
{
  const g = new Game({ bankroll: 3 });
  eq(g.canMaxBet(), false, 'no max below the table minimum');
}
{ // chips come off the bet one at a time, and never below zero
  const g = new Game({ bankroll: 1000 });
  g.addBet(500); g.addBet(25);
  eq(g.removeBet(25) && g.bet, 500, 'a chip comes back off the bet');
  eq(g.removeBet(5000) && g.bet, 0, 'removing more than is out clears the bet');
  eq(g.canRemoveBet(5), false, 'nothing to take back off an empty spot');
}
{
  const g = rigged([C('10'), C('6'), C('8'), C('A')]);
  g.addBet(25); g.deal();
  eq(g.removeBet(5), false, 'no chip comes off mid-hand');
}
{
  const g = rigged([C('10'), C('6'), C('8'), C('A')]);
  g.addBet(25); g.deal();
  eq(g.canDoubleBet(), false, 'no bet shortcuts mid-hand');
  eq(g.maxBet(), false, 'max refused mid-hand');
}

console.log(fails ? `\n${fails} failing` : '\nall passed');
process.exit(fails ? 1 : 0);
