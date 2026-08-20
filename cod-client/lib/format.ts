/**
 * Formatting Utilities
 * 
 * Centralized formatting functions for consistent data display.
 */

/**
 * Format price with currency
 * @example formatPrice(1500, "دج") // "1,500 دج"
 * @example formatPrice(1500, "DA") // "1,500 DA"
 */
export const formatPrice = (price: number | null | undefined, currency: string = "دج"): string => {
  if (price === null || price === undefined || isNaN(price)) return `0 ${currency}`;
  return `${price.toLocaleString("ar-DZ")} ${currency}`;
};

/**
 * Format price per meter with currency
 * @example formatPricePerMeter(850, "دج") // "850 دج/م"
 */
export const formatPricePerMeter = (price: number | null | undefined, currency: string = "دج"): string => {
  if (price === null || price === undefined || isNaN(price)) return `0 ${currency}/م`;
  return `${price.toLocaleString("ar-DZ")} ${currency}/م`;
};

/**
 * Format date in Arabic locale
 * @example formatDate("2024-03-15") // "١٥/٠٣/٢٠٢٤"
 */
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return "—";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) return "—";
  
  return dateObj.toLocaleDateString("ar-DZ");
};

/**
 * Format date and time — avoids locale-dependent separators to prevent SSR hydration mismatches.
 * Constructs the time portion manually (Western digits + Arabic AM/PM) and joins with a space.
 * @example formatDateTime("2024-03-15T10:30:00") // "١٥/٠٣/٢٠٢٤ 10:30 ص"
 */
export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return "—";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const datePart = d.toLocaleDateString("ar-DZ");
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${datePart} ${h12}:${m} ${period}`;
};

/**
 * Format phone number with spaces
 * @example formatPhone("0555123456") // "0555 12 34 56"
 */
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone || phone.length !== 10) return phone || "—";
  return phone.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");
};

/**
 * Get initials from name
 * @example getInitials("محمد أحمد") // "مأ"
 */
export const getInitials = (name: string | null | undefined): string => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

/**
 * Format file size in human-readable format
 * @example formatFileSize(1024) // "1 KB"
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

/**
 * Truncate text with ellipsis
 * @example truncate("Long text here", 10) // "Long text..."
 */
export const truncate = (text: string | null | undefined, length: number): string => {
  if (!text) return "";
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
};

/**
 * Format relative time (e.g., "منذ ساعتين" / "2h ago")
 * @example formatRelativeTime(new Date(Date.now() - 3600000)) // "منذ ساعة"
 */
export const formatRelativeTime = (
  date: string | Date | null | undefined,
  locale: "ar" | "en" = "ar",
): string => {
  if (!date) return "—";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "—";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (locale === "en") {
    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateObj);
  }

  if (diffInSeconds < 60) return "منذ لحظات";
  if (diffInSeconds < 3600) return `منذ ${Math.floor(diffInSeconds / 60)} دقيقة`;
  if (diffInSeconds < 86400) return `منذ ${Math.floor(diffInSeconds / 3600)} ساعة`;
  if (diffInSeconds < 604800) return `منذ ${Math.floor(diffInSeconds / 86400)} يوم`;

  return formatDate(dateObj);
};
