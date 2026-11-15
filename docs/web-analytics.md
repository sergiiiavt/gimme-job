# Web analytics

GimmeJob counts page views with [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/). It is cookieless and stores no personal identifiers, so the site needs no consent banner. The data stays with Cloudflare, which already serves every request.

## How it works

- `worker/web-analytics.ts` adds the Cloudflare beacon (`https://static.cloudflareinsights.com/beacon.min.js`) to the `<head>` of HTML documents.
- It runs only when the Worker has a valid `CLOUDFLARE_WEB_ANALYTICS_TOKEN`, the request is a `GET` to `https://gimme-job.com`, and the response is a `200` HTML page. Local dev, `workers.dev` previews, and tests never load it.
- Hand-written pages that send their own strict `Content-Security-Policy` (sign-in and OAuth pages) are skipped.
- The baseline CSP in `worker/security-headers.ts` sets no `script-src`, `connect-src`, or `default-src`, so the beacon and its reports to `https://cloudflareinsights.com` are allowed. `tests/web-analytics.test.ts` fails if a future CSP change would block them.
- The beacon runs in SPA mode, so client-side navigation also counts as page views.

## Setup

1. In the Cloudflare dashboard, open **Analytics & Logs → Web Analytics → Add a site**, enter `gimme-job.com`, and pick the manual JavaScript snippet setup. If Cloudflare offers automatic injection for the proxied zone, leave it off so the beacon is not loaded twice.
2. Copy the `token` value from the snippet (`data-cf-beacon='{"token": "…"}'`). It is a public, 32-character hex value, not a secret.
3. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add a repository variable named `CLOUDFLARE_WEB_ANALYTICS_TOKEN` with that value.
4. Deploy `main` (merge a change or run **Deploy production** manually). The deploy log ends with `Web Analytics: enabled`. An invalid token fails the deploy before D1 migrations or the Worker upload run.

Removing the variable and redeploying turns analytics off again.

## Checking it works

1. Open `https://gimme-job.com/?utm_source=threads` in a private window and view the page source. The `<head>` contains `static.cloudflareinsights.com/beacon.min.js` with your token.
2. In the browser's network panel, a `POST` to `cloudflareinsights.com/cdn-cgi/rum` follows the page load.
3. Visits appear in **Web Analytics** within a few minutes.

## Social traffic and UTM tags

Cloudflare Web Analytics ignores query strings, so `utm_*` parameters are not reported. Instagram and Threads visits show up under **Referer** as `l.instagram.com` and `l.threads.com` (or `l.threads.net`), the link shims both apps use. In-app browsers sometimes drop the referrer, and those visits are counted as direct traffic. Keep the UTM tags on the profile links anyway: they cost nothing, and they let a future tool attribute the same links without editing the profiles.
