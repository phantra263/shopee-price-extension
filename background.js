// background.js - Service Worker xử lý API, Kích hoạt Affiliate ngầm, Alarm & Thông báo
try {
  importScripts("config.js");
} catch (e) {}

const DEFAULT_SETTINGS = typeof TEAZ_CONFIG !== "undefined" ? TEAZ_CONFIG : {
  enabled: true,
  notifEnabled: true,
  apiUrl: "http://localhost:5000/api/track",
  affiliateType: "shopee_direct",
  shopeeAffiliateId: "17300000000",
  accesstradeBaseUrl: "https://go.isclix.com/deep_link/4348611985448651000/4751584435713464249",
  customRedirectUrl: "http://localhost:5000/s",
  affiliateSubId: "chrome_ext",
  adminPin: "8888"
};

// Thiết lập Alarm định kỳ kiểm tra giá sản phẩm đang canh (mỗi 6 tiếng)
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    chrome.storage.sync.set(items);
  });

  chrome.alarms.create("CHECK_PRICE_DROPS", {
    periodInMinutes: 360
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "CHECK_PRICE_DROPS") {
    checkWatchedProductsPriceDrop();
  }
});

// Lắng nghe messages từ content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Lấy dữ liệu phân tích giá
  if (message.type === "FETCH_PRICE_ANALYTICS") {
    handleFetchPriceAnalytics(message.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 2. Kích hoạt Affiliate ngầm khi bấm nút Mua Ngay hoặc Thêm Vào Giỏ Hàng
  if (message.type === "ACTIVATE_AFFILIATE") {
    handleSilentAffiliateActivation(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

// Kích hoạt Affiliate ngầm (gửi request ngầm mang cookie)
async function handleSilentAffiliateActivation({ affiliateUrl, actionType }) {
  if (!affiliateUrl) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    // Gửi request ngầm để kích hoạt tracking/cookie
    await fetch(affiliateUrl, {
      method: "GET",
      mode: "no-cors",
      credentials: "include",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (err) {
    // Không làm gián đoạn trải nghiệm người dùng
  }
}

// Gọi API Backend phân tích giá
async function handleFetchPriceAnalytics({ url, shopId, itemId }) {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(settings.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, shopId, itemId }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Kiểm tra ngầm các sản phẩm trong danh sách canh giá
async function checkWatchedProductsPriceDrop() {
  const { watchlist = [] } = await chrome.storage.local.get({ watchlist: [] });
  if (!watchlist.length) return;

  for (const item of watchlist) {
    try {
      const data = await handleFetchPriceAnalytics({
        url: item.url,
        shopId: item.shopId,
        itemId: item.itemId
      });

      if (data && data.product && data.product.current_price) {
        const newPrice = Number(data.product.current_price);
        const targetPrice = Number(item.targetPrice || item.lowestPrice);

        if (newPrice > 0 && targetPrice > 0 && newPrice <= targetPrice) {
          const formattedNewPrice = new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND"
          }).format(newPrice);

          if (chrome.notifications) {
            chrome.notifications.create(`price_drop_${item.itemId}`, {
              type: "basic",
              iconUrl: "icons/icon128.svg",
              title: "🔥 Báo động giảm giá Shopee!",
              message: `Sản phẩm "${item.title.slice(0, 45)}..." vừa giảm xuống ${formattedNewPrice} (đạt ngưỡng canh giá)!`,
              priority: 2
            });
          }
        }
      }
    } catch (e) { }
  }
}

// Khi người dùng bấm vào thông báo thì mở sản phẩm với link Affiliate
if (chrome.notifications && chrome.notifications.onClicked) {
  chrome.notifications.onClicked.addListener(async (notifId) => {
    if (notifId.startsWith("price_drop_")) {
      const itemId = notifId.replace("price_drop_", "");
      const { watchlist = [] } = await chrome.storage.local.get({ watchlist: [] });
      const item = watchlist.find((i) => String(i.itemId) === String(itemId));
      if (item && item.url) {
        const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
        let redirectUrl = item.url;
        if (settings.affiliateType === "shopee_direct") {
          const rawId = settings.shopeeAffiliateId || DEFAULT_SETTINGS.shopeeAffiliateId;
          const affiliateId = String(rawId).replace(/^an_/, "").trim();
          const urlObj = new URL(item.url.split("?")[0]);
          urlObj.searchParams.set("utm_source", `an_${affiliateId}`);
          urlObj.searchParams.set("utm_medium", "affiliates");
          urlObj.searchParams.set("utm_campaign", settings.affiliateSubId || "chrome_ext");
          redirectUrl = urlObj.toString();
        }
        chrome.tabs.create({ url: redirectUrl });
      }
    }
  });
}
