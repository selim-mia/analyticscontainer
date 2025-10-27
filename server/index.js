// server/index.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// Shopify admin iframe-এ লোড হতে দিতে CSP
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
  );
  next();
});

const PORT = process.env.PORT || 3000;

// ===== Helpers =====
function assert(v, msg) { if (!v) throw new Error(msg); }

async function shopifyFetch(shop, accessToken, path, opts = {}) {
  const url = `https://${shop}/admin/api/2024-10${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status} ${text}`);
  }
  return res.json();
}

async function getMainThemeId(shop, token) {
  const data = await shopifyFetch(shop, token, "/themes.json", { method: "GET" });
  const main = data.themes.find(t => t.role === "main") || data.themes[0];
  if (!main) throw new Error("No theme found on this shop");
  return main.id;
}

async function getAsset(shop, token, themeId, key) {
  const q = encodeURIComponent(key);
  const data = await shopifyFetch(
    shop, token,
    `/themes/${themeId}/assets.json?asset[key]=${q}&theme_id=${themeId}`,
    { method: "GET" }
  );
  return data.asset;
}

async function putAsset(shop, token, themeId, key, value) {
  return shopifyFetch(shop, token, `/themes/${themeId}/assets.json`, {
    method: "PUT",
    body: JSON.stringify({ asset: { key, value } })
  });
}

function injectIntoThemeLiquid(src) {
  const headTag = "{% render 'ultimate-datalayer', part: 'head' %}";
  const bodyTag = "{% render 'ultimate-datalayer', part: 'body' %}";
  let out = src;
  if (!out.includes(headTag)) out = out.replace(/<\/head>/i, `  ${headTag}\n</head>`);
  if (!out.includes(bodyTag)) out = out.replace(/<body(\b[^>]*)?>/i, (m) => `${m}\n  ${bodyTag}`);
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

// ===== API =====

// GTM ID save → shop metafield
app.post("/api/settings/gtm", async (req, res) => {
  try {
    const { shop, accessToken, gtmId } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing or invalid 'shop'");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing or invalid 'accessToken' (shpat_...)");
    assert(gtmId && /^GTM-[A-Z0-9]+$/.test(gtmId), "Missing or invalid 'gtmId' (format GTM-XXXXXXX)");

    const gql = `mutation metafieldsSet($metafields:[MetafieldsSetInput!]!){
      metafieldsSet(metafields:$metafields){
        metafields{ namespace key value }
        userErrors{ field message }
      }
    }`;
    const r = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: gql,
        variables: { metafields: [{
          namespace: "analyticscontainer",
          key: "gtm_id",
          type: "single_line_text_field",
          value: gtmId
        }] }
      })
    });
    const j = await r.json();
    const errs = j?.data?.metafieldsSet?.userErrors || [];
    if (errs.length) throw new Error(errs.map(e=>e.message).join("; "));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// Snippet create + theme.liquid inject
app.post("/api/activate", async (req, res) => {
  try {
    const { shop, accessToken } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing or invalid 'shop'");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing or invalid 'accessToken' (shpat_...)");

    const themeId = await getMainThemeId(shop, accessToken);
    await putAsset(shop, accessToken, themeId, "snippets/ultimate-datalayer.liquid", SNIPPET_VALUE);

    const themeKey = "layout/theme.liquid";
    const asset = await getAsset(shop, accessToken, themeId, themeKey);
    const orig = asset.value || Buffer.from(asset.attachment, "base64").toString("utf8");
    const patched = injectIntoThemeLiquid(orig);
    if (patched !== orig) {
      await putAsset(shop, accessToken, themeId, themeKey, patched);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// Minimal UI
app.get("/admin/settings", (req, res) => {
  const shop = req.query.shop || process.env.SHOP || "";
  res.type("html").send(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AnalyticsContainer • Settings</title>
<style>
 body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;background:#f8fafc;margin:0}
 .wrap{max-width:760px;margin:40px auto;padding:0 16px}
 .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 1px 12px rgba(0,0,0,.04);padding:22px}
 label{display:block;margin-bottom:6px;font-weight:600}
 input[type=text]{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px}
 .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
 .btn{appearance:none;border:0;background:#111827;color:#fff;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer}
 .btn.secondary{background:#374151}
 .muted{color:#6b7280;font-size:12px}
 .toast{padding:10px 12px;border-radius:8px;margin-top:10px;display:none}
 .ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
 .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
</style>
<div class="wrap"><div class="card">
  <h1>AnalyticsContainer – Settings</h1>
  <p class="muted">Save your GTM container ID, then inject the snippet into your theme.</p>
  <form id="f">
    <label>Shop domain (myshopify.com)</label>
    <input id="shop" type="text" placeholder="your-store.myshopify.com" value="${shop}">
    <div class="row">
      <div>
        <label>GTM Container ID</label>
        <input id="gtm" type="text" placeholder="GTM-XXXXXXX">
      </div>
      <div>
        <label>Admin API Access Token <span class="muted">(shpat_… for dev test)</span></label>
        <input id="tok" type="text" placeholder="shpat_xxx">
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-top:14px">
      <button class="btn" type="submit">Save GTM ID</button>
      <button class="btn secondary" id="activate" type="button">Inject into Theme</button>
    </div>
    <div id="ok" class="toast ok">Saved!</div>
    <div id="err" class="toast err">Something went wrong</div>
  </form>
</div></div>
<script>
const f = document.getElementById('f');
const ok = document.getElementById('ok');
const err = document.getElementById('err');
const btnActivate = document.getElementById('activate');
function show(el){ el.style.display='block'; setTimeout(()=>el.style.display='none', 3500); }

f.addEventListener('submit', async (e) => {
  e.preventDefault(); ok.style.display='none'; err.style.display='none';
  const payload = {
    shop: document.getElementById('shop').value.trim(),
    accessToken: document.getElementById('tok').value.trim(),
    gtmId: document.getElementById('gtm').value.trim()
  };
  try {
    const r = await fetch('/api/settings/gtm', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json();
    if(!r.ok || j.error) throw new Error(j.error || 'error');
    ok.innerText = 'Saved!'; show(ok);
  } catch(e){ err.innerText = 'Failed to save: ' + e.message; show(err); }
});

btnActivate.addEventListener('click', async () => {
  ok.style.display='none'; err.style.display='none';
  const payload = {
    shop: document.getElementById('shop').value.trim(),
    accessToken: document.getElementById('tok').value.trim()
  };
  try {
    const r = await fetch('/api/activate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || j.error) throw new Error(j.error || 'error');
    ok.innerText = 'Injected! Check your theme files.'; show(ok);
  } catch(e){ err.innerText = 'Injection failed: ' + e.message; show(err); }
});
</script>`);
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>analyticscontainer</title>
  <h1>AnalyticsContainer</h1><p><a href="/admin/settings">Open Settings UI</a></p>`);
});

app.listen(PORT, () => console.log(`analyticscontainer running on :${PORT}`));
