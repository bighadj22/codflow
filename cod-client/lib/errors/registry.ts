/**
 * Error Message Registry
 * 
 * Centralized mapping of error codes to localized user messages.
 * Supports English (en) and Arabic (ar) with placeholder interpolation.
 */

import { ERROR_CODES } from "@/../cod-shared/errors/codes";

export interface ErrorMessage {
  en: string;
  ar: string;
  fr?: string;
}

/**
 * Error message registry mapping error codes to localized messages.
 * Messages support placeholder syntax: {{variableName}}
 */
export const ERROR_REGISTRY: Record<string, ErrorMessage> = {
  // ============================================================================
  // VALIDATION ERRORS
  // ============================================================================
  [ERROR_CODES.VALIDATION_FAILED]: {
    en: "Please check your input and try again",
    ar: "يرجى التحقق من المدخلات والمحاولة مرة أخرى",
    fr: "Veuillez vérifier vos saisies et réessayer",
  },
  [ERROR_CODES.REQUIRED_FIELD_MISSING]: {
    en: "{{fieldName}} is required",
    ar: "{{fieldName}} مطلوب",
  },
  [ERROR_CODES.INVALID_FORMAT]: {
    en: "{{fieldName}} has an invalid format",
    ar: "{{fieldName}} له تنسيق غير صالح",
  },
  [ERROR_CODES.VALUE_OUT_OF_RANGE]: {
    en: "{{fieldName}} value is out of range",
    ar: "قيمة {{fieldName}} خارج النطاق المسموح",
  },
  [ERROR_CODES.INVALID_UUID]: {
    en: "Invalid ID format",
    ar: "تنسيق المعرف غير صالح",
  },
  [ERROR_CODES.INVALID_EMAIL_FORMAT]: {
    en: "Invalid email format",
    ar: "تنسيق البريد الإلكتروني غير صالح",
  },
  [ERROR_CODES.INVALID_PHONE_FORMAT]: {
    en: "Invalid phone number format",
    ar: "تنسيق رقم الهاتف غير صالح",
  },

  // ============================================================================
  // AUTHENTICATION ERRORS
  // ============================================================================
  [ERROR_CODES.MISSING_API_KEY]: {
    en: "API key is missing. Please provide a valid API key.",
    ar: "مفتاح API مفقود. يرجى تقديم مفتاح API صالح.",
    fr: "La clé API est manquante. Veuillez fournir une clé API valide.",
  },
  [ERROR_CODES.INVALID_API_KEY]: {
    en: "Invalid API key. Please check your credentials.",
    ar: "مفتاح API غير صالح. يرجى التحقق من بيانات الاعتماد الخاصة بك.",
  },
  [ERROR_CODES.AUTHENTICATION_FAILED]: {
    en: "Authentication failed. Please sign in again.",
    ar: "فشلت المصادقة. يرجى تسجيل الدخول مرة أخرى.",
    fr: "Échec de l'authentification. Veuillez vous reconnecter.",
  },
  [ERROR_CODES.USER_INACTIVE]: {
    en: "Your account is inactive. Please contact an administrator.",
    ar: "حسابك غير نشط. يرجى الاتصال بالمسؤول.",
    fr: "Votre compte est inactif. Veuillez contacter un administrateur.",
  },
  [ERROR_CODES.PERMISSION_DENIED]: {
    en: "You don't have permission to perform this action",
    ar: "ليس لديك إذن لتنفيذ هذا الإجراء",
    fr: "Vous n'avez pas la permission d'effectuer cette action",
  },
  [ERROR_CODES.SESSION_EXPIRED]: {
    en: "Your session has expired. Please sign in again.",
    ar: "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.",
  },
  [ERROR_CODES.UNAUTHORIZED]: {
    en: "You are not authorized to access this resource",
    ar: "غير مصرح لك بالوصول إلى هذا المورد",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - GENERAL
  // ============================================================================
  [ERROR_CODES.ENTITY_NOT_FOUND]: {
    en: "The requested resource was not found",
    ar: "المورد المطلوب غير موجود",
  },
  [ERROR_CODES.DUPLICATE_ENTITY]: {
    en: "This record already exists",
    ar: "هذا السجل موجود بالفعل",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - CUSTOMERS
  // ============================================================================
  [ERROR_CODES.CUSTOMER_NOT_FOUND]: {
    en: "Customer not found",
    ar: "العميل غير موجود",
  },
  [ERROR_CODES.CUSTOMER_HAS_ORDERS]: {
    en: "Cannot delete customer with existing orders. Archive the customer instead.",
    ar: "لا يمكن حذف عميل لديه طلبات موجودة. قم بأرشفة العميل بدلاً من ذلك.",
  },
  [ERROR_CODES.DUPLICATE_PHONE]: {
    en: "This phone number is already registered",
    ar: "رقم الهاتف هذا مسجل بالفعل",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - ORDERS
  // ============================================================================
  [ERROR_CODES.ORDER_NOT_FOUND]: {
    en: "Order not found",
    ar: "الطلب غير موجود",
    fr: "Commande introuvable",
  },
  [ERROR_CODES.ORDER_ALREADY_DISPATCHED]: {
    en: "This order is already dispatched to a delivery company (tracking: {{trackingNumber}}). Driver assignment is not allowed.",
    ar: "تم إرسال هذا الطلب بالفعل إلى شركة التوصيل (رقم التتبع: {{trackingNumber}}). لا يُسمح بتعيين سائق.",
    fr: "Cette commande est déjà expédiée (suivi: {{trackingNumber}}). L'assignation d'un livreur n'est pas autorisée.",
  },
  [ERROR_CODES.DRIVER_ALREADY_ASSIGNED]: {
    en: "Order is already assigned to driver {{driverName}}. Remove the driver assignment first.",
    ar: "الطلب مُعيّن بالفعل للسائق {{driverName}}. قم بإزالة تعيين السائق أولاً.",
    fr: "La commande est déjà assignée au livreur {{driverName}}. Retirez d'abord l'assignation.",
  },
  [ERROR_CODES.INVALID_STATUS_TRANSITION]: {
    en: "Cannot change order status from {{currentStatus}} to {{targetStatus}}",
    ar: "لا يمكن تغيير حالة الطلب من {{currentStatus}} إلى {{targetStatus}}",
    fr: "Impossible de changer le statut de {{currentStatus}} à {{targetStatus}}",
  },
  [ERROR_CODES.MISSING_WILAYA_COMMUNE]: {
    en: "Wilaya and commune are required for dispatch",
    ar: "الولاية والبلدية مطلوبة للإرسال",
  },
  [ERROR_CODES.MISSING_STATION_CODE]: {
    en: "Station code is required for stop-desk orders",
    ar: "رمز المحطة مطلوب لطلبات المكتب",
  },
  [ERROR_CODES.INSUFFICIENT_STOCK]: {
    en: "Insufficient stock for {{productName}}. Available: {{available}}, Required: {{required}}",
    ar: "مخزون غير كافٍ لـ {{productName}}. المتاح: {{available}}، المطلوب: {{required}}",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - PRODUCTS
  // ============================================================================
  [ERROR_CODES.PRODUCT_NOT_FOUND]: {
    en: "Product not found",
    ar: "المنتج غير موجود",
  },
  [ERROR_CODES.PRODUCT_HAS_ORDERS]: {
    en: "Cannot delete product with existing orders. Archive the product instead.",
    ar: "لا يمكن حذف منتج لديه طلبات موجودة. قم بأرشفة المنتج بدلاً من ذلك.",
  },
  [ERROR_CODES.DUPLICATE_SKU]: {
    en: "This SKU already exists",
    ar: "رمز المنتج (SKU) موجود بالفعل",
  },
  [ERROR_CODES.VARIANT_NOT_FOUND]: {
    en: "Product variant not found",
    ar: "نوع المنتج غير موجود",
  },
  [ERROR_CODES.VARIANT_HAS_ORDERS]: {
    en: "Cannot delete variant with existing orders",
    ar: "لا يمكن حذف نوع المنتج لديه طلبات موجودة",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - DRIVERS
  // ============================================================================
  [ERROR_CODES.DRIVER_NOT_FOUND]: {
    en: "Driver not found",
    ar: "السائق غير موجود",
    fr: "Livreur introuvable",
  },
  [ERROR_CODES.DRIVER_HAS_ACTIVE_ORDERS]: {
    en: "Cannot delete driver with active orders. Complete or reassign the orders first.",
    ar: "لا يمكن حذف سائق لديه طلبات نشطة. أكمل الطلبات أو أعد تعيينها أولاً.",
    fr: "Impossible de supprimer un livreur avec des commandes actives. Terminez ou réassignez d'abord les commandes.",
  },
  [ERROR_CODES.DRIVER_UNAVAILABLE]: {
    en: "Driver is not available for assignment",
    ar: "السائق غير متاح للتعيين",
    fr: "Le livreur n'est pas disponible pour une assignation",
  },
  [ERROR_CODES.DRIVER_COMPENSATION_NOT_FOUND]: {
    en: "No compensation row is configured for this driver in this wilaya",
    ar: "لا يوجد صف تعويض مُعد لهذا السائق في هذه الولاية",
    fr: "Aucune grille de rémunération n'est configurée pour ce livreur dans cette wilaya",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - DELIVERY COMPANIES
  // ============================================================================
  [ERROR_CODES.COMPANY_NOT_FOUND]: {
    en: "Delivery company not found",
    ar: "شركة التوصيل غير موجودة",
  },
  [ERROR_CODES.COMPANY_INACTIVE]: {
    en: "This delivery company is not active",
    ar: "شركة التوصيل هذه غير نشطة",
  },
  [ERROR_CODES.PROVIDER_NOT_SUPPORTED]: {
    en: "Delivery provider {{provider}} is not supported",
    ar: "مزود التوصيل {{provider}} غير مدعوم",
  },
  [ERROR_CODES.MISSING_API_CREDENTIALS]: {
    en: "API credentials are not configured for this delivery company",
    ar: "بيانات اعتماد API غير مكونة لشركة التوصيل هذه",
  },
  [ERROR_CODES.SHIPMENT_CREATION_FAILED]: {
    en: "Failed to create shipment with delivery company",
    ar: "فشل إنشاء الشحنة مع شركة التوصيل",
  },
  [ERROR_CODES.SHIPMENT_VALIDATION_FAILED]: {
    en: "Shipment validation failed. Please check the order details.",
    ar: "فشل التحقق من الشحنة. يرجى التحقق من تفاصيل الطلب.",
  },
  [ERROR_CODES.SHIPMENT_UPDATE_FAILED]: {
    en: "Failed to update shipment with delivery company",
    ar: "فشل تحديث الشحنة لدى شركة التوصيل",
    fr: "Échec de la mise à jour de l'expédition auprès du transporteur",
  },
  [ERROR_CODES.SHIPMENT_CANCEL_FAILED]: {
    en: "Failed to cancel shipment with delivery company",
    ar: "فشل إلغاء الشحنة لدى شركة التوصيل",
    fr: "Échec de l'annulation de l'expédition auprès du transporteur",
  },
  [ERROR_CODES.SHIPMENT_NOT_FOUND]: {
    en: "Shipment not found",
    ar: "الشحنة غير موجودة",
    fr: "Expédition introuvable",
  },
  [ERROR_CODES.OPERATION_NOT_SUPPORTED]: {
    en: "This operation is not supported by the delivery provider",
    ar: "هذه العملية غير مدعومة من قبل شركة التوصيل",
    fr: "Cette opération n'est pas prise en charge par le transporteur",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - STOCK
  // ============================================================================
  [ERROR_CODES.STOCK_RECORD_NOT_FOUND]: {
    en: "Stock record not found",
    ar: "سجل المخزون غير موجود",
  },
  [ERROR_CODES.NEGATIVE_STOCK_NOT_ALLOWED]: {
    en: "Stock quantity cannot be negative",
    ar: "لا يمكن أن تكون كمية المخزون سالبة",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - CUSTOMER GROUPS
  // ============================================================================
  [ERROR_CODES.GROUP_NOT_FOUND]: {
    en: "Customer group not found",
    ar: "مجموعة العملاء غير موجودة",
  },
  [ERROR_CODES.GROUP_HAS_MEMBERS]: {
    en: "Cannot delete group with members. Remove all members first.",
    ar: "لا يمكن حذف مجموعة تحتوي على أعضاء. قم بإزالة جميع الأعضاء أولاً.",
  },
  [ERROR_CODES.DUPLICATE_GROUP_NAME]: {
    en: "A group with this name already exists",
    ar: "مجموعة بهذا الاسم موجودة بالفعل",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - CUSTOMER TAGS
  // ============================================================================
  [ERROR_CODES.TAG_NOT_FOUND]: {
    en: "Customer tag not found",
    ar: "وسم العميل غير موجود",
  },
  [ERROR_CODES.TAG_HAS_ASSIGNMENTS]: {
    en: "Cannot delete tag with assignments. Remove all assignments first.",
    ar: "لا يمكن حذف وسم له تعيينات. قم بإزالة جميع التعيينات أولاً.",
  },
  [ERROR_CODES.DUPLICATE_TAG_NAME]: {
    en: "A tag with this name already exists",
    ar: "وسم بهذا الاسم موجود بالفعل",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - USERS
  // ============================================================================
  [ERROR_CODES.USER_NOT_FOUND]: {
    en: "User not found",
    ar: "المستخدم غير موجود",
  },
  [ERROR_CODES.DUPLICATE_EMAIL]: {
    en: "This email address is already registered",
    ar: "عنوان البريد الإلكتروني هذا مسجل بالفعل",
  },
  [ERROR_CODES.INVALID_ROLE]: {
    en: "Invalid user role",
    ar: "دور المستخدم غير صالح",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - OFFERS
  // ============================================================================
  [ERROR_CODES.OFFER_NOT_FOUND]: {
    en: "Offer not found",
    ar: "العرض غير موجود",
  },
  [ERROR_CODES.OFFER_EXPIRED]: {
    en: "This offer has expired",
    ar: "انتهت صلاحية هذا العرض",
  },
  [ERROR_CODES.OFFER_NOT_ACTIVE]: {
    en: "This offer is not currently active",
    ar: "هذا العرض غير نشط حالياً",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - REVIEWS
  // ============================================================================
  [ERROR_CODES.REVIEW_NOT_FOUND]: {
    en: "Review not found",
    ar: "المراجعة غير موجودة",
  },
  [ERROR_CODES.ORDER_ALREADY_REVIEWED]: {
    en: "This order has already been reviewed",
    ar: "تمت مراجعة هذا الطلب بالفعل",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - SHIPPING PROFILES
  // ============================================================================
  [ERROR_CODES.PROFILE_NOT_FOUND]: {
    en: "Shipping profile not found",
    ar: "ملف الشحن غير موجود",
    fr: "Profil d'expédition introuvable",
  },
  [ERROR_CODES.SHIPPING_PROFILE_NOT_FOUND]: {
    en: "Shipping profile not found",
    ar: "ملف الشحن غير موجود",
    fr: "Profil d'expédition introuvable",
  },
  [ERROR_CODES.SHIPPING_RULE_NOT_FOUND]: {
    en: "No shipping rule configured for this wilaya",
    ar: "لا توجد قاعدة شحن مهيأة لهذه الولاية",
    fr: "Aucune règle d'expédition configurée pour cette wilaya",
  },
  [ERROR_CODES.COMMUNE_OVERRIDE_NOT_FOUND]: {
    en: "No override configured for this commune",
    ar: "لا يوجد تجاوز مهيأ لهذه البلدية",
    fr: "Aucun remplacement configuré pour cette commune",
  },
  [ERROR_CODES.PROFILE_IN_USE]: {
    en: "Cannot delete shipping profile that is in use by products",
    ar: "لا يمكن حذف ملف الشحن المستخدم من قبل المنتجات",
    fr: "Impossible de supprimer un profil d'expédition utilisé par des produits",
  },
  [ERROR_CODES.DEFAULT_PROFILE_REQUIRED]: {
    en: "At least one shipping profile must be set as default",
    ar: "يجب أن يكون على الأقل ملف شحن واحد افتراضيًا",
    fr: "Au moins un profil d'expédition doit être défini par défaut",
  },
  [ERROR_CODES.DUPLICATE_WILAYA_RULE]: {
    en: "Duplicate wilaya in rules — each wilaya may appear only once",
    ar: "ولاية مكررة في القواعد — يمكن أن تظهر كل ولاية مرة واحدة فقط",
    fr: "Wilaya en double dans les règles — chaque wilaya ne peut apparaître qu'une seule fois",
  },
  [ERROR_CODES.DELIVERY_NOT_AVAILABLE]: {
    en: "Delivery is not available for the selected location",
    ar: "التوصيل غير متاح للموقع المحدد",
    fr: "La livraison n'est pas disponible pour la localisation sélectionnée",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - PRODUCT GROUPS
  // ============================================================================
  [ERROR_CODES.PRODUCT_GROUP_NOT_FOUND]: {
    en: "Product group not found",
    ar: "مجموعة المنتجات غير موجودة",
  },
  [ERROR_CODES.PRODUCT_GROUP_HAS_PRODUCTS]: {
    en: "Cannot delete product group with products. Remove all products first.",
    ar: "لا يمكن حذف مجموعة منتجات تحتوي على منتجات. قم بإزالة جميع المنتجات أولاً.",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - WILAYAS
  // ============================================================================
  [ERROR_CODES.WILAYA_NOT_FOUND]: {
    en: "Wilaya not found",
    ar: "الولاية غير موجودة",
  },
  [ERROR_CODES.COMMUNE_NOT_FOUND]: {
    en: "Commune not found",
    ar: "البلدية غير موجودة",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - STORES
  // ============================================================================
  [ERROR_CODES.STORE_NOT_FOUND]: {
    en: "Store not found",
    ar: "المتجر غير موجود",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - IMAGES
  // ============================================================================
  [ERROR_CODES.IMAGE_NOT_FOUND]: {
    en: "Image not found",
    ar: "الصورة غير موجودة",
  },
  [ERROR_CODES.INVALID_FILE_TYPE]: {
    en: "Invalid file type. Please upload an image file.",
    ar: "نوع الملف غير صالح. يرجى تحميل ملف صورة.",
  },
  [ERROR_CODES.FILE_TOO_LARGE]: {
    en: "File size exceeds the maximum limit of {{maxSize}}",
    ar: "حجم الملف يتجاوز الحد الأقصى {{maxSize}}",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - WEBHOOKS
  // ============================================================================
  [ERROR_CODES.INVALID_WEBHOOK_PAYLOAD]: {
    en: "Invalid webhook payload",
    ar: "حمولة الويب هوك غير صالحة",
  },
  [ERROR_CODES.WEBHOOK_PROCESSING_FAILED]: {
    en: "Failed to process webhook",
    ar: "فشل معالجة الويب هوك",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - PAYMENTS
  // ============================================================================
  [ERROR_CODES.PAYMENT_NOT_FOUND]: {
    en: "Payment record not found",
    ar: "سجل الدفع غير موجود",
    fr: "Enregistrement de paiement introuvable",
  },
  [ERROR_CODES.PAYMENT_ALREADY_SETTLED]: {
    en: "{{settledCount}} order(s) are already settled for this payment type. Remove them from your selection and retry.",
    ar: "{{settledCount}} طلب(طلبات) تمت تسويته بالفعل لهذا النوع من الدفع. قم بإزالتها من التحديد وحاول مرة أخرى.",
    fr: "{{settledCount}} commande(s) sont déjà réglées pour ce type de paiement. Retirez-les de votre sélection et réessayez.",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - MCP MANAGEMENT
  // ============================================================================
  [ERROR_CODES.MCP_CONNECTION_NOT_FOUND]: {
    en: "MCP connection not found",
    ar: "اتصال MCP غير موجود",
    fr: "Connexion MCP introuvable",
  },
  [ERROR_CODES.MCP_CLIENT_NOT_FOUND]: {
    en: "MCP client not found",
    ar: "عميل MCP غير موجود",
    fr: "Client MCP introuvable",
  },

  // ============================================================================
  // BUSINESS LOGIC ERRORS - STOREFRONT OTP VERIFICATION (dzverify)
  // ============================================================================
  [ERROR_CODES.OTP_NOT_ENABLED]: {
    en: "Phone verification is not enabled for this store",
    ar: "التحقق من رقم الهاتف غير مفعّل لهذا المتجر",
    fr: "La vérification par téléphone n'est pas activée pour ce magasin",
  },
  [ERROR_CODES.OTP_VERIFICATION_REQUIRED]: {
    en: "Please verify your phone number before placing the order",
    ar: "يرجى التحقق من رقم هاتفك قبل إتمام الطلب",
    fr: "Veuillez vérifier votre numéro de téléphone avant de passer la commande",
  },
  [ERROR_CODES.OTP_TOKEN_INVALID]: {
    en: "Phone verification expired. Please verify again.",
    ar: "انتهت صلاحية التحقق من الهاتف. يرجى التحقق مرة أخرى.",
    fr: "La vérification du téléphone a expiré. Veuillez vérifier à nouveau.",
  },
  [ERROR_CODES.OTP_PHONE_MISMATCH]: {
    en: "The verified phone number does not match the order phone number",
    ar: "رقم الهاتف المُتحقق منه لا يطابق رقم هاتف الطلب",
    fr: "Le numéro de téléphone vérifié ne correspond pas à celui de la commande",
  },
  [ERROR_CODES.OTP_QUOTA_EXHAUSTED]: {
    en: "Phone verification service is out of credits. Your order was placed without verification.",
    ar: "خدمة التحقق من الهاتف نفدت أرصدتها. تم تسجيل طلبك دون تحقق.",
    fr: "Le service de vérification n'a plus de crédit. Votre commande a été enregistrée sans vérification.",
  },
  [ERROR_CODES.OTP_RATE_LIMITED]: {
    en: "Too many verification requests. Please wait and try again.",
    ar: "طلبات تحقق كثيرة جداً. يرجى الانتظار والمحاولة مرة أخرى.",
    fr: "Trop de demandes de vérification. Veuillez patienter et réessayer.",
  },

  // ============================================================================
  // SYSTEM ERRORS
  // ============================================================================
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: {
    en: "An unexpected error occurred. Please try again later.",
    ar: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً.",
    fr: "Une erreur inattendue est survenue. Veuillez réessayer plus tard.",
  },
  [ERROR_CODES.DATABASE_ERROR]: {
    en: "Database error. Please contact support if this persists.",
    ar: "خطأ في قاعدة البيانات. يرجى الاتصال بالدعم إذا استمر هذا.",
  },
  [ERROR_CODES.EXTERNAL_API_FAILURE]: {
    en: "Failed to connect to {{provider}}. Please try again later.",
    ar: "فشل الاتصال بـ {{provider}}. يرجى المحاولة مرة أخرى لاحقاً.",
  },
  [ERROR_CODES.NETWORK_TIMEOUT]: {
    en: "Request timed out. Check your internet connection and try again.",
    ar: "انتهت مهلة الطلب. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.",
  },
  [ERROR_CODES.SERVICE_UNAVAILABLE]: {
    en: "Service is temporarily unavailable. Please try again later.",
    ar: "الخدمة غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى لاحقاً.",
  },
};

/**
 * Fallback error message for unknown error codes
 */
export const FALLBACK_ERROR_MESSAGE: ErrorMessage = {
  en: "An error occurred. Please try again.",
  ar: "حدث خطأ. يرجى المحاولة مرة أخرى.",
  fr: "Une erreur est survenue. Veuillez réessayer.",
};
