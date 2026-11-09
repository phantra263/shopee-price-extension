@echo off
chcp 65001 >nul
echo ========================================================
echo        ĐẨY CODE SHOPEE PRICE EXTENSION LÊN GIT
echo ========================================================
echo.

cd /d "%~dp0"

IF NOT EXIST .git (
    echo [1/4] Khởi tạo Git repository...
    git init
    git branch -M main
) ELSE (
    echo [1/4] Git đã được khởi tạo sẵn.
)

echo.
echo [2/4] Đang thêm toàn bộ file vào Git...
git add .

echo.
echo [3/4] Đang commit mã nguồn v1.8.0...
git commit -m "feat: Shopee Price History & Fake Sale Detector Extension v1.8.0"

echo.
git remote get-url origin >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [!] Chưa có link Remote Git (GitHub / GitLab).
    set /p REPO_URL=">> Dán link repository GitHub của bạn vào đây (ví dụ: https://github.com/username/shopee-price-extension.git): "
    IF NOT "%REPO_URL%"=="" (
        git remote add origin %REPO_URL%
    ) ELSE (
        echo [!] Bạn chưa nhập link remote. Đã lưu commit ở máy cục bộ!
        goto end
    )
)

echo.
echo [4/4] Đang đẩy (push) code lên Git...
git push -u origin main
IF %ERRORLEVEL% NEQ 0 (
    echo [!] Đang thử đẩy lên branch master...
    git push -u origin master
)

:end
echo.
echo ========================================================
echo Hoàn tất! Nhấn phím bất kỳ để thoát...
pause >nul

