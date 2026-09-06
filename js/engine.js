// Blackjack engine. Pure logic, no DOM. Works in browser and Node (ES module).
//
// Rules:
//   6 decks, cut card at ~75% penetration
//   dealer stands on soft 17, peeks for blackjack on A and 10
//   blackjack pays 3:2, insurance pays 2:1
//   double on any first two cards, double after split allowed
//   split up to 4 hands, on equal card VALUE (so K+10 splits)
//   split aces get one card each and are done; 21 there is not a blackjack
//
// Every action returns an ordered list of events for the UI to animate:
//   {type:'shuffle'}
//   {type:'card', to:'player', hand, card}      card dealt to hand index
//   {type:'card', to:'dealer', card, hidden}
//   {type:'reveal', card}                        hole card turns over
//   {type:'focus', hand}                         active hand moved
//   {type:'split', hand}                         hand split; a new one follows it
//   {type:'bet', hand, bet}                      bet changed (double)
//   {type:'insurance_offer'}                     dealer shows an ace
//   {type:'insurance', bet}                      insurance taken
//   {type:'insurance_result', won, payout}
//   {type:'result', hand, outcome, payout, net}
//   {type:'done', net}                           whole round settled
//
// outcome: 'blackjack' | 'win' | 'dealer_bust' | 'push' | 'lose' | 'bust'

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RULES = {
  decks: 6,
  penetration: 0.75,
  blackjackPays: 1.5,
  insurancePays: 2,
  dealerHitsSoft17: false,
  maxHands: 4,
  doubleAfterSplit: true,
  splitAcesOneCard: true,
  startBankroll: 3000,
  chips: [5, 25, 100, 500],
  minBet: 5
};

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return parseInt(rank, 10);
}

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return {
    total,
    soft: aces > 0 && total <= 21,
    bust: total > 21,
    twentyOne: total === 21,
    pair: cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank)
  };
}

// A blackjack is 21 on the first two cards of a hand that was never split.
export function isBlackjack(hand) {
  return !hand.split && hand.cards.length === 2 && handValue(hand.cards).total === 21;
}

export function createShoe(decks = RULES.decks, rng = Math.random) {
  const cards = [];
  for (let d = 0; d < decks; d++)
    for (const s of SUITS)
      for (const r of RANKS) cards.push({ rank: r, suit: s });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function newHand(bet, split = false) {
  return { cards: [], bet, split, doubled: false, aces: false, done: false, outcome: null, payout: 0 };
}

export class Game {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;
    this.rules = Object.assign({}, RULES, opts.rules || {});
    this.bankroll = opts.bankroll != null ? opts.bankroll : this.rules.startBankroll;
    this.shoe = [];
    this.cutCard = 0;
    this.needsShuffle = true;
    this.phase = 'betting';   // betting | insurance | player | dealer | settled
    this.bet = 0;             // pending bet while betting
    this.hands = [];
    this.active = 0;
    this.dealer = [];
    this.holeHidden = false;
    this.insuranceBet = 0;
    this.insuranceResult = null;
    this.roundNet = 0;
    this.stats = Object.assign(
      { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, peak: this.bankroll, best: 0, wagered: 0, net: 0,
        streak: 0, bestWinStreak: 0, bestLoseStreak: 0 },
      opts.stats || {}
    );
  }

  // ---- shoe ----
  shuffle() {
    this.shoe = createShoe(this.rules.decks, this.rng);
    this.cutCard = Math.floor(this.shoe.length * (1 - this.rules.penetration));
    this.needsShuffle = false;
  }
  draw() {
    if (this.shoe.length === 0) this.shuffle();
    const c = this.shoe.pop();
    if (this.shoe.length <= this.cutCard) this.needsShuffle = true;
    return c;
  }
  get cardsLeft() { return this.shoe.length; }
  get hand() { return this.hands[this.active] || null; }
  get totalStaked() { return this.hands.reduce((s, h) => s + h.bet, 0) + this.insuranceBet; }

  // ---- betting ----
  canBet(amount) { return this.phase === 'betting' && amount > 0 && this.bet + amount <= this.bankroll; }
  addBet(amount) { if (!this.canBet(amount)) return false; this.bet += amount; return true; }
  clearBet() { if (this.phase !== 'betting') return false; this.bet = 0; return true; }
  // taking a chip back off the table: the bet never goes below zero, and a chip
  // larger than what is out simply clears it
  canRemoveBet(amount) { return this.phase === 'betting' && this.bet > 0 && amount > 0; }
  removeBet(amount) { if (!this.canRemoveBet(amount)) return false; this.bet = Math.max(0, this.bet - amount); return true; }
  canDoubleBet() { return this.phase === 'betting' && this.bet > 0 && this.bet * 2 <= this.bankroll; }
  doubleBet() { if (!this.canDoubleBet()) return false; this.bet *= 2; return true; }
  // the whole bankroll, rounded down to something the chips can actually make:
  // a blackjack on an odd bet pays a half unit, so the bankroll is not always round
  maxBetAmount() { return Math.floor(this.bankroll / this.rules.minBet) * this.rules.minBet; }
  canMaxBet() { return this.phase === 'betting' && this.maxBetAmount() >= this.rules.minBet && this.bet !== this.maxBetAmount(); }
  maxBet() { if (!this.canMaxBet()) return false; this.bet = this.maxBetAmount(); return true; }
  canDeal() { return this.phase === 'betting' && this.bet >= this.rules.minBet && this.bet <= this.bankroll; }

  // ---- deal ----
  deal() {
    if (!this.canDeal()) return [];
    const ev = [];
    if (this.needsShuffle) { this.shuffle(); ev.push({ type: 'shuffle' }); }
    this.bankroll -= this.bet;
    this.stats.wagered += this.bet;
    this.hands = [newHand(this.bet)];
    this.active = 0;
    this.dealer = [];
    this.insuranceBet = 0;
    this.insuranceResult = null;
    this.roundNet = 0;
    this.holeHidden = true;
    this.phase = 'player';

    const h = this.hands[0];
    h.cards.push(this.draw()); ev.push({ type: 'card', to: 'player', hand: 0, card: h.cards[0] });
    this.dealer.push(this.draw()); ev.push({ type: 'card', to: 'dealer', card: this.dealer[0], hidden: false });
    h.cards.push(this.draw()); ev.push({ type: 'card', to: 'player', hand: 0, card: h.cards[1] });
    this.dealer.push(this.draw()); ev.push({ type: 'card', to: 'dealer', card: this.dealer[1], hidden: true });

    if (this.dealer[0].rank === 'A' && this.bankroll >= Math.floor(this.bet / 2)) {
      this.phase = 'insurance';
      ev.push({ type: 'insurance_offer' });
      return ev;
    }
    ev.push(...this.afterPeek());
    return ev;
  }

  // Dealer peeks under an ace or a ten. If there is a blackjack the round is over.
  afterPeek() {
    const ev = [];
    const up = this.dealer[0].rank;
    const peeks = up === 'A' || cardValue(up) === 10;
    const dealerBJ = handValue(this.dealer).total === 21;
    if (peeks && dealerBJ) {
      ev.push(...this.reveal());
      if (this.insuranceBet > 0) {
        const payout = this.insuranceBet * (1 + this.rules.insurancePays);
        this.bankroll += payout;
        this.insuranceResult = { won: true, payout };
        ev.push({ type: 'insurance_result', won: true, payout });
      }
      ev.push(...this.settleAll());
      return ev;
    }
    if (this.insuranceBet > 0) {
      this.insuranceResult = { won: false, payout: 0 };
      ev.push({ type: 'insurance_result', won: false, payout: 0 });
    }
    if (isBlackjack(this.hands[0])) {
      ev.push(...this.reveal());
      ev.push(...this.settleAll());
      return ev;
    }
    this.phase = 'player';
    ev.push({ type: 'focus', hand: 0 });
    return ev;
  }

  // ---- insurance ----
  get insuranceCost() { return Math.floor(this.hands[0] ? this.hands[0].bet / 2 : 0); }
  canInsure() { return this.phase === 'insurance' && this.bankroll >= this.insuranceCost; }
  takeInsurance(yes) {
    if (this.phase !== 'insurance') return [];
    const ev = [];
    if (yes && this.canInsure()) {
      this.insuranceBet = this.insuranceCost;
      this.bankroll -= this.insuranceBet;
      this.stats.wagered += this.insuranceBet;
      ev.push({ type: 'insurance', bet: this.insuranceBet });
    }
    ev.push(...this.afterPeek());
    return ev;
  }

  // ---- player actions ----
  canHit() { return this.phase === 'player' && !!this.hand && !this.hand.done; }
  canStand() { return this.canHit(); }
  canDouble() {
    const h = this.hand;
    return this.phase === 'player' && !!h && !h.done && h.cards.length === 2 &&
      this.bankroll >= h.bet && (!h.split || this.rules.doubleAfterSplit);
  }
  canSplit() {
    const h = this.hand;
    return this.phase === 'player' && !!h && !h.done && h.cards.length === 2 &&
      handValue(h.cards).pair && this.hands.length < this.rules.maxHands && this.bankroll >= h.bet;
  }

  hit() {
    if (!this.canHit()) return [];
    const ev = [];
    const h = this.hand;
    const card = this.draw();
    h.cards.push(card);
    ev.push({ type: 'card', to: 'player', hand: this.active, card });
    const v = handValue(h.cards);
    if (v.bust || v.total === 21) { h.done = true; ev.push(...this.advance()); }
    return ev;
  }

  stand() {
    if (!this.canStand()) return [];
    this.hand.done = true;
    return this.advance();
  }

  double() {
    if (!this.canDouble()) return [];
    const ev = [];
    const h = this.hand;
    this.bankroll -= h.bet;
    this.stats.wagered += h.bet;
    h.bet *= 2;
    h.doubled = true;
    ev.push({ type: 'bet', hand: this.active, bet: h.bet });
    const card = this.draw();
    h.cards.push(card);
    ev.push({ type: 'card', to: 'player', hand: this.active, card });
    h.done = true;
    ev.push(...this.advance());
    return ev;
  }

  split() {
    if (!this.canSplit()) return [];
    const ev = [];
    const h = this.hand;
    const moved = h.cards.pop();
    const nh = newHand(h.bet, true);
    nh.cards.push(moved);
    h.split = true;
    const acesSplit = moved.rank === 'A';
    h.aces = nh.aces = acesSplit;
    this.bankroll -= h.bet;
    this.stats.wagered += h.bet;
    this.hands.splice(this.active + 1, 0, nh);
    ev.push({ type: 'split', hand: this.active });

    const c1 = this.draw(); h.cards.push(c1);
    ev.push({ type: 'card', to: 'player', hand: this.active, card: c1 });
    const c2 = this.draw(); nh.cards.push(c2);
    ev.push({ type: 'card', to: 'player', hand: this.active + 1, card: c2 });

    if (acesSplit && this.rules.splitAcesOneCard) {
      h.done = true; nh.done = true;
      ev.push(...this.advance());
    } else {
      if (handValue(h.cards).total === 21) { h.done = true; ev.push(...this.advance()); }
      else ev.push({ type: 'focus', hand: this.active });
    }
    return ev;
  }

  // move to the next unfinished hand, or hand over to the dealer
  advance() {
    const ev = [];
    for (let i = this.active + 1; i < this.hands.length; i++) {
      if (!this.hands[i].done) {
        this.active = i;
        ev.push({ type: 'focus', hand: i });
        return ev;
      }
    }
    this.phase = 'dealer';
    ev.push(...this.reveal());
    ev.push(...this.dealerPlay());
    ev.push(...this.settleAll());
    return ev;
  }

  reveal() {
    if (!this.holeHidden) return [];
    this.holeHidden = false;
    return [{ type: 'reveal', card: this.dealer[1] }];
  }

  // the dealer only draws when a hand still needs to be compared
  needsDealer() {
    return this.hands.some(h => !handValue(h.cards).bust && !isBlackjack(h));
  }

  dealerPlay() {
    const ev = [];
    if (!this.needsDealer()) return ev;
    for (;;) {
      const d = handValue(this.dealer);
      const mustHit = d.total < 17 || (d.total === 17 && d.soft && this.rules.dealerHitsSoft17);
      if (!mustHit) break;
      const card = this.draw();
      this.dealer.push(card);
      ev.push({ type: 'card', to: 'dealer', card, hidden: false });
    }
    return ev;
  }

  settleAll() {
    const ev = [];
    const d = handValue(this.dealer);
    const dealerBJ = this.dealer.length === 2 && d.total === 21;
    let net = 0;
    this.hands.forEach((h, i) => {
      const p = handValue(h.cards);
      const bj = isBlackjack(h);
      let outcome, payout = 0;
      if (p.bust) outcome = 'bust';
      else if (bj && dealerBJ) { outcome = 'push'; payout = h.bet; }
      else if (bj) { outcome = 'blackjack'; payout = h.bet + h.bet * this.rules.blackjackPays; }
      else if (dealerBJ) outcome = 'lose';
      else if (d.bust) { outcome = 'dealer_bust'; payout = h.bet * 2; }
      else if (p.total > d.total) { outcome = 'win'; payout = h.bet * 2; }
      else if (p.total < d.total) outcome = 'lose';
      else { outcome = 'push'; payout = h.bet; }

      h.outcome = outcome; h.payout = payout; h.done = true;
      this.bankroll += payout;
      const hNet = payout - h.bet;
      net += hNet;

      this.stats.hands++;
      if (outcome === 'push') this.stats.pushes++;
      else if (payout > h.bet) { this.stats.wins++; if (outcome === 'blackjack') this.stats.blackjacks++; }
      else this.stats.losses++;

      ev.push({ type: 'result', hand: i, outcome, payout, net: hNet });
    });
    if (this.insuranceBet > 0) net += (this.insuranceResult ? this.insuranceResult.payout : 0) - this.insuranceBet;
    this.roundNet = net;
    this.stats.net += net;
    // streaks count ROUNDS, not hands: a split that wins one and loses one is
    // neither a win nor a loss to the player, and breaking the streak there
    // would not match what they saw happen
    const s = this.stats;
    if (net > 0) s.streak = s.streak > 0 ? s.streak + 1 : 1;
    else if (net < 0) s.streak = s.streak < 0 ? s.streak - 1 : -1;
    else s.streak = 0;
    s.bestWinStreak = Math.max(s.bestWinStreak, s.streak);
    s.bestLoseStreak = Math.min(s.bestLoseStreak, s.streak);
    this.stats.peak = Math.max(this.stats.peak, this.bankroll);
    this.stats.best = Math.max(this.stats.best, net);
    this.phase = 'settled';
    ev.push({ type: 'done', net });
    return ev;
  }

  nextHand() {
    if (this.phase !== 'settled') return false;
    this.phase = 'betting';
    this.hands = [];
    this.dealer = [];
    this.active = 0;
    this.holeHidden = false;
    this.insuranceBet = 0;
    this.insuranceResult = null;
    if (this.bet > this.bankroll) this.bet = this.bankroll >= this.rules.minBet ? this.bankroll : 0;
    return true;
  }

  resetBankroll() {
    this.bankroll = this.rules.startBankroll;
    this.bet = 0;
    this.phase = 'betting';
    this.hands = [];
    this.dealer = [];
    this.stats.peak = Math.max(this.stats.peak, this.bankroll);
    return true;
  }

  resetStats() {
    this.stats = { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, peak: this.bankroll, best: 0, wagered: 0, net: 0,
      streak: 0, bestWinStreak: 0, bestLoseStreak: 0 };
  }
}
