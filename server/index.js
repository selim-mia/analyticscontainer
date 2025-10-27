import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Helpers to read ENV default values
function envShop() { return process.env.SHOP || ""; }
function envToken() { return process.env.ACCESS_TOKEN || ""; }
const PORT = process.env.PORT || 3000;

async function shopifyFetch(shop, accessToken, path, opts = {}) {
  const url = `https://${shop}/admin/api/2024-10${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status} ${text}`);
  }
  return res.json();
}

async function getMainThemeId(shop, token) {
  const data = await shopifyFetch(shop, token, "/themes.json");
  const main = data.themes.find((t) => t.role === "main") || data.themes[0];
  if (!main) throw new Error("No theme found");
  return main.id;
}

async function getAsset(shop, token, themeId, key) {
  const q = encodeURIComponent(key);
  const data = await shopifyFetch(
    shop,
    token,
    `/themes/${themeId}/assets.json?asset[key]=${q}&theme_id=${themeId}`,
    { method: "GET" }
  );
  return data.asset;
}

async function putAsset(shop, token, themeId, key, value) {
  return shopifyFetch(shop, token, `/themes/${themeId}/assets.json`, {
    method: "PUT",
    body: JSON.stringify({ asset: { key, value } }),
  });
}

function injectIntoThemeLiquid(src) {
  const headTag = "{% render 'ultimate-datalayer', part: 'head' %}";
  const bodyTag = "{% render 'ultimate-datalayer', part: 'body' %}";

  let out = src;

  if (!out.includes(headTag)) {
    out = out.replace(/<\/head>/i, `  ${headTag}\n</head>`);
  }
  if (!out.includes(bodyTag)) {
    out = out.replace(/<body(\b[^>]*)?>/i, (m) => `${m}\n  ${bodyTag}`);
  }

  return out;
}

const SNIPPET_VALUE = `{%- assign _gtm = gtm_id | default: shop.metafields.analyticscontainer.gtm_id -%}
{%- if _gtm and _gtm != blank -%}
  {%- if part == 'head' -%}
    <script>(function(){function l(i){if(window.__ac_gtm_loaded__)return;window.__ac_gtm_loaded__=!0;window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'ac_boot'});var s=document.createElement('script');s.async=!0;s.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(i);document.head.appendChild(s)}function t(){var p=window.Shopify&&Shopify.customerPrivacy;if(!p||!p.getConsent){l('{{ _gtm | escape }}');return}p.getConsent().then(function(c){if(!c||c.analyticsProcessingAllowed)l('{{ _gtm | escape }}')})}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',t)}else{t()}})();</script>
  {%- elsif part == 'body' -%}
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{ _gtm | escape }}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  {%- endif -%}
{%- endif -%}`.trim();

export async function onAppActivated(shop, accessToken) {
  const themeId = await getMainThemeId(shop, accessToken);

  // 1) Create/update snippet
  const snippetKey = "snippets/ultimate-datalayer.liquid";
  await putAsset(shop, accessToken, themeId, snippetKey, SNIPPET_VALUE);

  // 2) Patch theme.liquid
  const themeKey = "layout/theme.liquid";
  const asset = await getAsset(shop, accessToken, themeId, themeKey);
  const orig = asset.value || Buffer.from(asset.attachment, "base64").toString("utf8");
  const patched = injectIntoThemeLiquid(orig);
  if (patched !== orig) {
    await putAsset(shop, accessToken, themeId, themeKey, patched);
  }
}

function removeRenderTags(src) {
  return src
    .replace(/\n?\s*{%\s*render\s+'ultimate-datalayer',\s*part:\s*'head'\s*%}\s*/gi, "\n")
    .replace(/\n?\s*{%\s*render\s+'ultimate-datalayer',\s*part:\s*'body'\s*%}\s*/gi, "\n");
}

export async function onAppUninstalled(shop, accessToken) {
  const themeId = await getMainThemeId(shop, accessToken);
  const themeKey = "layout/theme.liquid";
  try {
    const asset = await getAsset(shop, accessToken, themeId, themeKey);
    const orig = asset.value || Buffer.from(asset.attachment, "base64").toString("utf8");
    const cleaned = removeRenderTags(orig);
    if (cleaned !== orig) {
      await putAsset(shop, accessToken, themeId, themeKey, cleaned);
    }
  } catch (_) {}

  // Optional: delete snippet
  try {
    await shopifyFetch(
      shop,
      accessToken,
      `/themes/${themeId}/assets.json?asset[key]=snippets/ultimate-datalayer.liquid`,
      { method: "DELETE" }
    );
  } catch (_) {}
}

// === Routes ===

app.post("/api/activate", async (req, res) => {
  try {
    const shop = req.body.shop || envShop();
    const accessToken = req.body.accessToken || envToken();
    if (!shop || !accessToken) return res.status(400).json({ error: "Missing shop or accessToken" });
    await onAppActivated(shop, accessToken);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/settings/gtm", async (req, res) => {
  try {
    const shop = req.body.shop || envShop();
    const accessToken = req.body.accessToken || envToken();
    const gtmId = req.body.gtmId;
    if (!shop || !accessToken || !gtmId) return res.status(400).json({ error: "Missing shop/accessToken/gtmId" });
    const gql = `mutation metafieldsSet($metafields:[MetafieldsSetInput!]!) {
      metafieldsSet(metafields:$metafields){ metafields{ namespace key value } userErrors{ field message } }
    }`;
    const r = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: gql,
        variables: {
          metafields: [{
            namespace: "analyticscontainer",
            key: "gtm_id",
            type: "single_line_text_field",
            value: gtmId
          }]
        },
      }),
    });
    const j = await r.json();
    res.json(j);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/webhooks/app_uninstalled", async (req, res) => {
  // TODO: add HMAC verification
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`analyticscontainer running on :${PORT}`));
