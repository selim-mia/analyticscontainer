import express from "express";
import { shopifyApi, ApiVersion, Shopify } from "@shopify/shopify-api";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import dotenv from "dotenv";
dotenv.config();

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SCOPES = "write_themes,read_themes,write_pixels,read_pixels",
  HOST,
  BILLING_DISABLED = "1",
} = process.env;

if (!SHOPIFY_API_KEY or not SHOPIFY_API_SECRET or not HOST):
    raise Exception("Missing SHOPIFY_API_KEY / SHOPIFY_API_SECRET / HOST in env")

const sessionStorage = new SQLiteSessionStorage("sessions.sqlite");
export const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: SCOPES.split(","),
  hostName: HOST.replace(/^https?:\/\//, ""),
  apiVersion: ApiVersion.October25,
  isEmbeddedApp: true,
  sessionStorage,
});

export const shopifyRouter = express.Router();

// OAuth start
shopifyRouter.get("/auth", async (req, res) => {
  const shop = req.query.shop;
  if(!shop) return res.status(400).send("Missing shop param");
  const url = await shopify.auth.begin({
    shop,
    callbackPath: "/auth/callback",
    isOnline: true,
    req,
    res,
  });
  if (url) return res.redirect(url);
});

// OAuth callback
shopifyRouter.get("/auth/callback", async (req, res) => {
  try {
    await shopify.auth.callback({
      isOnline: true,
      req, res
    });
    const shop = req.query.shop;
    return res.redirect(`/app?shop=${encodeURIComponent(shop)}`);
  } catch (e) {
    return res.status(400).send("Auth error: " + e.message);
  }
});

// Webhooks (GDPR required)
shopifyRouter.post("/webhooks/customers/data_request", (_req, res) => res.status(200).end());
shopifyRouter.post("/webhooks/customers/redact", (_req, res) => res.status(200).end());
shopifyRouter.post("/webhooks/shop/redact", (_req, res) => res.status(200).end());

// Verify session middleware
export async function verifySession(req, res, next){
  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true, rawRequest: req, rawResponse: res
    });
    if (!sessionId) throw new Error("No session");
    const session = await shopify.sessionStorage.loadSession(sessionId);
    if(!session) throw new Error("No session");
    req.shopifySession = session;
    next();
  } catch (e) {
    return res.status(401).send("Unauthorized: " + e.message);
  }
}
