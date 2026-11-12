# Shopee Price History & Fake Sale Detector (v2.0.0)

Tiện ích mở rộng trình duyệt (Manifest V3) theo chuẩn **BeeCost**: Phân tích lịch sử biến động giá 30/90 ngày, phát hiện tăng giá ảo trước sale, hỗ trợ đặt ngưỡng canh giá đáy tự động trên `shopee.vn`, tuân thủ 100% chính sách của **Google Chrome Web Store**.

---

## 🛑 Vì sao Google từ chối extension trước đó & Cách khắc phục triệt để

| Lỗi Google từ chối | Nguyên nhân kỹ thuật | Đã khắc phục ở bản v2.0.0 |
|---|---|---|
| **1. Deceptive / Cookie Stuffing** | Code can thiệp sự kiện click vào nút "Thêm vào giỏ" & "Mua ngay" của Shopee (`setupNativeButtonsInterceptor`). Google cấm tuyệt đối việc chặn nút gốc của website để gắn cookie affiliate ngầm. | **Đã gỡ bỏ 100% bộ chặn nút gốc.** Toàn bộ liên kết Affiliate chỉ kích hoạt khi người dùng bấm trực tiếp vào các nút trên chính widget tiện ích (Chuẩn chính sách Google). |
| **2. Insecure Host Permissions** | Có `http://localhost:5000/*` trong `manifest.json`. Google cấm URL localhost/HTTP trong bản phát hành chính thức. | **Đã xóa bỏ localhost.** Chuyển sang HTTPS chuẩn Vercel (`https://*.vercel.app/*`). |
| **3. Định dạng Icon không hợp lệ** | Dùng file `icon128.svg` trong `manifest.json`. CWS yêu cầu file PNG chuẩn (16, 48, 128). | **Đã cấu hình bộ icon PNG:** `icon16.png`, `icon48.png`, `icon128.png`. |
| **4. Thiếu Privacy Policy & Disclosure** | Tiện ích sử dụng `storage` và `host_permissions` nhưng thiếu link chính sách quyền riêng tư và công bố tiếp thị liên kết. | **Đã bổ sung:** `PRIVACY_POLICY.md` và `privacy.html`. |

---

## 🚀 Hướng dẫn Deploy Backend lên Vercel (Miễn phí 100% trong 2 phút)

Thư mục `backend/` đã được cấu hình chuẩn Serverless Function cho Vercel (`api/index.js` và `vercel.json`).

### Cách 1: Deploy qua giao diện Vercel Dashboard (Dễ nhất)
1. Đẩy code lên GitHub (nếu chưa đẩy, chạy `git push origin main`).
2. Truy cập [vercel.com](https://vercel.com) và đăng nhập bằng GitHub.
3. Bấm **"Add New..." ➔ "Project"** ➔ Chọn repository `shopee-price-extension`.
4. Tại mục **Root Directory**, bấm **Edit** và chọn thư mục: `backend`.
5. Bấm nút **"Deploy"**.
6. Sau 30 giây, Vercel sẽ cấp cho bạn một link HTTPS (ví dụ: `https://shopee-price-backend.vercel.app`).
7. Mở file [config.js](file:///d:/trapc/shopee-price-extension/config.js) và dán link Vercel của bạn vào dòng `apiUrl: "https://your-domain.vercel.app/api/track"`.

### Cách 2: Deploy qua Vercel CLI
```bash
cd d:\trapc\shopee-price-extension\backend
npx vercel
```

---

## 📦 Hướng dẫn Đóng Gói & Nộp lại lên Chrome Web Store

### Bước 1: Tạo bộ Icon PNG chuẩn
Nhấp đúp chuột vào file:
👉 [tao-icons-png.bat](file:///d:/trapc/shopee-price-extension/tao-icons-png.bat)
*(Hoặc chạy lệnh `node backend/generate-icons.js` trong terminal)*.

### Bước 2: Đóng gói file ZIP phát hành
Nhấp đúp chuột vào file:
👉 [build-extension.bat](file:///d:/trapc/shopee-price-extension/build-extension.bat)
File nén sạch đạt chuẩn sẽ được tạo tại: `dist/shopee-price-extension.zip`.

### Bước 3: Điền biểu mẫu trên Chrome Web Store Developer Dashboard

Khi tải file `dist/shopee-price-extension.zip` lên CWS Developer Console, điền theo thông tin chuẩn chính sách sau để được duyệt nhanh nhất:

1. **Single Purpose Description (Mục đích duy nhất):**
   > "Tiện ích giúp người dùng theo dõi lịch sử biến động giá 30 và 90 ngày, phát hiện bẫy tăng giá ảo trước ngày sale, và nhận thông báo khi sản phẩm trên Shopee giảm về mức giá đáy mong muốn."

2. **Permission Justifications (Giải trình quyền hạn):**
   - **`storage`**: *"Dùng để lưu trữ cục bộ danh sách sản phẩm theo dõi giá đáy (Watchlist) và cài đặt hiển thị của người dùng trên trình duyệt."*
   - **`alarms`**: *"Dùng để kích hoạt tác vụ định kỳ chạy ngầm kiểm tra xem giá các sản phẩm trong danh sách theo dõi có giảm về mức giá đáy mục tiêu hay không."*
   - **`notifications`**: *"Dùng để hiển thị thông báo màn hình cho người dùng khi sản phẩm họ quan tâm giảm giá về mức giá mong muốn."*
   - **`host_permissions` (`https://shopee.vn/*`)**: *"Cần thiết để hiển thị biểu đồ phân tích giá trực tiếp trên trang chi tiết sản phẩm Shopee."*
   - **`host_permissions` (`https://*.vercel.app/*`)**: *"Kết nối với máy chủ API bảo mật để tải dữ liệu lịch sử giá sản phẩm."*

3. **Privacy Policy URL (Link chính sách quyền riêng tư):**
   > Dán link file `privacy.html` hoặc `PRIVACY_POLICY.md` trên GitHub của bạn:
   > `https://github.com/phantra263/shopee-price-extension/blob/main/PRIVACY_POLICY.md`
   *(Hoặc link trang Vercel của bạn nếu có).*
