# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Create `.env` File
```bash
cp .env.example .env
```

### 3. Edit `.env` with Your Credentials

```env
# Required
PORT=3000
HOST=https://your-app-url.com
SHOPIFY_API_KEY=your_api_key_from_partners_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partners_dashboard
SESSION_SECRET=run_this_command_to_generate

# Optional
GTM_DEFAULT_ID=GTM-XXXXXXX
LOG_LEVEL=info
```

### 4. Generate Session Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste it as `SESSION_SECRET` in `.env`

### 5. Start Server
```bash
npm run dev
```

### 6. Test Locally

Open: `http://localhost:3000/admin/settings`

---

## 🔧 For Development Testing

If you have a dev store with a custom app already set up:

1. Go to Settings UI: `http://localhost:3000/admin/settings`
2. Enter your shop domain (e.g., `mystore.myshopify.com`)
3. Enter your access token (starts with `shpat_`)
4. Click "Enable GTM" and "Enable DataLayer"

---

## 🌐 For Production OAuth Flow

### 1. Create App in Shopify Partners

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Apps → Create app → Custom app
3. App name: `analyticsgtm`
4. App URL: `https://your-app-url.com`
5. Allowed redirection URL(s): `https://your-app-url.com/auth/callback`

### 2. Configure Scopes

Required scopes:
- `write_themes`
- `read_themes`

Optional (for pixel API):
- `write_pixels`
- `read_pixels`

### 3. Get API Credentials

Copy from your app settings:
- API key → `SHOPIFY_API_KEY`
- API secret key → `SHOPIFY_API_SECRET`

### 4. Deploy Your App

Deploy to:
- Render
- Railway
- Heroku
- DigitalOcean
- Any Node.js hosting

Update `HOST` in `.env` with your deployment URL.

### 5. Install on Store

Visit: `https://your-app-url.com/auth?shop=yourstore.myshopify.com`

---

## ✅ Verification

After installation:

1. **Check Database**
   ```bash
   sqlite3 data/shops.db "SELECT shop, installed_at FROM shops;"
   ```

2. **Check Logs**
   ```bash
   tail -f logs/combined.log
   ```

3. **Test GTM Injection**
   - View your store's theme.liquid
   - Look for `<!-- Google Tag Manager -->` in `<head>`
   - Look for GTM noscript in `<body>`

4. **Test DataLayer**
   - View any product page on your store
   - Open browser console
   - Type: `dataLayer`
   - You should see events being pushed

---

## 🔍 Debug Checklist

### OAuth Not Working?
- [ ] `SHOPIFY_API_KEY` matches Partner Dashboard
- [ ] `SHOPIFY_API_SECRET` matches Partner Dashboard
- [ ] `HOST` is correct deployment URL
- [ ] Redirect URL configured in Partner Dashboard
- [ ] Shop domain format: `store.myshopify.com`

### Database Not Creating?
- [ ] `data/` directory exists
- [ ] Write permissions on `data/` folder
- [ ] `better-sqlite3` installed correctly
- [ ] Check logs: `tail -f logs/error.log`

### Webhooks Not Firing?
- [ ] Webhook URL: `https://your-app-url.com/webhooks/app/uninstalled`
- [ ] Topic: `app/uninstalled`
- [ ] `SHOPIFY_API_SECRET` set in `.env`
- [ ] App is actually installed on shop

---

## 📚 Next Steps

1. **Customize GTM ID**: Edit `GTM_DEFAULT_ID` in `.env`
2. **Test Events**: Install on dev store and test dataLayer events
3. **Configure Pixel**: Manually add custom pixel for checkout events
4. **Review Logs**: Monitor `logs/combined.log` for issues
5. **Production Deploy**: Deploy to hosting service

---

## 🆘 Common Issues

### "Database not initialized"
```bash
# Solution: Restart server
npm run dev
```

### "Invalid shop domain"
```bash
# Shop must be: store.myshopify.com (not custom domain)
```

### "Webhook verification failed"
```bash
# Check SHOPIFY_API_SECRET in .env
# Make sure it matches Partner Dashboard
```

### Pixel not tracking checkout
```bash
# Custom pixel must be manually added in:
# Shopify Admin → Settings → Customer events
# Copy code from app settings page
```

---

## 🎓 Learn More

- [Shopify OAuth Documentation](https://shopify.dev/docs/apps/auth/oauth)
- [Theme Asset API](https://shopify.dev/docs/api/admin-rest/2025-10/resources/asset)
- [Web Pixels API](https://shopify.dev/docs/api/admin-rest/2025-10/resources/web-pixel)
- [Customer Events](https://shopify.dev/docs/api/web-pixels-api)

---

**Need Help?**  
Check `logs/error.log` or `logs/combined.log` for detailed error messages.
