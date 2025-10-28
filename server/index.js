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

// ===== Config (edit these if you want) =====
const DEFAULT_GTM_ID = process.env.GTM_DEFAULT_ID || "GTM-KXSP7VPD";

// ===== Helpers =====
function assert(v, msg){ if(!v) throw new Error(msg); }

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
  if (!res.ok) throw new Error(`Shopify ${res.status} ${await res.text()}`);
  return res.json();
}
async function getMainThemeId(shop, token) {
  const data = await shopifyFetch(shop, token, "/themes.json", { method:"GET" });
  const main = data.themes.find(t => t.role === "main") || data.themes[0];
  if (!main) throw new Error("No theme found");
  return main.id;
}
async function getAsset(shop, token, themeId, key) {
  const q = encodeURIComponent(key);
  const data = await shopifyFetch(shop, token, `/themes/${themeId}/assets.json?asset[key]=${q}&theme_id=${themeId}`, { method:"GET" });
  return data.asset;
}
async function putAsset(shop, token, themeId, key, value) {
  return shopifyFetch(shop, token, `/themes/${themeId}/assets.json`, {
    method:"PUT",
    body: JSON.stringify({ asset: { key, value } })
  });
}

// ===== Your payloads (PASTE YOUR FILE CONTENTS BELOW) =====
// 1) ultimate-datalayer.liquid → paste exact contents between backticks
const UDL_SNIPPET_VALUE = `PASTE_YOUR_ultimate-datalayer.liquid_CONTENT_HERE`;

// 2) checkout-webpixel.js → paste exact JS (NO <script> wrapper) between backticks
const CUSTOM_PIXEL_JS   = `PASTE_YOUR_checkout-webpixel.js_CONTENT_HERE`;

// ===== Injectors =====
function injectExactGTM(src, gtmId = DEFAULT_GTM_ID) {
  const headTag = [
    "<!-- Google Tag Manager -->",
    "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':",
    "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],",
    "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=",
    "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);",
    `})(window,document,'script','dataLayer','${gtmId}');</script>`,
    "<!-- End Google Tag Manager -->"
  ].join("");

  const bodyTag = [
    "<!-- Google Tag Manager (noscript) -->",
    `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"`,
    `height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
    "<!-- End Google Tag Manager (noscript) -->"
  ].join("");

  if (!src.includes("googletagmanager.com/gtm.js")) {
    src = src.replace(/<head(\b[^>]*)?>/i, (m) => `${m}\n${headTag}\n`);
  }
  if (!src.includes("googletagmanager.com/ns.html")) {
    src = src.replace(/<body(\b[^>]*)?>/i, (m) => `${m}\n${bodyTag}\n`);
  }
  return src;
}
function injectSnippetRenders(src) {
  const renderHead = `{% render 'ultimate-datalayer', part: 'head' %}`;
  const renderBody = `{% render 'ultimate-datalayer', part: 'body' %}`;
  if (!src.includes("ultimate-datalayer', part: 'head")) {
    src = src.replace(/<\/head>/i, `  ${renderHead}\n</head>`);
  }
  if (!src.includes("ultimate-datalayer', part: 'body")) {
    src = src.replace(/<body(\b[^>]*)?>/i, (m) => `${m}\n  ${renderBody}`);
  }
  return src;
}

// ===== Endpoints =====

// 1) Enable GTM → inject head/body GTM tags ONLY
app.post("/api/gtm/enable", async (req, res) => {
  try {
    const { shop, accessToken, gtmId } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing/invalid shop");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing/invalid shpat token");

    const themeId = await getMainThemeId(shop, accessToken);
    const themeKey = "layout/theme.liquid";
    const asset = await getAsset(shop, accessToken, themeId, themeKey);
    const orig = asset.value || Buffer.from(asset.attachment, "base64").toString("utf8");
    const patched = injectExactGTM(orig, gtmId || DEFAULT_GTM_ID);
    if (patched !== orig) await putAsset(shop, accessToken, themeId, themeKey, patched);
    res.json({ ok:true });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// 2) Enable DataLayer → create snippet + render in head/body
app.post("/api/datalayer/enable", async (req, res) => {
  try {
    const { shop, accessToken } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing/invalid shop");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing/invalid shpat token");

    const themeId = await getMainThemeId(shop, accessToken);
    await putAsset(shop, accessToken, themeId, "snippets/ultimate-datalayer.liquid", UDL_SNIPPET_VALUE);

    const themeKey = "layout/theme.liquid";
    const asset = await getAsset(shop, accessToken, themeId, themeKey);
    const orig = asset.value || Buffer.from(asset.attachment, "base64").toString("utf8");
    const patched = injectSnippetRenders(orig);
    if (patched !== orig) await putAsset(shop, accessToken, themeId, themeKey, patched);
    res.json({ ok:true });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// 3) Enable custom Web Pixel (Checkout) → install/update a customer web pixel
app.post("/api/pixel/enable", async (req, res) => {
  try {
    const { shop, accessToken, name = "AnalyticsContainer Pixel" } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing/invalid shop");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing/invalid shpat token");

    const listQ = `
      { webPixels(first:50){ edges{ node{ id name } } } }
    `;
    const listR = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method:"POST",
      headers:{ "X-Shopify-Access-Token":accessToken, "Content-Type":"application/json" },
      body: JSON.stringify({ query: listQ })
    }).then(r=>r.json());

    const existing = (listR?.data?.webPixels?.edges || [])
      .map(e=>e.node)
      .find(n => (n.name||"").toLowerCase() === name.toLowerCase());

    const mutationCreate = `
      mutation webPixelCreate($webPixel: WebPixelInput!) {
        webPixelCreate(webPixel: $webPixel) {
          userErrors { field message }
          webPixel { id name }
        }
      }`;
    const mutationUpdate = `
      mutation webPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
        webPixelUpdate(id: $id, webPixel: $webPixel) {
          userErrors { field message }
          webPixel { id name }
        }
      }`;

    const input = {
      name,
      enabled: true,
      settings: "{}",
      // IMPORTANT: raw JS only (no <script> tag)
      javaScript: CUSTOM_PIXEL_JS
    };

    let mu, vars;
    if (existing?.id) {
      mu = mutationUpdate;
      vars = { id: existing.id, webPixel: input };
    } else {
      mu = mutationCreate;
      vars = { webPixel: input };
    }

    const mq = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type":"application/json" },
      body: JSON.stringify({ query: mu, variables: vars })
    }).then(r=>r.json());

    const errs = mq?.data?.webPixelCreate?.userErrors || mq?.data?.webPixelUpdate?.userErrors || [];
    if (errs.length) throw new Error(errs.map(e=>e.message).join("; "));
    res.json({ ok:true, pixel: (mq.data.webPixelCreate?.webPixel || mq.data.webPixelUpdate?.webPixel) });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// ===== Embedded Settings UI with 3 sections =====
app.get("/admin/settings", (req, res) => {
  const shop = req.query.shop || process.env.SHOP || "";
  res.type("html").send(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AnalyticsContainer • Settings</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;background:#f8fafc;margin:0}
  .wrap{max-width:860px;margin:40px auto;padding:0 16px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 1px 12px rgba(0,0,0,.04);padding:22px;margin-bottom:16px}
  h1{margin:0 0 12px 0}
  label{display:block;margin-bottom:6px;font-weight:600}
  input[type=text]{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
  .btn{appearance:none;border:0;background:#111827;color:#fff;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer}
  .btn.secondary{background:#374151}
  .muted{color:#6b7280;font-size:12px}
  .toast{padding:10px 12px;border-radius:8px;margin-top:10px;display:none}
  .ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
  .section-title{font-size:18px;margin:0 0 8px 0}
</style>
<div class="wrap">
  <div class="card">
    <h1>AnalyticsContainer – Settings</h1>
    <div class="row">
      <div>
        <label>Shop domain (myshopify.com)</label>
        <input id="shop" type="text" placeholder="your-store.myshopify.com" value="${shop}">
      </div>
      <div>
        <label>Admin API Access Token <span class="muted">(shpat_… dev test)</span></label>
        <input id="tok" type="text" placeholder="shpat_xxx">
      </div>
    </div>
  </div>

  <div class="card">
    <h2 class="section-title">1) Enable GTM</h2>
    <p class="muted">Adds GTM script in &lt;head&gt; and GTM noscript in &lt;body&gt; start. Default: <code>${DEFAULT_GTM_ID}</code></p>
    <div class="row">
      <div>
        <label>GTM Container ID</label>
        <input id="gtm" type="text" placeholder="GTM-XXXXXXX">
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-top:14px">
      <button class="btn" id="btn-gtm">Enable GTM</button>
    </div>
    <div id="ok-gtm" class="toast ok">GTM injected.</div>
    <div id="err-gtm" class="toast err">Failed.</div>
  </div>

  <div class="card">
    <h2 class="section-title">2) Enable DataLayer</h2>
    <p class="muted">Creates <code>snippets/ultimate-datalayer.liquid</code> and renders it in head/body.</p>
    <div style="display:flex;gap:12px;margin-top:14px">
      <button class="btn" id="btn-dl">Enable DataLayer</button>
    </div>
    <div id="ok-dl" class="toast ok">DataLayer snippet injected.</div>
    <div id="err-dl" class="toast err">Failed.</div>
  </div>

  <div class="card">
    <h2 class="section-title">3) Enable custom Web Pixel (Checkout)</h2>
    <p class="muted">Installs/updates a customer web pixel with your checkout code.</p>
    <div class="row">
      <div>
        <label>Pixel name</label>
        <input id="pxname" type="text" value="AnalyticsContainer Pixel">
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-top:14px">
      <button class="btn" id="btn-pixel">Enable custom Web Pixel</button>
    </div>
    <div id="ok-px" class="toast ok">Pixel installed/updated.</div>
    <div id="err-px" class="toast err">Failed.</div>
  </div>
</div>

<script>
function toast(id, ok, msg) {
  const el = document.getElementById(id);
  el.innerText = msg || (ok ? 'Done' : 'Failed');
  el.style.display='block';
  setTimeout(()=>el.style.display='none', 3500);
}
function val(id) { return document.getElementById(id).value.trim(); }

document.getElementById('btn-gtm').addEventListener('click', async () => {
  const payload = { shop: val('shop'), accessToken: val('tok'), gtmId: val('gtm') };
  try {
    const r = await fetch('/api/gtm/enable', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || j.error) throw new Error(j.error || 'error');
    toast('ok-gtm', true, 'GTM injected.');
  } catch(e) { toast('err-gtm', false, 'Error: ' + e.message); }
});

document.getElementById('btn-dl').addEventListener('click', async () => {
  const payload = { shop: val('shop'), accessToken: val('tok') };
  try {
    const r = await fetch('/api/datalayer/enable', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || j.error) throw new Error(j.error || 'error');
    toast('ok-dl', true, 'DataLayer snippet injected.');
  } catch(e) { toast('err-dl', false, 'Error: ' + e.message); }
});

document.getElementById('btn-pixel').addEventListener('click', async () => {
  const payload = { shop: val('shop'), accessToken: val('tok'), name: val('pxname') };
  try {
    const r = await fetch('/api/pixel/enable', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || j.error) throw new Error(j.error || 'error');
    toast('ok-px', true, 'Pixel installed/updated.');
  } catch(e) { toast('err-px', false, 'Error: ' + e.message); }
});
</script>`);
});

// Small root
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>analyticscontainer</title>
  <h1>AnalyticsContainer</h1><p><a href="/admin/settings">Open Settings UI</a></p>`);
});

app.listen(PORT, () => console.log(`analyticscontainer running on :${PORT}`));
