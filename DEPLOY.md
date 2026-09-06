# Deploying

Live at **https://rblsh.github.io/bj21/** — GitHub Pages, served from branch `main` at the repository root.

## How it is set up

- Repository `rblsh/bj21`, public
- Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`
- `.nojekyll` at the root, so Pages copies the files as they are instead of running Jekyll over them. Without it any path starting with an underscore would be dropped
- No build step: there is nothing to compile, Pages just serves the folder

Every reference in the project is relative (`css/style.css`, `js/app.js`, `start_url: "."` in the manifest, `scope: "."`), which is why the game works under the `/bj21/` subpath and would work unchanged at the root of a domain.

## Releasing a new version

```bash
git push
```

Pages rebuilds in under a minute. **Bump `CACHE` in `sw.js` before every release** (currently `bj21-v3`). The service worker is network-first, so fresh code arrives anyway, but the offline copy only refreshes under a new cache name.

## Caching

GitHub Pages sets its own headers and does not read a `_headers` file — it serves everything with a 10-minute `max-age` and an ETag. That is fine here: nothing is content-hashed, and the service worker checks the network first. Should the caching ever matter more, the alternative is a host that honours per-path headers.

## Checks after a release

- Open the page, play a round, look at the console
- On a phone: "Add to Home Screen" installs it, it opens without an address bar and plays in airplane mode
- `node test/engine.test.mjs` passes locally before pushing — Pages will happily publish a broken build

## A custom domain, if it ever comes back

Settings → Pages → Custom domain, plus a `CNAME` record pointing at `rblsh.github.io`. GitHub then writes a `CNAME` file into the repository root. Nothing else in the project needs to change.
