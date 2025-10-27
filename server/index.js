import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(express.json());
// Basic CSP so the app can be embedded in Shopify admin
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "frame-ancestors https://admin.shopify.com https://*.myshopify.com;");
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`analyticscontainer running on :${PORT}`));

app.get("/admin/settings", (req, res) => {
  const shop = req.query.shop || process.env.SHOP || "";
  res.type("html").send(`<!doctype html>
<html lang="en">
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AnalyticsContainer • Settings</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;max-width:720px;margin:40px auto;padding:0 16px;color:#0b1221;background:#f8fafc}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 1px 12px rgba(0,0,0,.04);padding:20px}
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
<div class="card">
  <h1>AnalyticsContainer – Settings</h1>
  <p class="muted">Save your Google Tag Manager Container ID for this shop.</p>
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
</div>
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
  } catch(e){ err.innerText = 'Failed to save'; show(err); }
});

btnActivate.addEventListener('click', async () => {
  ok.style.display='none'; err.style.display='none';
  const payload = {
    shop: document.getElementById('shop').value.trim(),
    accessToken: document.getElementById('tok').value.trim()
  };
  try {
    const r = await fetch('/api/activate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(!r.ok) throw new Error('error');
    ok.innerText = 'Injected! Check your theme files.'; show(ok);
  } catch(e){ err.innerText = 'Injection failed'; show(err); }
});
</script>
</html>`);
});

app.get("/", (req,res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>analyticscontainer</title>
  <h1>AnalyticsContainer</h1><p><a href="/admin/settings">Open Settings UI</a></p>`);
});
