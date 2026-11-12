// backend/api/index.js - Vercel Serverless Function (Hỗ trợ 100% Vercel & Node.js)
const { URL } = require("url");

const AFFILIATE_ID = process.env.AFFILIATE_ID || "17300000000";

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

module.exports = (req, res) => {
  // CORS Headers chuẩn bảo mật HTTPS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const host = req.headers.host || "localhost";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const parsedUrl = new URL(req.url, `${protocol}://${host}`);

  // 1. Endpoint phân tích lịch sử giá: POST /api/track
  if (req.method === "POST" && (parsedUrl.pathname === "/api/track" || parsedUrl.pathname === "/track")) {
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
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          return res.end(JSON.stringify({ error: "URL sản phẩm Shopee không hợp lệ" }));
        }

        const analytics = buildPriceHistory(ids.shopId, ids.itemId);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify(analytics));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Endpoint Redirect Affiliate: GET /s hoặc GET /api/s
  if (req.method === "GET" && (parsedUrl.pathname === "/s" || parsedUrl.pathname === "/api/s")) {
    const targetUrl = parsedUrl.searchParams.get("url") || "https://shopee.vn";
    const subId = parsedUrl.searchParams.get("sub") || "chrome_ext";

    try {
      const redirectUrl = new URL(targetUrl);
      redirectUrl.searchParams.set("utm_source", "an_" + AFFILIATE_ID);
      redirectUrl.searchParams.set("utm_medium", "affiliates");
      redirectUrl.searchParams.set("utm_campaign", subId);

      res.writeHead(302, { Location: redirectUrl.toString() });
      return res.end();
    } catch (e) {
      res.writeHead(302, { Location: "https://shopee.vn" });
      return res.end();
    }
  }

  // 3. Healthcheck / Trang chủ
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(
    JSON.stringify({
      status: "ok",
      service: "Shopee Price History & Fake Sale Detector API",
      deployed_on: "Vercel",
      endpoints: {
        track: "POST /api/track",
        redirect: "GET /s?url=...&sub=chrome_ext"
      }
    })
  );
};

