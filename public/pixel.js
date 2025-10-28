// public/pixel.js
export default function (analytics) {
  // GTM/GA4 বা অন্য যেকোনো প্রসেসিংয়ের জন্য dataLayer রাখুন
  window.dataLayer = window.dataLayer || [];
  const log = (name, evt) => {
    console.log("[AC Pixel]", name, evt);
  };

  // ইচ্ছা করলে ইভেন্ট নামের সামনে প্রিফিক্স দিন
  const PREFIX = "ac_";

  // যে সব Shopify Web Pixel ইভেন্টে সাবস্ক্রাইব করবেন
  const EVENTS = [
    "page_viewed",
    "collection_viewed",
    "product_viewed",
    "search_submitted",
    "cart_viewed",
    "cart_updated",
    "product_added_to_cart",
    "checkout_started",
    "checkout_contact_info_submitted",
    "checkout_shipping_info_submitted",
    "payment_info_submitted",
    "checkout_completed",
  ];

  // ইভেন্ট পেলোড থেকে দরকারি অংশ নিন (অতি বড় / সার্কুলার অবজেক্ট বাদ)
  const pick = (evt) => ({
    clientId: evt.clientId,
    // context থেকে সাধারণত দরকারি ২–৩টা
    page_location: evt?.context?.document?.location?.href,
    user_agent: evt?.context?.userAgent,
    // checkout ইভেন্ট হলে কিছু ফিল্ড
    order_id: evt?.data?.checkout?.order?.id,
    currency: evt?.data?.checkout?.currencyCode,
    value: evt?.data?.checkout?.totalPrice?.amount,
    // cart / product ইভেন্টে লাইন আইটেমগুলো লাগলে যোগ করবেন
    lineItems: evt?.data?.cart?.lineItems || evt?.data?.checkout?.lineItems,
    product: evt?.data?.product,
    collection: evt?.data?.collection,
    searchTerm: evt?.data?.searchResult?.query,
  });

  // একসাথে সব ইভেন্ট সাবস্ক্রাইব করুন
  EVENTS.forEach((name) => {
    analytics.subscribe(name, (evt) => {
      const payload = pick(evt);
      // GTM/GA4 compatible push
      window.dataLayer.push({ ecommerce: null }); // GA4 reset (optional)
      window.dataLayer.push({ event: PREFIX + name, ...payload });

      log(name, payload);
    });
  });
}
