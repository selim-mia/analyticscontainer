// server/index.js
// =============================================================================
// analyticsgtm — Shopify GTM + DataLayer + Custom Web Pixel installer
// ESM module. Requires: node >= 18, express, node-fetch, dotenv
// Run: node server/index.js
// =============================================================================
import express from "express";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

// --------------------------- Security / Embeds -------------------------------
app.disable("x-powered-by");
// Allow Shopify Admin iframe (embedded app previews)
app.use((req, res, next) => {
  // Allow admin & storefront to frame
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
  );
  // Helpful defaults
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
  next();
});

// ------------------------------- Config --------------------------------------
const PORT = process.env.PORT || 3000;
const DEFAULT_GTM_ID = process.env.GTM_DEFAULT_ID || "GTM-XXXXXXXX";

// ------------------------------- Utils ---------------------------------------
function assert(v, msg) {
  if (!v) throw new Error(msg);
}

async function shopifyFetch(shop, accessToken, apiPath, opts = {}) {
  const url = `https://${shop}/admin/api/2024-10${apiPath}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Shopify ${res.status} ${await res.text()}`);
  return res.json();
}

async function getMainThemeId(shop, token) {
  const data = await shopifyFetch(shop, token, "/themes.json", { method: "GET" });
  const main = data.themes.find((t) => t.role === "main") || data.themes[0];
  if (!main) throw new Error("No theme found");
  return main.id;
}

async function getAsset(shop, token, themeId, key) {
  const q = encodeURIComponent(key);
  const data = await shopifyFetch(
    shop,
    token,
    `/themes/${themeId}/assets.json?asset[key]=${q}&theme_id=${themeId}`,
    { method: "GET" }
  );
  return data.asset;
}

async function putAsset(shop, token, themeId, key, value) {
  return shopifyFetch(shop, token, `/themes/${themeId}/assets.json`, {
    method: "PUT",
    body: JSON.stringify({ asset: { key, value } }),
  });
}

// -------------------------- Snippet & Pixel Code -----------------------------
const UDL_SNIPPET_VALUE = `<script>
/**
  * Author: analyticsgtm
  * Email: analyticsgtm@gmail.com
  * Last Update: 27 September 2025
  */
(function() {
  class Ultimate_Shopify_DataLayer {
    constructor() {
      window.dataLayer = window.dataLayer || [];
      this.eventPrefix = '';
      this.formattedItemId = true;
      this.dataSchema = { ecommerce:{ show:true }, dynamicRemarketing:{ show:false, business_vertical:'retail' } };
      this.addToWishListSelectors = { 'addWishListIcon':'', 'gridItemSelector':'', 'productLinkSelector':'a[href*="/products/"]' };
      this.quickViewSelector = { 'quickViewElement':'', 'gridItemSelector':'', 'productLinkSelector':'a[href*="/products/"]' };
      this.miniCartButton = ['a[href="/cart"]'];
      this.miniCartAppersOn = 'click';
      this.beginCheckoutButtons = ['input[name="checkout"]','button[name="checkout"]','a[href="/checkout"]','.additional-checkout-buttons'];
      this.shopifyDirectCheckoutButton = ['.shopify-payment-button'];
      this.isAddToCartRedirect = false;
      this.isAjaxCartIncrementDecrement = true;

      this.cart = {{ cart | json }};
      this.countryCode = "{{ shop.address.country_code }}";
      this.storeURL = "{{ shop.secure_url }}";
      localStorage.setItem('shopCountryCode', this.countryCode);

      this.collectData();
      this.itemsList = [];
    }

    updateCart() { fetch("/cart.js").then(r=>r.json()).then(d=>{ this.cart=d; }); }
    debounce(delay){ let t; return function(fn){ clearTimeout(t); t=setTimeout(()=>fn.apply(this, arguments), delay); }; }
    eventConsole(n, d){ const c1='background:red;color:#fff;border-radius:3px 0 0 3px;padding:3px 4px;'; const c2='background:blue;color:#fff;border-radius:0 3px 3px 0;padding:3px 4px;'; console.log('%cGTM DataLayer Event:%c'+n, c1, c2, d); }

    collectData(){
      this.customerData(); this.ajaxRequestData(); this.searchPageData(); this.miniCartData(); this.beginCheckoutData();
      {% if template contains 'cart' %} this.viewCartPageData(); {% endif %}
      {% if template contains 'product' %} this.productSinglePage(); {% endif %}
      {% if template contains 'collection' %} this.collectionsPageData(); {% endif %}
      this.addToWishListData(); this.quickViewData(); this.selectItemData(); this.formData(); this.phoneClickData(); this.emailClickData(); this.loginRegisterData();
    }

    customerData(){
      const currentUser = {};
      {% if customer %} currentUser.id={{ customer.id }}; currentUser.first_name="{{ customer.first_name }}"; currentUser.last_name="{{ customer.last_name }}"; currentUser.full_name="{{ customer.name }}"; currentUser.email="{{ customer.email }}"; currentUser.phone="{{ customer.default_address.phone }}";
      {% if customer.default_address %} currentUser.address={ address_summary:"{{ customer.default_address.summary }}", address1:"{{ customer.default_address.address1 }}", address2:"{{ customer.default_address.address2 }}", city:"{{ customer.default_address.city }}", street:"{{ customer.default_address.street }}", zip:"{{ customer.default_address.zip }}", company:"{{ customer.default_address.company }}", country:"{{ customer.default_address.country.name }}", countryCode:"{{ customer.default_address.country_code }}", province:"{{ customer.default_address.province }}" }; {% endif %}{% endif %}
      if(currentUser.email){ currentUser.hash_email="{{ customer.email | sha256 }}" }
      if(currentUser.phone){ currentUser.hash_phone="{{ customer.phone | sha256 }}" }
      window.dataLayer = window.dataLayer || [];
      dataLayer.push({ customer: currentUser });
    }

    ajaxRequestData(){
      const self=this;
      if(this.isAddToCartRedirect){
        document.addEventListener('submit', (event)=>{
          const f = event.target.closest('form[action="/cart/add"]');
          if(f){
            event.preventDefault();
            const fd = new FormData(f);
            fetch(window.Shopify.routes.root+'cart/add.js',{ method:'POST', body:fd }).then(()=>{ window.location.href="{{ routes.cart_url }}";});
          }
        });
      }

      // fetch patch
      let originalFetch = window.fetch; let debounce = this.debounce(800);
      window.fetch = function(){
        return originalFetch.apply(this, arguments).then((response)=>{
          if(response.ok){
            let clone = response.clone();
            let requestURL = arguments[0]['url'] || arguments[0];

            if(typeof requestURL==='string' && /.*\\/search\\/?\\.*/.test(requestURL) && requestURL.includes('q=') && !requestURL.includes('&requestFrom=uldt')){
              const qs = requestURL.split('?')[1]; const p = new URLSearchParams(qs); const search_term = p.get('q');
              debounce(function(){
                fetch(\`\${self.storeURL}/search/suggest.json?q=\${search_term}&resources[type]=product&requestFrom=uldt\`).then(r=>r.json()).then((data)=>{
                  const prods = data.resources.results.products;
                  if(prods.length){
                    Promise.all(prods.map(product=>fetch(\`\${self.storeURL}/\${product.url.split('?')[0]}.js\`).then(r=>r.json()))).then(products=>{
                      const items = products.map(product=>({ product_id:product.id, product_title:product.title, variant_id:product.variants[0].id, variant_title:product.variants[0].title, vendor:product.vendor, total_discount:0, final_price:product.price_min, product_type:product.type, quantity:1 }));
                      self.ecommerceDataLayer('search', {search_term, items});
                    });
                  } else { self.ecommerceDataLayer('search', {search_term, items:[]}); }
                });
              });
            }
            else if(typeof requestURL==='string' && requestURL.includes('/cart/add')){
              clone.text().then((t)=>{
                const data = JSON.parse(t);
                if(data.items && Array.isArray(data.items)){ data.items.forEach(item=> self.ecommerceDataLayer('add_to_cart', {items:[item]})); }
                else { self.ecommerceDataLayer('add_to_cart', {items:[data]}); }
                self.updateCart();
              });
            }
            else if(typeof requestURL==='string' && (requestURL.includes('/cart/change') || requestURL.includes('/cart/update'))){
              clone.text().then((t)=>{
                const newCart = JSON.parse(t); const newItems = newCart.items; const oldItems = self.cart.items;
                for(let i=0;i<oldItems.length;i++){
                  let item = oldItems[i];
                  let newItem = newItems.find(n=> n.id===item.id);
                  if(newItem){
                    if(newItem.quantity>item.quantity){ let q=newItem.quantity-item.quantity; let u={...item, quantity:q}; self.ecommerceDataLayer('add_to_cart', {items:[u]}); self.updateCart(); }
                    else if(newItem.quantity<item.quantity){ let q=item.quantity-newItem.quantity; let u={...item, quantity:q}; self.ecommerceDataLayer('remove_from_cart', {items:[u]}); self.updateCart(); }
                  } else { self.ecommerceDataLayer('remove_from_cart', {items:[item]}); self.updateCart(); }
                }
              });
            }
          }
          return response;
        });
      };

      // XHR patch
      const Orig = XMLHttpRequest;
      XMLHttpRequest = function(){
        let requestURL; const xhr = new Orig(); const open = xhr.open; const send = xhr.send;
        xhr.open = function(method, url){ requestURL=url; return open.apply(this, arguments); };
        xhr.send = function(){
          if(typeof requestURL==='string' && (requestURL.includes('/cart/add') || requestURL.includes('/cart/change') || /.*\\/search\\/?\\.*/.test(requestURL) && requestURL.includes('q='))){
            xhr.addEventListener('load', function(){
              if(xhr.readyState===4 && xhr.status>=200 && xhr.status<400){
                if(/.*\\/search\\/?\\.*/.test(requestURL) && requestURL.includes('q=') && !requestURL.includes('&requestFrom=uldt')){
                  const qs = requestURL.split('?')[1]; const p = new URLSearchParams(qs); const search_term = p.get('q');
                  const debounce = self.debounce(800);
                  debounce(function(){
                    fetch(\`\${self.storeURL}/search/suggest.json?q=\${search_term}&resources[type]=product&requestFrom=uldt\`).then(r=>r.json()).then((data)=>{
                      const prods = data.resources.results.products;
                      if(prods.length){
                        Promise.all(prods.map(product=>fetch(\`\${self.storeURL}/\${product.url.split('?')[0]}.js\`).then(r=>r.json()))).then(products=>{
                          const items = products.map(product=>({ product_id:product.id, product_title:product.title, variant_id:product.variants[0].id, variant_title:product.variants[0].title, vendor:product.vendor, total_discount:0, final_price:product.price_min, product_type:product.type, quantity:1 }));
                          self.ecommerceDataLayer('search', {search_term, items});
                        });
                      } else { self.ecommerceDataLayer('search', {search_term, items:[]}); }
                    });
                  });
                } else if(requestURL.includes('/cart/add')){
                  const data = JSON.parse(xhr.responseText);
                  if(data.items && Array.isArray(data.items)){ data.items.forEach(it=> self.ecommerceDataLayer('add_to_cart', {items:[it]})); }
                  else { self.ecommerceDataLayer('add_to_cart', {items:[data]}); }
                  self.updateCart();
                } else if(requestURL.includes('/cart/change')){
                  const newCart = JSON.parse(xhr.responseText); const newItems = newCart.items; const oldItems = self.cart.items;
                  for(let i=0;i<oldItems.length;i++){
                    let item = oldItems[i];
                    let n = newItems.find(x=> x.id===item.id);
                    if(n){
                      if(n.quantity>item.quantity){ let q=n.quantity-item.quantity; let u={...item, quantity:q}; self.ecommerceDataLayer('add_to_cart', {items:[u]}); self.updateCart(); }
                      else if(n.quantity<item.quantity){ let q=item.quantity-n.quantity; let u={...item, quantity:q}; self.ecommerceDataLayer('remove_from_cart', {items:[u]}); self.updateCart(); }
                    } else { self.ecommerceDataLayer('remove_from_cart', {items:[item]}); self.updateCart(); }
                  }
                }
              }
            });
          }
          return send.apply(this, arguments);
        };
        return xhr;
      };
    }

    searchPageData(){
      const self=this; let url = window.location.href;
      if(/.+\\/search\\?.*\\&?q=.+/.test(url)){
        const qs = url.split('?')[1]; const p = new URLSearchParams(qs); const search_term = p.get('q');
        fetch(\`{{ shop.secure_url }}/search/suggest.json?q=\${search_term}&resources[type]=product&requestFrom=uldt\`).then(r=>r.json()).then((data)=>{
          const prods = data.resources.results.products;
          if(prods.length){
            Promise.all(prods.map(product=>fetch(\`\${self.storeURL}/\${product.url.split('?')[0]}.js\`).then(r=>r.json()))).then(products=>{
              const items = products.map(product=>({ product_id:product.id, product_title:product.title, variant_id:product.variants[0].id, variant_title:product.variants[0].title, vendor:product.vendor, total_discount:0, final_price:product.price_min, product_type:product.type, quantity:1 }));
              self.ecommerceDataLayer('search', {search_term, items});
            });
          } else { self.ecommerceDataLayer('search', {search_term, items:[]}); }
        });
      }
    }

    miniCartData(){
      if(this.miniCartButton.length){
        let self=this;
        if(this.miniCartAppersOn==='hover'){ this.miniCartAppersOn='mouseenter'; }
        this.miniCartButton.forEach(sel=>{
          document.querySelectorAll(sel).forEach(btn=>{
            btn.addEventListener(self.miniCartAppersOn, ()=> self.ecommerceDataLayer('view_cart', self.cart));
          });
        });
      }
    }

    beginCheckoutData(){
      let self=this;
      document.addEventListener('pointerdown', (e)=>{
        let el = e.target.closest(self.beginCheckoutButtons.join(', '));
        if(el){ self.ecommerceDataLayer('begin_checkout', self.cart); }
      });
    }

    viewCartPageData(){
      this.ecommerceDataLayer('view_cart', this.cart);
      if(!this.isAjaxCartIncrementDecrement){
        const self=this;
        document.addEventListener('pointerdown', (e)=>{
          const t = e.target.closest('a[href*="/cart/change?"]');
          if(t){
            const qs = t.getAttribute('href').split('?')[1]; const p = new URLSearchParams(qs);
            const newQ = +p.get('quantity'); const line = p.get('line'); const cart_id = p.get('id');
            if(newQ && (line || cart_id)){
              let item = line ? {...self.cart.items[line-1]} : self.cart.items.find(i=> i.key===cart_id);
              let evt = newQ < item.quantity ? 'remove_from_cart' : 'add_to_cart';
              let q = Math.abs(newQ - item.quantity); item.quantity = q;
              self.ecommerceDataLayer(evt, {items:[item]});
            }
          }
        });
      }
    }

    productSinglePage(){
      {% if template contains 'product' %}
      const item = {
        product_id: {{ product.id | json }},
        variant_id: {{ product.selected_or_first_available_variant.id }},
        product_title: {{ product.title | json }},
        line_level_total_discount: 0,
        vendor: {{ product.vendor | json }},
        sku: {{ product.selected_or_first_available_variant.sku | json }},
        product_type: {{ product.type | json }},
        item_list_id: {{ product.collections[0].id | json }},
        item_list_name: {{ product.collections[0].title | json }},
        {% if product.selected_or_first_available_variant.title != "Default Title" %} variant_title: {{ product.selected_or_first_available_variant.title | json }}, {% endif %}
        final_price: {{ product.selected_or_first_available_variant.price }},
        quantity: 1
      };
      const variants = {{ product.variants | json }};
      this.ecommerceDataLayer('view_item', {items:[item]});

      if(this.shopifyDirectCheckoutButton.length){
        let self=this;
        document.addEventListener('pointerdown', (e)=>{
          let checkoutButton = e.target.closest(this.shopifyDirectCheckoutButton.join(', '));
          if(checkoutButton && (variants || self.quickViewVariants)){
            let form = checkoutButton.closest('form[action*="/cart/add"]');
            if(form){
              let variant_id=null;
              let input = form.querySelector('input[name="id"]');
              let fromUrl = new URLSearchParams(window.location.search).get('variant');
              let first = item.variant_id;
              if(input) variant_id = parseInt(input.value);
              else if(fromUrl) variant_id = parseInt(fromUrl);
              else if(first) variant_id = parseInt(first);

              if(variant_id){
                let quantity = 1;
                let fid = form.getAttribute('id');
                if(fid){
                  let qi = document.querySelector('input[name="quantity"][form="'+fid+'"]');
                  if(qi) quantity = +qi.value;
                }

                let v = variants.find(i=> i.id===+variant_id);
                if(v && item){
                  item.variant_id = variant_id;
                  item.variant_title = v.title;
                  item.final_price = v.price;
                  item.quantity = quantity;
                  self.ecommerceDataLayer('add_to_cart', {items:[item]});
                  self.ecommerceDataLayer('begin_checkout', {items:[item]});
                } else if(self.quickViewedItem){
                  let v2 = self.quickViewVariants.find(i=> i.id===+variant_id);
                  if(v2){
                    self.quickViewedItem.variant_id = variant_id;
                    self.quickViewedItem.variant_title = v2.title;
                    self.quickViewedItem.final_price = parseFloat(v2.price)*100;
                    self.quickViewedItem.quantity = quantity;
                    self.ecommerceDataLayer('add_to_cart', {items:[self.quickViewedItem]});
                    self.ecommerceDataLayer('begin_checkout', {items:[self.quickViewedItem]});
                  }
                }
              }
            }
          }
        });
      }
      {% endif %}
    }

    collectionsPageData(){
      var ecommerce = { items: [ {% for product in collection.products %} { 'product_id': {{ product.id | json }}, 'variant_id': {{ product.selected_or_first_available_variant.id | json }}, 'vendor': {{ product.vendor | json }}, 'sku': {{ product.selected_or_first_available_variant.sku | json }}, 'total_discount': 0, 'variant_title': {{ product.selected_or_first_available_variant.title | json }}, 'product_title': {{ product.title | json }}, 'final_price': Number({{ product.price }}), 'product_type': {{ product.type | json }}, 'item_list_id': {{ collection.id | json }}, 'item_list_name': {{ collection.title | json }}, 'url': {{ product.url | json }}, 'quantity': 1 }, {% endfor %} ] };
      this.itemsList = ecommerce.items;
      ecommerce.item_list_id = {{ collection.id | json }};
      ecommerce.item_list_name = {{ collection.title | json }};
      this.ecommerceDataLayer('view_item_list', ecommerce);
    }

    addToWishListData(){
      if(this.addToWishListSelectors && this.addToWishListSelectors.addWishListIcon){
        const self=this;
        document.addEventListener('pointerdown', (e)=>{
          let icon = e.target.closest(self.addToWishListSelectors.addWishListIcon);
          if(icon){
            let page = window.location.href.replace(/\\?.+/, ''); let req;
            if(/\\/products\\/[^/]+$/.test(page)){ req = page; }
            else if(self.addToWishListSelectors.gridItemSelector && self.addToWishListSelectors.productLinkSelector){
              let itemEl = e.target.closest(self.addToWishListSelectors.gridItemSelector);
              if(itemEl){
                let linkEl = itemEl.querySelector(self.addToWishListSelectors.productLinkSelector);
                if(linkEl){ let link = linkEl.getAttribute('href').replace(/\\?.+/g, ''); if(link && /\\/products\\/[^/]+$/.test(link)) req = link; }
              }
            }
            if(req){
              fetch(req + '.json').then(r=>r.json()).then(result=>{
                let p = result.product;
                if(p){
                  let d = { product_id:p.id, variant_id:p.variants[0].id, product_title:p.title, quantity:1, final_price: parseFloat(p.variants[0].price)*100, total_discount:0, product_type:p.product_type, vendor:p.vendor, variant_title:(p.variants[0].title!=='Default Title')?p.variants[0].title:undefined, sku:p.variants[0].sku };
                  self.ecommerceDataLayer('add_to_wishlist', {items:[d]});
                }
              });
            }
          }
        });
      }
    }

    quickViewData(){
      if(this.quickViewSelector.quickViewElement && this.quickViewSelector.gridItemSelector && this.quickViewSelector.productLinkSelector){
        const self=this;
        document.addEventListener('pointerdown', (e)=>{
          if(e.target.closest(self.quickViewSelector.quickViewElement)){
            let req; let itemEl = e.target.closest(this.quickViewSelector.gridItemSelector);
            if(itemEl){
              let linkEl = itemEl.querySelector(self.quickViewSelector.productLinkSelector);
              if(linkEl){
                let link = linkEl.getAttribute('href').replace(/\\?.+/g,'');
                if(link && /\\/products\\/[^/]+$/.test(link)) req = link;
              }
            }
            if(req){
              fetch(req + '.json').then(r=>r.json()).then(result=>{
                let p = result.product;
                if(p){
                  let d = { product_id:p.id, variant_id:p.variants[0].id, product_title:p.title, quantity:1, final_price: parseFloat(p.variants[0].price)*100, total_discount:0, product_type:p.product_type, vendor:p.vendor, variant_title:(p.variants[0].title!=='Default Title')?p.variants[0].title:undefined, sku:p.variants[0].sku };
                  self.ecommerceDataLayer('view_item', {items:[d]});
                  self.quickViewVariants = p.variants; self.quickViewedItem = d;
                }
              });
            }
          }
        });

        {% unless template contains 'product' %}
        if(this.shopifyDirectCheckoutButton.length){
          let self=this;
          document.addEventListener('pointerdown', (e)=>{
            let checkoutButton = e.target.closest(this.shopifyDirectCheckoutButton.join(', '));
            if(self.quickViewVariants && self.quickViewedItem && self.quickViewVariants.length && checkoutButton){
              let form = checkoutButton.closest('form[action*="/cart/add"]');
              if(form){
                let quantity = 1; let vin = form.querySelector('input[name="id"]'); let fid = form.getAttribute('id');
                if(fid){ let qi = document.querySelector('input[name="quantity"][form="'+fid+'"]'); if(qi) quantity = +qi.value; }
                if(vin){
                  let variant_id = parseInt(vin.value);
                  if(variant_id){
                    const v = self.quickViewVariants.find(x=> x.id===+variant_id);
                    if(v && self.quickViewedItem){
                      self.quickViewedItem.variant_id = variant_id;
                      self.quickViewedItem.variant_title = v.title;
                      self.quickViewedItem.final_price = parseFloat(v.price)*100;
                      self.quickViewedItem.quantity = quantity;
                      self.ecommerceDataLayer('add_to_cart', {items:[self.quickViewedItem]});
                      self.ecommerceDataLayer('begin_checkout', {items:[self.quickViewedItem]});
                    }
                  }
                }
              }
            }
          });
        }
        {% endunless %}
      }
    }

    selectItemData(){
      const self=this; const items=this.itemsList;
      {% if template contains 'collection' %}
      document.addEventListener('pointerdown', function(e){
        const link = e.target.closest('a[href*="/products/"]');
        if(link){
          const href = link.getAttribute('href');
          const match = (it)=>{
            const a = (it.url.split('/products/')[1]).split('#')[0].split('?')[0].trim();
            const b = (href.split('/products/')[1]).split('#')[0].split('?')[0].trim();
            return a===b;
          }
          const item = items.find(match);
          const index = items.findIndex(match);
          if(item){ self.ecommerceDataLayer('select_item', {items:[{...item, index}]}); }
        }
      });
      {% endif %}

      document.addEventListener('variant:change', function(ev){
        const p = ev.detail.product; const v = ev.detail.variant;
        const item = { product_id:p.id, product_title:p.title, variant_id:v.id, variant_title:v.public_title, vendor:p.vendor, final_price:v.price, product_type:p.type, quantity:1 };
        self.ecommerceDataLayer('select_item', {items:[item]});
      });
    }

    ecommerceDataLayer(event, data){
      const self=this;
      dataLayer.push({ ecommerce:null });
      const payload = {
        event: this.eventPrefix + event,
        ecommerce: {
          currency: this.cart.currency,
          items: data.items.map((it, idx)=>{
            const out = {
              index: idx,
              item_id: this.formattedItemId ? \`shopify_\${this.countryCode}_\${it.product_id}_\${it.variant_id}\` : it.product_id.toString(),
              product_id: it.product_id?.toString?.() ?? String(it.product_id),
              variant_id: it.variant_id?.toString?.() ?? String(it.variant_id),
              item_name: it.product_title,
              quantity: it.quantity,
              price: +((it.final_price/100).toFixed(2)),
              discount: it.total_discount ? +((it.total_discount/100).toFixed(2)) : 0
            };
            if(it.product_type) out.item_category = it.product_type;
            if(it.vendor) out.item_brand = it.vendor;
            if(it.variant_title && it.variant_title!=='Default Title') out.item_variant = it.variant_title;
            if(it.sku) out.sku = it.sku;
            if(it.item_list_name) out.item_list_name = it.item_list_name;
            if(it.item_list_id) out.item_list_id = it.item_list_id.toString();
            return out;
          })
        }
      };
      payload.ecommerce.value = (data.total_price!==undefined)
        ? +((data.total_price/100).toFixed(2))
        : +(payload.ecommerce.items.reduce((t,i)=> t+(i.price*i.quantity), 0)).toFixed(2);

      if(data.item_list_id) payload.ecommerce.item_list_id = data.item_list_id;
      if(data.item_list_name) payload.ecommerce.item_list_name = data.item_list_name;
      if(data.search_term) payload.search_term = data.search_term;

      if(self.dataSchema.dynamicRemarketing && self.dataSchema.dynamicRemarketing.show){
        dataLayer.push({ dynamicRemarketing:null });
        payload.dynamicRemarketing = {
          value: payload.ecommerce.value,
          items: payload.ecommerce.items.map(i=> ({ id:i.item_id, google_business_vertical:self.dataSchema.dynamicRemarketing.business_vertical }))
        };
      }

      if(!self.dataSchema.ecommerce || !self.dataSchema.ecommerce.show){ delete payload.ecommerce; }
      dataLayer.push(payload);
      this.eventConsole(this.eventPrefix + event, payload);
    }

    formData(){
      const self=this;
      document.addEventListener('submit', (e)=>{
        let f = e.target.closest('form[action^="/contact"]');
        if(f){
          const fd = { form_location:window.location.href, form_id:f.getAttribute('id'), form_classes:f.getAttribute('class') };
          let t = f.querySelector('input[name="form_type"]'); let inputs = f.querySelectorAll('input:not([type=hidden]):not([type=submit]), textarea, select');
          inputs.forEach(input=>{
            var n=input.name, v=input.value;
            if(n && v){ var m = n.match(/\\[(.*?)\\]/); if(m && m.length>1){ fd[m[1]] = input.value; } }
          });
          if(t && t.value==='customer'){ dataLayer.push({ event:self.eventPrefix+'newsletter_signup', ...fd }); self.eventConsole(self.eventPrefix+'newsletter_signup', { event:self.eventPrefix+'newsletter_signup', ...fd }); }
          else if(t && t.value==='contact'){ dataLayer.push({ event:self.eventPrefix+'contact_form_submit', ...fd }); self.eventConsole(self.eventPrefix+'contact_form_submit', { event:self.eventPrefix+'contact_form_submit', ...fd }); }
        }
      });
    }

    phoneClickData(){
      const self=this;
      document.addEventListener('click', (e)=>{
        let a = e.target.closest('a[href^="tel:"]');
        if(a){
          let phone = a.getAttribute('href').replace('tel:','');
          let ev = { event:self.eventPrefix+'phone_number_click', page_location:window.location.href, link_classes:a.getAttribute('class'), link_id:a.getAttribute('id'), phone_number:phone };
          dataLayer.push(ev); self.eventConsole(self.eventPrefix+'phone_number_click', ev);
        }
      });
    }

    emailClickData(){
      const self=this;
      document.addEventListener('click', (e)=>{
        let a = e.target.closest('a[href^="mailto:"]');
        if(a){
          let email = a.getAttribute('href').replace('mailto:','');
          let ev = { event:self.eventPrefix+'email_click', page_location:window.location.href, link_classes:a.getAttribute('class'), link_id:a.getAttribute('id'), email_address:email };
          dataLayer.push(ev); self.eventConsole(self.eventPrefix+'email_click', ev);
        }
      });
    }

    loginRegisterData(){
      const self=this; let didLogin=false; let didReg=false;
      if(window.location.href.includes('/account/login')){
        document.addEventListener('submit', (e)=>{
          const f = e.target.closest('[action="/account/login"]');
          if(f && !didLogin){ didLogin=true; const ev={ event:self.eventPrefix+'login' }; dataLayer.push(ev); self.eventConsole(self.eventPrefix+'login', ev); }
        });
      }
      if(window.location.href.includes('/account/register')){
        document.addEventListener('submit', (e)=>{
          const f = e.target.closest('[action="/account"]');
          if(f && !didReg){ didReg=true; const ev={ event:self.eventPrefix+'sign_up' }; dataLayer.push(ev); self.eventConsole(self.eventPrefix+'sign_up', ev); }
        });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    try{ new Ultimate_Shopify_DataLayer(); }catch(err){ console.log(err); }
  });
})();
</script>
`;

const CUSTOM_PIXEL_JS = `export default (analytics) => {
const event_prefix = '';
const formattedItemId = true;
const gclidWithPageLocation = true;

let storeCountryCode = window.localStorage.getItem('shopCountryCode') || 'US';
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }

if(/.+\\/checkouts?\\/.*/.test(window.location.href)){
  analytics.subscribe('payment_info_submitted', (event) => ecommerceDataLayer('add_payment_info', event));
  analytics.subscribe('checkout_shipping_info_submitted', (event) => ecommerceDataLayer('add_shipping_info', event));
  analytics.subscribe('checkout_completed', (event) => ecommerceDataLayer('purchase', event));
}

function eventLog(n, d){
  const c1='background:red;color:#fff;border-radius:3px 0 0 3px;padding:3px 4px;';
  const c2='background:blue;color:#fff;border-radius:0 3px 3px 0;padding:3px 4px;';
  console.log('%cGTM DataLayer Event:%c'+event_prefix+n, c1, c2, d);
}

function getPageLocation(event){
  let loc = event.context.document.location.href;
  if(gclidWithPageLocation){
    const name='_gcl_aw'; const value='; '+document.cookie; const parts=value.split('; '+name+'=');
    if(parts.length===2){
      const cookie = parts.pop().split(';').shift();
      const segs = cookie.split('.'); const gclid = segs[segs.length-1];
      loc = loc.includes('?') ? (loc+'&gclid='+gclid) : (loc+'?gclid='+gclid);
    }
  }
  return loc;
}

async function sha256Hash(value){
  const enc=new TextEncoder(); const data=enc.encode(value);
  const buf=await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b=>('00'+b.toString(16)).slice(-2)).join('');
}

async function ecommerceDataLayer(gtm_event_name, event){
  let hash_email, hash_phone;
  const phone = event.data?.checkout?.phone;
  const email = event.data?.checkout?.email;
  if(phone) hash_phone = await sha256Hash(phone);
  if(email) hash_email = await sha256Hash(email);

  const customerInfo = {
    customer:{
      first_name: event.data?.checkout?.billingAddress?.firstName || event.data?.checkout?.shippingAddress?.firstName,
      last_name: event.data?.checkout?.billingAddress?.lastName || event.data?.checkout?.shippingAddress?.lastName,
      email: email,
      hash_email: hash_email,
      phone: phone,
      hash_phone: hash_phone,
      address: event.data?.checkout?.shippingAddress
    }
  };
  dataLayer.push(customerInfo);

  const info = {
    event: event_prefix + gtm_event_name,
    page_location: getPageLocation(event),
    ecommerce:{
      transaction_id: event.data?.checkout?.order?.id,
      value: event.data?.checkout?.totalPrice?.amount,
      tax: event.data?.checkout?.totalTax?.amount,
      shipping: event.data?.checkout?.shippingLine?.price?.amount,
      currency: event.data?.checkout?.currencyCode,
      coupon: (event.data?.checkout?.discountApplications || []).map(d=> d.title).join(','),
      items: (event.data?.checkout?.lineItems || []).map(item => ({
        item_id: formattedItemId ? ('shopify_'+storeCountryCode+'_'+(item.variant?.product?.id||'')+'_'+(item.variant?.id||'')) : item.variant?.product?.id,
        product_id: item.variant?.product?.id,
        variant_id: item.variant?.id,
        sku: item.variant?.sku,
        item_name: item.title,
        coupon: item.discountAllocations?.discountApplication?.title,
        discount: item.discountAllocations?.amount?.amount,
        item_variant: item.variant?.title,
        price: item.variant?.price?.amount,
        quantity: item.quantity,
        item_brand: item.variant?.product?.vendor,
        item_category: item.variant?.product?.type
      }))
    }
  };

  dataLayer.push({ ecommerce:null });
  dataLayer.push(info);
  eventLog(gtm_event_name, Object.assign({}, info, customerInfo));
}
};`;

// ------------------------------ Injectors ------------------------------------
function buildGTMBlocks(gtmId) {
  const headTag = [
    "<!-- Google Tag Manager -->",
    "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':",
    "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],",
    "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=",
    "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);",
    `})(window,document,'script','dataLayer','${gtmId}');</script>`,
    "<!-- End Google Tag Manager -->",
  ].join("");

  const bodyTag = [
    "<!-- Google Tag Manager (noscript) -->",
    `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"`,
    `height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
    "<!-- End Google Tag Manager (noscript) -->",
  ].join("");

  return { headTag, bodyTag };
}

/**
 * Upsert GTM head/body and `{% render 'ultimate-datalayer' %}` after GTM head end.
 */
function upsertGTMAndRender(src, gtmId) {
  const { headTag, bodyTag } = buildGTMBlocks(gtmId);
  const renderTag = `{% render 'ultimate-datalayer' %}`;

  const reHeadBlock = /<!--\s*Google Tag Manager\s*-->[\s\S]*?<!--\s*End Google Tag Manager\s*-->/i;
  const reBodyBlock = /<!--\s*Google Tag Manager\s*\(noscript\)\s*-->[\s\S]*?<!--\s*End Google Tag Manager\s*\(noscript\)\s*-->/i;
  src = src.replace(reHeadBlock, "").replace(reBodyBlock, "");

  src = src.replace(/\{\%\s*render\s+'ultimate-datalayer'\s*\%\}\s*/gi, "");

  src = src.replace(/<head(\b[^>]*)?>/i, (m) => `${m}\n${headTag}\n`);
  src = src.replace(/<body(\b[^>]*)?>/i, (m) => `${m}\n${bodyTag}\n`);

  src = src.replace(/(<!--\s*End Google Tag Manager\s*-->)/i, `$1\n  ${renderTag}`);

  if (!/render\s+'ultimate-datalayer'/.test(src)) {
    src = src.replace(/<\/head>/i, `  ${renderTag}\n</head>`);
  }
  return src;
}

/**
 * Only ensure `{% render 'ultimate-datalayer' %}` exists (prefer after GTM head end).
 */
function insertRenderAfterGTM(src) {
  const renderTag = `{% render 'ultimate-datalayer' %}`;
  src = src.replace(/\{\%\s*render\s+'ultimate-datalayer'\s*\%\}\s*/gi, "");
  const withAfter = src.replace(/(<!--\s*End Google Tag Manager\s*-->)/i, `$1\n  ${renderTag}`);
  if (withAfter !== src) return withAfter;
  return src.replace(/<\/head>/i, `  ${renderTag}\n</head>`);
}

// ------------------------------- API Routes ----------------------------------

// 1) Enable GTM in theme.liquid (head + body) and add render after GTM head end.
app.post("/api/gtm/enable", async (req, res) => {
  try {
    const { shop, accessToken, gtmId } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing/invalid shop");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing/invalid shpat token");

    const desiredId = (gtmId || DEFAULT_GTM_ID || "").trim();
    assert(/^GTM-[A-Z0-9_-]+$/i.test(desiredId), "Invalid GTM Container ID");

    const themeId = await getMainThemeId(shop, accessToken);
    const themeKey = "layout/theme.liquid";

    const asset = await getAsset(shop, accessToken, themeId, themeKey);
    const orig = asset.value || Buffer.from(asset.attachment, "base64").toString("utf8");

    const patched = upsertGTMAndRender(orig, desiredId);
    if (patched !== orig) await putAsset(shop, accessToken, themeId, themeKey, patched);

    res.json({ ok: true, gtmId: desiredId });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// 2) Upload `snippets/ultimate-datalayer.liquid` and ensure it's rendered.
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

    const patched = insertRenderAfterGTM(orig);
    if (patched !== orig) await putAsset(shop, accessToken, themeId, themeKey, patched);

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// 3) Create/Update Custom Web Pixel (GraphQL with schema detection, REST fallback)
app.post("/api/pixel/enable", async (req, res) => {
  const fail = (msg, detail) => res.status(400).json({ error: msg, detail });
  try {
    const { shop, accessToken } = req.body || {};
    if (!shop?.endsWith(".myshopify.com")) throw new Error("Missing/invalid shop");
    if (!accessToken?.startsWith("shpat_")) throw new Error("Missing/invalid shpat token");

    const APIv = "2024-10";
    const REST = `https://${shop}/admin/api/${APIv}`;
    const headers = {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const gql = async (query, variables) => {
      const r = await fetch(`${REST}/graphql.json`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });
      const j = await r.json();
      if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors || j));
      return j.data;
    };

    const hasType = async (typeName) => {
      try {
        const d = await gql(
          `query($n:String!){ __type(name:$n){ name kind } }`,
          { n: typeName }
        );
        return !!d?.__type?.name;
      } catch { return false; }
    };
    const argNameOf = async (field) => {
      try {
        const d = await gql(
          `query{
            __schema{ mutationType{ fields{ name args{ name type{ kind name ofType{ name } } } } } }
          }`,
          {}
        );
        const f = d?.__schema?.mutationType?.fields?.find((x) => x.name === field);
        const arg = f?.args?.[0]?.name;
        const t = f?.args?.[0]?.type?.name || f?.args?.[0]?.type?.ofType?.name;
        return { argName: arg, typeName: t };
      } catch { return {}; }
    };

    let argCreate = "input", argUpdate = "input";
    let typeCreate = "WebPixelInput", typeUpdate = "WebPixelUpdateInput";

    const createInfo = await argNameOf("webPixelCreate");
    if (createInfo.argName) argCreate = createInfo.argName;
    if (createInfo.typeName) typeCreate = createInfo.typeName;

    const updateInfo = await argNameOf("webPixelUpdate");
    if (updateInfo.argName) argUpdate = updateInfo.argName;
    if (updateInfo.typeName) typeUpdate = updateInfo.typeName;

    const variants = [];
    const existsCreate = await hasType(typeCreate);
    const existsUpdate = await hasType(typeUpdate);

    const pushVariant = (ac, tc, au, tu) => variants.push({
      create: `mutation($v:${tc}!){ webPixelCreate(${ac}:$v){ webPixel{ id } userErrors{ field message } } }`,
      update: `mutation($id:ID!, $v:${tu}!){ webPixelUpdate(id:$id, ${au}:$v){ webPixel{ id } userErrors{ field message } } }`,
      varCreate: (js) => ({ v: { enabled: true, settings: "{}", javascript: js } }),
      varUpdate: (js) => ({ id: "", v: { enabled: true, settings: "{}", javascript: js } }),
    });

    if (existsCreate && existsUpdate) pushVariant(argCreate, typeCreate, argUpdate, typeUpdate);
    pushVariant("webPixel", "WebPixelInput", "webPixel", "WebPixelUpdateInput");
    pushVariant("input", "WebPixelInput", "input", "WebPixelUpdateInput");
    pushVariant("webPixel", "WebPixelInput", "webPixel", "WebPixelInput");

    const pixelJs = CUSTOM_PIXEL_JS;

    let lastErr = null;
    for (const v of variants) {
      try {
        const c = await gql(v.create, v.varCreate(pixelJs));
        const ce = c?.webPixelCreate?.userErrors || [];
        const createdId = c?.webPixelCreate?.webPixel?.id;
        if (createdId && !ce.length) return res.json({ ok: true, mode: "created", pixel: { id: createdId } });

        const list = await gql(`query { webPixels(first:50){ nodes{ id } } }`, {});
        const existing = list?.webPixels?.nodes?.[0]?.id;
        if (!existing) throw new Error(ce.length ? JSON.stringify(ce) : "No pixel found to update");

        const u = await gql(v.update, { id: existing, ...v.varUpdate(pixelJs) });
        const ue = u?.webPixelUpdate?.userErrors || [];
        const uid = u?.webPixelUpdate?.webPixel?.id;
        if (uid && !ue.length) return res.json({ ok: true, mode: "updated", pixel: { id: uid } });
        throw new Error(ue.length ? JSON.stringify(ue) : "Unknown update error");
      } catch (e) {
        lastErr = String(e.message || e);
      }
    }

    // REST fallback
    const probe = await fetch(`${REST}/web_pixels.json?limit=1`, { method: "GET", headers });
    if (probe.status === 404 || probe.status === 405) {
      return fail(
        "Custom Web Pixel endpoints not available on this store.",
        {
          hint: "Admin → Settings → Customer events → Add custom pixel (ensure available). If theme uses checkout.liquid, customer-events may not fire.",
          scopes: "App token must include read_custom_pixels, write_custom_pixels (or read_pixels, write_pixels). Reinstall after changing scopes.",
          lastGraphQLError: lastErr
        }
      );
    }
    if (probe.status === 401 || probe.status === 403) {
      return fail("Unauthorized: token invalid or missing scopes.", "Grant read_custom_pixels, write_custom_pixels and reinstall.");
    }

    const body = { web_pixel: { name: "analyticsgtm Pixel", enabled: true, settings: "{}", javascript: pixelJs } };
    const cRes = await fetch(`${REST}/web_pixels.json`, { method: "POST", headers, body: JSON.stringify(body) });
    const cJson = await cRes.json().catch(() => ({}));
    if (cRes.ok) return res.json({ ok: true, mode: "created", pixel: cJson.web_pixel });

    const lRes = await fetch(`${REST}/web_pixels.json`, { method: "GET", headers });
    const lJson = await lRes.json().catch(() => ({}));
    const existing = (lJson.web_pixels || [])[0];
    if (!existing) return fail(`Create failed (${cRes.status})`, cJson?.errors || cJson || lastErr || "No pixel to update.");

    const upd = { web_pixel: { id: existing.id, enabled: true, settings: "{}", javascript: pixelJs } };
    const uRes = await fetch(`${REST}/web_pixels/${existing.id}.json`, { method: "PUT", headers, body: JSON.stringify(upd) });
    const uJson = await uRes.json().catch(() => ({}));
    if (!uRes.ok) return fail(`Update failed (${uRes.status})`, uJson?.errors || uJson || lastErr);

    return res.json({ ok: true, mode: "updated", pixel: uJson.web_pixel });
  } catch (e) {
    return res.status(400).json({ error: String(e.message) });
  }
});

// ------------------------------- Static / UI ---------------------------------
// Serve pixel.js with proper MIME/CORS (optional: for storefront loads)
app.get("/pixel.js", (req, res) => {
  res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.sendFile(path.join(process.cwd(), "public/pixel.js"));
});

// Serve other static assets from /public
app.use(express.static(path.join(process.cwd(), "public")));

// Simple admin UI for manual calls
app.get("/admin/settings", (req, res) => {
  const shop = req.query.shop || process.env.SHOP || "";
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>analyticsgtm • Settings</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{--bg:#0b1220;--panel:#0f1629;--panel-2:#121a30;--text:#e7eefc;--muted:#9fb2d1;--brand:#6ea8ff;--brand-2:#7c5cff;--accent:#22c55e;--danger:#ef4444;--border:rgba(255,255,255,.08);--ring:rgba(110,168,255,.35);--shadow:0 8px 30px rgba(0,0,0,.35)}
  *{box-sizing:border-box} body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;color:var(--text);background:radial-gradient(1200px 600px at 20% -20%, #1b2a55 0, transparent 60%), var(--bg)}
  .topbar{background:linear-gradient(90deg, rgba(110,168,255,.25), rgba(124,92,255,.25));border-bottom:1px solid var(--border);backdrop-filter:blur(6px)}
  .topbar-inner{max-width:980px;margin:0 auto;padding:18px 16px;display:flex;align-items:center;gap:12px}
  .logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--brand),var(--brand-2));box-shadow:inset 0 0 0 2px rgba(255,255,255,.15)}
  .title{font-weight:800;letter-spacing:.3px;font-size:20px}
  .wrap{max-width:980px;margin:28px auto;padding:0 16px}
  .grid{display:grid;grid-template-columns:1fr;gap:16px}
  @media(min-width:840px){.grid{grid-template-columns:1fr 1fr}}
  .card{background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:22px}
  .card h2{margin:0 0 8px 0;font-size:18px}
  .muted{color:var(--muted);font-size:12px}
  label{display:block;margin:12px 0 6px;font-weight:600;color:var(--text)}
  input{padding:10px;border-radius:10px}
  .field{position:relative}
  .field input{width:100%;padding:12px 12px 12px 40px;font-size:14px;color:var(--text);background:#0b1428;border:1px solid var(--border);border-radius:12px;outline:none;transition:border .2s,box-shadow .2s,transform .05s}
  .field input:focus{border-color:var(--brand);box-shadow:0 0 0 4px var(--ring)}
  .btn{appearance:none;border:0;cursor:pointer;font-weight:700;letter-spacing:.2px;padding:12px 14px;border-radius:12px;color:#0b1220;background:linear-gradient(135deg,var(--brand),var(--brand-2));box-shadow:0 8px 16px rgba(110,168,255,.28);transition:transform .08s,filter .2s,box-shadow .2s}
  .btn:hover{filter:brightness(1.05)} .btn:active{transform:translateY(1px)}
  .btn.secondary{background:transparent;color:var(--text);border:1px solid var(--border);box-shadow:none}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  .toast{margin-top:12px;display:none;padding:12px 14px;border-radius:12px;font-weight:600;font-size:13px;border:1px solid;background:rgba(0,0,0,.25)}
  .ok{border-color:rgba(34,197,94,.35);color:#86efac;background:rgba(34,197,94,.08)}
  .err{border-color:rgba(239,68,68,.35);color:#fecaca;background:rgba(239,68,68,.08)}
  .section{margin-top:20px} .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  .pill{font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--muted)}
  .two-col{display:grid;grid-template-columns:1fr;gap:12px} @media(min-width:700px){.two-col{grid-template-columns:1fr 1fr}}
  code{background:#0b1428;border:1px solid var(--border);padding:2px 6px;border-radius:8px}
</style>
</head>
<body>

  <div class="topbar">
    <div class="topbar-inner">
      <div class="logo" aria-hidden="true"></div>
      <div class="title">analyticsgtm — Settings</div>
      <span class="pill">v1.0</span>
    </div>
  </div>

  <div class="wrap">
    <div class="card">
      <div class="header"><h2>Store connection</h2><span class="pill">Required</span></div>
      <div class="two-col">
        <div>
          <label>Shop domain (myshopify.com)</label>
          <div class="field"><input id="shop" type="text" placeholder="your-store.myshopify.com" value="${shop}"></div>
          <div class="muted" style="margin-top:6px">Example: <code>analyticscontainer-store.myshopify.com</code> (not admin URL)</div>
        </div>
        <div>
          <label>Admin API Access Token <span class="muted">(shpat_… dev test)</span></label>
          <div class="field"><input id="tok" type="text" placeholder="shpat_xxx"></div>
          <div class="muted" style="margin-top:6px">Themes: <code>read_themes, write_themes</code> • Pixels (optional): <code>read_pixels, write_pixels</code></div>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="header"><h2>1) Enable GTM</h2><span class="pill">Head + Body</span></div>
        <p class="muted">Adds GTM to <code>&lt;head&gt;</code> and noscript to <code>&lt;body&gt;</code>. Default: <code>${process.env.GTM_DEFAULT_ID || "GTM-XXXXXXXX"}</code></p>
        <label>GTM Container ID</label>
        <div class="field"><input id="gtm" type="text" placeholder="GTM-XXXXXXX"></div>
        <div class="row">
          <button class="btn" id="btn-gtm">Enable GTM</button>
          <button class="btn secondary" id="btn-preview-gtm">Tag Assistant</button>
        </div>
        <div id="ok-gtm" class="toast ok">GTM injected.</div>
        <div id="err-gtm" class="toast err">Failed.</div>
      </div>

      <div class="card">
        <div class="header"><h2>2) Enable DataLayer</h2><span class="pill">Snippet</span></div>
        <p class="muted">Creates <code>snippets/ultimate-datalayer.liquid</code> and renders it after the GTM head end marker (or before <code>&lt;/head&gt;</code>).</p>
        <div class="row"><button class="btn" id="btn-dl">Enable DataLayer</button></div>
        <div id="ok-dl" class="toast ok">DataLayer snippet injected.</div>
        <div id="err-dl" class="toast err">Failed.</div>
      </div>
    </div>

    <div class="card section">
      <div class="header"><h2>3) Enable custom Web Pixel (Checkout)</h2><span class="pill">Customer events</span></div>
      <div class="two-col">
        <div>
          <label>Pixel name</label>
          <div class="field"><input id="pxname" type="text" value="analyticsgtm Pixel"></div>
        </div>
        <div>
          <label class="muted">Tip</label>
          <div class="muted">If REST not available, create once from <em>Settings → Customer events → Add custom pixel</em>, then click Enable again.</div>
        </div>
      </div>
      <div class="row"><button class="btn" id="btn-pixel">Enable custom Web Pixel</button></div>
      <div id="ok-px" class="toast ok">Pixel installed/updated.</div>
      <div id="err-px" class="toast err">Failed.</div>
    </div>

    <div class="card section" id="manual-pixel" style="display:none">
      <div class="header"><h2>Manual install — Custom Pixel (Customer events)</h2><span class="pill">Fallback</span></div>
      <ol style="margin:0 0 12px 18px; line-height:1.6">
        <li>Admin → <b>Settings → Customer events</b></li>
        <li><b>Add custom pixel</b> → নিচের বক্স থেকে কোড <b>Copy</b> করে paste করুন</li>
        <li><b>Save</b> করে <b>Enable</b> দিন</li>
      </ol>
      <label style="margin-top:12px">Custom Pixel code</label>
      <div class="field">
        <textarea id="px-code" rows="14" spellcheck="false" style="width:100%;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;font-size:12px;line-height:1.45;padding:12px;color:#e7eefc;background:#0b1428;border:1px solid rgba(255,255,255,.08);border-radius:12px;"></textarea>
      </div>
      <div class="row">
        <button class="btn" id="btn-copy-code">Copy code</button>
        <button class="btn secondary" id="btn-open-cust-events">Open Customer events</button>
      </div>
      <div id="ok-copy" class="toast ok">Copied!</div>
      <div id="err-copy" class="toast err">Copy failed.</div>
      <div class="muted" style="margin-top:10px">Note: যদি আপনার থিম <code>checkout.liquid</code> ব্যবহার করে, তাহলে Customer events (checkout-stage) ট্রিগার নাও পেতে পারে। Checkout Extensibility (one-page checkout) হলে সবচেয়ে ভালো কাজ করে।</div>
    </div>
  </div>

<script>
  function toast(id, ok, msg){ const el=document.getElementById(id); el.innerText=msg||(ok?'Done':'Failed'); el.style.display='block'; setTimeout(()=>el.style.display='none', 3500); }
  function val(id){ return document.getElementById(id).value.trim(); }
  function setLoading(btn, loading=true){
    if(!btn) return;
    if(loading){ btn.dataset.text=btn.textContent; btn.textContent='Working…'; btn.disabled=true; btn.style.opacity=.7; btn.style.cursor='not-allowed'; }
    else { btn.textContent=btn.dataset.text||btn.textContent; btn.disabled=false; btn.style.opacity=1; btn.style.cursor='pointer'; }
  }

  document.getElementById('btn-gtm').addEventListener('click', async (e)=>{
    const btn=e.currentTarget; setLoading(btn,true);
    const payload={ shop:val('shop'), accessToken:val('tok'), gtmId:val('gtm') };
    try{
      const r=await fetch('/api/gtm/enable',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const j=await r.json().catch(()=>({})); if(!r.ok||j.error) throw new Error(j.error||'error');
      toast('ok-gtm', true, 'GTM injected.');
    }catch(err){ toast('err-gtm', false, 'Error: '+err.message); }
    finally{ setLoading(btn,false); }
  });

  document.getElementById('btn-preview-gtm').addEventListener('click', ()=>{
    const id = val('gtm') || '${process.env.GTM_DEFAULT_ID || ""}';
    if(!/^GTM-[A-Z0-9_-]+$/i.test(id)){ alert('Enter a valid GTM Container ID'); return; }
    window.open('https://tagassistant.google.com/?utm_source=analyticsgtm#/?mode=PREVIEW&url='+encodeURIComponent(location.origin)+'&id='+encodeURIComponent(id), '_blank');
  });

  document.getElementById('btn-dl').addEventListener('click', async (e)=>{
    const btn=e.currentTarget; setLoading(btn,true);
    const payload={ shop:val('shop'), accessToken:val('tok') };
    try{
      const r=await fetch('/api/datalayer/enable',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const j=await r.json().catch(()=>({})); if(!r.ok||j.error) throw new Error(j.error||'error');
      toast('ok-dl', true, 'DataLayer snippet injected.');
    }catch(err){ toast('err-dl', false, 'Error: '+err.message); }
    finally{ setLoading(btn,false); }
  });

  document.getElementById('btn-pixel').addEventListener('click', async (e)=>{
    const btn=e.currentTarget; setLoading(btn,true);
    const payload={ shop:val('shop'), accessToken:val('tok'), name: document.getElementById('pxname').value.trim() };
    try{
      const r=await fetch('/api/pixel/enable',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const j=await r.json().catch(()=>({})); if(!r.ok||j.error) throw new Error(j.error||'error');
      toast('ok-px', true, 'Pixel installed/updated.');
      // If REST/GQL not available, reveal manual section and prefill code
      document.getElementById('px-code').value = \`${CUSTOM_PIXEL_JS.replace(/`/g, "\\`")}\`;
    }catch(err){
      toast('err-px', false, 'Error: '+err.message);
      // show manual fallback
      document.getElementById('manual-pixel').style.display='block';
      document.getElementById('px-code').value = \`${CUSTOM_PIXEL_JS.replace(/`/g, "\\`")}\`;
    }finally{ setLoading(btn,false); }
  });

  document.getElementById('btn-copy-code')?.addEventListener('click', async ()=>{
    const ta=document.getElementById('px-code');
    try{ await navigator.clipboard.writeText(ta.value); document.getElementById('ok-copy').style.display='block'; setTimeout(()=>document.getElementById('ok-copy').style.display='none', 2500); }
    catch{ document.getElementById('err-copy').style.display='block'; setTimeout(()=>document.getElementById('err-copy').style.display='none', 2500); }
  });

  document.getElementById('btn-open-cust-events')?.addEventListener('click', ()=>{
    window.open('https://admin.shopify.com/store/_/settings/customer_events', '_blank');
  });
</script>
</body></html>`);
});

// Health & root
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>analyticsgtm</title>
  <h1>analyticsgtm</h1><p><a href="/admin/settings">Open Settings UI</a></p>`);
});

// ------------------------------- Server Start --------------------------------
app.listen(PORT, () => {
  console.log(`analyticsgtm running on :${PORT}`);
});
