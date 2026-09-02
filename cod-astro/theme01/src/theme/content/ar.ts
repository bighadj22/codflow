/**
 * Arabic (العربية) Content
 * 
 * All user-facing text in Arabic for the Algerian market.
 * Supports RTL layout and Algerian dialect preferences.
 */

import type { StoreFrontContent } from "./types";

export const ar: StoreFrontContent = {
  // ── Announcement bar ─────────────────────────────────────────────────────
  announcementText: "الدفع عند الاستلام متاح لجميع الولايات",

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroEyebrow: "مجموعة جديدة",
  heroTitle: "اكتشف أفضل المنتجات",
  heroSubtitle: "توصيل لجميع ولايات الجزائر — الدفع عند الاستلام",
  heroPlaceholderTitle: "تشكيلة جديدة",
  heroPlaceholderSub: "قريباً جداً",

  // ── Trust badges ──────────────────────────────────────────────────────────
  trust1Title: "الدفع عند الاستلام",
  trust1Sub: "بدون دفع مسبق",
  trust2Title: "توصيل لجميع الولايات",
  trust2Sub: "58 ولاية",
  trust3Title: "تأكيد سريع",
  trust3Sub: "خلال 24 ساعة",

  // ── Hero CTAs ────────────────────────────────────────────────────────────
  heroCtaPrimary: "تسوق الآن",
  heroCtaSecondary: "عرض الأكثر مبيعاً",

  // ── Navigation ────────────────────────────────────────────────────────────
  navHome: "الرئيسية",
  navProducts: "المنتجات",
  navNewArrivals: "وصل حديثاً",
  navBestSellers: "الأكثر مبيعاً",
  navCategories: "الأقسام",

  // ── Section headings ──────────────────────────────────────────────────────
  categoriesSection: "تسوق حسب القسم",
  featuredSection: "منتجات مميزة",
  allProductsSection: "جميع المنتجات",
  bestSellersSection: "الأكثر مبيعاً",
  bestSellersSub: "الاختيار الأول لعملائنا",
  newArrivalsSection: "وصل حديثاً",
  newArrivalsSub: "منتجات جديدة أُضيفت مؤخراً",
  viewAllCta: "عرض الكل",

  // ── How It Works (COD trust) ────────────────────────────────────────────
  howItWorksTitle: "الدفع عند الاستلام — بسيط، آمن وموثوق",
  howItWorksSub: "اطلب اليوم، ادفع عند الوصول",
  howStep1Title: "قدّم طلبك",
  howStep1Sub: "اختر منتجاتك وأدخل بياناتك",
  howStep2Title: "التأكيد عبر واتساب",
  howStep2Sub: "فريقنا سيتواصل معك للتأكيد",
  howStep3Title: "ادفع عند الاستلام",
  howStep3Sub: "استلم طلبك وادفع لعامل التوصيل",

  // ── Features bar ────────────────────────────────────────────────────────
  feature1Title: "منتجات أصلية",
  feature2Title: "توصيل سريع",
  feature3Title: "الدفع عند الاستلام",
  feature5Title: "دعم على مدار الساعة",

  // ── Promo banner ────────────────────────────────────────────────────────
  promoTitle: "منتجات جديدة كل أسبوع",
  promoSub: "اكتشف آخر الوصولات والعروض الحصرية",
  promoCtaText: "تسوق الآن",

  // ── Testimonials ────────────────────────────────────────────────────────
  testimonialsTitle: "ماذا يقول عملاؤنا",
  testimonialsSub: "تقييمات حقيقية من عملاء حقيقيين",

  // ── Footer ──────────────────────────────────────────────────────────────
  footerAbout: "متجرك الموثوق عبر الإنترنت في الجزائر مع الدفع عند الاستلام",
  footerQuickLinks: "روابط سريعة",
  footerSupport: "خدمة العملاء",
  footerShipping: "معلومات الشحن",
  footerReturns: "الإرجاع والاستبدال",
  footerRights: "جميع الحقوق محفوظة",

  // ── Order form ────────────────────────────────────────────────────────────
  orderCta: "اطلب الآن",
  orderCtaSubtext: "الدفع عند الاستلام",
  formTitle: "أكمل طلبك",
  formDeliverySection: "معلومات التوصيل",
  formNameLabel: "الاسم الكامل",
  formNamePlaceholder: "مثال: أحمد بن علي",
  formPhoneLabel: "رقم الهاتف",
  formPhonePlaceholder: "0XX XX XX XX XX",
  formWilayaLabel: "الولاية",
  formWilayaPlaceholder: "اختر ولايتك",
  formCommuneLabel: "البلدية",
  formCommunePlaceholder: "اختر البلدية",
  formCommuneLoading: "جاري التحميل...",
  formCommuneDisabled: "اختر الولاية أولاً",
  formAddressLabel: "العنوان التفصيلي",
  formAddressPlaceholder: "الشارع، الحي، رقم المبنى...",
  formDeliveryLabel: "طريقة التوصيل",
  formHomeDelivery: "توصيل للمنزل",
  formStopDesk: "مكتب البريد",
  formNotesLabel: "ملاحظات",
  formNotesPlaceholder: "أي تفاصيل إضافية للتوصيل...",
  formSubmit: "تأكيد الطلب",
  formConfirmNote: "سيتصل بك فريقنا لتأكيد طلبك خلال 24 ساعة",

  // ── WhatsApp OTP verification ─────────────────────────────────────────────
  otpTitle: "تأكيد رقم الهاتف",
  otpSubtitle: "أرسلنا رمزاً من 6 أرقام إلى واتساب",
  otpInputLabel: "رمز التحقق",
  otpInputPlaceholder: "••••••",
  otpVerifyBtn: "تأكيد الرمز",
  otpVerifying: "جارٍ التحقق...",
  otpResendIn: "إعادة الإرسال بعد",
  otpResend: "إعادة إرسال الرمز",
  otpChangePhone: "تغيير رقم الهاتف",
  otpErrorWrong: "الرمز غير صحيح — تحقق من واتساب وأعد المحاولة",
  otpErrorAttempts: "المحاولات المتبقية:",
  otpErrorExpired: "انتهت صلاحية الرمز — اطلب رمزاً جديداً",
  otpErrorRate: "طلبت رموزاً كثيرة — انتظر قليلاً ثم أعد المحاولة",
  otpErrorGeneric: "تعذر إرسال الرمز — أعد المحاولة",

  // ── Order summary ─────────────────────────────────────────────────────────
  qtyLabel: "الكمية",
  qtyUnit: "قطعة",
  shippingLabel: "رسوم التوصيل",
  shippingCalculated: "يُحسب بعد اختيار الولاية",
  shippingFree: "مجاني",
  totalLabel: "المجموع الكلي",
  itemsLabel: "المنتجات",

  // ── Thank you page ────────────────────────────────────────────────────────
  thankYouTitle: "تم استلام طلبك!",
  thankYouSubtitle: "شكراً لثقتك — سنتواصل معك قريباً",
  orderNumberLabel: "رقم الطلب",
  totalAmountLabel: "المبلغ الإجمالي",
  codNote: "الدفع عند الاستلام — لا دفع مسبق مطلوب",
  step1Title: "تأكيد الطلب",
  step1Sub: "خلال 24 ساعة",
  step2Title: "التجهيز",
  step2Sub: "وتغليف المنتج",
  step3Title: "التوصيل",
  step3Sub: "لباب منزلك",
  backToStore: "العودة للمتجر",

  // ── Empty / error states ──────────────────────────────────────────────────
  noProductsTitle: "لا توجد منتجات في هذا القسم",
  noProductsSub: "تصفح قسماً آخر",
  emptyStoreTitle: "المتجر قيد التجهيز",
  emptyStoreSub: "سيتم إضافة المنتجات قريباً",
  productNotFoundTitle: "المنتج غير موجود",

  // ── Reviews ───────────────────────────────────────────────────────────────
  reviewsTitle: "تقييمات العملاء",
  reviewsNoReviews: "لا توجد تقييمات بعد",
  reviewsBeFirst: "كن أول من يقيّم هذا المنتج",
  reviewsVerifiedBuyer: "مشتري موثق",
  reviewFormTitle: "اكتب تقييمك",
  reviewFormOrderLabel: "رقم الطلب",
  reviewFormOrderPlaceholder: "مثال: ORD-20240101-0001",
  reviewFormOrderHelp: "ستجد رقم طلبك في رسالة التأكيد",
  reviewFormRatingLabel: "التقييم",
  reviewFormTitleLabel: "عنوان التقييم",
  reviewFormTitlePlaceholder: "ملخص تجربتك",
  reviewFormBodyLabel: "تفاصيل التقييم",
  reviewFormBodyPlaceholder: "شاركنا تجربتك مع هذا المنتج...",
  reviewFormSubmit: "إرسال التقييم",
  reviewFormSuccess: "شكراً! تم إرسال تقييمك وسيظهر بعد المراجعة.",
  reviewFormErrorDuplicate: "لقد أرسلت تقييماً لهذا الطلب مسبقاً.",
  reviewFormErrorInvalidOrder: "رقم الطلب غير صحيح. تأكد من رقم طلبك وأعد المحاولة.",
  reviewFormErrorGeneric: "حدث خطأ. يرجى المحاولة مجدداً.",

  // ── Offers ───────────────────────────────────────────────────────────────
  offerAutoApplied: "يُطبَّق تلقائياً عند تأكيد الطلب",
  offerFreeLabel: "مجاني",
  offerActive: "عرض قائم!",
  offerUnlocked: "تم فتح العرض!",
  offerAddMore: "أضف {n} وحدة للحصول على:",
  offerAddOne: "أضف وحدة أخرى للحصول على:",
  offerYouGet: "سيُضاف تلقائياً لطلبك",
  offerSectionTitle: "اختر كميتك",
  offerFreeShippingBadge: "شحن مجاني",
  offerBuyOne: "اشتري 1",
  offerFullPrice: "السعر الكامل",
  offerMostPopular: "الأكثر طلباً",

  // ── Misc ──────────────────────────────────────────────────────────────────
  breadcrumbHome: "الرئيسية",
  required: "*",
  viewProduct: "عرض المنتج",
  featured: "مميز",
  lowStock: "آخر {n} قطع",
  outOfStock: "نفد المخزون",
  qtyMaxStock: "آخر {n} قطعة فقط",
  freeShippingBadge: "شحن مجاني",
  searchLabel: "بحث...",
  noResultsLabel: "لا توجد نتائج مطابقة",
  loadMoreLabel: "عرض المزيد",
  allLabel: "الكل",
  productCountLabel: "منتج",
  reviewFormMinLengthError: "يرجى كتابة تقييم لا يقل عن 10 أحرف",
  reviewFormRatingRequired: "يرجى اختيار تقييم من 1 إلى 5 نجوم",
  offerSaveBadge: "وفر {n}%",
  offerSavingsText: "توفير {amount} {currency}",
  offerUnitLabel: "الوحدة {n}",
  ariaMainNavigation: "التنقل الرئيسي",
  ariaQuantity: "الكمية",
  ariaGoToImage: "الانتقال إلى الصورة {n} من {total}",
  ariaBrowseAllProducts: "تصفح جميع المنتجات",
  ariaBrowseCategoryProducts: "تصفح منتجات {category}",
  ariaProductCard: "{name} - {price} {currency}",
  ariaStarRating: "{n} نجمة",
  navContact: "اتصل بنا",
  thankYouPageTitle: "تم استلام طلبك",
  defaultMetaDescription: "تسوق من {storeName} - أفضل المنتجات بأسعار مناسبة مع توصيل لجميع الولايات",
};
