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

Cloudflare Web Analytics ignores query strings, so `utm_*` parameters are not reported there. Instagram and Threads visits show up under **Referer** as `l.instagram.com` and `l.threads.com` (or `l.threads.net`), the link shims both apps use. In-app browsers, Telegram's in particular, often drop the referrer, and Web Analytics counts those visits as direct traffic. The Worker counts tagged traffic itself, as described in the next section.

## Campaign counting (Workers Analytics Engine)

`worker/campaign-analytics.ts` writes one [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) data point to the `gimmejob_campaigns` dataset in two cases. The `CAMPAIGN_ANALYTICS` binding is added by `scripts/deploy-cloudflare.mjs`, and Cloudflare creates the dataset on the first write.

- **Tagged page views (`page`).** A `GET` to `https://gimme-job.com` that carries any `utm_*` parameter and returns a `200` HTML page.
- **Short links (`go`).** A `GET` to `/go/<slug>`. The Worker answers with a `302` to the slug's page, tagged with the slug's UTM values. The slugs live in `app/campaign-links.ts`, and an unknown slug returns `404`. Short links redirect on every host, so they also work in local dev, but only production clicks are counted.

Link-preview and search crawlers are skipped by user agent: TelegramBot, facebookexternalhit, LinkedInBot, Twitterbot, Slackbot, WhatsApp, Discordbot, Googlebot, and bingbot. The write runs in `ctx.waitUntil` and never delays the response. Without the binding (local dev, tests) nothing is written. No cookie, IP address, or user agent is stored, so this needs no consent banner either.

Following a short link writes two data points: a `go` point for the click, then a `page` point when the tagged page loads. Filter on one event type at a time. `page` counts every tagged visit that reached the site, short-link visits included. `go` counts short-link clicks, including visitors who left before the page loaded.

| Column | Value |
| --- | --- |
| `index1` | `utm_source` |
| `blob1` | `utm_source` |
| `blob2` | `utm_medium` |
| `blob3` | `utm_campaign` |
| `blob4` | `utm_content` |
| `blob5` | path, for example `/uk/interview` or `/go/dou` |
| `blob6` | two-letter country code from `request.cf.country` |
| `blob7` | referrer host, for example `l.instagram.com`, or empty when the app sent none |
| `blob8` | event: `page` or `go` |

Tag values are lowercased and trimmed before they are stored, and a missing tag is stored as an empty string. Tag links the way `withUtm()` in `app/social-profiles.ts` does: lowercase snake_case, with `utm_medium` set to `organic_social`, `community`, `referral`, or `share`.

### Adding a short link

Add an entry to `CAMPAIGN_LINKS` in `app/campaign-links.ts` and deploy. Slugs are lowercase. Once a slug is printed in a bio, a post, or a video, keep it working. You can change its target, but never reuse it for another campaign.

### Querying

Queries go to the [Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/). Create an API token with the **Account → Account Analytics → Read** permission. The deploy token does not need it. This query counts tagged page views by source and content for the last 7 days:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  --header "Authorization: Bearer $CLOUDFLARE_ANALYTICS_READ_TOKEN" \
  --data "
    SELECT
      blob1 AS utm_source,
      blob4 AS utm_content,
      SUM(_sample_interval) AS visits
    FROM gimmejob_campaigns
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob8 = 'page'
    GROUP BY utm_source, utm_content
    ORDER BY visits DESC
    FORMAT JSON"
```

`SUM(_sample_interval)` is used instead of `COUNT()` because Analytics Engine may sample busy datasets, and the sample interval weights each stored point back up. Replace `blob8 = 'page'` with `blob8 = 'go'` to count short-link clicks, or group by `blob3` (campaign) or `blob5` (path) instead. `SHOW TABLES` lists the dataset once the first point is written. Data is kept for three months.

### Test traffic

Analytics Engine cannot delete rows, so keep test clicks out of the data instead:

- Check a short link with `curl -I https://gimme-job.com/go/<slug>`. A `HEAD` request gets the same `302` but is not counted.
- Tag a test page view with `utm_source=deploy_check` and add `AND blob1 != 'deploy_check'` to report queries.

The #663 deployment check wrote three rows on 2026-11-28 between 11:09:36 and 11:09:38 UTC, before this rule existed: a `go` row each for `/go/dou` and `/go/ig` with an empty referrer, and a `page` row with `utm_source=deploy_check`. Exclude them with `AND timestamp NOT BETWEEN toDateTime('2026-11-28 11:09:00') AND toDateTime('2026-11-28 11:10:00')` until they expire at the end of February 2027.

The Free plan includes 100,000 writes and 10,000 read queries a day ([pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)).
