# bj21

Blackjack in the browser. Static: HTML, CSS and ES modules, no build step and no dependencies. Installs on a phone as an app and plays offline.

**Play: https://rblsh.github.io/bj21/**

## Run it locally

ES modules do not load over `file://`, so any static server will do:

```bash
cd bj21
python3 -m http.server 8080
# open http://localhost:8080
```

## Rules

- 6 decks, reshuffled when the cut card at ~75% of the shoe comes out
- Dealer stands on all 17s, soft 17 included, and peeks under an ace or a ten
- Blackjack pays 3:2, insurance pays 2:1
- Double on any two cards, including after a split
- Split up to 4 hands on equal card VALUE (K and 10 split), aces get one card each
- 21 on a split hand is 21, not a blackjack
- Bankroll of 1,000 with 5 / 25 / 100 / 500 chips, kept in the browser's localStorage

## What the interface does

- Cards deal, flip and re-layout on springs that can be interrupted mid-flight
- Chips are drawn like real ones: edge notches, denominations on a single tonal scale. The bet is a stack, not a number, and chips fly into the bet and back into the bankroll
- Scores are counted from the cards ON THE TABLE, so the dealer's total grows as cards land instead of appearing final
- Light and dark themes plus auto; on a phone the switch lives in the sheet, where there is room for it
- Sound is synthesised with WebAudio, not a single audio file; the header button turns it off
- Session stats: hands, win rate, blackjacks, net, best round, bankroll peak, amount wagered, return
- A How-to-play sheet with every move, the payouts and a short basic-strategy summary
- Basic-strategy hint: the bulb in the header marks the move basic strategy would make with a dot. It is a marker, not a filled button — hit and stand are equals and the game nudges toward neither
- Keys: Space or Enter to deal and to go to the next hand, H hit, S stand, D double, P split, Y and N for insurance, ? for help, Escape to close a sheet
- Haptics on a phone at the end of a round (off when the system asks for reduced motion)

## Layout

```
index.html                markup
css/style.css             design tokens (light and dark), cards, chips, sheet
js/engine.js              pure game logic, no DOM: shoe, hands, split, insurance, settlement
js/spring.js              spring animation engine
js/sound.js               WebAudio synthesis
js/strategy.js            basic strategy: the in-game hint and the same table used in the fairness check
js/app.js                 UI: dealing, scoring, bets, panels, theme, keys
test/engine.test.mjs      engine tests: node test/engine.test.mjs
sw.js                     service worker, network-first shell cache
manifest.webmanifest      PWA manifest
icons/                    app icons
```

The engine returns an ordered list of events (`card`, `reveal`, `split`, `focus`, `bet`, `insurance`, `result`, `done`) and the interface replays them one by one. Logic is tested in Node, so the animation can change without touching the rules.

## Fairness

The engine was checked three independent ways:

- 500,000 hands played by basic strategy: the player takes 43.5% of hands, loses 47.9%, pushes 8.6%. House edge 0.451% against a published 0.40–0.46% for these rules
- The dealer's final-hand distribution for every upcard was compared with published tables: rows 2–9 differ by no more than 0.6 points on samples of 150,000, and the ten and the ace match to a tenth
- Playing "like the dealer" (hit to 17, no double, no split) gives a 5.74% house edge against a published ~5.5%

A short session proves nothing either way: over 30 hands one standard deviation of the win rate is 9 points. Eight wins out of thirty comes up about once in twenty sessions.

## Tests

```bash
node test/engine.test.mjs
```

About ninety assertions: hand values, every outcome, split and resplit to four hands, split aces, double after split, insurance in all three outcomes, bankroll limits, the cut-card reshuffle, statistics, plus a 3,000-round random run checking invariants.

## Debugging

`window.__bj` in the console gives you `game`, `views`, `spots` and `busy()`. To stack a known shoe:

```js
const g = window.__bj.game;
g.shuffle();
g.shoe.push(...['8','9','8','7'].map((r,i)=>({rank:r,suit:'SHDC'[i%4]})).reverse());
g.needsShuffle = false;
```

## Deploying

See [DEPLOY.md](DEPLOY.md). The site is GitHub Pages from `main` at the repository root; every path in the project is relative, so it works from the `/bj21/` subpath as well as from a domain root.

## Licence

MIT, see [LICENSE](LICENSE).
