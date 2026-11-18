# Search visibility plan (SEO, AEO, GEO)

Honest baseline: nobody can guarantee the first result for a broad term like "makeup tool". The
plan is to win specific, high-intent searches first, become the answer AI assistants quote, then
grow authority until broader terms follow.

## Already built

- Unique titles, descriptions, canonical URLs (once `VITE_SITE_URL` is set), Open Graph images.
- JSON-LD: Organization, WebSite, SoftwareApplication with ZAR prices, FAQPage, BreadcrumbList.
- `sitemap.xml`, `robots.txt` that welcomes search and AI crawlers, `llms.txt` summary for AI.
- Answer pages (`src/content/answer-pages.ts`): each opens with a direct, quotable answer, then
  steps, reasons and FAQs. Add a page per new search to win; reuse `AnswerPageView`.
- Fast, accessible, mobile-first pages; no render-blocking third-party scripts.

## Do this first (needs the live domain)

1. **Domain:** connect it in Vercel (Settings → Domains); set `VITE_SITE_URL` to it and redeploy.
   Add `Sitemap: https://YOUR-DOMAIN/sitemap.xml` to `public/robots.txt`.
2. **Google Search Console:** add the domain property, verify by DNS, submit the sitemap, request
   indexing for `/`, `/pricing`, `/skin-analysis-app`, `/makeup-artist-app`.
3. **Bing Webmaster Tools:** import from Search Console and submit the sitemap. Bing's index feeds
   ChatGPT search, Copilot and DuckDuckGo.
4. **Google Business Profile** if you have a South African business address: helps local
   searches such as "makeup artist app Johannesburg".

## Searches to win next (one answer page each)

| Search                                   | Page idea                                 |
| ---------------------------------------- | ----------------------------------------- |
| skin care routine app South Africa       | Routines built from your own shelf        |
| bridal makeup trial checklist            | Free checklist that leads into MUA Studio |
| hair porosity test app                   | How the hair scan reads porosity          |
| does my skincare clash (retinol and BHA) | The care agent's conflict checker         |
| makeup artist booking app South Africa   | Bookings angle for MUA Studio             |

Write the first paragraph as the complete answer in under 60 words. AI assistants and Google's
answer boxes lift exactly that.

## Authority (what moves rankings and AI mentions most)

- **Reviews:** ask happy beta testers (the dashboard's Thank flow) for a short public review.
- **Mentions:** South African beauty bloggers and makeup artist directories; a founder story for
  local tech press. AI answers lean on these third-party mentions.
- **Partners:** the affiliate programme gives makeup artists a reason to link to Glowtrace.
- **Original data:** publish anonymised, aggregate beta insights (for example "most common skin
  concern among testers") only with consent and only in aggregate. Journalists link to data.

## Measure monthly

Search Console (impressions, clicks, position per query), Bing Webmaster (same), and a manual
check of how ChatGPT, Perplexity, Gemini and Copilot answer "best skin analysis app South Africa"
and "makeup artist app South Africa". Note whether Glowtrace is named and which source is cited.
