// config.js - File cấu hình tập trung cho toàn bộ Extension & Backend
// 👉 BẠN CHỈ CẦN THAY MÃ AFFILIATE CỦA BẠN TẠI ĐÂY 1 LẦN DUY NHẤT!

const TEAZ_CONFIG = {
  // ==========================================
  // 1. CẤU HÌNH TIẾP THỊ LIÊN KẾT (AFFILIATE)
  // ==========================================
  // Chọn 1 trong 3 loại: 'shopee_direct' | 'accesstrade' | 'custom_url'
  affiliateType: "shopee_direct",

  // 👉 THAY MÃ PARTNER ID SHOPEE CỦA BẠN TẠI ĐÂY:
  shopeeAffiliateId: "17300000000",

  // Dành cho Accesstrade Deeplink (nếu dùng):
  accesstradeBaseUrl: "https://go.isclix.com/deep_link/4348611985448651000/4751584435713464249",

  // Dành cho Server chuyển hướng riêng (nếu dùng):
  customRedirectUrl: "http://localhost:5000/s",

  // Tên chiến dịch theo dõi (Sub-ID):
  affiliateSubId: "chrome_ext",

  // ==========================================
  // 2. BẢO MẬT QUẢN TRỊ VIÊN (ADMIN)
  // ==========================================
  // Mã PIN bí mật để mở khóa tab Affiliate trong popup (nhấn 5 lần vào tiêu đề):
  adminPin: "8888",

  // ==========================================
  // 3. HỆ THỐNG & BACKEND
  // ==========================================
  apiUrl: "http://localhost:5000/api/track",
  enabled: true,
  notifEnabled: true
};

// Hỗ trợ cả Node.js (Backend) và Browser (Extension)
if (typeof module !== "undefined" && module.exports) {
  module.exports = TEAZ_CONFIG;
}

