# 🚀 Quick Publishing Checklist

## Step 1: Choose Hosting ✓

Pick one:
- [ ] **Render.com** (Recommended - Free)
- [ ] **Railway.app** ($5 credit/month)
- [ ] **DigitalOcean** ($5/month)
- [ ] **Heroku** (Paid)

---

## Step 2: Create Shopify Partner Account ✓

1. [ ] Go to: https://partners.shopify.com/signup
2. [ ] Create account
3. [ ] Verify email

---

## Step 3: Create Shopify App ✓

1. [ ] Partners Dashboard → Apps → Create app
2. [ ] Choose: "Custom app"
3. [ ] App name: `Analytics GTM`
4. [ ] Click "Create app"

---

## Step 4: Get API Credentials ✓

From Partners Dashboard:
1. [ ] Copy **API key**
2. [ ] Copy **API secret key**
3. [ ] Save them securely

---

## Step 5: Deploy to Hosting ✓

### For Render.com:

1. [ ] Push code to GitHub:
   ```bash
   git add .
   git commit -m "Ready for production"
   git push origin main
   ```

2. [ ] Go to https://render.com
3. [ ] Sign up with GitHub
4. [ ] New → Web Service
5. [ ] Connect repo: `selim-mia/analyticscontainer`
6. [ ] Settings:
   - Name: `analyticsgtm`
   - Build: `npm install`
   - Start: `npm start`
7. [ ] Click "Create Web Service"

---

## Step 6: Set Environment Variables ✓

In Render Dashboard → Environment tab, add:

```
SHOPIFY_API_KEY = [paste from Partners]
SHOPIFY_API_SECRET = [paste from Partners]
SCOPES = write_themes,read_themes,write_pixels,read_pixels
HOST = https://YOUR-APP-NAME.onrender.com
PORT = 3000
NODE_ENV = production
SESSION_SECRET = [generate new with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
GTM_DEFAULT_ID = GTM-XXXXXXX
LOG_LEVEL = info
```

**Important:** Replace `YOUR-APP-NAME` with actual Render URL!

---

## Step 7: Update Shopify Partners URLs ✓

In Partners Dashboard → App setup:

1. [ ] App URL: `https://YOUR-APP-NAME.onrender.com`
2. [ ] Allowed redirection URL(s): `https://YOUR-APP-NAME.onrender.com/auth/callback`
3. [ ] Save

---

## Step 8: Configure Scopes ✓

In Partners Dashboard → Configuration → API access:

Required:
- [ ] `write_themes`
- [ ] `read_themes`

Optional (for pixel):
- [ ] `write_pixels`
- [ ] `read_pixels`

---

## Step 9: Configure Webhook ✓

In Partners Dashboard → Configuration:

1. [ ] Add webhook subscription
2. [ ] Topic: `app/uninstalled`
3. [ ] URL: `https://YOUR-APP-NAME.onrender.com/webhooks/app/uninstalled`
4. [ ] Format: JSON
5. [ ] Save

---

## Step 10: Create Dev Store ✓

1. [ ] Partners → Stores → Add store
2. [ ] Choose "Development store"
3. [ ] Store name: `test-analyticsgtm`
4. [ ] Create store

---

## Step 11: Install on Dev Store ✓

1. [ ] Open: `https://YOUR-APP-NAME.onrender.com/auth?shop=test-analyticsgtm.myshopify.com`
2. [ ] Complete OAuth flow
3. [ ] Grant permissions
4. [ ] Redirected to settings page

---

## Step 12: Test Features ✓

### Test GTM Injection:
1. [ ] Settings page → Enable GTM
2. [ ] Enter GTM ID: `GTM-XXXXXXX`
3. [ ] Click "Enable GTM"
4. [ ] Check theme.liquid has GTM code

### Test DataLayer:
1. [ ] Click "Enable DataLayer"
2. [ ] Check snippet created: `snippets/ultimate-datalayer.liquid`
3. [ ] Visit store → Check browser console for `dataLayer`

### Test Custom Pixel (Optional):
1. [ ] Copy pixel code
2. [ ] Shopify Admin → Settings → Customer events
3. [ ] Add custom pixel
4. [ ] Paste code
5. [ ] Save

---

## Step 13: Test Uninstall ✓

1. [ ] Shopify Admin → Apps
2. [ ] Find your app
3. [ ] Uninstall
4. [ ] Check logs - should see cleanup
5. [ ] Check theme.liquid - GTM removed
6. [ ] Check snippet - deleted

---

## Step 14: Monitor Logs ✓

In Render Dashboard → Logs:

Look for:
- [ ] "Database initialized successfully"
- [ ] "OAuth flow started"
- [ ] "Shop installed successfully"
- [ ] "GTM injected successfully"
- [ ] No errors

---

## Step 15: Go Live (Optional) ✓

### For Private App (Custom installations):
- [ ] Share installation URL with clients
- [ ] Format: `https://YOUR-APP.onrender.com/auth?shop=THEIR-STORE.myshopify.com`

### For Public App Listing:
- [ ] Fill out app listing form
- [ ] Submit for Shopify review
- [ ] Wait for approval (can take weeks)
- [ ] Listed in Shopify App Store

---

## 🎯 You're Ready if:

- ✅ App accessible at public URL
- ✅ OAuth flow works
- ✅ Database saving shops
- ✅ GTM injection works
- ✅ DataLayer tracking events
- ✅ Logs showing activity
- ✅ Uninstall cleanup works

---

## 📞 Need Help?

Check:
- `DEPLOYMENT.md` - Detailed deployment guide
- `README.md` - Full documentation
- `QUICKSTART.md` - Setup guide
- `logs/error.log` - Error messages

---

**Current Status:**
- [x] Code ready
- [x] Local testing done
- [ ] Hosting chosen
- [ ] Shopify app created
- [ ] Deployed
- [ ] Tested on dev store

**Next Step:** Choose hosting platform and deploy!
