// Centralized type exports
// All types are organized by domain in separate files

// Customer types
export type { Customer, CustomerFormState } from "./customer.types";

// Order types
export type {
  Order,
  OrderStatus,
  OrderType,
  StatusHistoryItem,
  OrderProduct,
  OrderFormState,
} from "./order.types";

// Product types
export type {
  ProductType,
  ProductStatus,
  ProductCategory,
  VariantOption,
  VariantOptionValue,
  ProductVariant,
  Product,
  ProductImage,
  ProductFormState,
  VariantOptionFormState,
  VariantOptionValueFormState,
} from "./product.types";

// Driver types
export type { Driver, DriverCompensation, DriverStatus, VehicleType, DriverPayment, DriverPaymentType } from "./driver.types";

// Delivery types
export type {
  Wilaya,
  Commune,
  DeliveryCompany,
  DeliveryType,
  CompanyShipment,
  StopDesk,
} from "./delivery.types";

// Team types
export type { TeamMember, TeamRole } from "./team.types";

// Shipping types
export type { ShippingRule, ShippingProfile, ShippingProfileWithRules, CommuneOverride } from "./shipping.types";

// Customer Group types
export type {
  CustomerGroup,
  CustomerGroupMember,
  CustomerGroupWithMembers,
  CustomerGroupSummary,
} from "./customer-group.types";

// Customer Tag types
export type {
  CustomerTag,
  CustomerTagAssigned,
  CustomerTagWithCustomers,
  CustomerTagSummary,
} from "./customer-tag.types";

