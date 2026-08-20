/**
 * Application Configuration
 * 
 * Centralized configuration for the entire application.
 * Modify these values to customize the application behavior.
 */

export const APP_CONFIG = {
  // Application Info
  name: "COD Flow",
  locale: "ar",
  currency: "دج",
  dateFormat: "ar-DZ",
  direction: "rtl" as const,

  // Pagination
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },

  // Validation
  validation: {
    phoneRegex: /^(0)(5|6|7)[0-9]{8}$/,
    minPasswordLength: 8,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  },

  // UI Constants
  ui: {
    inputHeight: "h-11",
    buttonHeight: "h-11",
    selectItemPadding: "py-3",
    cardRadius: "rounded-xl",
    dialogPadding: {
      content: "p-0",
      header: "px-6 pt-6 pb-0",
      body: "px-6",
      footer: "px-6 pb-6 pt-4",
    },
  },

  // Debounce Delays
  debounce: {
    search: 300,
    input: 500,
  },

  // Toast Duration
  toast: {
    duration: 3000,
    position: "top-center" as const,
  },
} as const;
