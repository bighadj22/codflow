"use client";

// Translation utility
import arNavigation from '@/locales/ar/navigation.json';
import arDashboard from '@/locales/ar/dashboard.json';
import arOrders from '@/locales/ar/orders.json';
import arCustomers from '@/locales/ar/customers.json';
import arProducts from '@/locales/ar/products.json';
import arProductGroups from '@/locales/ar/product-groups.json';
import arCustomerGroups from '@/locales/ar/customer-groups.json';
import arCustomerTags from '@/locales/ar/customer-tags.json';
import arReviews from '@/locales/ar/reviews.json';
import arOffers from '@/locales/ar/offers.json';

import arDelivery from '@/locales/ar/delivery.json';
import arSettings from '@/locales/ar/settings.json';
import arTeam from '@/locales/ar/team.json';
import arAuth from '@/locales/ar/auth.json';
import arCommon from '@/locales/ar/common.json';
import arProfile from '@/locales/ar/profile.json';
import arMcp from '@/locales/ar/mcp.json';

import enNavigation from '@/locales/en/navigation.json';
import enDashboard from '@/locales/en/dashboard.json';
import enOrders from '@/locales/en/orders.json';
import enCustomers from '@/locales/en/customers.json';
import enProducts from '@/locales/en/products.json';
import enProductGroups from '@/locales/en/product-groups.json';
import enCustomerGroups from '@/locales/en/customer-groups.json';
import enCustomerTags from '@/locales/en/customer-tags.json';
import enReviews from '@/locales/en/reviews.json';
import enOffers from '@/locales/en/offers.json';

import enDelivery from '@/locales/en/delivery.json';
import enSettings from '@/locales/en/settings.json';
import enTeam from '@/locales/en/team.json';
import enAuth from '@/locales/en/auth.json';
import enCommon from '@/locales/en/common.json';
import enProfile from '@/locales/en/profile.json';
import enMcp from '@/locales/en/mcp.json';

import frNavigation from '@/locales/fr/navigation.json';
import frDashboard from '@/locales/fr/dashboard.json';
import frOrders from '@/locales/fr/orders.json';
import frCustomers from '@/locales/fr/customers.json';
import frProducts from '@/locales/fr/products.json';
import frProductGroups from '@/locales/fr/product-groups.json';
import frCustomerGroups from '@/locales/fr/customer-groups.json';
import frCustomerTags from '@/locales/fr/customer-tags.json';
import frReviews from '@/locales/fr/reviews.json';
import frOffers from '@/locales/fr/offers.json';
import frDelivery from '@/locales/fr/delivery.json';
import frSettings from '@/locales/fr/settings.json';
import frTeam from '@/locales/fr/team.json';
import frAuth from '@/locales/fr/auth.json';
import frCommon from '@/locales/fr/common.json';
import frProfile from '@/locales/fr/profile.json';
import frMcp from '@/locales/fr/mcp.json';

import { useLanguage } from './i18n-context';

export const allTranslations = {
  ar: {
    navigation: arNavigation,
    dashboard: arDashboard,
    orders: arOrders,
    customers: arCustomers,
    products: arProducts,
    delivery: arDelivery,
    settings: arSettings,
    team: arTeam,
    auth: arAuth,
    common: arCommon,
    productGroups: arProductGroups,
    customerGroups: arCustomerGroups,
    customerTags: arCustomerTags,
    reviews: arReviews,
    offers: arOffers,
    profile: arProfile,
    mcp: arMcp,
  },
  en: {
    navigation: enNavigation,
    dashboard: enDashboard,
    orders: enOrders,
    customers: enCustomers,
    products: enProducts,
    productGroups: enProductGroups,
    customerGroups: enCustomerGroups,
    customerTags: enCustomerTags,
    reviews: enReviews,
    offers: enOffers,
    delivery: enDelivery,
    settings: enSettings,
    team: enTeam,
    auth: enAuth,
    common: enCommon,
    profile: enProfile,
    mcp: enMcp,
  },
  fr: {
    navigation: frNavigation,
    dashboard: frDashboard,
    orders: frOrders,
    customers: frCustomers,
    products: frProducts,
    productGroups: frProductGroups,
    customerGroups: frCustomerGroups,
    customerTags: frCustomerTags,
    reviews: frReviews,
    offers: frOffers,
    delivery: frDelivery,
    settings: frSettings,
    team: frTeam,
    auth: frAuth,
    common: frCommon,
    profile: frProfile,
    mcp: frMcp,
  }
};

export type TranslationKey = keyof typeof allTranslations.ar;

export function useTranslations() {
  const { locale } = useLanguage();
  return allTranslations[locale];
}

// Helper hooks for each section
export const useNavigation = () => useTranslations().navigation;
export const useDashboard = () => useTranslations().dashboard;
export const useOrders = () => useTranslations().orders;
export const useCustomers = () => useTranslations().customers;
export const useProducts = () => useTranslations().products;
export const useProductGroups = () => useTranslations().productGroups;
export const useCustomerGroups = () => useTranslations().customerGroups;
export const useCustomerTags = () => useTranslations().customerTags;
export const useReviews = () => useTranslations().reviews;
export const useOffers = () => useTranslations().offers;
export const useDelivery = () => useTranslations().delivery;
export const useSettings = () => useTranslations().settings;
export const useTeam = () => useTranslations().team;
export const useAuth = () => useTranslations().auth;
export const useCommon = () => useTranslations().common;
export const useProfile = () => useTranslations().profile;
export const useMcp = () => useTranslations().mcp;

/**
 * Legacy t function - might need locale context
 * Recommend using the hooks instead
 */
export function t(section: TranslationKey, path: string, locale: 'ar' | 'en' | 'fr' = 'ar'): string {
  const keys = path.split('.');
  let value: any = allTranslations[locale][section];
  
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return path; // Return path if not found
    }
  }
  
  return typeof value === 'string' ? value : path;
}
