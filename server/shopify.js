// server/shopify.js
import express from "express";
import fetch from "node-fetch";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import dotenv from "dotenv";
import { saveShop, getShop, deleteShop, getAllShops } from "./database.js";

dotenv.config();

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SCOPES = "read_themes,write_themes,read_theme_code,write_theme_code,write_script_tags,write_pixels,write_custom_pixels",
  HOST,
  BILLING_DISABLED = "1",
} = process.env;

// Basic env validation
if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !HOST) {
  throw new Error("Missing SHOPIFY_API_KEY / SHOPIFY_API_SECRET / HOST in env");
}

const sessionStorage = new SQLiteSessionStorage("sessions.sqlite");

export const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: SCOPES.split(",").map(s => s.trim()).filter(Boolean),
  hostName: HOST.replace(/^https?:\/\//, ""),
  apiVersion: ApiVersion.October25,
  isEmbeddedApp: true,
  sessionStorage,
});

export const shopifyRouter = express.Router();

// ----------------------
// OAuth start
// ----------------------
shopifyRouter.get("/auth", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).send("Missing shop param");
    const redirectUrl = await shopify.auth.begin({
      shop,
      callbackPath: "/auth/callback",
      isOnline: true,
      req,
      res,
    });
    if (redirectUrl) return res.redirect(redirectUrl);
    return res.status(500).send("Failed to build install URL");
  } catch (e) {
    console.error("Auth start error:", e);
    return res.status(500).send("Auth start error: " + e.message);
  }
});

// ----------------------
// OAuth callback
// ----------------------
shopifyRouter.get("/auth/callback", async (req, res) => {
  try {
    // Let the Shopify library handle the callback (creates session)
    await shopify.auth.callback({ isOnline: true, req, res });

    // Retrieve the current session id the library created for this request
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      console.error("Auth callback: no sessionId returned");
      return res.status(500).send("Auth error: no session created");
    }

    // Load the session from storage to get shop & accessToken
    const session = await shopify.sessionStorage.loadSession(sessionId);
    if (!session) {
      console.error("Auth callback: session not found in sessionStorage", { sessionId });
      return res.status(500).send("Auth error: session not found");
    }

    // Extract shop, token and scopes (use fallbacks)
    const shop = session.shop || req.query.shop;
    const accessToken = session.accessToken || session.access_token || session.token;
    // session.scope is typical — fallback to environment SCOPES string if needed
    const scopes =
      session.scope ||
      (session.onlineAccessInfo && session.onlineAccessInfo.scopes) ||
      SCOPES;

    if (!shop || !accessToken) {
      console.error("Auth callback: incomplete session data", { shop, accessToken, scopes });
      return res.status(500).send("Auth error: incomplete session data");
    }

    // Save to shops DB (wrapped in try/catch so redirect still occurs even if DB write fails)
    try {
      // saveShop may be synchronous (better-sqlite3) or Promise-based depending on your implementation
      const saved = saveShop(shop, accessToken, Array.isArray(scopes) ? scopes.join(",") : scopes);
      // if saveShop returns a Promise, await it
      if (saved && typeof saved.then === "function") {
        await saved;
      }
      console.info("Saved shop credentials to DB:", shop);
    } catch (dbErr) {
      console.error("Failed to save shop to DB:", dbErr);
      // continue; user still redirected
    }

    // Finally redirect to app UI
    return res.redirect(`/app?shop=${encodeURIComponent(shop)}`);
  } catch (e) {
    console.error("Auth callback error:", e);
    return res.status(400).send("Auth error: " + e.message);
  }
});

// ----------------------
// Webhooks (GDPR required endpoints - keep simple 200 responses)
// ----------------------
shopifyRouter.post("/webhooks/customers/data_request", (_req, res) => res.status(200).end());
shopifyRouter.post("/webhooks/customers/redact", (_req, res) => res.status(200).end());
shopifyRouter.post("/webhooks/shop/redact", (_req, res) => res.status(200).end());

// ----------------------
// Verify session middleware
// ----------------------
export async function verifySession(req, res, next) {
  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
    if (!sessionId) throw new Error("No session");
    const session = await shopify.sessionStorage.loadSession(sessionId);
    if (!session) throw new Error("No session data");
    req.shopifySession = session;
    next();
  } catch (e) {
    return res.status(401).send("Unauthorized: " + e.message);
  }
}

// ----------------------
// Debug / Utility endpoints (DEVELOPMENT ONLY)
// ----------------------
// 1) Show stored shop row
shopifyRouter.get("/debug/shops", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (shop) {
      const s = await getShop(shop);
      return res.json({ ok: !!s, shop: s || null });
    }
    const all = await getAllShops();
    return res.json({ ok: true, shops: all });
  } catch (e) {
    console.error("/debug/shops error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 2) Check granted access scopes from Shopify for a shop (calls Shopify /admin/oauth/access_scopes.json)
shopifyRouter.get("/debug/access_scopes", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.json({ ok: false, error: "provide ?shop=your-shop.myshopify.com" });
    const shopRow = await getShop(shop);
    if (!shopRow || !shopRow.access_token) return res.json({ ok: false, error: "No stored access token for this shop" });

    const url = `https://${shop}/admin/oauth/access_scopes.json`;
    const r = await fetch(url, {
      method: "GET",
      headers: { "X-Shopify-Access-Token": shopRow.access_token, Accept: "application/json" },
    });
    const text = await r.text();
    // Try to parse JSON, otherwise return raw text
    try {
      const parsed = JSON.parse(text);
      return res.status(r.status).json({ status: r.status, body: parsed });
    } catch {
      return res.status(r.status).send(text);
    }
  } catch (e) {
    console.error("/debug/access_scopes error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 3) List themes for the shop (verify published/main theme and ID)
shopifyRouter.get("/debug/themes", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.json({ ok: false, error: "provide ?shop=your-shop.myshopify.com" });
    const shopRow = await getShop(shop);
    if (!shopRow || !shopRow.access_token) return res.json({ ok: false, error: "No stored access token for this shop" });

    const url = `https://${shop}/admin/api/2025-10/themes.json`;
    const r = await fetch(url, {
      method: "GET",
      headers: { "X-Shopify-Access-Token": shopRow.access_token, Accept: "application/json" },
    });
    const payload = await r.json().catch(() => null);
    return res.status(r.status).json({ status: r.status, payload });
  } catch (e) {
    console.error("/debug/themes error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 4) Clear stored shop entry (useful before fresh reinstall) - DEV only
shopifyRouter.post("/debug/clear_shop", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.json({ ok: false, error: "provide ?shop=your-shop.myshopify.com" });
    const removed = await deleteShop(shop);
    return res.json({ ok: true, removed });
  } catch (e) {
    console.error("/debug/clear_shop error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default shopifyRouter;
