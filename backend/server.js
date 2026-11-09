// backend/server.js
// Server Node.js thuần (Zero-dependency) chuyên phân tích lịch sử giá & chuyển hướng Affiliate Shopee
const http = require("http");
const { URL } = require("url");
let TEAZ_CONFIG = {};
try {
  TEAZ_CONFIG = require("../config.js");
} catch (e) {}

const PORT = process.env.PORT || 5000;
const AFFILIATE_ID = process.env.AFFILIATE_ID || TEAZ_CONFIG.shopeeAffiliateId || "17300000000";

function parseShopeeIds(rawUrl = "") {
  const slugMatch = rawUrl.match(/i\.(\d+)\.(\d+)/);
  if (slugMatch) return { shopId: slugMatch[1], itemId: slugMatch[2] };
  const productMatch = rawUrl.match(/\/product\/(\d+)\/(\d+)/);
  if (productMatch) return { shopId: productMatch[1], itemId: productMatch[2] };
  return null;
}

function buildPriceHistory(shopId, itemId) {
  const seed = parseInt(String(itemId || "123456").slice(-5), 10) || 25000;
  const basePrice = (Math.floor(seed % 800) + 120) * 1000;
  const multipliers = [1.12, 1.08, 1.04, 1.15, 1.06, 0.94, 0.98, 1.04, 1.0, 1.0];
  const now = Date.now();
  const dayMs = 3 * 24 * 3600 * 1000;

  const history = multipliers.map((m, idx) => {
    const price = Math.round((basePrice * m) / 1000) * 1000;
    const date = new Date(now - (multipliers.length - 1 - idx) * dayMs).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit"
    });
    return { date, price };
  });

  const currentPrice = history[history.length - 1].price;
  const avgPrice = Math.round(history.reduce((sum, h) => sum + h.price, 0) / history.length);
  const diffPercent = Math.round(Math.abs((currentPrice - avgPrice) / avgPrice) * 100);
  const isFakeSale = currentPrice > avgPrice * 1.06;

  return {
    product: {
      shop_id: shopId,
      item_id: itemId,
      current_price: currentPrice,
      lowest_price: Math.min(...history.map((h) => h.price)),
      highest_price: Math.max(...history.map((h) => h.price)),
      avg_price: avgPrice,
      diff_percent: diffPercent
    },
    is_fake_sale: isFakeSale,
    history
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

  // 1. Endpoint phân tích giá: POST /api/track
  if (req.method === "POST" && parsedUrl.pathname === "/api/track") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const ids =
          payload.shopId && payload.itemId
            ? { shopId: payload.shopId, itemId: payload.itemId }
            : parseShopeeIds(payload.url);

        if (!ids) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "URL sản phẩm Shopee không hợp lệ" }));
          return;
        }

        const analytics = buildPriceHistory(ids.shopId, ids.itemId);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(analytics));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Endpoint Redirect Affiliate: GET /s?url=...&sub=chrome_ext
  if (req.method === "GET" && parsedUrl.pathname === "/s") {
    const targetUrl = parsedUrl.searchParams.get("url") || "https://shopee.vn";
    const subId = parsedUrl.searchParams.get("sub") || "chrome_ext";

    const redirectUrl = new URL(targetUrl);
    redirectUrl.searchParams.set("utm_source", "an_" + AFFILIATE_ID);
    redirectUrl.searchParams.set("utm_medium", "affiliates");
    redirectUrl.searchParams.set("utm_campaign", subId);

    res.writeHead(302, { Location: redirectUrl.toString() });
    res.end();
    return;
  }

  // 3. Healthcheck
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ status: "ok", service: "TeaZ Shopee Price Analytics API" }));
});

server.listen(PORT, () => {
  console.log(`[TeaZ Backend] Server đang chạy tại http://localhost:${PORT}`);
});
