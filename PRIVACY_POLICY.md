# Privacy Policy - Shopee Price History & Fake Sale Detector

*Last updated: November 2026*

**Shopee Price History & Fake Sale Detector** ("we", "our", or "the Extension") is committed to protecting your privacy. This Privacy Policy explains our practices regarding user data.

---

### 1. Data Collection & Usage
- **No Personal Information Collected**: We do not collect, transmit, store, or sell any personally identifiable information (PII), such as names, email addresses, passwords, payment details, or personal browsing history.
- **Product & Price Data**: The Extension processes publicly available product IDs and price data directly on `shopee.vn` to display price fluctuation graphs and alert users about fake sale price increases.
- **Local Storage**: Your tracked products ("Watchlist") and user preferences are stored exclusively on your local device using Chrome's `chrome.storage.local` API. This data never leaves your device.

---

### 2. Permissions Justification
- `storage`: Used solely to save your local watchlist and preferences.
- `alarms`: Used to periodically run a background check on your saved watchlist to see if items reach your target price.
- `notifications`: Used to display a desktop notification when an item on your watchlist drops below your desired target price.
- `host_permissions` (`https://shopee.vn/*`, `https://*.vercel.app/*`): Required to display the price analytics widget on Shopee product pages and communicate with the price analytics API.

---

### 3. Affiliate Links Disclosure
In compliance with Google Chrome Web Store policies:
The Extension provides links to Shopee product pages and the Shopee Voucher Hub. Some of these links contain standard affiliate tracking parameters. If you click on an extension-provided button (such as "Mua Ngay Giá Tốt Nhất" or "Mở Kho Voucher Shopee") and make a purchase, the extension owner may earn an affiliate commission at **no additional cost to you**. 

---

### 4. Third-Party Services
The Extension interacts with our secure HTTPS backend hosted on Vercel to retrieve price history models. No personal identifiers or account details are ever transmitted in these requests.

---

### 5. Contact
If you have questions regarding this Privacy Policy, please open an issue on our GitHub repository:
https://github.com/phantra263/shopee-price-extension

