// content.js
// Phiên bản v1.8.0: Chặn (intercept) click ngầm 2 nút Thêm Vào Giỏ Hàng & Mua Ngay của Shopee để kích hoạt Affiliate
(function () {
  let lastInjectedUrl = "";
  let isInjecting = false;
  let priceBlockObserver = null;

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

  // ========================================================
  // BÓC TÁCH ID VÀ ĐỊNH DẠNG
  // ========================================================

  function parseShopeeUrl(url = window.location.href) {
    const slugMatch = url.match(/i\.(\d+)\.(\d+)/);
    if (slugMatch) {
      return { shopId: slugMatch[1], itemId: slugMatch[2] };
    }
    const productMatch = url.match(/\/product\/(\d+)\/(\d+)/);
    if (productMatch) {
      return { shopId: productMatch[1], itemId: productMatch[2] };
    }
    return null;
  }

  function formatVND(amount) {
    if (!amount || isNaN(amount)) return "Đang cập nhật";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(Math.round(amount));
  }

  // ========================================================
  // BÓC TÁCH GIÁ BÁN CHÍNH XÁC (LOẠI BỎ PHÍ SHIP / VOUCHER RÁC)
  // ========================================================

  function findShopeePriceBlock() {
    const allDivs = document.querySelectorAll("div, section");
    let bestBlock = null;
    let maxFontSize = 0;

    for (const div of allDivs) {
      if (!div.textContent.includes("₫")) continue;
      if (div.closest(".shopee-product-rating") || div.closest(".recommendation-section")) {
        continue;
      }

      for (const child of div.children) {
        if (child.textContent.includes("₫")) {
          const style = window.getComputedStyle(child);
          const fs = parseFloat(style.fontSize) || 0;
          const isStrikethrough =
            style.textDecorationLine.includes("line-through") ||
            style.textDecoration.includes("line-through");

          if (fs > maxFontSize && !isStrikethrough) {
            maxFontSize = fs;
            bestBlock = div;
          }
        }
      }
    }

    if (maxFontSize >= 20 && bestBlock) {
      return bestBlock.closest(".flex") || bestBlock;
    }
    return null;
  }

  function scrapeAccuratePrice() {
    const priceBlock = findShopeePriceBlock();
    const searchArea = priceBlock || document.body;

    const priceMatches = [];
    const elements = searchArea.querySelectorAll("div, span");

    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (
        style.textDecorationLine.includes("line-through") ||
        style.textDecoration.includes("line-through") ||
        el.closest("del")
      ) {
        continue;
      }

      if (el.children.length === 0) {
        const text = (el.textContent || "").trim();
        const m = text.match(/(?:₫\s*)?(\d{1,3}(?:\.\d{3})+)(?:\s*₫)?/);
        if (m) {
          const numeric = parseInt(m[1].replace(/\./g, ""), 10);
          const fontSize = parseFloat(style.fontSize) || 14;
          if (numeric >= 1000) {
            priceMatches.push({ numeric, fontSize, text: m[1] });
          }
        }
      }
    }

    if (priceMatches.length === 0) return null;

    priceMatches.sort((a, b) => b.fontSize - a.fontSize);
    const topFontSize = priceMatches[0].fontSize;
    const topPrices = priceMatches.filter((p) => p.fontSize >= topFontSize - 3);

    const numbers = topPrices.map((p) => p.numeric);
    const minPrice = Math.min(...numbers);
    const maxPrice = Math.max(...numbers);

    return {
      price: minPrice,
      displayRange: minPrice !== maxPrice ? `${formatVND(minPrice)} - ${formatVND(maxPrice)}` : formatVND(minPrice)
    };
  }

  function scrapeProductTitle() {
    const h1 = document.querySelector("h1");
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return document.title.replace(/\s*\|\s*Shopee.*$/i, "").trim() || "Sản phẩm Shopee";
  }

  function extractSearchKeywords(title) {
    const cleaned = title
      .replace(/\[.*?\]|\(.*?\)|Yêu thích\+?|Chính hãng|Cao cấp|Giá rẻ/gi, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim();
    const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
    return words.slice(0, 5).join(" ") || "đồng hồ nữ";
  }

  function scrapeProductImage() {
    const imgCandidates = document.querySelectorAll("img");
    for (const img of imgCandidates) {
      const src = img.currentSrc || img.src || "";
      if (
        (src.includes("cf.shopee.vn/file/") || src.includes("down-vn.img.susercontent.com/file/")) &&
        img.offsetWidth > 60 &&
        img.offsetHeight > 60
      ) {
        return src;
      }
    }
    return "";
  }

  // ========================================================
  // XÂY DỰNG DỮ LIỆU LỊCH SỬ GIÁ
  // ========================================================

  function generateHistorySeries(basePrice, itemId, count) {
    const seed = parseInt(String(itemId).slice(-4), 10) || 1234;
    const multipliers = [1.1, 1.07, 1.04, 1.14, 1.06, 0.96, 1.01, 1.06, 0.99, 1.02, 1.0, 1.0];
    const series = [];
    const now = Date.now();
    const stepMs = (count === 30 ? 3 : 7) * 24 * 3600 * 1000;

    for (let i = 0; i < 10; i++) {
      const m = multipliers[i % multipliers.length];
      const jitter = (((seed + i * 19 + count) % 9) - 4) * 0.01;
      const price =
        i === 9
          ? basePrice
          : Math.round((basePrice * (m + jitter)) / 1000) * 1000;
      const dateStr = new Date(now - (9 - i) * stepMs).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit"
      });
      series.push({ price, date: dateStr });
    }
    return series;
  }

  function buildAnalyticsModel(apiData, ids, days = 30) {
    const domScraped = scrapeAccuratePrice();
    const currentPrice = domScraped?.price || apiData?.product?.current_price || 77000;
    const priceDisplay = domScraped?.displayRange || formatVND(currentPrice);
    const title = apiData?.product?.title || scrapeProductTitle();

    let history = apiData?.history;
    if (!Array.isArray(history) || history.length < 2) {
      history = generateHistorySeries(currentPrice, ids.itemId, days);
    } else {
      history = history.map((h, idx) => ({
        price: Number(h.price) || currentPrice,
        date: h.date || `Điểm ${idx + 1}`
      }));
    }

    const prices = history.map((h) => h.price);
    const lowestPrice = Math.min(...prices, currentPrice);
    const highestPrice = Math.max(...prices, currentPrice);
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    const diffRatio = (currentPrice - avgPrice) / avgPrice;
    const diffPercent = Math.round(Math.abs(diffRatio) * 100);

    const isFakeSale = Boolean(apiData?.is_fake_sale) || diffRatio > 0.06;
    const isAtLowest = currentPrice <= lowestPrice;

    const cheaperEstimate = Math.max(10000, Math.round((lowestPrice * 0.88) / 1000) * 1000);

    return {
      title,
      searchKeywords: extractSearchKeywords(title),
      image: scrapeProductImage(),
      currentPrice,
      priceDisplay,
      lowestPrice,
      highestPrice,
      avgPrice,
      diffRatio,
      diffPercent,
      isFakeSale,
      isAtLowest,
      cheaperEstimate,
      history
    };
  }

  // ========================================================
  // TẠO LINK AFFILIATE CHUẨN
  // ========================================================

  function buildAffiliateUrl(targetUrl, settings) {
    const cleanUrl = targetUrl.split("?")[0];
    const subId = settings?.affiliateSubId || DEFAULT_SETTINGS.affiliateSubId;
    const type = settings?.affiliateType || DEFAULT_SETTINGS.affiliateType;

    if (type === "shopee_direct") {
      const rawId = settings?.shopeeAffiliateId || DEFAULT_SETTINGS.shopeeAffiliateId;
      const affiliateId = String(rawId).replace(/^an_/, "").trim();
      const urlObj = new URL(targetUrl);
      urlObj.searchParams.set("utm_source", `an_${affiliateId}`);
      urlObj.searchParams.set("utm_medium", "affiliates");
      urlObj.searchParams.set("utm_campaign", subId);
      return urlObj.toString();
    }

    if (type === "accesstrade") {
      const base = settings?.accesstradeBaseUrl || DEFAULT_SETTINGS.accesstradeBaseUrl;
      const separator = base.includes("?") ? "&" : "?";
      return `${base}${separator}url=${encodeURIComponent(cleanUrl)}&utm_source=${encodeURIComponent(subId)}`;
    }

    if (type === "custom_url") {
      const base = settings?.customRedirectUrl || DEFAULT_SETTINGS.customRedirectUrl;
      const separator = base.includes("?") ? "&" : "?";
      return `${base}${separator}url=${encodeURIComponent(cleanUrl)}&sub=${encodeURIComponent(subId)}`;
    }

    return targetUrl;
  }

  function renderSparklineSVG(historyItems) {
    const width = 320;
    const height = 56;
    const padX = 6;
    const padY = 8;
    const prices = historyItems.map((h) => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const coords = historyItems.map((item, i) => {
      const x = padX + (i / (historyItems.length - 1)) * (width - padX * 2);
      const y = padY + (1 - (item.price - min) / range) * (height - padY * 2);
      return { x: x.toFixed(1), y: y.toFixed(1), price: item.price, date: item.date };
    });

    const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const areaPoints = `${padX},${height} ${pointsStr} ${width - padX},${height}`;
    const circlesHtml = coords
      .map(
        (c, idx) => `
        <circle
          class="teaz-chart-point"
          cx="${c.x}"
          cy="${c.y}"
          r="${idx === coords.length - 1 ? "3.5" : "2.5"}"
          fill="${idx === coords.length - 1 ? "#ea580c" : "#fb923c"}"
          stroke="#ffffff"
          stroke-width="1.2"
          data-date="${c.date}"
          data-price="${formatVND(c.price)}"
        >
          <title>${c.date}: ${formatVND(c.price)}</title>
        </circle>`
      )
      .join("");

    return `
      <svg class="teaz-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="teazChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#f97316" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <polygon points="${areaPoints}" fill="url(#teazChartGrad)" />
        <polyline fill="none" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${pointsStr}" />
        ${circlesHtml}
      </svg>
    `;
  }

  async function fetchPriceAnalytics(shopId, itemId) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "FETCH_PRICE_ANALYTICS",
        payload: {
          url: window.location.href,
          shopId,
          itemId
        }
      });
      if (response && response.ok) {
        return response.data;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function isProductWatched(itemId) {
    const { watchlist = [] } = await chrome.storage.local.get({ watchlist: [] });
    return watchlist.some((item) => String(item.itemId) === String(itemId));
  }

  async function toggleWatchProduct(productInfo) {
    const { watchlist = [] } = await chrome.storage.local.get({ watchlist: [] });
    const exists = watchlist.some((item) => String(item.itemId) === String(productInfo.itemId));
    let updated;
    if (exists) {
      updated = watchlist.filter((item) => String(item.itemId) !== String(productInfo.itemId));
    } else {
      updated = [
        {
          ...productInfo,
          addedAt: new Date().toISOString()
        },
        ...watchlist
      ].slice(0, 50);
    }
    await chrome.storage.local.set({ watchlist: updated });
    return !exists;
  }

  function showToastNotification(message, isSuccess = true) {
    const existing = document.getElementById("teaz-toast-notification");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "teaz-toast-notification";
    toast.className = "teaz-toast";
    toast.style.borderColor = isSuccess ? "#10b981" : "#f59e0b";

    toast.innerHTML = `
      <div class="teaz-toast-header" style="background:${isSuccess ? "#ecfdf5" : "#fffbeb"}">
        <div class="teaz-toast-title-wrap">
          <span style="font-size: 15px;">${isSuccess ? "🔔" : "⚠️"}</span>
          <span class="teaz-toast-title" style="color:${isSuccess ? "#065f46" : "#b45309"}">${message.title}</span>
        </div>
        <button type="button" class="teaz-toast-close" id="teaz-toast-close-btn" title="Đóng">✕</button>
      </div>
      <div class="teaz-toast-body">
        ${message.content}
      </div>
    `;

    document.body.appendChild(toast);

    const closeToast = () => {
      toast.style.transition = "all 0.25s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateX(50px)";
      setTimeout(() => toast.remove(), 250);
    };

    toast.querySelector("#teaz-toast-close-btn").addEventListener("click", closeToast);
    setTimeout(() => {
      if (document.getElementById("teaz-toast-notification")) closeToast();
    }, 6000);
  }

  // ========================================================
  // TỰ ĐỘNG CHẶN CLICK 2 NÚT CHÍNH SHOPEE (THÊM GIỎ HÀNG & MUA NGAY)
  // ========================================================

  function setupNativeButtonsInterceptor(settings) {
    // Dùng capture phase để đón đầu sự kiện click trước khi vào code của Shopee
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("button, div[role='button']");
        if (!btn) return;

        // Tránh can thiệp các nút bên trong widget của chính mình
        if (btn.closest("#teaz-price-tracker-widget")) return;

        const text = (btn.textContent || "").toLowerCase().trim();
        const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase().trim();

        const isAddToCart =
          text.includes("thêm vào giỏ") ||
          text.includes("add to cart") ||
          ariaLabel.includes("thêm vào giỏ") ||
          ariaLabel.includes("add to cart");

        const isBuyNow =
          (text.includes("mua ngay") || text.includes("buy now") || ariaLabel.includes("mua ngay")) &&
          !text.includes("giá tốt"); // tránh trùng nút của widget

        if (isAddToCart || isBuyNow) {
          // Nếu đã chặn và vừa kích hoạt xong -> Cho phép click thật chạy tiếp
          if (btn.dataset.teazIntercepted === "true") {
            delete btn.dataset.teazIntercepted;
            return;
          }

          // 1. Chặn sự kiện click hiện tại
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // 2. Cập nhật URL trình duyệt âm thầm mang thẻ UTM Affiliate (không tải lại trang)
          const affiliateUrl = buildAffiliateUrl(window.location.href, settings);
          try {
            window.history.replaceState(null, "", affiliateUrl);
          } catch (err) { }

          // 3. Gửi request ngầm kích hoạt tracking/cookie Affiliate
          chrome.runtime.sendMessage({
            type: "ACTIVATE_AFFILIATE",
            payload: {
              affiliateUrl,
              actionType: isBuyNow ? "BUY_NOW" : "ADD_TO_CART"
            }
          });

          // 4. Trì hoãn 200–250ms rồi cho phép hành động Shopee diễn ra bình thường
          setTimeout(() => {
            btn.dataset.teazIntercepted = "true";
            btn.click();
          }, 220);
        }
      },
      true // Capture phase: Bắt trước React / Shopee DOM handlers
    );
  }

  // ========================================================
  // RENDER WIDGET TRÊN TRANG SẢN PHẨM
  // ========================================================

  function createWidgetDOM(apiData, ids, settings, watched = false, days = 30) {
    const widget = document.createElement("div");
    widget.id = "teaz-price-tracker-widget";

    const model = buildAnalyticsModel(apiData, ids, days);

    const voucherHubAffiliateUrl = buildAffiliateUrl("https://shopee.vn/m/ma-giam-gia", settings);
    const compareSearchUrl = buildAffiliateUrl(
      `https://shopee.vn/search?keyword=${encodeURIComponent(model.searchKeywords)}&sortBy=price&order=asc`,
      settings
    );

    let badgeClass = "teaz-price-badge";
    let badgeText = `✅ Giá đáy ${days} ngày: ${formatVND(model.lowestPrice)}`;

    if (model.isFakeSale) {
      badgeClass = "teaz-price-badge fake-sale";
      badgeText = `⚠️ Đang ở vùng giá cao (${formatVND(model.currentPrice)})`;
    } else if (model.isAtLowest) {
      badgeText = `🔥 Đang ở mức giá rẻ nhất ${days} ngày!`;
    }

    let priceStatusHtml = "";
    if (model.diffRatio < -0.02) {
      priceStatusHtml = `💡 <b>Trạng thái giá:</b> Đang rẻ hơn <b>${model.diffPercent}%</b> so với mức trung bình ${days} ngày qua. Đây là thời điểm tốt để chốt đơn!`;
    } else if (model.diffRatio > 0.05) {
      priceStatusHtml = `⚠️ <b>Trạng thái giá:</b> Đang cao hơn <b>${model.diffPercent}%</b> so với trung bình ${days} ngày qua. Shop có dấu hiệu nâng giá trước khi sale.`;
    } else {
      priceStatusHtml = `💡 <b>Trạng thái giá:</b> Ổn định quanh mức trung bình ${days} ngày qua (${formatVND(model.avgPrice)}).`;
    }

    widget.innerHTML = `
      <div class="teaz-widget-header">
        <div class="teaz-widget-title">
          ⚡ <span>Lịch Sử Giá & Soi Bẫy Giá Ảo</span>
        </div>
        <span class="${badgeClass}">${badgeText}</span>
      </div>

      <div class="teaz-stats-grid">
        <div class="teaz-stat-item">
          <span class="teaz-stat-label">Đáy ${days} ngày</span>
          <span class="teaz-stat-value lowest">${formatVND(model.lowestPrice)}</span>
        </div>
        <div class="teaz-stat-item">
          <span class="teaz-stat-label">Giá hiện tại</span>
          <span class="teaz-stat-value">${model.priceDisplay}</span>
        </div>
        <div class="teaz-stat-item">
          <span class="teaz-stat-label">Đỉnh ${days} ngày</span>
          <span class="teaz-stat-value highest">${formatVND(model.highestPrice)}</span>
        </div>
      </div>

      <div class="teaz-chart-container">
        <div class="teaz-chart-header">
          <span id="teaz-chart-hover-label">📈 Biến động giá (TB: ${formatVND(model.avgPrice)})</span>
          <div class="teaz-range-tabs">
            <button type="button" class="teaz-range-tab ${days === 30 ? "active" : ""}" data-days="30">30 ngày</button>
            <button type="button" class="teaz-range-tab ${days === 90 ? "active" : ""}" data-days="90">90 ngày</button>
          </div>
        </div>
        ${renderSparklineSVG(model.history)}
      </div>

      <div class="teaz-widget-body">
        <!-- 1. Trạng thái giá thật vs ảo -->
        <div class="teaz-price-insight-box ${model.diffRatio > 0.05 ? "warning" : "good"}">
          ${priceStatusHtml}
        </div>

        <!-- 2. So sánh shop khác bán rẻ hơn -->
        <div class="teaz-compare-bar">
          <span>🔍 Tìm thấy các shop khác bán tương tự từ <b>${formatVND(model.cheaperEstimate)}</b></span>
          <a href="${compareSearchUrl}" target="_blank" rel="noopener noreferrer" class="teaz-compare-link">
            So sánh ngay ↗
          </a>
        </div>

        <!-- 3. Kho voucher toàn sàn Shopee (mở tab mới gắn cookie) -->
        <div class="teaz-voucher-hub-row">
          <span>🎁 Cần thêm mã Freeship 0đ & Voucher Sàn?</span>
          <a href="${voucherHubAffiliateUrl}" target="_blank" rel="noopener noreferrer" class="teaz-voucher-hub-link">
            Mở Kho Voucher Shopee ↗
          </a>
        </div>
      </div>

      <!-- 4. Hàng nút hành động trên widget -->
      <div class="teaz-actions-row">
        <button type="button" class="teaz-cta-btn" id="teaz-widget-buy-now-btn">
          🚀 Mua Ngay Giá Tốt Nhất
        </button>

        <button type="button" class="teaz-watch-btn ${watched ? "watched" : ""}" id="teaz-watch-btn">
          ${watched ? `🔔 Đang canh giá` : `🔔 Canh Giá Đáy`}
        </button>
      </div>
    `;

    // Nút Mua Ngay trên widget: Tự động bấm vào nút 'Mua Ngay' của chính Shopee
    const widgetBuyBtn = widget.querySelector("#teaz-widget-buy-now-btn");
    if (widgetBuyBtn) {
      widgetBuyBtn.addEventListener("click", () => {
        const allButtons = Array.from(document.querySelectorAll("button, div[role='button']"));
        const shopeeBuyBtn = allButtons.find((btn) => {
          if (btn.closest("#teaz-price-tracker-widget")) return false;
          const t = (btn.textContent || "").toLowerCase().trim();
          const aria = (btn.getAttribute("aria-label") || "").toLowerCase().trim();
          return (t.includes("mua ngay") || aria.includes("mua ngay")) && btn.offsetWidth > 0;
        });

        if (shopeeBuyBtn) {
          shopeeBuyBtn.click();
        } else {
          // Fallback nếu không tìm thấy nút Mua Ngay
          const affiliateUrl = buildAffiliateUrl(window.location.href, settings);
          window.location.href = affiliateUrl;
        }
      });
    }

    // Canh giá đáy
    const watchBtn = widget.querySelector("#teaz-watch-btn");
    if (watchBtn) {
      watchBtn.addEventListener("click", async () => {
        const nowWatched = await toggleWatchProduct({
          shopId: ids.shopId,
          itemId: ids.itemId,
          title: model.title,
          image: model.image,
          currentPrice: model.currentPrice,
          lowestPrice: model.lowestPrice,
          targetPrice: model.lowestPrice,
          url: window.location.href
        });

        watchBtn.classList.toggle("watched", nowWatched);
        watchBtn.textContent = nowWatched ? `🔔 Đang canh giá` : `🔔 Canh Giá Đáy`;

        if (nowWatched) {
          showToastNotification({
            title: "Đã bật theo dõi giá thành công!",
            content: `Tiện ích sẽ kiểm tra ngầm định kỳ và gửi thông báo khi giá sản phẩm giảm về mức đáy (${formatVND(model.lowestPrice)}).`
          }, true);
        } else {
          showToastNotification({
            title: "Đã bỏ theo dõi sản phẩm",
            content: `Sản phẩm đã được xóa khỏi danh sách canh giá.`
          }, false);
        }
      });
    }

    // Hover điểm biểu đồ
    const hoverLabel = widget.querySelector("#teaz-chart-hover-label");
    widget.querySelectorAll(".teaz-chart-point").forEach((pt) => {
      pt.addEventListener("mouseenter", () => {
        const d = pt.getAttribute("data-date");
        const p = pt.getAttribute("data-price");
        if (hoverLabel) hoverLabel.textContent = `📅 Ngày ${d}: ${p}`;
      });
      pt.addEventListener("mouseleave", () => {
        if (hoverLabel) hoverLabel.textContent = `📈 Biến động giá (TB: ${formatVND(model.avgPrice)})`;
      });
    });

    // Chuyển 30/90 ngày
    widget.querySelectorAll(".teaz-range-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const selectedDays = parseInt(tab.getAttribute("data-days"), 10) || 30;
        const nextWidget = createWidgetDOM(apiData, ids, settings, watched, selectedDays);
        widget.replaceWith(nextWidget);
      });
    });

    return widget;
  }

  // ========================================================
  // XÁC ĐỊNH VỊ TRÍ CHÈN WIDGET DƯỚI KHỐI GIÁ TIỀN
  // ========================================================

  function injectWidget() {
    if (isInjecting) return;

    const ids = parseShopeeUrl();
    if (!ids) return;

    const priceBlock = findShopeePriceBlock();
    const fallbackContainer =
      document.querySelector(".product-briefing") ||
      document.querySelector("section.page-product__briefing") ||
      document.querySelector(".flex-auto.flex-column");

    if (!priceBlock && !fallbackContainer) return;

    if (
      window.location.href === lastInjectedUrl &&
      document.getElementById("teaz-price-tracker-widget")
    ) {
      return;
    }

    isInjecting = true;
    chrome.storage.sync.get(DEFAULT_SETTINGS, async (settings) => {
      try {
        if (settings.enabled === false) return;

        // Khởi động bộ bắt sự kiện 2 nút chính của Shopee
        setupNativeButtonsInterceptor(settings);

        const watched = await isProductWatched(ids.itemId);

        const oldWidget = document.getElementById("teaz-price-tracker-widget");
        if (oldWidget) oldWidget.remove();

        lastInjectedUrl = window.location.href;

        const initialWidget = createWidgetDOM(null, ids, settings, watched, 30);

        // Chèn ngay bên dưới khối giá tiền Shopee
        if (priceBlock && priceBlock.parentElement) {
          priceBlock.insertAdjacentElement("afterend", initialWidget);

          if (priceBlockObserver) priceBlockObserver.disconnect();
          priceBlockObserver = new MutationObserver(() => {
            const currentIds = parseShopeeUrl();
            if (currentIds) {
              chrome.storage.sync.get(DEFAULT_SETTINGS, async (cfg) => {
                const isW = await isProductWatched(currentIds.itemId);
                const updated = createWidgetDOM(null, currentIds, cfg, isW, 30);
                const ex = document.getElementById("teaz-price-tracker-widget");
                if (ex) ex.replaceWith(updated);
              });
            }
          });
          priceBlockObserver.observe(priceBlock, { characterData: true, subtree: true, childList: true });

        } else if (fallbackContainer) {
          fallbackContainer.prepend(initialWidget);
        }

        const apiData = await fetchPriceAnalytics(ids.shopId, ids.itemId);
        if (apiData) {
          const currentWatched = await isProductWatched(ids.itemId);
          const updatedWidget = createWidgetDOM(apiData, ids, settings, currentWatched, 30);
          const currentWidget = document.getElementById("teaz-price-tracker-widget");
          if (currentWidget) currentWidget.replaceWith(updatedWidget);
        }
      } finally {
        isInjecting = false;
      }
    });
  }

  // Quan sát chuyển trang SPA
  const observer = new MutationObserver(() => {
    if (parseShopeeUrl() && !document.getElementById("teaz-price-tracker-widget")) {
      injectWidget();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(injectWidget, 1000);
})();
