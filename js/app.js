import { Game, handValue, isBlackjack, RULES } from './engine.js';
import { Spring, wait, reducedMotion } from './spring.js';
import { sound, setEnabled as setSound, isEnabled as soundOn, unlock } from './sound.js';
import { bestMove, INSURANCE_ADVICE, EXPECTED } from './strategy.js';

const $ = id => document.getElementById(id);
const els = {
  table: $('table'), shoe: $('shoe'), shoeLeft: $('shoeLeft'),
  dealerCards: $('dealerCards'), dealerScore: $('dealerScore'),
  hands: $('hands'),
  result: $('result'), betSpot: $('betSpot'), betStack: $('betStack'), betVal: $('betVal'),
  insChips: $('insChips'), insBox: $('insBox'), insVal: $('insVal'), insBadge: $('insBadge'),
  bankroll: $('bankroll'),
  uiBet: $('uiBet'), uiDeal: $('uiDeal'), uiPlay: $('uiPlay'), uiIns: $('uiIns'),
  uiNext: $('uiNext'), uiBroke: $('uiBroke'),
  btnClear: $('btnClear'), btnDeal: $('btnDeal'), btnX2: $('btnX2'), btnMax: $('btnMax'), btnHit: $('btnHit'), btnStand: $('btnStand'),
  btnDouble: $('btnDouble'), btnSplit: $('btnSplit'), btnInsYes: $('btnInsYes'), btnInsNo: $('btnInsNo'),
  btnNext: $('btnNext'), btnReset: $('btnReset'),
  hint: $('hint'), toast: $('toast'),
  themeSeg: $('themeSeg'), themeKnob: $('themeKnob'), btnSound: $('btnSound'), tools: document.querySelector('.tools'),
  btnHelp: $('btnHelp'), btnStats: $('btnStats'), btnHint: $('btnHint'),
  scrim: $('scrim'), sheet: $('sheet'), sheetTitle: $('sheetTitle'), sheetBody: $('sheetBody'),
  sheetClose: $('sheetClose')
};

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

// ---------- cards ----------
const SUIT_PATH = {
  S: 'M12 2C9 6 4 9 4 13.5A4 4 0 0 0 11 16c-.2 1.8-1 3.2-2.5 4h7c-1.5-.8-2.3-2.2-2.5-4a4 4 0 0 0 7-2.5C20 9 15 6 12 2z',
  H: 'M12 21s-7-4.6-9.3-8.7C.6 8.5 3 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 4 0 6.4 4.5 4.3 8.3C19 16.4 12 21 12 21z',
  D: 'M12 2l7 10-7 10-7-10z',
  C: 'M12 2a3.5 3.5 0 0 0-3.2 4.9A3.5 3.5 0 1 0 10.7 13c-.1 2.7-1 4.4-2.7 5h8c-1.7-.6-2.6-2.3-2.7-5a3.5 3.5 0 1 0 1.9-6.1A3.5 3.5 0 0 0 12 2z'
};
const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const RANK_NAME = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
const suitSvg = s => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${SUIT_PATH[s]}" fill="currentColor"/></svg>`;

// A court card used to differ from a number card by one letter in the corner.
// Each rank now carries a drawn figure: a spiked crown and a beard for the king,
// a lobed tiara and long hair for the queen, a plumed cap and an open collar for
// the jack. One figure rather than the mirrored pair a printed deck uses - at a
// 66px card the mirrored halves are too small to read as anything. It stays
// inside x 24..85 and y 18..126 of the viewBox, clear of the corner indices.
const COURT = {
  K: `<path class="soft" d="M25 126C25 106 34 94 50 94s25 12 25 32Z"/>
      <path class="stroke" d="M25 126C25 106 34 94 50 94s25 12 25 32"/>
      <path class="stroke" d="M40 96c2.6 4 5.9 6 10 6s7.4-2 10-6"/>
      <circle class="head" cx="50" cy="74" r="12.5"/>
      <path class="beard" d="M40 79.5c1.4 8.2 5.2 12.3 10 12.3s8.6-4.1 10-12.3c-2.9 2.3-6.3 3.5-10 3.5s-7.1-1.2-10-3.5Z"/>
      <path class="fill" d="M28 62V38l5.5 7.5L39 28l5.5 12L50 18l5.5 22L61 28l5.5 17.5L72 38v24Z"/>
      <circle class="gem" cx="39" cy="55" r="2.4"/>
      <circle class="gem" cx="50" cy="55" r="2.4"/>
      <circle class="gem" cx="61" cy="55" r="2.4"/>`,
  Q: `<path class="soft" d="M27 126C27 108 35 96 50 96s23 12 23 30Z"/>
      <path class="stroke" d="M27 126C27 108 35 96 50 96s23 12 23 30"/>
      <path class="hair" d="M36 66c-6.5 6-8.5 17-6.5 30 1.3 8 3.5 13.5 6.5 18 4-10.5 5-21 4-31.5Z"/>
      <g transform="translate(100 0) scale(-1 1)"><path class="hair" d="M36 66c-6.5 6-8.5 17-6.5 30 1.3 8 3.5 13.5 6.5 18 4-10.5 5-21 4-31.5Z"/></g>
      <path class="stroke" d="M41 97c2.4 3.6 5.4 5.4 9 5.4s6.6-1.8 9-5.4"/>
      <circle class="head" cx="50" cy="74" r="12.5"/>
      <path class="fill" d="M30 62v-7h40v7Z"/>
      <circle class="fill" cx="37.5" cy="47" r="7"/>
      <circle class="fill" cx="50" cy="41" r="8.5"/>
      <circle class="fill" cx="62.5" cy="47" r="7"/>`,
  J: `<path class="soft" d="M25 126C25 106 34 94 50 94s25 12 25 32Z"/>
      <path class="stroke" d="M25 126C25 106 34 94 50 94s25 12 25 32"/>
      <path class="stroke" d="M41 95 50 106l9-11"/>
      <circle class="head" cx="50" cy="74" r="12.5"/>
      <path class="feather" d="M69 56c10-4.5 15.5-12 16.5-21.5-9.5 1-16 6.5-19 14Z"/>
      <path class="fill" d="M29 62c0-18 9.5-28 21-28s21 10 21 28Z"/>`
};
// the suit worn on the chest: what turns a silhouette into a court card
const emblem = suit => `<g class="emblem" transform="translate(39.5 106) scale(.88)"><path d="${SUIT_PATH[suit]}"/></g>`;
function faceArt(card) {
  const figure = COURT[card.rank];
  if (!figure) return `<div class="pip${card.rank === 'A' ? ' ace' : ''}">${suitSvg(card.suit)}</div>`;
  return `<div class="court"><svg viewBox="0 0 100 141" aria-hidden="true">${figure}${emblem(card.suit)}</svg></div>`;
}

class CardView {
  constructor(card, hidden) {
    this.card = card;
    this.hidden = !!hidden;
    this.tilt = Math.random() * 2.6 - 1.3;
    const red = card.suit === 'H' || card.suit === 'D';
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', hidden ? 'Face-down card' : this.label());
    this.el.innerHTML = `<div class="in">
      <div class="f${red ? ' red' : ''}">
        <div class="rk">${card.rank}${suitSvg(card.suit)}</div>
        ${faceArt(card)}
        <div class="rk rot">${card.rank}${suitSvg(card.suit)}</div>
      </div>
      <div class="b"></div></div>`;
    this.inner = this.el.firstElementChild;
    this.x = 0; this.y = 0; this.r = 0; this.sc = 1; this.flip = 1;
    const paint = () => {
      this.el.style.transform = `translate3d(${this.x}px,${this.y}px,0) rotate(${this.r}deg) scale(${this.sc})`;
    };
    this.sx = new Spring(0, v => { this.x = v; paint(); }, { response: .5 });
    this.sy = new Spring(0, v => { this.y = v; paint(); }, { response: .5 });
    this.sr = new Spring(0, v => { this.r = v; paint(); }, { response: .5, eps: .01 });
    this.ss = new Spring(1, v => { this.sc = v; paint(); }, { response: .3, eps: .002 });
    this.sf = new Spring(1, v => { this.flip = v; this.inner.style.transform = `rotateY(${v * 180}deg)`; }, { response: .42, eps: .002 });
    paint();
    this.inner.style.transform = 'rotateY(180deg)';
  }
  label() { return `${RANK_NAME[this.card.rank] || this.card.rank} of ${SUIT_NAME[this.card.suit]}`; }
  place(x, y, r) { this.sx.jump(x); this.sy.jump(y); this.sr.jump(r); }
  moveTo(x, y, r, o = {}) {
    const q = { response: o.response, damping: o.damping };
    this.sx.set(x, q); this.sy.set(y, q);
    return this.sr.to(r, o);            // one spring carries the completion
  }
  faceUp(o) {
    if (!this.hidden && this.sf.target === 0) return Promise.resolve();
    this.hidden = false;
    this.el.setAttribute('aria-label', this.label());
    return this.sf.to(0, o);
  }
  nudge() { this.ss.jump(1.07); this.ss.set(1); }
  remove() { this.el.remove(); }
}

// ---------- chips ----------
// The four chips keep their colours and their 1 / 5 / 20 / 100 ratio but their
// face value climbs with the bankroll: at a billion, betting in fives is not a
// game. Everything below works on the INDEX of a chip, never on its value.
const CHIP_CLS = ['c5', 'c25', 'c100', 'c500'];
const CHIP_BASE = [5, 25, 100, 500];
let CHIPS = CHIP_BASE.slice();

function chipScale(bank) {
  let m = 1;
  while (bank >= 50000 * m && m < 1e24) m *= 10;
  return m;
}
// Largest chips first, and never more than `max` of them. The old version
// subtracted one chip at a time, so a ten-billion bet meant twenty million
// iterations and an array to match: that is what froze the tab and then killed it.
function chipBreak(amount, max = 5) {
  const out = [];
  let left = Math.floor(amount);
  if (!(left > 0)) return out;
  for (let i = CHIPS.length - 1; i >= 0 && out.length < max; i--) {
    const d = CHIPS[i];
    if (left < d) continue;
    const n = Math.floor(left / d);
    left -= n * d;
    for (let k = 0; k < n && out.length < max; k++) out.push(i);
  }
  if (!out.length) out.push(0);          // a bet smaller than the smallest chip still shows one
  return out;
}
function renderStack(el, amount, max = 5) {
  el.innerHTML = '';
  el.classList.toggle('empty', !amount);
  if (!amount) return;
  const chips = chipBreak(amount, max).reverse();
  chips.forEach((ci, i) => {
    const c = document.createElement('span');
    c.className = 'ch ' + CHIP_CLS[ci];
    c.style.setProperty('--i', String(i));
    el.appendChild(c);
  });
  el.style.setProperty('--n', String(chips.length));
}

// ---------- layout ----------
function rel(el) {
  const t = els.table.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - t.left, y: r.top - t.top, w: r.width, h: r.height };
}
function cardW() { return parseFloat(getComputedStyle(els.table).getPropertyValue('--cws')) || 76; }
function step(n) { return Math.max(15, Math.round(cardW() * (n > 4 ? .38 : .52))); }
function spanWidth(n) { return n <= 1 ? cardW() : cardW() + (n - 1) * step(n); }

// ---------- state ----------
const game = new Game({
  bankroll: store.get('bj.bankroll', RULES.startBankroll),
  stats: store.get('bj.stats', null) || undefined
});
const views = { player: [], dealer: [] };
const spots = [];
let busy = false;
let lastBet = store.get('bj.lastBet', 0);

const bankSpring = new Spring(game.bankroll, v => { els.bankroll.textContent = fmt(v); }, { response: .6, eps: .5 });
const bankScale = new Spring(1, v => { els.bankroll.style.transform = `scale(${v})`; }, { response: .3, eps: .002 });
const betScale = new Spring(1, v => { els.betSpot.style.transform = `scale(${v})`; }, { response: .28, eps: .002 });
const resScale = new Spring(.82, v => { els.result.style.transform = `scale(${v})`; }, { response: .34, eps: .002 });
const resAlpha = new Spring(0, v => { els.result.style.opacity = v; }, { response: .3, eps: .005 });
const dScoreScale = new Spring(1, v => { els.dealerScore.style.transform = `scale(${v})`; }, { response: .26, eps: .002 });

// Money grows without limit here, so a plain grouped number stops fitting long
// before the fun stops. Up to a million it reads in full; past that it takes a
// suffix, with enough digits that a bet still moves the last one.
const UNITS = [
  [1e33, 'Dc'], [1e30, 'No'], [1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'],
  [1e18, 'Qi'], [1e15, 'Qa'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']
];
function trimZeros(t) { return t.indexOf('.') < 0 ? t : t.replace(/0+$/, '').replace(/\.$/, ''); }
function compact(a, from) {
  for (const [v, suf] of UNITS) {
    if (v < from || a < v) continue;
    const x = a / v;
    return trimZeros(x.toFixed(x < 10 ? 3 : x < 100 ? 2 : 1)) + suf;
  }
  return trimZeros((Math.round(a * 10) / 10).toFixed(1));
}
function fmt(n) {
  const a = Math.abs(n), sign = n < 0 ? '-' : '';
  if (!isFinite(a)) return sign + '∞';
  if (a < 1e6) return sign + (Math.round(a * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  return sign + compact(a, 1e6);
}
// chip faces have a 54px circle to live in: K from a thousand, no grouping
const chipFace = v => v < 1000 ? String(v) : compact(v, 1e3);
function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

// ---------- player hand spots ----------
function makeSpot() {
  const el = document.createElement('div');
  el.className = 'spot';
  el.innerHTML = `<div class="badge"></div>
    <div class="cards empty"></div>
    <div class="meta"><span class="score num"></span></div>
    <div class="wager"><span class="stack empty" aria-hidden="true"></span><span class="amt num"></span></div>`;
  const spot = {
    el,
    cards: el.querySelector('.cards'),
    badge: el.querySelector('.badge'),
    score: el.querySelector('.score'),
    stack: el.querySelector('.stack'),
    amt: el.querySelector('.amt')
  };
  spot.alpha = new Spring(1, v => { el.style.opacity = v; }, { response: .34, eps: .004 });
  spot.badgeScale = new Spring(.7, v => { spot.badge.style.transform = `scale(${v})`; }, { response: .32, eps: .003 });
  spot.badgeAlpha = new Spring(0, v => { spot.badge.style.opacity = v; }, { response: .3, eps: .005 });
  spot.scoreScale = new Spring(1, v => { spot.score.style.transform = `scale(${v})`; }, { response: .26, eps: .002 });
  return spot;
}
function addSpot(at) {
  const s = makeSpot();
  spots.splice(at, 0, s);
  if (at >= els.hands.children.length) els.hands.appendChild(s.el);
  else els.hands.insertBefore(s.el, els.hands.children[at]);
  return s;
}
function clearSpots() { spots.length = 0; els.hands.innerHTML = ''; }

// ---------- rendering ----------
function scoreOf(cardViews) {
  const visible = cardViews.filter(v => !v.hidden).map(v => v.card);
  return visible.length ? handValue(visible) : null;
}
function paintScore(el, v, blackjack) {
  if (!v) { el.className = 'score num'; el.textContent = ''; return; }
  let cls = 'score num on';
  if (blackjack) cls += ' bj';
  else if (v.bust) cls += ' bust';
  else if (v.soft && v.total < 21) cls += ' soft';
  el.className = cls;
  el.textContent = String(v.total);
}
// scores are read off the cards ON THE TABLE, never off the game state:
// the dealer's hand is dealt out one card at a time and the number must follow
function renderDealerScore() {
  const v = scoreOf(views.dealer);
  const natural = !game.holeHidden && views.dealer.length === 2 && v && v.total === 21;
  paintScore(els.dealerScore, v, natural);
  dScoreScale.jump(1.22); dScoreScale.set(1);
}
function renderHandScore(i) {
  const spot = spots[i]; if (!spot) return;
  const v = scoreOf(views.player[i] || []);
  const h = game.hands[i];
  paintScore(spot.score, v, !!(h && isBlackjack(h) && v && v.total === 21));
  spot.scoreScale.jump(1.22); spot.scoreScale.set(1);
}
function renderStacks() {
  game.hands.forEach((h, i) => {
    if (!spots[i]) return;
    renderStack(spots[i].stack, h.bet);
    // chips alone do not say how much is at stake once a hand is doubled or split
    spots[i].amt.textContent = h.bet ? fmt(h.bet) : '';
    spots[i].el.setAttribute('aria-label', `Hand ${i + 1}, bet ${fmt(h.bet)}`);
  });
}
function renderBank(pop = true) {
  // a fixed half-unit tolerance takes hundreds of frames to cross a billion
  bankSpring.eps = Math.max(0.5, Math.max(Math.abs(game.bankroll), Math.abs(bankSpring.x)) * 1e-4);
  bankSpring.set(game.bankroll);
  if (pop) { bankScale.jump(1.12); bankScale.set(1); }
}
function renderBet(pop) {
  els.betVal.textContent = fmt(game.bet);
  renderStack(els.betStack, game.bet);
  els.betSpot.classList.toggle('empty', game.bet === 0);
  if (pop) { betScale.jump(1.09); betScale.set(1); }
}
function renderShoe() {
  els.shoeLeft.textContent = game.cardsLeft || '';
  els.shoe.style.setProperty('--fill', String(Math.max(0.08, game.cardsLeft / (game.rules.decks * 52))));
}
function setActive(i) {
  spots.forEach((s, k) => {
    const playing = game.phase === 'player';
    const on = k === i && playing;
    s.el.classList.toggle('active', on);
    s.alpha.set(playing && !on ? .78 : 1);
  });
}
const CLS = { blackjack: 'win', win: 'win', dealer_bust: 'win', push: 'push', lose: 'lose', bust: 'lose' };
function showBadge(i, outcome, net) {
  const s = spots[i]; if (!s) return;
  if (spots.length === 1) return;      // the centre pill already says it
  const text = outcome === 'push' ? 'Push' : outcome === 'bust' ? 'Bust' : signed(net);
  s.badge.className = 'badge ' + (CLS[outcome] || 'push');
  s.badge.textContent = text;
  s.badgeScale.jump(.7); s.badgeScale.set(1);
  s.badgeAlpha.set(1);
}
function hideBadges() { spots.forEach(s => { s.badgeAlpha.set(0); s.badgeScale.set(.8); }); }
function setResult(html, cls) {
  els.result.className = 'result ' + cls;
  els.result.innerHTML = html;
  resScale.jump(.82); resScale.set(1);
  resAlpha.set(1);
}
function hideResult() { resAlpha.set(0); resScale.set(.9); }

// The hint marks ONE button with a dot. It is deliberately not a filled button:
// a filled button reads as "the game wants this", and hit and stand are equals.
let hintOn = store.get('bj.hint', false);
const HINT_BTN = { hit: 'btnHit', stand: 'btnStand', double: 'btnDouble', split: 'btnSplit' };
function clearHints() {
  for (const el of document.querySelectorAll('.btn .tip')) el.remove();
  for (const el of document.querySelectorAll('.btn[data-hint]')) {
    el.removeAttribute('data-hint');
    el.removeAttribute('aria-label');   // the button's own text names it again
  }
}
function renderHint() {
  clearHints();
  if (!hintOn || busy) return;
  let id = null;
  if (game.phase === 'player') id = HINT_BTN[bestMove(game)];
  else if (game.phase === 'insurance') id = INSURANCE_ADVICE === 'no' ? 'btnInsNo' : 'btnInsYes';
  const b = id && els[id];
  if (!b || b.disabled || b.offsetParent === null) return;
  const dot = document.createElement('span');
  dot.className = 'tip';
  b.appendChild(dot);
  b.dataset.hint = '1';
  b.setAttribute('aria-label', b.textContent.trim().replace(/\s+/g, ' ') + ', recommended by basic strategy');
}

function renderControls() {
  const p = game.phase;
  const broke = p === 'betting' && game.bankroll < game.rules.minBet && game.bet === 0;
  els.uiBet.hidden = p !== 'betting' || broke;
  els.uiDeal.hidden = p !== 'betting' || broke;
  els.uiPlay.hidden = p !== 'player';
  els.uiIns.hidden = p !== 'insurance';
  els.uiNext.hidden = p !== 'settled';
  els.uiBroke.hidden = !broke;
  els.hint.hidden = p !== 'betting';
  els.betSpot.hidden = p !== 'betting';

  if (p === 'betting') {
    syncChips();
    for (const b of chipBtns) b.disabled = !game.canBet(+b.dataset.chip);
    els.btnDeal.disabled = !game.canDeal();
    els.btnClear.disabled = game.bet === 0;
    els.btnX2.disabled = !game.canDoubleBet();
    els.btnMax.disabled = !game.canMaxBet();
  }
  if (p === 'player') {
    els.btnHit.disabled = busy || !game.canHit();
    els.btnStand.disabled = busy || !game.canStand();
    els.btnDouble.disabled = busy || !game.canDouble();
    els.btnSplit.disabled = busy || !game.canSplit();
  }
  if (p === 'insurance') {
    els.btnInsYes.disabled = busy || !game.canInsure();
    els.btnInsYes.querySelector('.amt').textContent = fmt(game.insuranceCost);
    els.btnInsNo.disabled = busy;
  }
  els.btnNext.disabled = busy;
  renderHint();
}

// ---------- animation ----------
function shoeOrigin() {
  const s = rel(els.shoe);
  return { x: s.x + s.w / 2 - cardW() / 2, y: s.y + s.h / 2 - cardW() * .7, r: -8 };
}
function sizeSpacers() {
  const n = Math.max(1, spots.length);
  els.table.style.setProperty('--k', n >= 4 ? '.56' : n === 3 ? '.68' : n === 2 ? '.82' : '1');
  const h = Math.round(cardW() * 1.4) + 'px';
  spots.forEach((s, i) => {
    const cnt = (views.player[i] || []).length;
    s.cards.style.width = spanWidth(Math.max(1, cnt)) + 'px';
    s.cards.style.height = h;
    s.cards.classList.toggle('empty', cnt === 0);
  });
  els.dealerCards.style.width = spanWidth(Math.max(1, views.dealer.length)) + 'px';
  els.dealerCards.style.height = h;
  els.dealerCards.classList.toggle('empty', views.dealer.length === 0);
}
function targetsFor(spacerEl, n) {
  const s = rel(spacerEl), w = cardW(), st = step(n);
  const total = n <= 1 ? w : w + (n - 1) * st;
  const x0 = s.x + s.w / 2 - total / 2;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: Math.round(x0 + i * st), y: Math.round(s.y) });
  return out;
}
function relayout(animate = true, waitAll = false) {
  sizeSpacers();
  const o = { response: .38 };
  const done = [];
  const dt = targetsFor(els.dealerCards, views.dealer.length);
  views.dealer.forEach((v, i) => {
    if (animate) done.push(v.moveTo(dt[i].x, dt[i].y, v.tilt, o)); else v.place(dt[i].x, dt[i].y, v.tilt);
  });
  spots.forEach((s, i) => {
    const list = views.player[i] || [];
    const ts = targetsFor(s.cards, list.length);
    list.forEach((v, k) => {
      if (animate) done.push(v.moveTo(ts[k].x, ts[k].y, v.tilt, o)); else v.place(ts[k].x, ts[k].y, v.tilt);
    });
  });
  return waitAll ? Promise.all(done) : Promise.resolve();
}

const pending = [];
async function settleCards() { await Promise.all(pending.splice(0)); }

function dealCard(ev) {
  const isDealer = ev.to === 'dealer';
  const view = new CardView(ev.card, ev.hidden);
  const o = shoeOrigin();
  view.place(o.x, o.y, o.r);
  els.table.appendChild(view.el);
  if (isDealer) views.dealer.push(view);
  else {
    if (!views.player[ev.hand]) views.player[ev.hand] = [];
    views.player[ev.hand].push(view);
  }
  sound.deal();
  relayout(true);                        // cards already down make room
  const spacer = isDealer ? els.dealerCards : spots[ev.hand].cards;
  const list = isDealer ? views.dealer : views.player[ev.hand];
  const t = targetsFor(spacer, list.length)[list.length - 1];
  const land = view.moveTo(t.x, t.y, view.tilt, { response: .48 });
  if (!ev.hidden) wait(130).then(() => { view.faceUp(); sound.flip(); });
  renderShoe();
  return land.then(() => { isDealer ? renderDealerScore() : renderHandScore(ev.hand); });
}

async function revealHole() {
  const v = views.dealer[1];
  if (v) { sound.flip(); await v.faceUp({ response: .42 }); }
  renderDealerScore();
}

function flyChip(from, to, delay, cls) {
  return new Promise(res => {
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!a.width || !b.width) { res(); return; }
    const el = document.createElement('span');
    el.className = 'fly ch ' + (cls || 'c25');
    document.body.appendChild(el);
    let x = a.left + a.width / 2 - 13, y = a.top + a.height / 2 - 13;
    const paint = () => el.style.transform = `translate3d(${x}px,${y}px,0)`;
    paint();
    const sx = new Spring(x, v => { x = v; paint(); }, { response: .46 });
    const sy = new Spring(y, v => { y = v; paint(); }, { response: .46 });
    setTimeout(() => {
      sound.chip();
      sx.set(b.left + b.width / 2 - 13);
      sy.set(b.top + b.height / 2 - 13, { onRest: () => { el.remove(); res(); } });
    }, reducedMotion() ? 0 : delay);
  });
}
async function flyChips(from, to, amount) {
  const chips = chipBreak(amount, 6);
  if (!chips.length) return;
  await Promise.all(chips.map((ci, i) => flyChip(from, to, i * 70, CHIP_CLS[ci])));
}

function clearTable() {
  const all = [...views.dealer, ...views.player.flat()];
  views.dealer = []; views.player = [];
  all.forEach((v, i) => {
    setTimeout(() => {
      v.el.style.transition = reducedMotion() ? 'none' : 'opacity .3s ease';
      v.el.style.opacity = '0';
      v.moveTo(v.x, v.y + 46, v.r + (i % 2 ? 5 : -5), { response: .42, onRest: () => v.remove() });
      setTimeout(() => v.remove(), 800);
    }, reducedMotion() ? 0 : i * 26);
  });
  paintScore(els.dealerScore, null);
}

// ---------- event playback ----------
async function playEvents(evs) {
  for (const ev of evs) {
    switch (ev.type) {
      case 'shuffle':
        sound.shuffle(); toast('Shuffling a new shoe'); await wait(420); break;
      case 'card': {
        pending.push(dealCard(ev));
        const slow = ev.to === 'dealer' && !ev.hidden && views.dealer.length > 2;
        await wait(slow ? 470 : 250);
        break;
      }
      case 'reveal':
        await settleCards(); await wait(120); await revealHole(); await wait(280); break;
      case 'split': {
        await settleCards();
        const moved = views.player[ev.hand].pop();
        views.player.splice(ev.hand + 1, 0, [moved]);
        addSpot(ev.hand + 1);
        renderStacks();
        sound.chip();
        await relayout(true, true);
        renderHandScore(ev.hand); renderHandScore(ev.hand + 1);
        await wait(140);
        break;
      }
      case 'focus':
        await settleCards(); setActive(ev.hand); break;
      case 'bet':
        renderStacks();
        if (spots[ev.hand]) await flyChips(els.bankroll, spots[ev.hand].stack, ev.bet / 2);
        break;
      case 'insurance':
        els.insBox.hidden = false;
        els.insVal.textContent = fmt(ev.bet);
        renderStack(els.insChips, ev.bet);
        await flyChips(els.bankroll, els.insChips, ev.bet);
        break;
      case 'insurance_result':
        els.insBadge.textContent = ev.won ? 'Paid ' + signed(ev.payout - game.insuranceBet) : 'Lost';
        els.insBadge.className = 'ins-badge ' + (ev.won ? 'win' : 'lose');
        els.insBadge.hidden = false;
        await wait(520);
        break;
      case 'result':
        await settleCards();
        showBadge(ev.hand, ev.outcome, ev.net);
        if (ev.outcome === 'bust' && views.player[ev.hand]) views.player[ev.hand].forEach(v => v.nudge());
        await wait(spots.length > 1 ? 280 : 60);
        break;
      case 'done': {
        await settleCards();
        setActive(-1);
        const returned = game.hands.reduce((s, h) => s + h.payout, 0) + (game.insuranceResult ? game.insuranceResult.payout : 0);
        if (game.hands.length === 1 && !game.insuranceBet) {
          const map = {
            blackjack: ['Blackjack', 'win'], win: ['You win', 'win'], dealer_bust: ['Dealer busts', 'win'],
            push: ['Push', 'push'], lose: ['Dealer wins', 'lose'], bust: ['Bust', 'lose']
          };
          const [text, cls] = map[game.hands[0].outcome];
          setResult(`<span>${text}</span>${ev.net ? `<span class="net num">${signed(ev.net)}</span>` : ''}`, cls);
        } else {
          const cls = ev.net > 0 ? 'win' : ev.net < 0 ? 'lose' : 'push';
          setResult(`<span>Round</span><span class="net num">${ev.net === 0 ? 'even' : signed(ev.net)}</span>`, cls);
        }
        buzz(ev.net > 0 ? [12, 40, 12] : ev.net < 0 ? [22] : [8]);
        if (game.hands.some(h => h.outcome === 'blackjack')) sound.blackjack();
        else if (ev.net > 0) sound.win();
        else if (ev.net < 0) (game.hands.every(h => h.outcome === 'bust') ? sound.bust() : sound.lose());
        else sound.push();
        if (returned > 0) await flyChips(spots[0] ? spots[0].stack : els.result, els.bankroll, returned);
        renderBank();
        persist();
        break;
      }
    }
  }
  await settleCards();
}

// ---------- toast ----------
let toastT = null;
function toast(msg, ms = 1500) {
  els.toast.textContent = msg;
  els.toast.style.transition = reducedMotion() ? 'none' : 'transform .32s cubic-bezier(.22,.8,.24,1), opacity .25s';
  els.toast.style.transform = 'translate(-50%,0)'; els.toast.style.opacity = '1';
  clearTimeout(toastT);
  toastT = setTimeout(() => { els.toast.style.transform = 'translate(-50%,20px)'; els.toast.style.opacity = '0'; }, ms);
}

// a phone can say what a speaker says; silent if the device has no vibrator
function buzz(pattern) {
  if (reducedMotion() || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) {}
}

function persist() {
  store.set('bj.bankroll', game.bankroll);
  store.set('bj.stats', game.stats);
  store.set('bj.lastBet', lastBet);
}

// ---------- actions ----------
async function run(fn) {
  if (busy) return;
  busy = true; renderControls();
  try { await fn(); } finally { busy = false; renderControls(); }
}
function addChip(i, fromEl) {
  const amount = CHIPS[i];
  if (!game.canBet(amount)) return;
  game.addBet(amount);
  sound.chip();
  if (fromEl) flyChip(fromEl, els.betSpot, 0, CHIP_CLS[i]).then(() => renderBet(true));
  else renderBet(true);
  renderControls();
}
// the chip row is repainted only when the scale actually moves
const chipBtns = [...els.uiBet.querySelectorAll('.chip')];
function syncChips() {
  const next = CHIP_BASE.map(d => d * chipScale(Math.max(game.bankroll, game.bet, 0)));
  if (next[0] === CHIPS[0]) return;
  CHIPS = next;
  chipBtns.forEach((b, i) => {
    const face = chipFace(CHIPS[i]);
    b.dataset.chip = String(CHIPS[i]);
    b.querySelector('span').textContent = face;
    b.classList.toggle('long', face.length > 3);
    b.setAttribute('aria-label', 'Bet ' + fmt(CHIPS[i]));
  });
}
async function doDeal() {
  if (!game.canDeal()) return;
  lastBet = game.bet;
  hideResult(); hideBadges();
  els.insBox.hidden = true; els.insBadge.hidden = true;
  clearSpots(); views.player = []; addSpot(0);
  const evs = game.deal();
  renderBank(); renderStacks(); renderControls();
  await playEvents(evs);
}
async function doNext() {
  if (game.phase !== 'settled') return;
  hideResult(); hideBadges();
  els.insBox.hidden = true; els.insBadge.hidden = true;
  clearTable();
  game.nextHand();
  clearSpots(); addSpot(0);
  sizeSpacers();
  renderBet(false);
  await wait(260);
}
let resetArmed = false, resetT = null;
function doReset() {
  if (!resetArmed) {
    resetArmed = true;
    els.btnReset.textContent = 'Tap again to reset';
    clearTimeout(resetT);
    resetT = setTimeout(() => { resetArmed = false; els.btnReset.textContent = 'Reset bankroll'; }, 3000);
    return;
  }
  clearTimeout(resetT); resetArmed = false;
  els.btnReset.textContent = 'Reset bankroll';
  game.resetBankroll();
  clearTable(); clearSpots(); addSpot(0);
  hideResult(); sizeSpacers();
  renderBank(); renderBet(false); renderControls();
  persist();
  toast('Bankroll reset to ' + fmt(game.rules.startBankroll));
}

// ---------- sheets ----------
let sheetOpen = false, lastFocus = null;
const sheetY = new Spring(102, v => { els.sheet.style.setProperty('--sy', v + '%'); }, { response: .38, eps: .05 });
const scrimA = new Spring(0, v => { els.scrim.style.opacity = v; }, { response: .3, eps: .004 });

function openSheet(title, html, after) {
  lastFocus = document.activeElement;
  els.sheetTitle.textContent = title;
  els.sheetBody.innerHTML = html;
  els.sheetBody.scrollTop = 0;
  els.sheet.hidden = false; els.scrim.hidden = false;
  els.sheet.setAttribute('aria-hidden', 'false');
  sheetOpen = true;
  sheetY.set(0); scrimA.set(1);
  els.sheetClose.focus();
  sound.click();
  if (after) after();
}
function closeSheet() {
  if (!sheetOpen) return;
  unmountThemeFromSheet();
  sheetOpen = false;
  els.sheet.setAttribute('aria-hidden', 'true');
  scrimA.set(0);
  sheetY.set(102, { onRest: () => { if (!sheetOpen) { els.sheet.hidden = true; els.scrim.hidden = true; } } });
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
// a dialog owes a focus trap
els.sheet.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const f = [...els.sheet.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], lastEl = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
  else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
});

const HELP_HTML = `
<p class="lede">Beat the dealer without going over 21. Face cards count 10; an ace counts 11 or 1, whichever helps you.</p>
<h3>A round</h3>
<ol>
  <li>Put out a bet with the chips, then press Deal.</li>
  <li>You get two cards face up. The dealer gets one up, one down.</li>
  <li>Draw as many cards as you like, or stop while you are under 21.</li>
  <li>The dealer then draws to 17 and stands there, soft 17 included.</li>
  <li>Closer to 21 wins. The same total is a push and your bet comes back.</li>
</ol>
<h3>Your moves</h3>
<dl class="moves">
  <dt>Bet <kbd>X</kbd> <kbd>M</kbd></dt><dd>Chips add to the bet; ×2 doubles it and Max puts the whole bankroll out.</dd>
  <dt>Hit <kbd>H</kbd></dt><dd>Take one more card.</dd>
  <dt>Stand <kbd>S</kbd></dt><dd>Keep what you have and pass to the dealer.</dd>
  <dt>Double <kbd>D</kbd></dt><dd>Double the bet, take exactly one card, then stand. First two cards only, after a split as well.</dd>
  <dt>Split <kbd>P</kbd></dt><dd>Two cards of the same value become two hands, each with its own bet. Up to four hands. Split aces get one card each.</dd>
  <dt>Insurance <kbd>Y</kbd> <kbd>N</kbd></dt><dd>Offered when the dealer shows an ace. Costs half your bet, pays 2:1 if the dealer has blackjack. It loses money over time, so most players say no.</dd>
</dl>
<h3>The hint</h3>
<p>The bulb in the header marks the move basic strategy would make - the play with the best long-run return for the cards on the table. It is a mark, not an instruction: hit and stand are equal choices and the game never pushes you toward either.</p>
<h3>Payouts</h3>
<table class="pay">
  <tr><th scope="row">Blackjack, 21 on the first two cards</th><td>3:2</td></tr>
  <tr><th scope="row">Any other win</th><td>1:1</td></tr>
  <tr><th scope="row">Insurance</th><td>2:1</td></tr>
  <tr><th scope="row">Push</th><td>bet returned</td></tr>
</table>
<h3>House rules</h3>
<ul class="rules">
  <li>Six decks, reshuffled once about three quarters are dealt.</li>
  <li>Dealer stands on every 17, soft 17 included.</li>
  <li>Dealer checks for blackjack under an ace or a ten.</li>
  <li>21 on a split hand counts as 21, not as blackjack.</li>
  <li>Bankroll starts at ${fmt(RULES.startBankroll)} and is kept in this browser only.</li>
</ul>
<h3>Worth knowing</h3>
<p>Always split aces and eights, never split tens or fives. Stand on hard 17 and up. Hit hard 11 and under. Against a dealer showing 2 to 6, stand on 12 to 16 and let the dealer break.</p>
<p class="fine">Play money. Nothing here touches a payment of any kind.</p>`;

function statsHtml() {
  const s = game.stats;
  const decided = s.wins + s.losses;
  const rate = decided ? Math.round(s.wins / decided * 100) : 0;
  const ret = s.wagered ? s.net / s.wagered * 100 : 0;
  const row = (k, v, cls = '') => `<div class="st"><span class="k">${k}</span><span class="v num ${cls}">${v}</span></div>`;
  return `<div class="stats">
    ${row('Hands played', fmt(s.hands))}
    ${row('Won', fmt(s.wins))}
    ${row('Lost', fmt(s.losses))}
    ${row('Pushed', fmt(s.pushes))}
    ${row('Win rate', decided ? rate + '%' : '-')}
    ${row('Blackjacks', fmt(s.blackjacks))}
    ${row('Net', s.net === 0 ? 'even' : signed(s.net), s.net > 0 ? 'up' : s.net < 0 ? 'down' : '')}
    ${row('Best round', s.best > 0 ? signed(s.best) : '-')}
    ${row('Peak bankroll', fmt(s.peak))}
    ${row('Total wagered', fmt(s.wagered))}
    ${row('Best run', s.bestWinStreak ? plural(s.bestWinStreak, 'round') : '-')}
    ${row('Worst run', s.bestLoseStreak ? plural(-s.bestLoseStreak, 'round') : '-')}
    ${row('Return', s.wagered ? (ret > 0 ? '+' : '') + ret.toFixed(1) + '%' : '-')}
  </div>
  <p class="fine">Win rate counts decided hands, pushes left out. Return is the net against everything wagered.</p>
  <h3>What to expect</h3>
  <p>Played perfectly, this game returns <b>${EXPECTED.winRateOfDecided}%</b> of decided hands to the player and keeps
  about <b>${EXPECTED.houseEdge}%</b> of everything staked. That is the whole house edge: the dealer wins slightly more often
  because you can bust first, and blackjack paying 3:2 gives most of it back.</p>
  <p>Short sessions swing hard. Over 30 hands the win rate lands anywhere from 34% to 62% about two thirds of the time,
  so a run of 8 wins in 30 is unremarkable - it happens about once every twenty sessions. The numbers above only start
  meaning something after a few hundred hands.</p>
  <button type="button" class="btn quiet danger" id="btnResetStats">Reset statistics</button>`;
}
function bindStatsReset() {
  const b = $('btnResetStats');
  if (!b) return;
  let armed = false, t = null;
  b.addEventListener('click', () => {
    if (!armed) {
      armed = true; b.textContent = 'Tap again to clear';
      clearTimeout(t); t = setTimeout(() => { armed = false; b.textContent = 'Reset statistics'; }, 3000);
      return;
    }
    clearTimeout(t);
    game.resetStats(); persist();
    els.sheetBody.innerHTML = statsHtml();
    bindStatsReset();
    toast('Statistics cleared');
  });
}
// The theme switch exists in ONE place at a time: on a phone the header has no
// room for it, so the same node is moved into the sheet and moved back on close.
const narrow = () => matchMedia('(max-width:560px)').matches;
function mountThemeInSheet() {
  if (!narrow()) return;
  document.body.classList.add('narrow');
  const row = document.createElement('div');
  row.className = 'sheet-theme';
  row.innerHTML = '<span class="lbl">Theme</span>';
  row.appendChild(els.themeSeg);
  els.sheetBody.insertBefore(row, els.sheetBody.firstChild);
  applyTheme(themeMode(), false);
}
function unmountThemeFromSheet() {
  if (els.themeSeg.parentElement && els.themeSeg.parentElement.classList.contains('sheet-theme')) {
    els.tools.insertBefore(els.themeSeg, els.tools.firstChild);
    applyTheme(themeMode(), false);
  }
  document.body.classList.remove('narrow');
}
const openStats = () => openSheet('This session', statsHtml(), () => { bindStatsReset(); mountThemeInSheet(); });
const openHelp = () => openSheet('How to play', HELP_HTML, mountThemeInSheet);

// ---------- wiring ----------
els.uiBet.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b || b.disabled || game.phase !== 'betting') return;
  addChip(chipBtns.indexOf(b), b);
});
els.btnClear.addEventListener('click', () => { if (game.clearBet()) { sound.click(); renderBet(true); renderControls(); } });
els.btnX2.addEventListener('click', () => { if (game.doubleBet()) { sound.chips(2); renderBet(true); renderControls(); } });
els.btnMax.addEventListener('click', () => { if (game.maxBet()) { sound.chips(4); renderBet(true); renderControls(); } });
els.btnDeal.addEventListener('click', () => run(doDeal));
els.btnHit.addEventListener('click', () => run(() => playEvents(game.hit())));
els.btnStand.addEventListener('click', () => run(() => playEvents(game.stand())));
els.btnDouble.addEventListener('click', () => run(() => playEvents(game.double())));
els.btnSplit.addEventListener('click', () => run(() => playEvents(game.split())));
els.btnInsYes.addEventListener('click', () => run(() => playEvents(game.takeInsurance(true))));
els.btnInsNo.addEventListener('click', () => run(() => playEvents(game.takeInsurance(false))));
els.btnNext.addEventListener('click', () => run(doNext));
els.btnReset.addEventListener('click', doReset);
els.btnHelp.addEventListener('click', openHelp);
els.btnStats.addEventListener('click', openStats);
els.sheetClose.addEventListener('click', closeSheet);
els.scrim.addEventListener('click', closeSheet);

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' && sheetOpen) { e.preventDefault(); closeSheet(); return; }
  if (sheetOpen) return;
  if (e.key === '?') { e.preventDefault(); openHelp(); return; }
  if (k === ' ' || k === 'enter') {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();
    if (game.phase === 'betting') run(doDeal); else if (game.phase === 'settled') run(doNext);
    return;
  }
  if (busy) return;
  if (game.phase === 'betting') {
    if (k === 'x' && game.canDoubleBet()) { game.doubleBet(); sound.chips(2); renderBet(true); renderControls(); }
    if (k === 'm' && game.canMaxBet()) { game.maxBet(); sound.chips(4); renderBet(true); renderControls(); }
    return;
  }
  if (game.phase === 'insurance') {
    if (k === 'y' && game.canInsure()) run(() => playEvents(game.takeInsurance(true)));
    if (k === 'n') run(() => playEvents(game.takeInsurance(false)));
    return;
  }
  if (game.phase !== 'player') return;
  if (k === 'h') run(() => playEvents(game.hit()));
  if (k === 's') run(() => playEvents(game.stand()));
  if (k === 'd' && game.canDouble()) run(() => playEvents(game.double()));
  if (k === 'p' && game.canSplit()) run(() => playEvents(game.split()));
});

document.addEventListener('pointerdown', e => {
  unlock();
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  b.classList.add('pressed');
  const x0 = e.clientX, y0 = e.clientY;
  const move = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) end(); };
  const end = () => {
    b.classList.remove('pressed');
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
});

// ---------- sound toggle ----------
function paintSound() {
  const on = soundOn();
  els.btnSound.setAttribute('aria-pressed', String(on));
  els.btnSound.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  els.btnSound.classList.toggle('off', !on);
}
setSound(store.get('bj.sound', true));
els.btnSound.addEventListener('click', () => {
  setSound(!soundOn());
  store.set('bj.sound', soundOn());
  paintSound();
  if (soundOn()) sound.chip();
});
paintSound();

function paintHint() {
  els.btnHint.setAttribute('aria-pressed', String(hintOn));
  els.btnHint.setAttribute('aria-label', hintOn ? 'Hide the recommended move' : 'Show the recommended move');
}
els.btnHint.addEventListener('click', () => {
  hintOn = !hintOn;
  store.set('bj.hint', hintOn);
  paintHint(); renderControls(); sound.click();
  toast(hintOn ? 'Showing the basic-strategy move' : 'Hint off');
});
paintHint();

// ---------- theme ----------
const themeBtns = [...els.themeSeg.querySelectorAll('button')];
const knobX = new Spring(0, v => els.themeKnob.style.transform = `translateX(${v}px)`, { response: .32, eps: .05 });
function themeMode() { return document.documentElement.getAttribute('data-theme-mode') || 'auto'; }
function applyTheme(mode, animate) {
  const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme-mode', mode);
  store.set('bj.theme', mode);
  const i = themeBtns.findIndex(b => b.dataset.mode === mode);
  themeBtns.forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
  const x = themeBtns[i].offsetLeft - 2;
  animate ? knobX.set(x) : knobX.jump(x);
}
themeBtns.forEach(b => b.addEventListener('click', () => { applyTheme(b.dataset.mode, true); sound.click(); }));
els.themeSeg.addEventListener('keydown', e => {
  const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const i = themeBtns.findIndex(b => b.dataset.mode === themeMode());
  const n = themeBtns[(i + d + themeBtns.length) % themeBtns.length];
  applyTheme(n.dataset.mode, true); n.focus();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeMode() === 'auto') applyTheme('auto', false); });
applyTheme(themeMode(), false);

// ---------- init ----------
let resizeT = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { relayout(false); applyTheme(themeMode(), false); }, 90);
});
addSpot(0);
sizeSpacers();
if (lastBet && game.canBet(lastBet)) game.addBet(lastBet);
els.bankroll.textContent = fmt(game.bankroll);
renderBet(false); renderControls(); renderShoe();

// deliberate debug hook: makes the game inspectable from the console, and is what
// the screenshot pass uses to stack a known shoe. Play money, local storage only.
window.__bj = { game, views, spots, busy: () => busy };

// The whole game is cached on the first visit, so it plays with no connection at
// all: dealing, splitting, statistics and the bankroll are local either way.
// The two notices below are the only thing the network changes.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('Updated - reopen the game to get the new version', 2600);
  });
}
window.addEventListener('offline', () => toast('Offline - the game plays on', 2200));
window.addEventListener('online', () => { if (document.visibilityState === 'visible') toast('Back online'); });
