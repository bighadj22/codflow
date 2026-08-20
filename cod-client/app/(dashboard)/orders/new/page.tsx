
import { OrderFormPage } from "@/components/orders/order-form-page";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { getCustomers } from "@/actions/customers";
import { getProducts } from "@/actions/products";
import { getDefaultShippingRules } from "@/actions/shipping-profiles";
import { getWilayas } from "@/actions/wilayas";

export default async function NewOrderPage() {
  const [customersResult, productsResult, shippingResult, wilayasResult] = await Promise.allSettled([
    getCustomers(),
    getProducts({ status: "ACTIVE" }),
    getDefaultShippingRules(),
    getWilayas(),
  ]);

  const customers =
    customersResult.status === "fulfilled" ? customersResult.value : [];
  const products =
    productsResult.status === "fulfilled" ? productsResult.value : [];
  const shippingRules =
    shippingResult.status === "fulfilled" ? shippingResult.value : [];
  const wilayas =
    wilayasResult.status === "fulfilled" ? wilayasResult.value : [];

  return (
    <ProtectedRoute requiredScope={SCOPES.ORDERS_CREATE}>
      <OrderFormPage
        customers={customers}
        products={products}
        shippingRules={shippingRules}
        wilayas={wilayas}
      />
    </ProtectedRoute>
  );
}
