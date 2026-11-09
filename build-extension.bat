@echo off
chcp 65001 >nul
echo ========================================================
echo        ĐÓNG GÓI CHROME EXTENSION (XUẤT FILE ZIP)
echo ========================================================
echo.

cd /d "%~dp0"

IF NOT EXIST dist (
    mkdir dist
)

echo [1/2] Đang thu thập các file chạy extension (loại bỏ file rác, git, backend)...
IF EXIST dist\shopee-price-extension.zip (
    del /f /q dist\shopee-price-extension.zip
)

echo [2/2] Đang nén thành file dist\shopee-price-extension.zip...
powershell -Command "Compress-Archive -Path manifest.json, config.js, background.js, content.js, styles.css, popup.html, popup.js, icons -DestinationPath dist\shopee-price-extension.zip -Force"

IF EXIST dist\shopee-price-extension.zip (
    echo.
    echo ========================================================
    echo ✅ THÀNH CÔNG! Đã tạo file:
    echo 📁 dist\shopee-price-extension.zip
    echo.
    echo Bạn có thể dùng file .zip này để:
    echo 1. Gửi cho bạn bè / khách hàng giải nén cài vào Chrome.
    echo 2. Đăng tải trực tiếp lên Chrome Web Store Developer Dashboard.
    echo ========================================================
) ELSE (
    echo.
    echo [!] Có lỗi xảy ra trong quá trình nén file.
)

echo.
pause

