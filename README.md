````markdown
# analyticsgtm (Shopify) — GTM Injector + DataLayer Snippet

**Production-ready Shopify App** with OAuth authentication, database storage, comprehensive logging, and automatic cleanup.

This Node/Express app helps Shopify merchants install Google Tag Manager and comprehensive ecommerce tracking:

1. **GTM Script Injection**: Injects GTM code into `<head>` and `<body>` of theme.liquid
2. **DataLayer Snippet**: Creates `snippets/ultimate-datalayer.liquid` with comprehensive ecommerce event tracking
3. **Custom Pixel**: Checkout page event tracking via Shopify Customer Events API

---

## 🚀 New Features (v0.2.0)

### ✅ OAuth Implementation
- Secure Shopify OAuth flow (`/auth` → `/auth/callback`)
- CSRF protection with nonce validation
- HMAC verification for all webhooks
- Session management with express-session

### ✅ Database Storage
- SQLite database for shop credentials
- Automatic token retrieval for uninstall cleanup
- No user data collection - only shop access tokens

### ✅ Logging System
- Winston-based structured logging
- File rotation (5MB max, 10 files)
- Separate error logs
- HTTP request logging with duration
- Shopify API call tracking

### ✅ Better Error Handling
- Detailed error messages with proper HTTP status codes
- User-friendly error responses
- Development vs production error details
- Comprehensive try-catch blocks

### ✅ Automatic Cleanup
- Uninstall webhook with database token retrieval
- Removes GTM scripts from theme.liquid
- Deletes DataLayer snippet
- Disables custom pixels
- Removes shop from database

---

## 📁 Project Structure

```
analyticsgtm/
├── server/
│   ├── index.js           # Main Express app with all routes
│   ├── database.js        # SQLite database functions
│   ├── logger.js          # Winston logging configuration
│   ├── oauth.js           # Shopify OAuth helpers
│   └── payloads/
│       └── custom_pixel.js # Custom pixel code for checkout events
├── data/
│   └── shops.db           # SQLite database (auto-created)
├── logs/
│   ├── combined.log       # All logs
│   └── error.log          # Error logs only
├── example/
│   └── ultimate-datalayer.liquid  # Reference snippet
├── public/
│   ├── pixel.js           # Alternative pixel implementation
│   └── privacy.html       # Privacy policy page
├── scripts/
│   └── requests.http      # REST Client test requests
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore rules
└── package.json          # Dependencies
```

---

## 🛠 Installation

### 1. Prerequisites
- Node.js 18+
- Shopify Partner account
- Shopify dev store

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
```env
# Server
PORT=3000
HOST=https://your-app-url.com
NODE_ENV=development

# Shopify App Credentials (from Partner Dashboard)
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here

# Scopes
SCOPES=write_themes,read_themes,write_pixels,read_pixels

# Session Secret (generate random string)
SESSION_SECRET=your_random_secret_here

# Optional
GTM_DEFAULT_ID=GTM-XXXXXXX
LOG_LEVEL=info
```

### 4. Generate Session Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

---

## 📝 Usage

### OAuth Installation (Recommended)

1. Set up your app in Shopify Partners Dashboard
2. Set redirect URL: `https://your-app-url.com/auth/callback`
3. Navigate to: `https://your-app-url.com/auth?shop=yourstore.myshopify.com`
4. Complete OAuth flow
5. You'll be redirected to settings page

### Manual Testing (Development)

1. Go to: `http://localhost:3000/admin/settings`
2. Enter shop domain and access token
3. Click buttons to enable GTM, DataLayer, or Pixel

---

## 🔌 API Endpoints

### OAuth Routes

- `GET /auth?shop=store.myshopify.com` - Start OAuth flow
- `GET /auth/callback` - OAuth callback handler

### API Routes

- `POST /api/gtm/enable` - Inject GTM scripts into theme
- `POST /api/datalayer/enable` - Create DataLayer snippet
- `POST /api/pixel/enable` - Create/update custom pixel (API)
- `GET /api/pixel/source` - Get pixel source code for manual copy

### Webhooks

- `POST /webhooks/app/uninstalled` - Cleanup on app uninstall

### UI Routes

- `GET /` - Home page
- `GET /admin/settings` - Settings UI
- `GET /privacy` - Privacy policy

---

## 🎯 Features

### DataLayer Events Tracked

**Storefront Events:**
- `view_item` - Product page view
- `view_item_list` - Collection page view
- `select_item` - Product click in collection
- `add_to_cart` - Add to cart (AJAX & redirect)
- `remove_from_cart` - Remove from cart
- `view_cart` - Cart page view / mini cart open
- `begin_checkout` - Checkout button click
- `search` - Search submission
- `add_to_wishlist` - Add to wishlist
- `form_submit` - Contact form submission
- `newsletter_signup` - Newsletter signup
- `phone_number_click` - Phone link click
- `email_click` - Email link click
- `login` / `sign_up` - Account actions

**Checkout Events (via Custom Pixel):**
- `page_view` - Checkout page view
- `add_payment_info` - Payment info submitted
- `add_shipping_info` - Shipping info submitted
- `purchase` - Order completed

### Customer Data
- SHA-256 hashed email/phone
- Address information (if available)
- Customer ID, name
- GDPR-compliant data handling

### Dynamic Remarketing
- Google Ads compatible item format
- Configurable business vertical
- Formatted item IDs: `shopify_{country}_{productId}_{variantId}`

---

## 🗄 Database Schema

**shops** table:
```sql
CREATE TABLE shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  scope TEXT,
  installed_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
)
```

---

## 📊 Logging

Logs are written to:
- `logs/combined.log` - All logs (info, warn, error)
- `logs/error.log` - Errors only
- Console - Colorized output

Log levels: `error`, `warn`, `info`, `debug`

Configure via `LOG_LEVEL` environment variable.

---

## 🔒 Security

- ✅ CSRF protection with OAuth nonce
- ✅ HMAC verification for webhooks
- ✅ Session secret for cookie encryption
- ✅ Content-Security-Policy headers
- ✅ Input validation on all endpoints
- ✅ Shop domain validation
- ✅ Access token format validation

---

## 🧹 Cleanup on Uninstall

When app is uninstalled, the webhook automatically:

1. ✅ Removes GTM scripts from theme.liquid
2. ✅ Deletes ultimate-datalayer.liquid snippet
3. ✅ Disables custom pixels
4. ✅ Removes shop from database

No manual cleanup needed!

---

## 🚧 Development

### Run Tests
```bash
# Test OAuth flow
curl "http://localhost:3000/auth?shop=test-store.myshopify.com"

# Test API endpoints (see scripts/requests.http)
```

### Database Management

```bash
# Check database
sqlite3 data/shops.db "SELECT * FROM shops;"

# Clear database
rm data/shops.db
```

### View Logs

```bash
# Real-time logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log
```

---

## 📦 Dependencies

```json
{
  "better-sqlite3": "^11.5.0",   // SQLite database
  "dotenv": "^16.4.5",           // Environment variables
  "express": "^4.21.2",          // Web framework
  "express-session": "^1.18.1",  // Session management
  "node-fetch": "^3.3.2",        // HTTP client
  "winston": "^3.17.0"           // Logging
}
```

---

## ⚠️ Important Notes

### For App Store Submission

This app uses **Theme Asset API** which directly modifies theme files. Shopify recommends:

1. **Theme App Extensions** instead of direct theme modification
2. **Web Pixels API** for customer event tracking

Current implementation is suitable for:
- Private apps
- Custom development
- Internal use
- Dev stores

### Data Privacy

- ✅ No user login system
- ✅ No personal data collection
- ✅ Only stores shop domain + access token
- ✅ Automatic cleanup on uninstall
- ✅ SHA-256 hashing for customer email/phone

### Theme Safety

- ✅ Idempotent operations (safe to run multiple times)
- ✅ Creates backup via version control (recommended)
- ✅ Removes code cleanly on uninstall

---

## 🆘 Troubleshooting

### Database Issues
```bash
# Reset database
rm data/shops.db
npm run dev  # Will recreate automatically
```

### OAuth Errors
- Check `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` in `.env`
- Verify redirect URL in Partner Dashboard
- Check `HOST` matches your deployed URL

### Webhook Not Working
- Set `SHOPIFY_API_SECRET` (not `SHOPIFY_SHARED_SECRET`)
- Webhook URL: `https://your-app-url.com/webhooks/app/uninstalled`
- Topic: `app/uninstalled`

### Logging Not Working
- Check `logs/` directory exists and is writable
- Verify `LOG_LEVEL` in `.env`

---

## 📄 License

Private / Proprietary

---

## 👨‍💻 Author

analyticsgtm  
Email: analyticsgtm@gmail.com

---

## 🔄 Version History

### v0.2.0 (Current)
- ✅ OAuth implementation
- ✅ SQLite database storage
- ✅ Winston logging system
- ✅ Improved error handling
- ✅ Automatic cleanup on uninstall

### v0.1.0
- Initial release
- Basic GTM injection
- DataLayer snippet
- Custom pixel support
````
