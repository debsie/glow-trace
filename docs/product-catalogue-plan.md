# Product catalogue, prices and "what helped people like me"

Goal: from any scan, show products that suit the person's readings, where to buy them in South
Africa, the best current price, cheaper equivalents ("dupes"), and, once there is enough data,
which products helped people with similar readings. Glowtrace earns a referral commission; it
does not hold stock or take payment for products.

## 1. Getting product data legally

Scraping retailer sites usually breaks their terms of use and gives stale prices. Use feeds and
partner programmes instead. Check each one's current terms before building against it.

| Source                                                        | Route to check                                                           | Gives                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| Takealot                                                      | Affiliate or marketplace programme                                       | Product links, prices                |
| Amazon (amazon.co.za)                                         | Amazon Associates; product data API usually needs qualifying sales first | Links, prices, commission            |
| Clicks, Dis-Chem, Faithful to Nature, Superbalist, Woolworths | Affiliate networks they may use, or direct partnership                   | Product feeds, prices, commission    |
| Brands                                                        | Direct feeds or a partner agreement                                      | Full ingredient (INCI) lists, images |

Store only public product facts: name, brand, size, INCI list, price per retailer, link, date
checked. Prices refresh daily from feeds; show "price checked on" and never invent a deal.

## 2. Catalogue in Supabase (no personal data)

- `products` (brand, name, size, category, INCI text), `offers` (product, retailer, price in ZAR,
  URL, checked_at), readable by everyone; written only by a server job with a service key.
- Agent profiles are generated from INCI with `src/lib/ingredients.ts` (`detectActives`), so
  every catalogue product gets a profile automatically (CLAUDE.md requires one) and the
  ingredient checker works on every product.
- Vector search with **pgvector** inside Supabase (no new vendor): each product gets an embedding
  of its INCI list and claims, so "similar products" and "cheaper equivalent" are one query. The
  embeddings describe products, never people.

## 3. "Helped people with similar readings"

This needs outcome data, so it is opt-in and numbers only, like calibration sharing: "I used
product X for N weeks" plus the indicator change the app already computes. Never photos.

- Readings are bucketed (for example redness band, dryness band, skin-type self-report).
- Show a result only when at least 20 different people contributed to that product and bucket,
  and only as "people with readings like yours" with the count, never as a medical outcome.
- Wording follows the wellness rule: "indicators improved", never "treated" or "cured".

## 4. Buying

Phase 1: "Buy at Takealot, R189" opens the retailer with Glowtrace's referral tag. Disclose
referral links on the page ("Glowtrace may earn a commission"), as advertising rules require.
Phase 2, only if it pays off: a basket that sends people to each retailer. Holding stock or taking
payment means a payments provider, the Consumer Protection Act returns duties and much more legal
work.

## 5. Order of work

1. Join one or two affiliate programmes and get their feed terms (owner: needs the company).
2. Supabase tables, daily price job, offer cards on suggestions and the routine page.
3. Auto-generated agent profiles from INCI; ingredient checker on catalogue products.
4. pgvector similar-product and dupe search.
5. Opt-in "what I used" sharing, then "people like you" once the 20-person threshold is met.
