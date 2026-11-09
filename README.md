# Shopee Price History & Fake Sale Detector (TeaZ Extension)

Tiện ích mở rộng trình duyệt (Manifest V3) theo chuẩn **BeeCost**: Tập trung vào **phân tích lịch sử giá thật vs Giá ảo**, bảo mật ẩn mã Affiliate dành riêng cho Admin và tích hợp **cơ chế kích hoạt Affiliate ngầm khi bấm Thêm Vào Giỏ Hàng & Mua Ngay**.

## Cấu trúc dự án

```text
shopee-price-extension/
├── manifest.json        # Cấu hình chuẩn Chrome Extension Manifest V3 (v1.8.0)
├── background.js        # Service Worker gọi API, Kích hoạt Affiliate ngầm, Alarm & Thông báo
├── content.js           # Bắt sự kiện Thêm Giỏ Hàng/Mua Ngay, soi bẫy giá ảo, so sánh shop rẻ hơn
├── styles.css           # Giao diện Widget chuyên nghiệp, hiển thị trực quan mức độ rẻ/đắt
├── popup.html           # Popup quản lý danh sách canh giá đáy & Bảng Admin bí mật
├── popup.js             # Quản lý mở khóa quyền Admin (nhấn 5 lần + mã PIN 8888) & lưu cấu hình
├── icons/
│   └── icon128.svg      # Biểu tượng của Extension
└── backend/
    ├── package.json     # Cấu hình Backend Node.js
    └── server.js        # API Server chạy tại http://localhost:5000 (Zero-dependency)
```

## Cơ Chế Kích Hoạt Affiliate Ngầm (Tự Nhiên 100% - Không Làm Phiền Người Mua)

Thay vì dùng popup QR hay bắt người dùng bấm link lạ:

1. **Bắt sự kiện 2 nút chính của Shopee (`setupNativeButtonsInterceptor`)**:
   - Khi khách bấm vào nút **"Thêm Vào Giỏ Hàng"** hoặc **"Mua Ngay"** có sẵn trên Shopee:
     - Script đón đầu sự kiện click ở `capture phase` và giữ nhẹ **220ms**.
     - Âm thầm cập nhật thanh địa chỉ URL mang tham số `utm_source=an_...` bằng `history.replaceState` (không tải lại trang).
     - Gửi request ngầm qua `background.js` để kích hoạt cookie hoa hồng Affiliate.
     - Sau 220ms, giải phóng sự kiện để Shopee thực hiện thêm hàng vào giỏ hoặc mở trang thanh toán hoàn toàn bình thường.
   - **Người dùng hoàn toàn không nhận thấy bất kỳ sự khác biệt nào**, thao tác mua sắm diễn ra mượt mà và hoa hồng được ghi nhận tự động.

2. **Các tính năng gia tăng giá trị trên Widget**:
   - Biểu đồ biến động giá 30/90 ngày & Đánh giá trạng thái giá thật vs giá ảo.
   - Dòng **`🔍 Tìm thấy các shop khác bán tương tự...`** dẫn tới tìm kiếm Shopee theo giá rẻ nhất.
   - Dòng **`🎁 Mở Kho Voucher Shopee ↗`** mở kho mã giảm giá chính thức của Shopee sang tab mới.
   - Nút **`🔔 Canh Giá Đáy`** lưu sản phẩm vào danh sách theo dõi và thông báo khi giá giảm.

## Cơ chế Bảo Mật Cho Admin

- Người dùng thông thường chỉ thấy tính năng canh giá đáy và cài đặt.
- **Admin**: Nhấn **5 lần liên tiếp vào tiêu đề** `⚡ TeaZ Shopee - Soi Giá Thật` trong Popup tiện ích ➡️ Nhập mã PIN: **`8888`** để mở khóa bảng cấu hình mã đối tác Shopee Affiliate!
