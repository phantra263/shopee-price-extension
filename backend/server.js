// backend/server.js - Server chạy cục bộ (Local Development)
const http = require("http");
const handler = require("./api/index.js");

const PORT = process.env.PORT || 5000;
const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`[Shopee Price Tracker Backend] Server đang chạy tại http://localhost:${PORT}`);
  console.log(`- POST /api/track: Phân tích lịch sử giá`);
  console.log(`- GET /s?url=...: Redirect Affiliate`);
});

module.exports = server;
