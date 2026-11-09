// popup.js
const DEFAULT_SETTINGS = typeof TEAZ_CONFIG !== "undefined" ? TEAZ_CONFIG : {
  enabled: true,
  notifEnabled: true,
  apiUrl: "http://localhost:5000/api/track",
  affiliateType: "shopee_direct", // 'shopee_direct' | 'accesstrade' | 'custom_url'
  shopeeAffiliateId: "17300000000",
  accesstradeBaseUrl: "https://go.isclix.com/deep_link/4348611985448651000/4751584435713464249",
  customRedirectUrl: "http://localhost:5000/s",
  affiliateSubId: "chrome_ext",
  adminPin: "8888" // Mã PIN quản trị mặc định
};

function formatVND(amount) {
  if (!amount || isNaN(amount)) return "N/A";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND"
  }).format(Math.round(amount));
}

function buildPreviewUrl(settings, customUrl) {
  const sampleProductUrl = customUrl || "https://shopee.vn/product/123456/7890123";
  const subId = settings.affiliateSubId || "chrome_ext";

  if (settings.affiliateType === "shopee_direct") {
    const affiliateId = (settings.shopeeAffiliateId || "17399980696").replace(/^an_/, "");
    const cleanUrl = sampleProductUrl.split("?")[0];
    return `${cleanUrl}?utm_source=an_${affiliateId}&utm_medium=affiliates&utm_campaign=${encodeURIComponent(subId)}`;
  } else if (settings.affiliateType === "accesstrade") {
    const base = settings.accesstradeBaseUrl || "https://go.isclix.com/deep_link/sample";
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}url=${encodeURIComponent(sampleProductUrl)}&utm_source=${encodeURIComponent(subId)}`;
  } else {
    const base = settings.customRedirectUrl || "http://localhost:5000/s";
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}url=${encodeURIComponent(sampleProductUrl)}&sub=${encodeURIComponent(subId)}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const watchCountEl = document.getElementById("watchCount");
  const watchlistContainer = document.getElementById("watchlistContainer");

  const tabBtnAffiliate = document.getElementById("tab-btn-affiliate");
  const adminBadge = document.getElementById("adminBadge");
  const adminSecretTrigger = document.getElementById("adminSecretTrigger");
  const pinModal = document.getElementById("pinModal");
  const adminPinInput = document.getElementById("adminPinInput");
  const confirmPinBtn = document.getElementById("confirmPinBtn");
  const cancelPinBtn = document.getElementById("cancelPinBtn");
  const pinError = document.getElementById("pinError");
  const lockAdminBtn = document.getElementById("lockAdminBtn");

  const affiliateTypeEl = document.getElementById("affiliateType");
  const affiliateHintEl = document.getElementById("affiliateHint");
  const fieldShopeeId = document.getElementById("field-shopeeId");
  const fieldAccesstrade = document.getElementById("field-accesstrade");
  const fieldCustom = document.getElementById("field-custom");

  const shopeeAffiliateIdEl = document.getElementById("shopeeAffiliateId");
  const accesstradeBaseUrlEl = document.getElementById("accesstradeBaseUrl");
  const customRedirectUrlEl = document.getElementById("customRedirectUrl");
  const affiliateSubIdEl = document.getElementById("affiliateSubId");
  const apiUrlEl = document.getElementById("apiUrl");

  const saveAffiliateBtn = document.getElementById("saveAffiliateBtn");
  const previewBtn = document.getElementById("previewBtn");
  const statusEl = document.getElementById("status");

  const enabledEl = document.getElementById("enabled");
  const notifEnabledEl = document.getElementById("notifEnabled");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const statusSettingsEl = document.getElementById("statusSettings");

  let clickCount = 0;
  let clickTimer = null;

  // ========================================================
  // CƠ CHẾ BẢO MẬT ADMIN (NHẤN 5 LẦN ĐỂ MỞ KHÓA)
  // ========================================================

  function isUnlocked() {
    return sessionStorage.getItem("teaz_admin_unlocked") === "true";
  }

  function setAdminUnlocked(unlocked) {
    if (unlocked) {
      sessionStorage.setItem("teaz_admin_unlocked", "true");
      tabBtnAffiliate.style.display = "block";
      adminBadge.style.display = "inline-block";
    } else {
      sessionStorage.removeItem("teaz_admin_unlocked");
      tabBtnAffiliate.style.display = "none";
      adminBadge.style.display = "none";
      switchTab("watchlist");
    }
  }

  // Khởi động kiểm tra trạng thái session
  if (isUnlocked()) {
    setAdminUnlocked(true);
  }

  // Bắt sự kiện nhấn 5 lần vào tiêu đề để mở modal PIN
  adminSecretTrigger.addEventListener("click", () => {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 2500);

    if (clickCount >= 5) {
      clickCount = 0;
      if (isUnlocked()) {
        switchTab("affiliate");
      } else {
        pinError.textContent = "";
        adminPinInput.value = "";
        pinModal.style.display = "flex";
        adminPinInput.focus();
      }
    }
  });

  // Xác nhận mã PIN Admin
  confirmPinBtn.addEventListener("click", () => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      const correctPin = settings.adminPin || DEFAULT_SETTINGS.adminPin;
      if (adminPinInput.value.trim() === correctPin) {
        pinModal.style.display = "none";
        setAdminUnlocked(true);
        switchTab("affiliate");
      } else {
        pinError.textContent = "Mã PIN không đúng!";
      }
    });
  });

  adminPinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmPinBtn.click();
  });

  cancelPinBtn.addEventListener("click", () => {
    pinModal.style.display = "none";
  });

  // Khóa lại quyền Admin
  lockAdminBtn.addEventListener("click", () => {
    setAdminUnlocked(false);
  });

  // ========================================================
  // CHUYỂN ĐỔI TAB GIAO DIỆN
  // ========================================================

  function switchTab(tabId) {
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    const activeBtn = document.querySelector(`.tab-btn[data-tab='${tabId}']`);
    if (activeBtn) activeBtn.classList.add("active");
    const activePanel = document.getElementById(`tab-${tabId}`);
    if (activePanel) activePanel.classList.add("active");
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  // ========================================================
  // ĐỔI NỀN TẢNG TIẾP THỊ LIÊN KẾT
  // ========================================================

  function updateAffiliateFields(type) {
    fieldShopeeId.style.display = type === "shopee_direct" ? "block" : "none";
    fieldAccesstrade.style.display = type === "accesstrade" ? "block" : "none";
    fieldCustom.style.display = type === "custom_url" ? "block" : "none";

    if (type === "shopee_direct") {
      affiliateHintEl.textContent = "Gắn trực tiếp tracking của Shopee Affiliate vào link sản phẩm, mở thẳng Shopee không sợ bị chặn firewall.";
    } else if (type === "accesstrade") {
      affiliateHintEl.textContent = "Chuyển hướng qua deeplink hệ thống Accesstrade để ghi nhận hoa hồng.";
    } else {
      affiliateHintEl.textContent = "Sử dụng server riêng hoặc link rút gọn tùy biến của bạn.";
    }
  }

  affiliateTypeEl.addEventListener("change", (e) => {
    updateAffiliateFields(e.target.value);
  });

  // ========================================================
  // RENDER WATCHLIST SẢN PHẨM CANH GIÁ
  // ========================================================

  function renderWatchlist() {
    chrome.storage.local.get({ watchlist: [] }, ({ watchlist }) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        watchCountEl.textContent = watchlist.length;
        if (!watchlist.length) {
          watchlistContainer.innerHTML = `
            <div class="watchlist-empty">
              Chưa có sản phẩm nào trong danh sách.<br/>
              Bấm nút <b>"🔔 Bật Thông Báo..."</b> trên trang sản phẩm Shopee để theo dõi giá đáy!
            </div>
          `;
          return;
        }

        watchlistContainer.innerHTML = watchlist
          .map((item) => {
            const productLink = buildPreviewUrl(settings, item.url);
            const targetDisplay = item.targetPrice ? formatVND(item.targetPrice) : formatVND(item.lowestPrice);
            return `
              <div class="watch-item">
                <div class="watch-info">
                  <a href="${productLink}" target="_blank" class="watch-title" title="${item.title}">
                    ${item.title}
                  </a>
                  <div class="watch-price-row">
                    <span class="watch-price">Hiện tại: ${formatVND(item.currentPrice)}</span>
                    <span class="watch-target">• Mục tiêu: &lt; ${targetDisplay}</span>
                  </div>
                </div>
                <button class="remove-btn" data-id="${item.itemId}" title="Xóa khỏi danh sách">✕</button>
              </div>
            `;
          })
          .join("");

        watchlistContainer.querySelectorAll(".remove-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idToRemove = btn.getAttribute("data-id");
            const nextList = watchlist.filter((i) => String(i.itemId) !== String(idToRemove));
            chrome.storage.local.set({ watchlist: nextList }, renderWatchlist);
          });
        });
      });
    });
  }

  renderWatchlist();

  // Load cài đặt
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    enabledEl.checked = items.enabled !== false;
    notifEnabledEl.checked = items.notifEnabled !== false;
    apiUrlEl.value = items.apiUrl || DEFAULT_SETTINGS.apiUrl;

    affiliateTypeEl.value = items.affiliateType || DEFAULT_SETTINGS.affiliateType;
    shopeeAffiliateIdEl.value = items.shopeeAffiliateId || DEFAULT_SETTINGS.shopeeAffiliateId;
    accesstradeBaseUrlEl.value = items.accesstradeBaseUrl || DEFAULT_SETTINGS.accesstradeBaseUrl;
    customRedirectUrlEl.value = items.customRedirectUrl || DEFAULT_SETTINGS.customRedirectUrl;
    affiliateSubIdEl.value = items.affiliateSubId || DEFAULT_SETTINGS.affiliateSubId;

    updateAffiliateFields(affiliateTypeEl.value);
  });

  // Lưu cấu hình Affiliate (Admin)
  saveAffiliateBtn.addEventListener("click", () => {
    const updated = {
      affiliateType: affiliateTypeEl.value,
      shopeeAffiliateId: shopeeAffiliateIdEl.value.trim() || DEFAULT_SETTINGS.shopeeAffiliateId,
      accesstradeBaseUrl: accesstradeBaseUrlEl.value.trim() || DEFAULT_SETTINGS.accesstradeBaseUrl,
      customRedirectUrl: customRedirectUrlEl.value.trim() || DEFAULT_SETTINGS.customRedirectUrl,
      affiliateSubId: affiliateSubIdEl.value.trim() || DEFAULT_SETTINGS.affiliateSubId,
      apiUrl: apiUrlEl.value.trim() || DEFAULT_SETTINGS.apiUrl
    };

    chrome.storage.sync.set(updated, () => {
      statusEl.textContent = "✅ Đã lưu cấu hình Affiliate thành công!";
      renderWatchlist();
      setTimeout(() => {
        statusEl.textContent = "";
      }, 2500);
    });
  });

  // Kiểm tra link mẫu (Admin)
  previewBtn.addEventListener("click", () => {
    const currentConfig = {
      affiliateType: affiliateTypeEl.value,
      shopeeAffiliateId: shopeeAffiliateIdEl.value.trim() || DEFAULT_SETTINGS.shopeeAffiliateId,
      accesstradeBaseUrl: accesstradeBaseUrlEl.value.trim() || DEFAULT_SETTINGS.accesstradeBaseUrl,
      customRedirectUrl: customRedirectUrlEl.value.trim() || DEFAULT_SETTINGS.customRedirectUrl,
      affiliateSubId: affiliateSubIdEl.value.trim() || DEFAULT_SETTINGS.affiliateSubId
    };
    const testUrl = buildPreviewUrl(currentConfig);
    chrome.tabs.create({ url: testUrl });
  });

  // Lưu cài đặt người dùng thông thường
  saveSettingsBtn.addEventListener("click", () => {
    const updated = {
      enabled: enabledEl.checked,
      notifEnabled: notifEnabledEl.checked
    };

    chrome.storage.sync.set(updated, () => {
      statusSettingsEl.textContent = "✅ Đã lưu cài đặt!";
      setTimeout(() => {
        statusSettingsEl.textContent = "";
      }, 2000);
    });
  });
});
