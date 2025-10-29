# analyticsgtm (Shopify) — GTM injector + datalayer snippet

This minimal Node/Express project does two things after your app is installed on a store:

1. Creates/updates a Liquid snippet: `snippets/ultimate-datalayer.liquid`
2. Patches `layout/theme.liquid` to render that snippet in both `<head>` and `<body>`

> **Note:** This repository shows the theme-asset approach you asked for.
> For App Store submission, Theme App Extensions + Web Pixel are recommended.

---

## Quick start (local dev)

1. **Node 18+** required.
2. `npm install`
3. Put your temporary shop + access token in a `.env` file or pass with the requests (see scripts).
4. Run server:  
   ```bash
   npm run dev
   ```
5. After installing the app on a **dev store**, call:
   - `POST /api/settings/gtm` with `{ shop, accessToken, gtmId }`
   - `POST /api/activate` with `{ shop, accessToken }`

The server will:
- Write `snippets/ultimate-datalayer.liquid` into the main theme
- Insert the render tags into `layout/theme.liquid` (idempotent)

### Endpoints

- `POST /api/settings/gtm` – saves metafield `analyticsgtm.gtm_id`
- `POST /api/activate` – creates snippet + injects render tags
- `POST /webhooks/app_uninstalled` – webhook placeholder (HMAC verify not included in this minimal sample)

---

## Environment

Create `.env` from `.env.example` if you want to centralize values:

```
SHOP=my-shop.myshopify.com
ACCESS_TOKEN=shpat_***
PORT=3000
```

You can also supply `shop` and `accessToken` in the JSON body per request instead.

---

## Files

- `server/index.js` — Express app with Shopify REST/GraphQL calls for assets/metafields
- `example/ultimate-datalayer.liquid` — reference snippet content (the app writes the same to the store)
- `scripts/requests.http` — ready-to-run HTTP snippets (VS Code REST Client compatible)

---

## Important

- This approach edits theme files directly. Make sure you have a theme backup.
- Consider using Theme App Extensions + Web Pixel for App Store review friendliness.
- Add HMAC verification for all webhooks and admin calls in your production app.
