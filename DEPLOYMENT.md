# Deployment Guide - Render.com

## Quick Deploy to Render.com (Recommended - Free Tier)

### 1. Prepare Repository
```bash
# Commit all changes
git add .
git commit -m "Production ready with OAuth, DB, and Logging"
git push origin main
```

### 2. Create Render Account
- Go to: https://render.com
- Sign up with GitHub

### 3. Create New Web Service
- Dashboard → New → Web Service
- Connect your GitHub repo: `selim-mia/analyticscontainer`
- Name: `analyticsgtm`
- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

### 4. Set Environment Variables
In Render Dashboard → Environment:

```
SHOPIFY_API_KEY=your_api_key_from_partners
SHOPIFY_API_SECRET=your_api_secret_from_partners
SCOPES=write_themes,read_themes,write_pixels,read_pixels
HOST=https://analyticsgtm.onrender.com
PORT=3000
NODE_ENV=production
SESSION_SECRET=generate_new_random_secret_here
GTM_DEFAULT_ID=GTM-XXXXXXX
LOG_LEVEL=info
BILLING_DISABLED=1
```

### 5. Deploy
- Click "Create Web Service"
- Wait for deployment (5-10 minutes)
- Note your URL: `https://analyticsgtm.onrender.com`

### 6. Update Shopify Partners
- Go back to Partners Dashboard
- Update App URL: `https://analyticsgtm.onrender.com`
- Update Redirect URL: `https://analyticsgtm.onrender.com/auth/callback`

### 7. Configure Webhook
- Partners Dashboard → App → API & Webhooks
- Add webhook:
  - Topic: `app/uninstalled`
  - URL: `https://analyticsgtm.onrender.com/webhooks/app/uninstalled`
  - Format: JSON

---

## Alternative: Railway.app

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login and Deploy
```bash
railway login
railway init
railway up
```

### 3. Set Environment Variables
```bash
railway variables set SHOPIFY_API_KEY=xxx
railway variables set SHOPIFY_API_SECRET=xxx
# ... set all other variables
```

### 4. Get URL
```bash
railway domain
```

---

## Alternative: Heroku

### 1. Install Heroku CLI
Download from: https://devcenter.heroku.com/articles/heroku-cli

### 2. Create and Deploy
```bash
heroku login
heroku create analyticsgtm-app
git push heroku main
```

### 3. Set Config Vars
```bash
heroku config:set SHOPIFY_API_KEY=xxx
heroku config:set SHOPIFY_API_SECRET=xxx
# ... set all variables
```

### 4. Get URL
```bash
heroku info
```

---

## Post-Deployment Checklist

- [ ] App accessible at public URL
- [ ] Environment variables set
- [ ] Database auto-created (check logs)
- [ ] Logs visible in dashboard
- [ ] Settings UI loads: `https://your-url.com/admin/settings`
- [ ] Shopify Partners URLs updated
- [ ] Webhook configured

---

## Testing After Deployment

### 1. Test OAuth Flow
```
https://your-deployed-url.com/auth?shop=your-dev-store.myshopify.com
```

### 2. Check Logs
- Render: Dashboard → Logs tab
- Railway: `railway logs`
- Heroku: `heroku logs --tail`

### 3. Check Database
- Should auto-create in deployed environment
- Check logs for "Database initialized successfully"

### 4. Install on Dev Store
- Complete OAuth flow
- Check if shop saved in database
- Test GTM injection
- Test DataLayer creation

---

## Important Notes

### Free Tier Limitations:
- **Render**: Sleeps after 15 min inactivity (wakes on request)
- **Railway**: $5 free credit/month
- **Heroku**: No free tier anymore (paid only)

### Recommendations:
1. Start with **Render.com** (best free tier)
2. Use **Railway** if you need always-on
3. Upgrade to paid if needed later

### Security:
- Never commit `.env` file (already in .gitignore)
- Generate new SESSION_SECRET for production
- Keep API secrets secure
- Use environment variables only

---

## Troubleshooting

### App not starting?
- Check logs for errors
- Verify all environment variables set
- Check `package.json` has `start` script

### Database errors?
- Check if `data/` directory exists
- Verify write permissions
- Check logs for specific error

### OAuth not working?
- Verify redirect URL matches exactly
- Check SHOPIFY_API_KEY and SECRET
- Ensure HOST is production URL

---

**Choose your hosting platform and follow the guide above!**
