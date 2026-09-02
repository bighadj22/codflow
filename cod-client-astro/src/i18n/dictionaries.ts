// Dictionary layer: bundles the locale JSON files locally.
// Bundled synchronously on purpose: no loading states for text, ever.
// Add a namespace import here as pages start consuming it.

import arOrders from "../../locales/ar/orders.json";
import arAuth from "../../locales/ar/auth.json";
import arCommon from "../../locales/ar/common.json";
import arNavigation from "../../locales/ar/navigation.json";
import arDashboard from "../../locales/ar/dashboard.json";
import arCustomers from "../../locales/ar/customers.json";
import arCustomerGroups from "../../locales/ar/customer-groups.json";
import arCustomerTags from "../../locales/ar/customer-tags.json";
import arReviews from "../../locales/ar/reviews.json";
import arProducts from "../../locales/ar/products.json";
import arProductGroups from "../../locales/ar/product-groups.json";
import arOffers from "../../locales/ar/offers.json";
import arDelivery from "../../locales/ar/delivery.json";
import arDeliveryCompanies from "../../locales/ar/delivery_companies.json";
import arSettings from "../../locales/ar/settings.json";
import arTeam from "../../locales/ar/team.json";
import arMcp from "../../locales/ar/mcp.json";

import enOrders from "../../locales/en/orders.json";
import enAuth from "../../locales/en/auth.json";
import enCommon from "../../locales/en/common.json";
import enNavigation from "../../locales/en/navigation.json";
import enDashboard from "../../locales/en/dashboard.json";
import enCustomers from "../../locales/en/customers.json";
import enCustomerGroups from "../../locales/en/customer-groups.json";
import enCustomerTags from "../../locales/en/customer-tags.json";
import enReviews from "../../locales/en/reviews.json";
import enProducts from "../../locales/en/products.json";
import enProductGroups from "../../locales/en/product-groups.json";
import enOffers from "../../locales/en/offers.json";
import enDelivery from "../../locales/en/delivery.json";
import enDeliveryCompanies from "../../locales/en/delivery_companies.json";
import enSettings from "../../locales/en/settings.json";
import enTeam from "../../locales/en/team.json";
import enMcp from "../../locales/en/mcp.json";

import frOrders from "../../locales/fr/orders.json";
import frAuth from "../../locales/fr/auth.json";
import frCommon from "../../locales/fr/common.json";
import frNavigation from "../../locales/fr/navigation.json";
import frDashboard from "../../locales/fr/dashboard.json";
import frCustomers from "../../locales/fr/customers.json";
import frCustomerGroups from "../../locales/fr/customer-groups.json";
import frCustomerTags from "../../locales/fr/customer-tags.json";
import frReviews from "../../locales/fr/reviews.json";
import frProducts from "../../locales/fr/products.json";
import frProductGroups from "../../locales/fr/product-groups.json";
import frOffers from "../../locales/fr/offers.json";
import frDelivery from "../../locales/fr/delivery.json";
import frDeliveryCompanies from "../../locales/fr/delivery_companies.json";
import frSettings from "../../locales/fr/settings.json";
import frTeam from "../../locales/fr/team.json";
import frMcp from "../../locales/fr/mcp.json";

import type { Locale } from "./config";

export const NAMESPACES = ["orders", "auth", "common", "navigation", "dashboard", "customers", "customer-groups", "customer-tags", "reviews", "products", "product-groups", "offers", "delivery", "delivery_companies", "settings", "team", "mcp"] as const;
export type Namespace = (typeof NAMESPACES)[number];
export type Dict = Record<string, unknown>;

const DICTS: Record<Locale, Partial<Record<Namespace, Dict>>> = {
  ar: { orders: arOrders, auth: arAuth, common: arCommon, navigation: arNavigation, dashboard: arDashboard, customers: arCustomers, "customer-groups": arCustomerGroups, "customer-tags": arCustomerTags, reviews: arReviews, products: arProducts, "product-groups": arProductGroups, offers: arOffers, delivery: arDelivery, delivery_companies: arDeliveryCompanies, settings: arSettings, team: arTeam, mcp: arMcp },
  en: { orders: enOrders, auth: enAuth, common: enCommon, navigation: enNavigation, dashboard: enDashboard, customers: enCustomers, "customer-groups": enCustomerGroups, "customer-tags": enCustomerTags, reviews: enReviews, products: enProducts, "product-groups": enProductGroups, offers: enOffers, delivery: enDelivery, delivery_companies: enDeliveryCompanies, settings: enSettings, team: enTeam, mcp: enMcp },
  fr: { orders: frOrders, auth: frAuth, common: frCommon, navigation: frNavigation, dashboard: frDashboard, customers: frCustomers, "customer-groups": frCustomerGroups, "customer-tags": frCustomerTags, reviews: frReviews, products: frProducts, "product-groups": frProductGroups, offers: frOffers, delivery: frDelivery, delivery_companies: frDeliveryCompanies, settings: frSettings, team: frTeam, mcp: frMcp },
};

export function getDict(locale: Locale, ns: Namespace): Dict {
  return DICTS[locale][ns] ?? DICTS[DEFAULT_LOCALE][ns] ?? {};
}

import { DEFAULT_LOCALE } from "./config";
