/**
 * French (Français) Content
 * 
 * All user-facing text in French for the Algerian market.
 * Supports French-speaking customers in Algeria.
 */

import type { StoreFrontContent } from "./types";

export const fr: StoreFrontContent = {
  // ── Announcement bar ─────────────────────────────────────────────────────
  announcementText: "Paiement à la livraison disponible dans toutes les wilayas",

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroEyebrow: "Nouvelle collection",
  heroTitle: "Découvrez les meilleurs produits",
  heroSubtitle: "Livraison dans toutes les wilayas d'Algérie — Paiement à la livraison",
  heroPlaceholderTitle: "Nouvelle collection",
  heroPlaceholderSub: "Bientôt disponible",

  // ── Trust badges ──────────────────────────────────────────────────────────
  trust1Title: "Paiement à la livraison",
  trust1Sub: "Aucun paiement anticipé",
  trust2Title: "Livraison dans toutes les wilayas",
  trust2Sub: "58 wilayas",
  trust3Title: "Confirmation rapide",
  trust3Sub: "Dans les 24 heures",

  // ── Hero CTAs ────────────────────────────────────────────────────────────
  heroCtaPrimary: "Achetez maintenant",
  heroCtaSecondary: "Voir les meilleures ventes",

  // ── Navigation ────────────────────────────────────────────────────────────
  navHome: "Accueil",
  navProducts: "Produits",
  navNewArrivals: "Nouveautés",
  navBestSellers: "Meilleures ventes",
  navCategories: "Catégories",

  // ── Section headings ──────────────────────────────────────────────────────
  categoriesSection: "Achetez par catégorie",
  featuredSection: "Produits vedettes",
  allProductsSection: "Tous les produits",
  bestSellersSection: "Meilleures ventes",
  bestSellersSub: "Les favoris de nos clients",
  newArrivalsSection: "Nouveautés",
  newArrivalsSub: "Produits fraîchement ajoutés",
  viewAllCta: "Voir tout",

  // ── How It Works (COD trust) ────────────────────────────────────────────
  howItWorksTitle: "Paiement à la livraison — Simple, sûr et fiable",
  howItWorksSub: "Commandez aujourd'hui, payez à la livraison",
  howStep1Title: "Passez votre commande",
  howStep1Sub: "Choisissez vos produits et remplissez vos coordonnées",
  howStep2Title: "Confirmez via WhatsApp",
  howStep2Sub: "Notre équipe vous contactera pour confirmer",
  howStep3Title: "Payez à la livraison",
  howStep3Sub: "Recevez votre commande et payez le livreur",

  // ── Features bar ────────────────────────────────────────────────────────
  feature1Title: "Produits authentiques",
  feature2Title: "Livraison rapide",
  feature3Title: "Paiement à la livraison",
  feature5Title: "Support 24h/24",

  // ── Promo banner ────────────────────────────────────────────────────────
  promoTitle: "Nouveaux produits chaque semaine",
  promoSub: "Découvrez nos dernières nouveautés et offres exclusives",
  promoCtaText: "Achetez maintenant",

  // ── Testimonials ────────────────────────────────────────────────────────
  testimonialsTitle: "Ce que disent nos clients",
  testimonialsSub: "De vrais avis de vrais clients",

  // ── Footer ──────────────────────────────────────────────────────────────
  footerAbout: "Votre boutique en ligne de confiance en Algérie avec paiement à la livraison",
  footerQuickLinks: "Liens rapides",
  footerSupport: "Support client",
  footerShipping: "Infos livraison",
  footerReturns: "Retours et échanges",
  footerRights: "Tous droits réservés",

  // ── Order form ────────────────────────────────────────────────────────────
  orderCta: "Commander maintenant",
  orderCtaSubtext: "Paiement à la livraison",
  formTitle: "Complétez votre commande",
  formDeliverySection: "Informations de livraison",
  formNameLabel: "Nom complet",
  formNamePlaceholder: "Exemple: Ahmed Ben Ali",
  formPhoneLabel: "Numéro de téléphone",
  formPhonePlaceholder: "0XX XX XX XX XX",
  formPhoneInvalid: "Numéro algérien invalide — doit commencer par 05, 06 ou 07",
  formWilayaLabel: "Wilaya",
  formWilayaPlaceholder: "Choisissez votre wilaya",
  formCommuneLabel: "Commune",
  formCommunePlaceholder: "Choisissez la commune",
  formCommuneLoading: "Chargement...",
  formCommuneDisabled: "Choisissez d'abord la wilaya",
  formAddressLabel: "Adresse détaillée",
  formAddressPlaceholder: "Rue, quartier, numéro de bâtiment...",
  formDeliveryLabel: "Mode de livraison",
  formHomeDelivery: "Livraison à domicile",
  formStopDesk: "Bureau de poste",
  formNotesLabel: "Notes",
  formNotesPlaceholder: "Détails supplémentaires pour la livraison...",
  formSubmit: "Confirmer la commande",
  formConfirmNote: "Notre équipe vous contactera pour confirmer votre commande dans les 24 heures",

  // ── WhatsApp OTP verification ─────────────────────────────────────────────
  otpTitle: "Vérifiez votre téléphone",
  otpSubtitle: "Nous avons envoyé un code à 6 chiffres sur votre WhatsApp",
  otpInputLabel: "Code de vérification",
  otpInputPlaceholder: "••••••",
  otpVerifyBtn: "Confirmer le code",
  otpVerifying: "Vérification...",
  otpResendIn: "Renvoyer dans",
  otpResend: "Renvoyer le code",
  otpChangePhone: "Changer le numéro",
  otpErrorWrong: "Code incorrect — vérifiez WhatsApp et réessayez",
  otpErrorAttempts: "Tentatives restantes :",
  otpErrorExpired: "Ce code a expiré — demandez-en un nouveau",
  otpErrorRate: "Trop de demandes — patientez un instant puis réessayez",
  otpErrorGeneric: "Impossible d'envoyer le code — réessayez",

  // ── Order summary ─────────────────────────────────────────────────────────
  qtyLabel: "Quantité",
  qtyUnit: "pièce",
  shippingLabel: "Frais de livraison",
  shippingCalculated: "Calculé après sélection de la wilaya",
  shippingFree: "Gratuit",
  totalLabel: "Total général",
  itemsLabel: "Produits",

  // ── Thank you page ────────────────────────────────────────────────────────
  thankYouTitle: "Commande reçue !",
  thankYouSubtitle: "Merci pour votre confiance — nous vous contacterons bientôt",
  orderNumberLabel: "Numéro de commande",
  totalAmountLabel: "Montant total",
  codNote: "Paiement à la livraison — aucun paiement anticipé requis",
  step1Title: "Confirmation de commande",
  step1Sub: "Dans les 24 heures",
  step2Title: "Préparation",
  step2Sub: "et emballage du produit",
  step3Title: "Livraison",
  step3Sub: "à votre porte",
  backToStore: "Retour au magasin",

  // ── Empty / error states ──────────────────────────────────────────────────
  noProductsTitle: "Aucun produit dans cette section",
  noProductsSub: "Parcourez une autre section",
  emptyStoreTitle: "Magasin en préparation",
  emptyStoreSub: "Les produits seront ajoutés bientôt",
  productNotFoundTitle: "Produit introuvable",

  // ── Reviews ───────────────────────────────────────────────────────────────
  reviewsTitle: "Avis clients",
  reviewsNoReviews: "Aucun avis pour le moment",
  reviewsBeFirst: "Soyez le premier à évaluer ce produit",
  reviewsVerifiedBuyer: "Acheteur vérifié",
  reviewFormTitle: "Rédigez votre avis",
  reviewFormOrderLabel: "Numéro de commande",
  reviewFormOrderPlaceholder: "Exemple: ORD-20240101-0001",
  reviewFormOrderHelp: "Vous trouverez votre numéro de commande dans le message de confirmation",
  reviewFormRatingLabel: "Évaluation",
  reviewFormTitleLabel: "Titre de l'avis",
  reviewFormTitlePlaceholder: "Résumé de votre expérience",
  reviewFormBodyLabel: "Détails de l'avis",
  reviewFormBodyPlaceholder: "Partagez votre expérience avec ce produit...",
  reviewFormSubmit: "Envoyer l'avis",
  reviewFormSuccess: "Merci ! Votre avis a été envoyé et apparaîtra après révision.",
  reviewFormErrorDuplicate: "Vous avez déjà envoyé un avis pour cette commande.",
  reviewFormErrorInvalidOrder: "Numéro de commande invalide. Vérifiez votre numéro de commande et réessayez.",
  reviewFormErrorGeneric: "Une erreur s'est produite. Veuillez réessayer.",

  // ── Offers ───────────────────────────────────────────────────────────────
  offerAutoApplied: "Appliqué automatiquement lors de la confirmation de commande",
  offerFreeLabel: "Gratuit",
  offerActive: "Offre active !",
  offerUnlocked: "Offre débloquée !",
  offerAddMore: "Ajoutez {n} unité(s) pour obtenir :",
  offerAddOne: "Ajoutez une autre unité pour obtenir :",
  offerYouGet: "Sera ajouté automatiquement à votre commande",
  offerSectionTitle: "Choisissez votre quantité",
  offerFreeShippingBadge: "Livraison gratuite",
  offerBuyOne: "Achetez 1",
  offerFullPrice: "Prix complet",
  offerMostPopular: "Le plus demandé",

  // ── Misc ──────────────────────────────────────────────────────────────────
  breadcrumbHome: "Accueil",
  required: "*",
  viewProduct: "Voir le produit",
  featured: "Vedette",
  lowStock: "Dernières {n} pièces",
  outOfStock: "Rupture de stock",
  qtyMaxStock: "Seulement {n} pièce(s) restante(s)",
  freeShippingBadge: "Livraison gratuite",
  searchLabel: "Recherche...",
  noResultsLabel: "Aucun résultat correspondant",
  loadMoreLabel: "Voir plus",
  allLabel: "Tout",
  productCountLabel: "produit",
  reviewFormMinLengthError: "Veuillez écrire un avis d'au moins 10 caractères",
  reviewFormRatingRequired: "Veuillez choisir une évaluation de 1 à 5 étoiles",
  offerSaveBadge: "Économisez {n}%",
  offerSavingsText: "Économie de {amount} {currency}",
  offerUnitLabel: "Unité {n}",
  ariaMainNavigation: "Navigation principale",
  ariaQuantity: "Quantité",
  ariaGoToImage: "Aller à l'image {n} sur {total}",
  ariaBrowseAllProducts: "Parcourir tous les produits",
  ariaBrowseCategoryProducts: "Parcourir les produits {category}",
  ariaProductCard: "{name} - {price} {currency}",
  ariaStarRating: "{n} étoile{s}",
  navContact: "Contactez-nous",
  thankYouPageTitle: "Commande reçue",
  defaultMetaDescription: "Achetez chez {storeName} - Les meilleurs produits à des prix abordables avec livraison dans toutes les wilayas",
};