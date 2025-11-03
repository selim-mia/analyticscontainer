// server/index.js — FINAL (uses raw template literals instead of comment-heredoc)
import express from "express";
import nodeFetch from "node-fetch"; // Node 18+ has global fetch; this is a fallback
import dotenv from "dotenv";
dotenv.config();
// top-এ imports (fs/path/fileURLToPath) থাকুক:
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname helper:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ কপি হবে এই ফাইলের কনটেন্ট
const PIXEL_COPY_PATH = path.join(__dirname, "payloads", "custom_pixel.js");

function readPixelCopySource() {
  try {
    return fs.readFileSync(PIXEL_COPY_PATH, "utf8");
  } catch (e) {
    return "/* Pixel source not found: server/payloads/custom_pixel.js */";
  }
}
const fetch = globalThis.fetch || nodeFetch;

const app = express();
app.use(express.json({ limit: "512kb" }));

// Allow Shopify Admin iframe (embedded UI) + a few safe headers
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
  next();
});

const PORT = process.env.PORT || 3000;
const DEFAULT_GTM_ID = process.env.GTM_DEFAULT_ID || "GTM-XXXXXXXX";

/* --------------------------------
   Raw template literal helper
   -------------------------------- */
const raw = (strings, ..._values) => strings.raw[0];

// ---------- Utils ----------
function assert(v, msg) { if (!v) throw new Error(msg); }

// Shopify Admin REST 2025-10
async function shopifyFetch(shop, accessToken, path, opts = {}) {
  const url = `https://${shop}/admin/api/2025-10${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Shopify ${res.status} ${await res.text()}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
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
    shop, token,
    `/themes/${themeId}/assets.json?asset[key]=${q}`,
    { method: "GET" }
  );
  return data.asset;
}

async function putAsset(shop, token, themeId, key, value) {
  const asset = { key };
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > 650 * 1024) {
    asset.attachment = Buffer.from(value, "utf8").toString("base64");
  } else {
    asset.value = value;
  }
  return shopifyFetch(shop, token, `/themes/${themeId}/assets.json`, {
    method: "PUT",
    body: JSON.stringify({ asset }),
  });
}

/* -----------------------------------------
   1) UDL snippet as Liquid (raw template)
   ----------------------------------------- */
const UDL_SNIPPET_VALUE = raw`<script>
/**
  * Author: analyticsgtm
  * Email: analyticsgtm@gmail.com 
  * Last Update: 27 September 2025
  */
  
  (function() {
      class Ultimate_Shopify_DataLayer {
        constructor() {
          window.dataLayer = window.dataLayer || []; 
          
          // use a prefix of events name
          this.eventPrefix = '';

          //Keep the value false to get non-formatted product ID
          this.formattedItemId = true; 

          // data schema
          this.dataSchema = {
            ecommerce: {
                show: true
            },
            dynamicRemarketing: {
                show: false,
                business_vertical: 'retail'
            }
          }

          // add to wishlist selectors
          this.addToWishListSelectors = {
            'addWishListIcon': '',
            'gridItemSelector': '',
            'productLinkSelector': 'a[href*="/products/"]'
          }

          // quick view selectors
          this.quickViewSelector = {
            'quickViewElement': '',
            'gridItemSelector': '',
            'productLinkSelector': 'a[href*="/products/"]'
          }

          // mini cart button selector
          this.miniCartButton = [
            'a[href="/cart"]', 
          ];
          this.miniCartAppersOn = 'click';


          // begin checkout buttons/links selectors
          this.beginCheckoutButtons = [
            'input[name="checkout"]',
            'button[name="checkout"]',
            'a[href="/checkout"]',
            '.additional-checkout-buttons',
          ];

          // direct checkout button selector
          this.shopifyDirectCheckoutButton = [
            '.shopify-payment-button'
          ]

          //Keep the value true if Add to Cart redirects to the cart page
          this.isAddToCartRedirect = false;
          
          // keep the value false if cart items increment/decrement/remove refresh page 
          this.isAjaxCartIncrementDecrement = true;
          

          // Caution: Do not modify anything below this line, as it may result in it not functioning correctly.
          this.cart = {{ cart | json }}
          this.countryCode = "{{ shop.address.country_code }}";
          this.storeURL = "{{ shop.secure_url }}";
          localStorage.setItem('shopCountryCode', this.countryCode);
          this.collectData(); 
          this.itemsList = [];
        }

        updateCart() {
          fetch("/cart.js")
          .then((response) => response.json())
          .then((data) => {
            this.cart = data;
          });
        }

       debounce(delay) {         
          let timeoutId;
          return function(func) {
            const context = this;
            const args = arguments;
            
            clearTimeout(timeoutId);
            
            timeoutId = setTimeout(function() {
              func.apply(context, args);
            }, delay);
          };
        }

        eventConsole(eventName, eventData) {
          const css1 = 'background: red; color: #fff; font-size: normal; border-radius: 3px 0 0 3px; padding: 3px 4px;';
          const css2 = 'background-color: blue; color: #fff; font-size: normal; border-radius: 0 3px 3px 0; padding: 3px 4px;';
          console.log('%cGTM DataLayer Event:%c' + eventName, css1, css2, eventData);
        }

        collectData() { 
            this.customerData();
            this.ajaxRequestData();
            this.searchPageData();
            this.miniCartData();
            this.beginCheckoutData();
  
            {% if template contains 'cart' %}
              this.viewCartPageData();
            {% endif %}
  
            {% if template contains 'product' %}
              this.productSinglePage();
            {% endif %}
  
            {% if template contains 'collection' %}
              this.collectionsPageData();
            {% endif %}
            
            this.addToWishListData();
            this.quickViewData();
            this.selectItemData(); 
            this.formData();
            this.phoneClickData();
            this.emailClickData();
            this.loginRegisterData();
        }        

        //logged-in customer data 
        customerData() {
            const currentUser = {};
            {% if customer %}
              currentUser.id = {{ customer.id }};
              currentUser.first_name = "{{ customer.first_name }}";
              currentUser.last_name = "{{ customer.last_name }}";
              currentUser.full_name = "{{ customer.name }}";
              currentUser.email = "{{ customer.email }}";
              currentUser.phone = "{{ customer.default_address.phone }}";
          
              {% if customer.default_address %}
                currentUser.address = {
                  address_summary: "{{ customer.default_address.summary }}",
                  address1: "{{ customer.default_address.address1 }}",
                  address2: "{{ customer.default_address.address2 }}",
                  city: "{{ customer.default_address.city }}",
                  street: "{{ customer.default_address.street }}",
                  zip: "{{ customer.default_address.zip }}",
                  company: "{{ customer.default_address.company }}",
                  country: "{{ customer.default_address.country.name }}",
                  countryCode: "{{ customer.default_address.country_code }}",
                  province: "{{ customer.default_address.province }}"
                };
              {% endif %}
            {% endif %}

            if (currentUser.email) {
              currentUser.hash_email = "{{ customer.email | sha256 }}"
            }

            if (currentUser.phone) {
              currentUser.hash_phone = "{{ customer.phone | sha256 }}"
            }

            window.dataLayer = window.dataLayer || [];
            dataLayer.push({
              customer: currentUser
            });
        }

        // add_to_cart, remove_from_cart, search
        ajaxRequestData() {
          const self = this;
          
          // handle non-ajax add to cart
          if(this.isAddToCartRedirect) {
            document.addEventListener('submit', function(event) {
              const addToCartForm = event.target.closest('form[action="/cart/add"]');
              if(addToCartForm) {
                event.preventDefault();
                
                const formData = new FormData(addToCartForm);
            
                fetch(window.Shopify.routes.root + 'cart/add.js', {
                  method: 'POST',
                  body: formData
                })
                .then(response => {
                    window.location.href = "{{ routes.cart_url }}";
                })
                .catch((error) => {
                  console.error('Error:', error);
                });
              }
            });
          }
          
          // fetch
          let originalFetch = window.fetch;
          let debounce = this.debounce(800);
          
          window.fetch = function () {
            return originalFetch.apply(this, arguments).then((response) => {
              if (response.ok) {
                let cloneResponse = response.clone();
                let requestURL = arguments[0]['url'] || arguments[0];
                
                if(typeof requestURL === 'string' && /.*\\/search\\/?\\.*/.test(requestURL) && requestURL.includes('q=') && !requestURL.includes('&requestFrom=uldt')) {   
                  const queryString = requestURL.split('?')[1];
                  const urlParams = new URLSearchParams(queryString);
                  const search_term = urlParams.get("q");

                  debounce(function() {
                    fetch(\`\${self.storeURL}/search/suggest.json?q=\${search_term}&resources[type]=product&requestFrom=uldt\`)
                      .then(res => res.json())
                      .then(function(data) {
                            const products = data.resources.results.products;
                            if(products.length) {
                              const fetchRequests = products.map(product =>
                                fetch(\`\${self.storeURL}/\${product.url.split('?')[0]}.js\`)
                                  .then(response => response.json())
                                  .catch(error => console.error('Error fetching:', error))
                              );

                              Promise.all(fetchRequests)
                                .then(products => {
                                    const items = products.map((product) => {
                                      return {
                                        product_id: product.id,
                                        product_title: product.title,
                                        variant_id: product.variants[0].id,
                                        variant_title: product.variants[0].title,
                                        vendor: product.vendor,
                                        total_discount: 0,
                                        final_price: product.price_min,
                                        product_type: product.type, 
                                        quantity: 1
                                      }
                                    });

                                    self.ecommerceDataLayer('search', {search_term, items});
                                })
                            }else {
                              self.ecommerceDataLayer('search', {search_term, items: []});
                            }
                      });
                  });
                }
                else if (typeof requestURL === 'string' && requestURL.includes("/cart/add")) {
                  cloneResponse.text().then((text) => {
                    let data = JSON.parse(text);

                    if(data.items && Array.isArray(data.items)) {
                      data.items.forEach(function(item) {
                         self.ecommerceDataLayer('add_to_cart', {items: [item]});
                      })
                    } else {
                      self.ecommerceDataLayer('add_to_cart', {items: [data]});
                    }
                    self.updateCart();
                  });
                }else if(typeof requestURL === 'string' && (requestURL.includes("/cart/change") || requestURL.includes("/cart/update"))) {
                  
                   cloneResponse.text().then((text) => {
                     
                    let newCart = JSON.parse(text);
                    let newCartItems = newCart.items;
                    let oldCartItems = self.cart.items;

                    for(let i = 0; i < oldCartItems.length; i++) {
                      let item = oldCartItems[i];
                      let newItem = newCartItems.find(newItems => newItems.id === item.id);


                      if(newItem) {

                        if(newItem.quantity > item.quantity) {
                          // cart item increment
                          let quantity = (newItem.quantity - item.quantity);
                          let updatedItem = {...item, quantity}
                          self.ecommerceDataLayer('add_to_cart', {items: [updatedItem]});
                          self.updateCart(); 

                        }else if(newItem.quantity < item.quantity) {
                          // cart item decrement
                          let quantity = (item.quantity - newItem.quantity);
                          let updatedItem = {...item, quantity}
                          self.ecommerceDataLayer('remove_from_cart', {items: [updatedItem]});
                          self.updateCart(); 
                        }
                        

                      }else {
                        self.ecommerceDataLayer('remove_from_cart', {items: [item]});
                        self.updateCart(); 
                      }
                    }
                     
                  });
                }
              }
              return response;
            });
          }
          // end fetch 


          //xhr
          var origXMLHttpRequest = XMLHttpRequest;
          XMLHttpRequest = function() {
            var requestURL;
    
            var xhr = new origXMLHttpRequest();
            var origOpen = xhr.open;
            var origSend = xhr.send;
            
            // Override the \`open\` function.
            xhr.open = function(method, url) {
                requestURL = url;
                return origOpen.apply(this, arguments);
            };
    
    
            xhr.send = function() {
    
                // Only proceed if the request URL matches what we're looking for.
                if (typeof requestURL === 'string' && (requestURL.includes("/cart/add") || requestURL.includes("/cart/change") || /.*\\/search\\/?\\.*/.test(requestURL) && requestURL.includes('q='))) {
        
                    xhr.addEventListener('load', function() {
                        if (xhr.readyState === 4) {
                            if (xhr.status >= 200 && xhr.status < 400) { 

                              if(typeof requestURL === 'string' && /.*\\/search\\/?\\.*/.test(requestURL) && requestURL.includes('q=') && !requestURL.includes('&requestFrom=uldt')) {
                                const queryString = requestURL.split('?')[1];
                                const urlParams = new URLSearchParams(queryString);
                                const search_term = urlParams.get("q");

                                debounce(function() {
                                    fetch(\`\${self.storeURL}/search/suggest.json?q=\${search_term}&resources[type]=product&requestFrom=uldt\`)
                                      .then(res => res.json())
                                      .then(function(data) {
                                            const products = data.resources.results.products;
                                            if(products.length) {
                                              const fetchRequests = products.map(product =>
                                                fetch(\`\${self.storeURL}/\${product.url.split('?')[0]}.js\`)
                                                  .then(response => response.json())
                                                  .catch(error => console.error('Error fetching:', error))
                                              );
                
                                              Promise.all(fetchRequests)
                                                .then(products => {
                                                    const items = products.map((product) => {
                                                      return {
                                                        product_id: product.id,
                                                        product_title: product.title,
                                                        variant_id: product.variants[0].id,
                                                        variant_title: product.variants[0].title,
                                                        vendor: product.vendor,
                                                        total_discount: 0,
                                                        final_price: product.price_min,
                                                        product_type: product.type, 
                                                        quantity: 1
                                                      }
                                                    });
                
                                                    self.ecommerceDataLayer('search', {search_term, items});
                                                })
                                            }else {
                                              self.ecommerceDataLayer('search', {search_term, items: []});
                                            }
                                      });
                                  });

                              }

                              else if(typeof requestURL === 'string' && requestURL.includes("/cart/add")) {
                                  const data = JSON.parse(xhr.responseText);

                                  if(data.items && Array.isArray(data.items)) {
                                    data.items.forEach(function(item) {
                                        self.ecommerceDataLayer('add_to_cart', {items: [item]});
                                      })
                                  } else {
                                    self.ecommerceDataLayer('add_to_cart', {items: [data]});
                                  }
                                  self.updateCart();
                                 
                               }else if(typeof requestURL === 'string' && requestURL.includes("/cart/change")) {
                                 
                                  const newCart = JSON.parse(xhr.responseText);
                                  const newCartItems = newCart.items;
                                  let oldCartItems = self.cart.items;
              
                                  for(let i = 0; i < oldCartItems.length; i++) {
                                    let item = oldCartItems[i];
                                    let newItem = newCartItems.find(newItems => newItems.id === item.id);
              
              
                                    if(newItem) {
                                      if(newItem.quantity > item.quantity) {
                                        // cart item increment
                                        let quantity = (newItem.quantity - item.quantity);
                                        let updatedItem = {...item, quantity}
                                        self.ecommerceDataLayer('add_to_cart', {items: [updatedItem]});
                                        self.updateCart(); 
              
                                      }else if(newItem.quantity < item.quantity) {
                                        // cart item decrement
                                        let quantity = (item.quantity - newItem.quantity);
                                        let updatedItem = {...item, quantity}
                                        self.ecommerceDataLayer('remove_from_cart', {items: [updatedItem]});
                                        self.updateCart(); 
                                      }
                                      
              
                                    }else {
                                      self.ecommerceDataLayer('remove_from_cart', {items: [item]});
                                      self.updateCart(); 
                                    }
                                  }
                               }          
                            }
                        }
                    });
                }
    
                return origSend.apply(this, arguments);
            };
    
            return xhr;
          }; 
          //end xhr
        }

        // search event from search page
        searchPageData() {
          const self = this;
          let pageUrl = window.location.href;
          
          if(/.+\\/search\\?.*\\&?q=.+/.test(pageUrl)) {   
            const queryString = pageUrl.split('?')[1];
            const urlParams = new URLSearchParams(queryString);
            const search_term = urlParams.get("q");
                
            fetch(\`{{ shop.secure_url }}/search/suggest.json?q=\${search_term}&resources[type]=product&requestFrom=uldt\`)
            .then(res => res.json())
            .then(function(data) {
                  const products = data.resources.results.products;
                  if(products.length) {
                    const fetchRequests = products.map(product =>
                      fetch(\`\${self.storeURL}/\${product.url.split('?')[0]}.js\`)
                        .then(response => response.json())
                        .catch(error => console.error('Error fetching:', error))
                    );
                    Promise.all(fetchRequests)
                    .then(products => {
                        const items = products.map((product) => {
                            return {
                            product_id: product.id,
                            product_title: product.title,
                            variant_id: product.variants[0].id,
                            variant_title: product.variants[0].title,
                            vendor: product.vendor,
                            total_discount: 0,
                            final_price: product.price_min,
                            product_type: product.type, 
                            quantity: 1
                            }
                        });

                        self.ecommerceDataLayer('search', {search_term, items});
                    });
                  }else {
                    self.ecommerceDataLayer('search', {search_term, items: []});
                  }
            });
          }
        }

        // view_cart
        miniCartData() {
          if(this.miniCartButton.length) {
            let self = this;
            if(this.miniCartAppersOn === 'hover') {
              this.miniCartAppersOn = 'mouseenter';
            }
            this.miniCartButton.forEach((selector) => {
              let miniCartButtons = document.querySelectorAll(selector);
              miniCartButtons.forEach((miniCartButton) => {
                  miniCartButton.addEventListener(self.miniCartAppersOn, () => {
                    self.ecommerceDataLayer('view_cart', self.cart);
                  });
              })
            });
          }
        }

        // begin_checkout
        beginCheckoutData() {
          let self = this;
          document.addEventListener('pointerdown', (event) => {
            let targetElement = event.target.closest(self.beginCheckoutButtons.join(', '));
            if(targetElement) {
              self.ecommerceDataLayer('begin_checkout', self.cart);
            }
          });
        }

        // view_cart, add_to_cart, remove_from_cart
        viewCartPageData() {
          
          this.ecommerceDataLayer('view_cart', this.cart);

          //if cart quantity chagne reload page 
          if(!this.isAjaxCartIncrementDecrement) {
            const self = this;
            document.addEventListener('pointerdown', (event) => {
              const target = event.target.closest('a[href*="/cart/change?"]');
              if(target) {
                const linkUrl = target.getAttribute('href');
                const queryString = linkUrl.split("?")[1];
                const urlParams = new URLSearchParams(queryString);
                const newQuantity = urlParams.get("quantity");
                const line = urlParams.get("line");
                const cart_id = urlParams.get("id");
        
                
                if(newQuantity && (line || cart_id)) {
                  let item = line ? {...self.cart.items[line - 1]} : self.cart.items.find(item => item.key === cart_id);
        
                  let event = 'add_to_cart';
                  if(newQuantity < item.quantity) {
                    event = 'remove_from_cart';
                  }
        
                  let quantity = Math.abs(newQuantity - item.quantity);
                  item['quantity'] = quantity;
        
                  self.ecommerceDataLayer(event, {items: [item]});
                }
              }
            });
          }
        }

        productSinglePage() {
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
              {% if product.selected_or_first_available_variant.title != "Default Title" %}
                variant_title: {{ product.selected_or_first_available_variant.title | json }},
              {% endif %}
              final_price: {{ product.selected_or_first_available_variant.price }},
              quantity: 1
          };
          
          const variants = {{ product.variants | json }}
          this.ecommerceDataLayer('view_item', {items: [item]});

          if(this.shopifyDirectCheckoutButton.length) {
              let self = this;
              document.addEventListener('pointerdown', (event) => {  
                let target = event.target;
                let checkoutButton = event.target.closest(this.shopifyDirectCheckoutButton.join(', '));

                if(checkoutButton && (variants || self.quickViewVariants)) {

                    let checkoutForm = checkoutButton.closest('form[action*="/cart/add"]');
                    if(checkoutForm) {

                        let variant_id = null;
                        let varientInput = checkoutForm.querySelector('input[name="id"]');
                        let varientIdFromURL = new URLSearchParams(window.location.search).get('variant');
                        let firstVarientId = item.variant_id;

                        if(varientInput) {
                          variant_id = parseInt(varientInput.value);
                        }else if(varientIdFromURL) {
                          variant_id = varientIdFromURL;
                        }else if(firstVarientId) {
                          variant_id = firstVarientId;
                        }

                        if(variant_id) {
                            variant_id = parseInt(variant_id);

                            let quantity = 1;
                            let quantitySelector = checkoutForm.getAttribute('id');
                            if(quantitySelector) {
                              let quentityInput = document.querySelector('input[name="quantity"][form="'+quantitySelector+'"]');
                              if(quentityInput) {
                                  quantity = +quentityInput.value;
                              }
                            }
                          
                            if(variant_id) {
                                let variant = variants.find(item => item.id === +variant_id);
                                if(variant && item) {
                                    variant_id
                                    item['variant_id'] = variant_id;
                                    item['variant_title'] = variant.title;
                                    item['final_price'] = variant.price;
                                    item['quantity'] = quantity;
                                    
                                    self.ecommerceDataLayer('add_to_cart', {items: [item]});
                                    self.ecommerceDataLayer('begin_checkout', {items: [item]});
                                }else if(self.quickViewedItem) {                                  
                                  let variant = self.quickViewVariants.find(item => item.id === +variant_id);
                                  if(variant) {
                                    self.quickViewedItem['variant_id'] = variant_id;
                                    self.quickViewedItem['variant_title'] = variant.title;
                                    self.quickViewedItem['final_price'] = parseFloat(variant.price) * 100;
                                    self.quickViewedItem['quantity'] = quantity;
                                    
                                    self.ecommerceDataLayer('add_to_cart', {items: [self.quickViewedItem]});
                                    self.ecommerceDataLayer('begin_checkout', {items: [self.quickViewedItem]});
                                    
                                  }
                                }
                            }
                        }
                    }

                }
              }); 
          }
          
          {% endif %}
        }

        collectionsPageData() {
          var ecommerce = {
            'items': [
              {% for product in collection.products %}
                {
                    'product_id': {{ product.id | json }},
                    'variant_id': {{ product.selected_or_first_available_variant.id | json }},
                    'vendor': {{ product.vendor | json }},
                    'sku': {{ product.selected_or_first_available_variant.sku | json }},
                    'total_discount': 0,
                    'variant_title': {{ product.selected_or_first_available_variant.title | json }},
                    'product_title': {{ product.title | json }},
                    'final_price': Number({{ product.price }}),
                    'product_type': {{ product.type | json }},
                    'item_list_id': {{ collection.id | json }},
                    'item_list_name': {{ collection.title | json }},
                    'url': {{product.url | json}},
                    'quantity': 1
                },
              {% endfor %}
              ]
          };

          this.itemsList = ecommerce.items;
          ecommerce['item_list_id'] = {{ collection.id | json }}
          ecommerce['item_list_name'] = {{ collection.title | json }}

          this.ecommerceDataLayer('view_item_list', ecommerce);
        }
        
        
        // add to wishlist
        addToWishListData() {
          if(this.addToWishListSelectors && this.addToWishListSelectors.addWishListIcon) {
            const self = this;
            document.addEventListener('pointerdown', (event) => {
              let target = event.target;
              
              if(target.closest(self.addToWishListSelectors.addWishListIcon)) {
                let pageULR = window.location.href.replace(/\\?.+/, '');
                let requestURL = undefined;
          
                if(/\\/products\\/[^/]+$/.test(pageULR)) {
                  requestURL = pageULR;
                } else if(self.addToWishListSelectors.gridItemSelector && self.addToWishListSelectors.productLinkSelector) {
                  let itemElement = target.closest(self.addToWishListSelectors.gridItemSelector);
                  if(itemElement) {
                    let linkElement = itemElement.querySelector(self.addToWishListSelectors.productLinkSelector); 
                    if(linkElement) {
                      let link = linkElement.getAttribute('href').replace(/\\?.+/g, '');
                      if(link && /\\/products\\/[^/]+$/.test(link)) {
                        requestURL = link;
                      }
                    }
                  }
                }

                if(requestURL) {
                  fetch(requestURL + '.json')
                    .then(res => res.json())
                    .then(result => {
                      let data = result.product;                    
                      if(data) {
                        let dataLayerData = {
                          product_id: data.id,
                            variant_id: data.variants[0].id,
                            product_title: data.title,
                          quantity: 1,
                          final_price: parseFloat(data.variants[0].price) * 100,
                          total_discount: 0,
                          product_type: data.product_type,
                          vendor: data.vendor,
                          variant_title: (data.variants[0].title !== 'Default Title') ? data.variants[0].title : undefined,
                          sku: data.variants[0].sku,
                        }

                        self.ecommerceDataLayer('add_to_wishlist', {items: [dataLayerData]});
                      }
                    });
                }
              }
            });
          }
        }

        quickViewData() {
          if(this.quickViewSelector.quickViewElement && this.quickViewSelector.gridItemSelector && this.quickViewSelector.productLinkSelector) {
            const self = this;
            document.addEventListener('pointerdown', (event) => {
              let target = event.target;
              if(target.closest(self.quickViewSelector.quickViewElement)) {
                let requestURL = undefined;
                let itemElement = target.closest(this.quickViewSelector.gridItemSelector );
                
                if(itemElement) {
                  let linkElement = itemElement.querySelector(self.quickViewSelector.productLinkSelector); 
                  if(linkElement) {
                    let link = linkElement.getAttribute('href').replace(/\\?.+/g, '');
                    if(link && /\\/products\\/[^/]+$/.test(link)) {
                      requestURL = link;
                    }
                  }
                }   
                
                if(requestURL) {
                    fetch(requestURL + '.json')
                      .then(res => res.json())
                      .then(result => {
                        let data = result.product;                    
                        if(data) {
                          let dataLayerData = {
                            product_id: data.id,
                            variant_id: data.variants[0].id,
                            product_title: data.title,
                            quantity: 1,
                            final_price: parseFloat(data.variants[0].price) * 100,
                            total_discount: 0,
                            product_type: data.product_type,
                            vendor: data.vendor,
                            variant_title: (data.variants[0].title !== 'Default Title') ? data.variants[0].title : undefined,
                            sku: data.variants[0].sku,
                          }
  
                          self.ecommerceDataLayer('view_item', {items: [dataLayerData]});
                          self.quickViewVariants = data.variants;
                          self.quickViewedItem = dataLayerData;
                        }
                      });
                  }
              }
            });

            {% unless template contains 'product' %}
              if(this.shopifyDirectCheckoutButton.length) {
                let self = this;
                document.addEventListener('pointerdown', (event) => {
                  let target = event.target;
                  let checkoutButton = event.target.closest(this.shopifyDirectCheckoutButton.join(', '));
                  
                  if(self.quickViewVariants && self.quickViewedItem && self.quickViewVariants.length && checkoutButton) {

                    let checkoutForm = checkoutButton.closest('form[action*="/cart/add"]');
                    if(checkoutForm) {
                        let quantity = 1;
                        let varientInput = checkoutForm.querySelector('input[name="id"]');
                        let quantitySelector = checkoutForm.getAttribute('id');

                        if(quantitySelector) {
                          let quentityInput = document.querySelector('input[name="quantity"][form="'+quantitySelector+'"]');
                          if(quentityInput) {
                              quantity = +quentityInput.value;
                          }
                        }

                        if(varientInput) {
                            let variant_id = parseInt(varientInput.value);

                            if(variant_id) {
                                const variant = self.quickViewVariants.find(item => item.id === +variant_id);
                                if(variant && self.quickViewedItem) {
                                    self.quickViewedItem['variant_id'] = variant_id;
                                    self.quickViewedItem['variant_title'] = variant.title;
                                    self.quickViewedItem['final_price'] = parseFloat(variant.price) * 100;
                                    self.quickViewedItem['quantity'] = quantity; 
    
                                    self.ecommerceDataLayer('add_to_cart', {items: [self.quickViewedItem]});
                                    self.ecommerceDataLayer('begin_checkout', {items: [self.quickViewedItem]});
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

        // select_item events
        selectItemData() {
          
          const self = this;
          const items = this.itemsList;

          {% if template contains 'collection' %}            
            document.addEventListener('pointerdown', function(event) {
                            
              const productLink = event.target.closest('a[href*="/products/"]');

              if(productLink) {
                  const linkUrl = productLink.getAttribute('href');

                  const matchProduct = (item) => {
                    var itemSlug = (item.url.split('/products/')[1]).split('#')[0].split('?')[0].trim();
                    var linkUrlItemSlug = (linkUrl.split('/products/')[1]).split('#')[0].split('?')[0].trim();
                    
                    return itemSlug === linkUrlItemSlug;  
                  }
                
                  const item = items.find(matchProduct);
                  const index = items.findIndex(matchProduct);
                
                  if(item) {
                    self.ecommerceDataLayer('select_item', {items: [{...item, index: index}]});
                  }
              }
            });
          {% endif %}

          // select item on varient change
          document.addEventListener('variant:change', function(event) {            
            const product_id = event.detail.product.id;
            const variant_id = event.detail.variant.id;
            const vendor = event.detail.product.vendor; 
            const variant_title = event.detail.variant.public_title;
            const product_title = event.detail.product.title;
            const final_price = event.detail.variant.price;
            const product_type = event.detail.product.type;

             const item = {
                product_id: product_id,
                product_title: product_title,
                variant_id: variant_id,
                variant_title: variant_title,
                vendor: vendor,
                final_price: final_price,
                product_type: product_type, 
                quantity: 1
             }
            
             self.ecommerceDataLayer('select_item', {items: [item]});
          });
        }

        // all ecommerce events
        ecommerceDataLayer(event, data) {
          const self = this;
          dataLayer.push({ 'ecommerce': null });
          const dataLayerData = {
            "event": this.eventPrefix + event,
            'ecommerce': {
               'currency': this.cart.currency,
               'items': data.items.map((item, index) => {
                 const dataLayerItem = {
                    'index': index,
                    'item_id': this.formattedItemId  ? \`shopify_\${this.countryCode}_\${item.product_id}_\${item.variant_id}\` : item.product_id.toString(),
                    'product_id': item.product_id.toString(),
                    'variant_id': item.variant_id.toString(),
                    'item_name': item.product_title,
                    'quantity': item.quantity,
                    'price': +((item.final_price / 100).toFixed(2)),
                    'discount': item.total_discount ? +((item.total_discount / 100).toFixed(2)) : 0 
                }

                if(item.product_type) {
                  dataLayerItem['item_category'] = item.product_type;
                }
                
                if(item.vendor) {
                  dataLayerItem['item_brand'] = item.vendor;
                }
               
                if(item.variant_title && item.variant_title !== 'Default Title') {
                  dataLayerItem['item_variant'] = item.variant_title;
                }
              
                if(item.sku) {
                  dataLayerItem['sku'] = item.sku;
                }

                if(item.item_list_name) {
                  dataLayerItem['item_list_name'] = item.item_list_name;
                }

                if(item.item_list_id) {
                  dataLayerItem['item_list_id'] = item.item_list_id.toString()
                }

                return dataLayerItem;
              })
            }
          }

          if(data.total_price !== undefined) {
            dataLayerData['ecommerce']['value'] =  +((data.total_price / 100).toFixed(2));
          } else {
            dataLayerData['ecommerce']['value'] = +(dataLayerData['ecommerce']['items'].reduce((total, item) => total + (item.price * item.quantity), 0)).toFixed(2);
          }
          
          if(data.item_list_id) {
            dataLayerData['ecommerce']['item_list_id'] = data.item_list_id;
          }
          
          if(data.item_list_name) {
            dataLayerData['ecommerce']['item_list_name'] = data.item_list_name;
          }

          if(data.search_term) {
            dataLayerData['search_term'] = data.search_term;
          }

          if(self.dataSchema.dynamicRemarketing && self.dataSchema.dynamicRemarketing.show) {
            dataLayer.push({ 'dynamicRemarketing': null });
            dataLayerData['dynamicRemarketing'] = {
                value: dataLayerData.ecommerce.value,
                items: dataLayerData.ecommerce.items.map(item => ({id: item.item_id, google_business_vertical: self.dataSchema.dynamicRemarketing.business_vertical}))
            }
          }

          if(!self.dataSchema.ecommerce ||  !self.dataSchema.ecommerce.show) {
            delete dataLayerData['ecommerce'];
          }

          dataLayer.push(dataLayerData);
          self.eventConsole(self.eventPrefix + event, dataLayerData);
        }

        
        // contact form submit & newsletters signup
        formData() {
          const self = this;
          document.addEventListener('submit', function(event) {

            let targetForm = event.target.closest('form[action^="/contact"]');


            if(targetForm) {
              const formData = {
                form_location: window.location.href,
                form_id: targetForm.getAttribute('id'),
                form_classes: targetForm.getAttribute('class')
              };
                            
              let formType = targetForm.querySelector('input[name="form_type"]');
              let inputs = targetForm.querySelectorAll("input:not([type=hidden]):not([type=submit]), textarea, select");
              
              inputs.forEach(function(input) {
                var inputName = input.name;
                var inputValue = input.value;
                
                if (inputName && inputValue) {
                  var matches = inputName.match(/\\[(.*?)\\]/);
                  if (matches && matches.length > 1) {
                     var fieldName = matches[1];
                     formData[fieldName] = input.value;
                  }
                }
              });
              
              if(formType && formType.value === 'customer') {
                dataLayer.push({ event: self.eventPrefix + 'newsletter_signup', ...formData});
                self.eventConsole(self.eventPrefix + 'newsletter_signup', { event: self.eventPrefix + 'newsletter_signup', ...formData});

              } else if(formType && formType.value === 'contact') {
                dataLayer.push({ event: self.eventPrefix + 'contact_form_submit', ...formData});
                self.eventConsole(self.eventPrefix + 'contact_form_submit', { event: self.eventPrefix + 'contact_form_submit', ...formData});
              }
            }
          });

        }

        // phone_number_click event
        phoneClickData() {
          const self = this; 
          document.addEventListener('click', function(event) {
            let target = event.target.closest('a[href^="tel:"]');
            if(target) {
              let phone_number = target.getAttribute('href').replace('tel:', '');
              let eventData = {
                event: self.eventPrefix + 'phone_number_click',
                page_location: window.location.href,
                link_classes: target.getAttribute('class'),
                link_id: target.getAttribute('id'),
                phone_number
              }

              dataLayer.push(eventData);
              self.eventConsole(self.eventPrefix + 'phone_number_click', eventData);
            }
          });
        }
  
        // email_click event
        emailClickData() {
          const self = this; 
          document.addEventListener('click', function(event) {
            let target = event.target.closest('a[href^="mailto:"]');
            if(target) {
              let email_address = target.getAttribute('href').replace('mailto:', '');
              let eventData = {
                event: self.eventPrefix + 'email_click',
                page_location: window.location.href,
                link_classes: target.getAttribute('class'),
                link_id: target.getAttribute('id'),
                email_address
              }

              dataLayer.push(eventData);
              self.eventConsole(self.eventPrefix + 'email_click', eventData);
            }
          });
        }

        //login register 
        loginRegisterData() {
          
          const self = this; 
          let isTrackedLogin = false;
          let isTrackedRegister = false;
          
          if(window.location.href.includes('/account/login')) {
            document.addEventListener('submit', function(e) {
              const loginForm = e.target.closest('[action="/account/login"]');
              if(loginForm && !isTrackedLogin) {
                  const eventData = {
                    event: self.eventPrefix + 'login'
                  }
                  isTrackedLogin = true;
                  dataLayer.push(eventData);
                  self.eventConsole(self.eventPrefix + 'login', eventData);
              }
            });
          }

          if(window.location.href.includes('/account/register')) {
            document.addEventListener('submit', function(e) {
              const registerForm = e.target.closest('[action="/account"]');
              if(registerForm && !isTrackedRegister) {
                  const eventData = {
                    event: self.eventPrefix + 'sign_up'
                  }
                
                  isTrackedRegister = true;
                  dataLayer.push(eventData);
                  self.eventConsole(self.eventPrefix + 'sign_up', eventData);
              }
            });
          }
        }
      } 
      // end Ultimate_Shopify_DataLayer

      document.addEventListener('DOMContentLoaded', function() {
        try{
          new Ultimate_Shopify_DataLayer();
        }catch(error) {
          console.log(error);
        }
      });
    
  })();
</script>
`;

/* -----------------------------------------------------------
   2) Custom Pixel JS — Shopify Customer Events (raw template)
   ----------------------------------------------------------- */


/* ----------------------
   Injectors
   ---------------------- */
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

function upsertGTMAndRender(src, gtmId) {
  const { headTag, bodyTag } = buildGTMBlocks(gtmId);
  const renderTag = `{% render 'ultimate-datalayer' %}`;

  const reHeadBlock = /<!--\s*Google Tag Manager\s*-->[\s\S]*?<!--\s*End Google Tag Manager\s*-->/ig;
  const reBodyBlock = /<!--\s*Google Tag Manager\s*\(noscript\)\s*-->[\s\S]*?<!--\s*End Google Tag Manager\s*\(noscript\)\s*-->/ig;
  src = src.replace(reHeadBlock, "").replace(reBodyBlock, "");
  src = src.replace(/\{\%\s*render\s+'ultimate-datalayer'\s*\%\}\s*/gi, "");

  src = src.replace(/<head(\b[^>]*)?>/i, (m) => `${m}\n${headTag}\n`);
  src = src.replace(/<body(\b[^>]*)?>/i, (m) => `${m}\n${bodyTag}\n`);

  src = src.replace(/(<!--\s*End Google Tag Manager\s*-->)/i, `$1\n  ${renderTag}`);
  if (!/render\s+'ultimate-datalayer'/i.test(src)) {
    src = src.replace(/<\/head>/i, `  ${renderTag}\n</head>`);
  }
  return src;
}

function insertRenderAfterGTM(src) {
  const renderTag = `{% render 'ultimate-datalayer' %}`;
  src = src.replace(/\{\%\s*render\s+'ultimate-datalayer'\s*\%\}\s*/gi, "");
  const withAfter = src.replace(/(<!--\s*End Google Tag Manager\s*-->)/i, `$1\n  ${renderTag}`);
  if (withAfter !== src) return withAfter;
  return src.replace(/<\/head>/i, `  ${renderTag}\n</head>`);
}

/* ----------------------
   API Endpoints
   ---------------------- */

// 1) Enable GTM
app.post("/api/gtm/enable", async (req, res) => {
  try {
    const { shop, accessToken, gtmId } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing/invalid shop");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing/invalid shpat token");

    const desiredId = (gtmId || DEFAULT_GTM_ID || "").trim();
    assert(/^GTM-[A-Za-z0-9_-]+$/.test(desiredId), "Invalid GTM Container ID");

    const themeId = await getMainThemeId(shop, accessToken);
    const themeKey = "layout/theme.liquid";
    const asset = await getAsset(shop, accessToken, themeId, themeKey);
    const orig = asset.value || Buffer.from(asset.attachment || "", "base64").toString("utf8");

    const patched = upsertGTMAndRender(orig, desiredId);
    if (patched !== orig) await putAsset(shop, accessToken, themeId, themeKey, patched);

    res.json({ ok: true, gtmId: desiredId, themeId });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// 2) Enable DataLayer
app.post("/api/datalayer/enable", async (req, res) => {
  try {
    const { shop, accessToken } = req.body || {};
    assert(shop && shop.endsWith(".myshopify.com"), "Missing/invalid shop");
    assert(accessToken && accessToken.startsWith("shpat_"), "Missing/invalid shpat token");

    const themeId = await getMainThemeId(shop, accessToken);
    await putAsset(shop, accessToken, themeId, "snippets/ultimate-datalayer.liquid", UDL_SNIPPET_VALUE);

    const themeKey = "layout/theme.liquid";
    const asset = await getAsset(shop, accessToken, themeId, themeKey);
    const orig = asset.value || Buffer.from(asset.attachment || "", "base64").toString("utf8");

    const patched = insertRenderAfterGTM(orig);
    if (patched !== orig) await putAsset(shop, accessToken, themeId, themeKey, patched);

    res.json({ ok: true, themeId });
  } catch (e) {
    res.status(400).json({ error: String(e.message) });
  }
});

// 3) Create/Update Custom Web Pixel (Customer events)
app.post("/api/pixel/enable", async (req, res) => {
  const fail = (msg, detail) => res.status(400).json({ error: msg, detail });
  try {
    const { shop, accessToken, name = "analyticsgtm Pixel" } = req.body || {};
    if (!shop || !shop.endsWith(".myshopify.com")) throw new Error("Missing/invalid shop");
    if (!accessToken || !accessToken.startsWith("shpat_")) throw new Error("Missing/invalid shpat token");

    const API = `https://${shop}/admin/api/2025-10`;
    const headers = {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    // Probe
    const probe = await fetch(`${API}/web_pixels.json?limit=1`, { method: "GET", headers });
    if (probe.status === 401 || probe.status === 403) {
      return fail("Unauthorized: token invalid or missing scopes.",
        "Grant read_pixels, write_pixels (optional read_custom_pixels, write_custom_pixels) and reinstall the app.");
    }
    if (probe.status === 404 || probe.status === 405) {
      return fail("Web Pixels REST not available on this store/API.",
        "Create once in Admin → Settings → Customer events → Add custom pixel, then click Enable again to update.");
    }

    // Try create
    const createBody = { web_pixel: { name, enabled: true, settings: "{}", javascript: CUSTOM_PIXEL_JS } };
    const cRes = await fetch(`${API}/web_pixels.json`, { method: "POST", headers, body: JSON.stringify(createBody) });
    const cJson = await cRes.json().catch(() => ({}));
    if (cRes.ok) return res.json({ ok: true, mode: "created", pixel: cJson.web_pixel });

    // Fallback update
    const lRes = await fetch(`${API}/web_pixels.json`, { method: "GET", headers });
    const lJson = await lRes.json().catch(() => ({}));
    const existing =
      (lJson.web_pixels || []).find(p => (p.name || "").toLowerCase() === name.toLowerCase()) ||
      (lJson.web_pixels || [])[0];

    if (!existing) {
      return fail(`Create failed (${cRes.status})`,
        cJson?.errors || cJson || "No pixel to update. Create one manually once, then retry.");
    }

    const updBody = {
      web_pixel: { id: existing.id, name: existing.name || name, enabled: true,
                   settings: existing.settings || "{}", javascript: CUSTOM_PIXEL_JS }
    };
    const uRes = await fetch(`${API}/web_pixels/${existing.id}.json`, {
      method: "PUT", headers, body: JSON.stringify(updBody)
    });
    const uJson = await uRes.json().catch(() => ({}));
    if (!uRes.ok) return fail(`Update failed (${uRes.status})`, uJson?.errors || uJson || "No details");

    res.json({ ok: true, mode: "updated", pixel: uJson.web_pixel });
  } catch (e) { res.status(400).json({ error: String(e.message) }); }
});

// 4) Serve the in-file pixel source for "Copy" button
app.get("/api/pixel/source", (req, res) => {
  res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  const src = readPixelCopySource();
  res.send(src);
});


// ---------- Simple Embedded UI ----------
app.get("/admin/settings", (req, res) => {
  const shop = req.query.shop || process.env.SHOP || "";
  res.type("html").send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>analyticsgtm • Settings</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;background:#f8fafc;margin:0}
  .wrap{max-width:860px;margin:40px auto;padding:0 16px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 1px 12px rgba(0,0,0,.04);padding:22px;margin-bottom:16px}
  h1{margin:0 0 12px 0}
  label{display:block;margin-bottom:6px;font-weight:600}
  input[type=text]{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
  .btn{appearance:none;border:0;background:#111827;color:#fff;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer}
  .muted{color:#6b7280;font-size:12px}
  .toast{padding:10px 12px;border-radius:8px;margin-top:10px;display:none}
  .ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
  .section-title{font-size:18px;margin:0 0 8px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>analyticsgtm – Settings</h1>
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
    <p class="muted">Creates <code>snippets/ultimate-datalayer.liquid</code> and renders it in &lt;head&gt; (immediately after GTM head end if present).</p>
    <div style="display:flex;gap:12px;margin-top:14px">
      <button class="btn" id="btn-dl">Enable DataLayer</button>
    </div>
    <div id="ok-dl" class="toast ok">DataLayer snippet injected.</div>
    <div id="err-dl" class="toast err">Failed.</div>
  </div>

  <div class="card">
    <h2 class="section-title">3) Manual install — Custom Pixel (Customer events)</h2>
    <p class="muted">To Enable Checkout Event.</p>
    <ol style="margin:0 0 12px 18px; line-height:1.6">
      <li>Go to <b>Settings → Customer events</b></li>
      <li>Click <b>Add custom pixel</b></li>      
      <li>Click <b>Copy custom pixel code</b> below and <b>paste</b> it into the editor</li>
      <li>Click <b>Set GTM ID</b></li>
      <li><b>Save</b> → <b>Connect</b></li>
    </ol>

    <div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap">
      <button class="btn" id="btn-copy-pixel">Copy custom pixel code</button>
      <button class="btn" id="btn-open-cust-events">Open Customer events</button>
    </div>

    <div id="ok-copy" class="toast ok">Copied!</div>
    <div id="err-copy" class="toast err">Copy failed.</div>
  </div>
</div>

<script>
function toast(id, ok, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerText = msg || (ok ? 'Done' : 'Failed');
  el.style.display='block';
  setTimeout(function(){ el.style.display='none'; }, 3500);
}
function val(id) {
  var el = document.getElementById(id);
  return (el ? el.value : '').trim();
}

// --- GTM ---
var btnGtm = document.getElementById('btn-gtm');
if (btnGtm) {
  btnGtm.addEventListener('click', async function () {
    const payload = { shop: val('shop'), accessToken: val('tok'), gtmId: val('gtm') };
    try {
      const r = await fetch('/api/gtm/enable', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await r.json().catch(function(){return{};});
      if(!r.ok || j.error) throw new Error(j.error || 'error');
      toast('ok-gtm', true, 'GTM injected.');
    } catch(e) { toast('err-gtm', false, 'Error: ' + e.message); }
  });
}

// --- DataLayer ---
var btnDl = document.getElementById('btn-dl');
if (btnDl) {
  btnDl.addEventListener('click', async function () {
    const payload = { shop: val('shop'), accessToken: val('tok') };
    try {
      const r = await fetch('/api/datalayer/enable', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await r.json().catch(function(){return{};});
      if(!r.ok || j.error) throw new Error(j.error || 'error');
      toast('ok-dl', true, 'DataLayer snippet injected.');
    } catch(e) { toast('err-dl', false, 'Error: ' + e.message); }
  });
}

// --- Copy custom pixel code (from in-file source) ---
var copyBtn = document.getElementById('btn-copy-pixel');
if (copyBtn) {
  copyBtn.addEventListener('click', function () {
    fetch('/api/pixel/source', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Unable to load pixel source'); return r.text(); })
      .then(function (code) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(code);
        }
        var ta = document.createElement('textarea');
        ta.value = code; ta.style.position='fixed'; ta.style.left='-9999px';
        document.body.appendChild(ta); ta.focus(); ta.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
        return Promise.resolve();
      })
      .then(function(){ toast('ok-copy', true, 'Custom pixel code copied!'); })
      .catch(function(e){ toast('err-copy', false, 'Copy failed: ' + e.message); });
  });
}

// --- Open Admin → Settings → Customer events ---
var openBtn = document.getElementById('btn-open-cust-events');
if (openBtn) {
  openBtn.addEventListener('click', function () {
    var shopEl = document.getElementById('shop');
    var shop = (shopEl ? shopEl.value : '').trim();
    if (!shop) { alert('Enter your shop domain first (e.g., your-store.myshopify.com)'); return; }

    var url = 'https://' + shop + '/admin/settings/customer_events';
    var win = window.open(url, '_blank');

    if (win) {
      try { win.opener = null; } catch(e) {}
    } else {
      window.location.assign(url);
    }
  });
}
</script>
</body></html>`);
});

// Small root
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>analyticsgtm</title>
  <h1>analyticsgtm</h1><p><a href="/admin/settings">Open Settings UI</a></p>`);
});

app.listen(PORT, () => console.log(`analyticsgtm running on :${PORT}`));
