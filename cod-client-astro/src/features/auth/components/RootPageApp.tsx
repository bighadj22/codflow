import { useEffect, useState } from "react";
import { fetchIdentity } from "@/lib/session";
import { resolveGate } from "@/lib/gate";
import OrderDetailPageApp from "@/features/orders/components/OrderDetailPageApp";
import CustomerDetailPageApp from "@/features/customers/components/CustomerDetailPageApp";
import CustomerFormPageApp from "@/features/customers/components/CustomerFormPageApp";
import CustomerGroupDetailPageApp from "@/features/customer-groups/components/CustomerGroupDetailPageApp";
import CustomerGroupFormPageApp from "@/features/customer-groups/components/CustomerGroupFormPageApp";
import CustomerTagDetailPageApp from "@/features/customer-tags/components/CustomerTagDetailPageApp";
import CustomerTagFormPageApp from "@/features/customer-tags/components/CustomerTagFormPageApp";
import ProductDetailPageApp from "@/features/products/components/ProductDetailPageApp";
import ProductFormPageApp from "@/features/products/components/ProductFormPageApp";
import ProductGroupFormPageApp from "@/features/product-groups/components/ProductGroupFormPageApp";
import OfferFormPageApp from "@/features/offers/components/OfferFormPageApp";
import DriverProfilePageApp from "@/features/delivery/components/DriverProfilePageApp";
import DriverFormPageApp from "@/features/delivery/components/DriverFormPageApp";
import DriverCompensationsPageApp from "@/features/delivery/components/DriverCompensationsPageApp";
import CompanyProfilePageApp from "@/features/delivery/components/CompanyProfilePageApp";
import CompanyCredentialsPageApp from "@/features/delivery/components/CompanyCredentialsPageApp";
import CompanyStopDesksPageApp from "@/features/delivery/components/CompanyStopDesksPageApp";
import ShippingProfileDetailPageApp from "@/features/delivery/components/ShippingProfileDetailPageApp";
import ShippingProfileFormPageApp from "@/features/delivery/components/ShippingProfileFormPageApp";
import TeamMemberPageApp from "@/features/team/components/TeamMemberPageApp";
import { parseCustomerRoute } from "@/features/customers/model";
import { parseCustomerGroupRoute } from "@/features/customer-groups/model";
import { parseCustomerTagRoute } from "@/features/customer-tags/model";
import { parseProductRoute } from "@/features/products/model";
import { parseProductGroupRoute } from "@/features/product-groups/model";
import { parseOfferRoute } from "@/features/offers/model";
import { parseDriverRoute, parseDeliveryCompanyRoute, parseShippingProfileRoute } from "@/features/delivery/model";
import { parseTeamRoute } from "@/features/team/model";

/** Public root: routes visitors to the dashboard or sign-in. Silent. */
export function RootGate() {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  const [done, setDone] = useState(false);
  const customerRoute = parseCustomerRoute(pathname);
  const customerGroupRoute = parseCustomerGroupRoute(pathname);
  const customerTagRoute = parseCustomerTagRoute(pathname);
  const productRoute = parseProductRoute(pathname);
  const productGroupRoute = parseProductGroupRoute(pathname);
  const offerRoute = parseOfferRoute(pathname);
  const driverRoute = parseDriverRoute(pathname);
  const companyRoute = parseDeliveryCompanyRoute(pathname);
  const shippingProfileRoute = parseShippingProfileRoute(pathname);
  const teamRoute = parseTeamRoute(pathname);
  const orderId = pathname.startsWith("/orders/") && pathname !== "/orders/new" && pathname !== "/orders/abandoned"
    ? pathname.slice("/orders/".length)
    : null;
  const dynamicRoute = orderId || customerRoute.kind === "detail" || customerRoute.kind === "edit" || customerGroupRoute.kind === "detail" || customerGroupRoute.kind === "edit" || customerTagRoute.kind === "detail" || customerTagRoute.kind === "edit" || productRoute.kind === "detail" || productRoute.kind === "edit" || productGroupRoute.kind === "edit" || offerRoute.kind === "edit" || driverRoute.kind === "detail" || driverRoute.kind === "edit" || driverRoute.kind === "compensations" || companyRoute.kind === "detail" || companyRoute.kind === "credentials" || companyRoute.kind === "stopDesks" || shippingProfileRoute.kind === "detail" || shippingProfileRoute.kind === "edit" || teamRoute.kind === "detail";

  useEffect(() => {
    if (dynamicRoute) return;
    let alive = true;
    fetchIdentity().then((id) => {
      if (!alive) return;
      setDone(true);
       window.location.replace(resolveGate(id) === "authenticated" ? "/dashboard" : "/sign-in");
    });
    return () => {
      alive = false;
    };
  }, [dynamicRoute]);

  if (orderId) return <OrderDetailPageApp orderId={orderId} />;
  if (customerRoute.kind === "detail") return <CustomerDetailPageApp customerId={customerRoute.id} />;
  if (customerRoute.kind === "edit") return <CustomerFormPageApp customerId={customerRoute.id} />;
  if (customerGroupRoute.kind === "detail") return <CustomerGroupDetailPageApp groupId={customerGroupRoute.id} />;
  if (customerGroupRoute.kind === "edit") return <CustomerGroupFormPageApp groupId={customerGroupRoute.id} />;
  if (customerTagRoute.kind === "detail") return <CustomerTagDetailPageApp tagId={customerTagRoute.id} />;
  if (customerTagRoute.kind === "edit") return <CustomerTagFormPageApp tagId={customerTagRoute.id} />;
  if (productRoute.kind === "detail") return <ProductDetailPageApp productId={productRoute.id} />;
  if (productRoute.kind === "edit") return <ProductFormPageApp productId={productRoute.id} />;
  if (productGroupRoute.kind === "edit") return <ProductGroupFormPageApp groupId={productGroupRoute.id} />;
  if (offerRoute.kind === "edit") return <OfferFormPageApp offerId={offerRoute.id} />;
  if (driverRoute.kind === "detail") return <DriverProfilePageApp driverId={driverRoute.id} />;
  if (driverRoute.kind === "edit") return <DriverFormPageApp driverId={driverRoute.id} />;
  if (driverRoute.kind === "compensations") return <DriverCompensationsPageApp driverId={driverRoute.id} />;
  if (companyRoute.kind === "detail") return <CompanyProfilePageApp providerCode={companyRoute.code} />;
  if (companyRoute.kind === "credentials") return <CompanyCredentialsPageApp providerCode={companyRoute.code} />;
  if (companyRoute.kind === "stopDesks") return <CompanyStopDesksPageApp providerCode={companyRoute.code} />;
  if (shippingProfileRoute.kind === "detail") return <ShippingProfileDetailPageApp profileId={shippingProfileRoute.id} />;
  if (shippingProfileRoute.kind === "edit") return <ShippingProfileFormPageApp profileId={shippingProfileRoute.id} />;
  if (teamRoute.kind === "detail") return <TeamMemberPageApp memberId={teamRoute.id} />;
  return (
    <div data-auth-state={done ? "routing" : "pending"} className="flex justify-center py-24" aria-busy="true">
      <span className="font-display text-2xl font-bold tracking-tight text-foreground">CodFlow</span>
    </div>
  );
}
