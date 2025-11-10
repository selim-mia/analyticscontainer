// server/oauth.js — Shopify OAuth implementation
import crypto from "crypto";
import { log } from "./logger.js";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || "write_themes,read_themes";

// Use RENDER_EXTERNAL_URL in production, fallback to hardcoded production URL
// This ensures localhost HOST env var doesn't break production OAuth
const HOST = process.env.RENDER_EXTERNAL_URL || "https://analyticsgtm.onrender.com";

// Validate shop domain
export function isValidShopDomain(shop) {
  if (!shop) return false;
  
  // Must end with .myshopify.com
  const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopPattern.test(shop);
}

// Generate nonce for OAuth state
export function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

// Build OAuth authorization URL
export function buildAuthorizationUrl(shop, nonce) {
  const authUrl = `https://${shop}/admin/oauth/authorize`;
  const redirectUri = `${HOST}/auth/callback`;
  
  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: nonce,
  });
  
  return `${authUrl}?${params.toString()}`;
}

// Verify OAuth callback
export function verifyOAuthCallback(query, nonce) {
  const { code, hmac, shop, state } = query;
  
  // Verify all required parameters exist
  if (!code || !hmac || !shop || !state) {
    throw new Error("Missing required OAuth parameters");
  }
  
  // Verify state matches nonce (CSRF protection)
  if (state !== nonce) {
    throw new Error("Invalid OAuth state - possible CSRF attack");
  }
  
  // Verify shop domain
  if (!isValidShopDomain(shop)) {
    throw new Error("Invalid shop domain");
  }
  
  // Verify HMAC
  const queryWithoutHmac = { ...query };
  delete queryWithoutHmac.hmac;
  
  const message = Object.keys(queryWithoutHmac)
    .sort()
    .map((key) => `${key}=${queryWithoutHmac[key]}`)
    .join("&");
  
  const generatedHmac = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");
  
  if (generatedHmac !== hmac) {
    throw new Error("HMAC validation failed");
  }
  
  return true;
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(shop, code) {
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const redirectUri = `${HOST}/auth/callback`;
  
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error("No access token in response");
    }
    
    log.shopify.oauth(shop, "Token exchange successful");
    
    return {
      accessToken: data.access_token,
      scope: data.scope,
    };
  } catch (error) {
    log.error("Token exchange error", error, { shop });
    throw error;
  }
}

// Verify webhook HMAC
export function verifyWebhookHmac(data, hmacHeader) {
  if (!SHOPIFY_API_SECRET) {
    log.warn("SHOPIFY_API_SECRET not set - webhook verification skipped");
    return false;
  }
  
  if (!hmacHeader) {
    log.warn("No HMAC header in webhook request");
    return false;
  }
  
  const hash = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(data, "utf8")
    .digest("base64");
  
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(hmacHeader)
  );
}

// Verify API request (for admin API calls)
export function verifyApiRequest(shop, accessToken) {
  if (!shop || !isValidShopDomain(shop)) {
    throw new Error("Invalid shop domain");
  }
  
  if (!accessToken || !accessToken.startsWith("shpat_")) {
    throw new Error("Invalid access token format");
  }
  
  return true;
}
