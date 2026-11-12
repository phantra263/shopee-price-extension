@echo off
chcp 65001 >nul
echo ========================================================
echo        TẠO FILE ẢNH ICON PNG (16x16, 48x48, 128x128)
echo ========================================================
echo.
cd /d "%~dp0"
node backend/generate-icons.js
echo.
echo Hoàn tất! Đã tạo thành công icon16.png, icon48.png, icon128.png trong thư mục icons.
pause

