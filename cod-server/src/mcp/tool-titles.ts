/**
 * Human-readable tool titles — what ChatGPT's UI displays next to each tool
 * (instead of the snake_case identifier). Pure presentation; one entry per
 * registered tool. Coverage is enforced by tests against TOOL_NAMES so a new
 * tool without a title fails CI.
 */

export const TOOL_TITLES: Record<string, string> = {
  // ─── Customers ────────────────────────────────────────────────────────────
  listCustomers: "List customers",
  getCustomerDetails: "Get customer details",
  findCustomerByPhone: "Find customer by phone",
  getCustomerOrderHistory: "Get customer order history",
  getCustomerMemberships: "Get customer memberships",
  createNewCustomer: "Create customer",
  updateCustomerProfile: "Update customer profile",
  deleteCustomer: "Delete customer",

  // ─── Drivers ──────────────────────────────────────────────────────────────
  listDrivers: "List drivers",
  getDriverDetails: "Get driver details",
  createNewDriver: "Create driver",
  updateDriverProfile: "Update driver profile",
  updateDriverStatus: "Update driver status",
  deleteDriver: "Delete driver",

  // ─── Driver payments ──────────────────────────────────────────────────────
  listDriverPayments: "List driver payments",
  getPendingSettlements: "Get pending settlements",
  createDriverSettlement: "Create driver settlement",

  // ─── Products ─────────────────────────────────────────────────────────────
  listProducts: "List products",
  getProductDetails: "Get product details",
  createNewProduct: "Create product",
  updateProductDetails: "Update product details",
  updateProductStatus: "Update product status",
  deleteProduct: "Delete product",

  // ─── Product groups ───────────────────────────────────────────────────────
  listProductGroups: "List product groups",
  getProductGroupDetails: "Get product group details",
  createProductGroup: "Create product group",
  updateProductGroup: "Update product group",
  deleteProductGroup: "Delete product group",

  // ─── Offers ───────────────────────────────────────────────────────────────
  listOffers: "List offers",
  getOfferDetails: "Get offer details",
  createOffer: "Create offer",
  updateOffer: "Update offer",
  deleteOffer: "Delete offer",

  // ─── Landing pages ────────────────────────────────────────────────────────
  listLandingPages: "List landing pages",
  getLandingPageDetails: "Get landing page details",
  getLandingPageStats: "Get landing page stats",
  createLandingPage: "Create landing page",
  updateLandingPage: "Update landing page",
  publishLandingPage: "Publish landing page",
  unpublishLandingPage: "Unpublish landing page",
  archiveLandingPage: "Archive landing page",
  duplicateLandingPage: "Duplicate landing page",
  deleteLandingPage: "Delete landing page",
  uploadLandingPageImage: "Upload landing page image",
  getLandingPageImageUploadStatus: "Get image upload status",
  removeLandingPageImage: "Remove landing page image",
  reorderLandingPageImages: "Reorder landing page images",

  // ─── Variants ─────────────────────────────────────────────────────────────
  listProductVariants: "List product variants",
  getVariantDetails: "Get variant details",
  createProductVariant: "Create product variant",
  updateVariant: "Update variant",
  deleteProductVariant: "Delete product variant",

  // ─── Wilayas ──────────────────────────────────────────────────────────────
  listWilayas: "List wilayas",
  listWilayaCommunes: "List wilaya communes",

  // ─── Stock ────────────────────────────────────────────────────────────────
  getStockOverview: "Get stock overview",
  getStockAlerts: "Get stock alerts",
  getProductStockHistory: "Get product stock history",
  adjustProductStock: "Adjust product stock",
  adjustVariantStock: "Adjust variant stock",
  updateProductStockThreshold: "Update product stock threshold",
  updateVariantStockThreshold: "Update variant stock threshold",

  // ─── Shipping profiles ────────────────────────────────────────────────────
  listShippingProfiles: "List shipping profiles",
  getShippingProfile: "Get shipping profile",
  getDefaultShippingRules: "Get default shipping rules",
  createShippingProfile: "Create shipping profile",
  updateShippingProfile: "Update shipping profile",
  deleteShippingProfile: "Delete shipping profile",
  setShippingProfileRules: "Set shipping profile rules",
  listCommuneOverrides: "List commune overrides",
  setShippingCommuneOverride: "Set commune override",
  resetShippingCommuneOverride: "Reset commune override",

  // ─── Reviews ──────────────────────────────────────────────────────────────
  listReviews: "List reviews",
  moderateReview: "Moderate review",
  deleteReview: "Delete review",

  // ─── Customer groups ──────────────────────────────────────────────────────
  listCustomerGroups: "List customer groups",
  getCustomerGroupDetails: "Get customer group details",
  createCustomerGroup: "Create customer group",
  updateCustomerGroup: "Update customer group",
  deleteCustomerGroup: "Delete customer group",
  addCustomerToGroup: "Add customer to group",
  removeCustomerFromGroup: "Remove customer from group",

  // ─── Customer tags ────────────────────────────────────────────────────────
  listCustomerTags: "List customer tags",
  getCustomerTagDetails: "Get customer tag details",
  createCustomerTag: "Create customer tag",
  updateCustomerTag: "Update customer tag",
  deleteCustomerTag: "Delete customer tag",
  assignTagToCustomer: "Assign tag to customer",
  unassignTagFromCustomer: "Unassign tag from customer",

  // ─── Orders ───────────────────────────────────────────────────────────────
  listOrders: "List orders",
  getOrderDetails: "Get order details",
  createOrder: "Create order",
  updateOrderStatus: "Update order status",
  assignDriverToOrder: "Assign driver to order",
  unassignDriverFromOrder: "Unassign driver from order",
  recordOrderProductReturn: "Record order product return",
  deleteOrder: "Delete order",
};
