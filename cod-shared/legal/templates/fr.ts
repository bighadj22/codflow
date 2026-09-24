/**
 * French legal templates.
 *
 * Clause-for-clause parity with `ar.ts` — same sections, same guards, same
 * facts — so a merchant who switches `stores.lang` gets the same document in
 * another language, not a different policy. `legal/render.test.ts` enforces
 * that parity.
 */

import { doc, p, section, ul } from "../types";
import type { LegalTemplatePack, StoreLegalFacts } from "../types";

const seller = (f: StoreLegalFacts) => f.legalName ?? f.storeName;

const contactBlocks = (f: StoreLegalFacts) => [
  f.contactPhone ? p("Téléphone :", f.contactPhone) : null,
  f.contactEmail ? p("E-mail :", f.contactEmail) : null,
  f.address ? p("Adresse :", f.address) : null,
];

const noContact = (f: StoreLegalFacts) =>
  !f.contactPhone && !f.contactEmail
    ? p("Vous pouvez nous joindre via les coordonnées affichées sur la boutique.")
    : null;

export const fr: LegalTemplatePack = {
  terms: (f) =>
    doc(
      "Conditions générales de vente",
      `Conditions générales de vente de ${f.storeName} : commande, paiement à la livraison, livraison et annulation.`,
      section(
        "Qui sommes-nous",
        p(
          `${f.storeName} est une boutique en ligne qui vend en Algérie avec paiement à la livraison. En utilisant ce site et en passant commande, vous acceptez les conditions ci-dessous.`,
        ),
        f.legalName ? p("Dénomination :", f.legalName) : null,
        f.rcNumber ? p("Registre de commerce :", f.rcNumber) : null,
        f.nif ? p("NIF :", f.nif) : null,
        ...contactBlocks(f),
      ),
      section(
        "Produits et prix",
        p(
          "Tous les prix affichés sont en dinar algérien. Le prix du produit ne comprend pas les frais de livraison, calculés selon la wilaya et le mode de livraison et affichés avant la validation de votre commande.",
        ),
        p(
          "Nous faisons le nécessaire pour présenter des photos et des descriptions fidèles. De légères différences de couleur ou d'aspect peuvent apparaître selon votre écran.",
        ),
        p(
          "Nous pouvons modifier un prix ou retirer un produit à tout moment. Le prix retenu est celui confirmé avec vous lors de l'appel de confirmation.",
        ),
      ),
      section(
        "Commande et confirmation",
        p(
          "Après l'envoi du formulaire, votre commande nous parvient avec le statut « à confirmer ». Une commande passée sur le site vaut offre d'achat et ne devient une vente ferme qu'après confirmation.",
        ),
        p(
          "Notre équipe vous appelle pour confirmer le produit, la quantité, l'adresse et les frais de livraison avant l'expédition.",
        ),
        p(
          "Si vous restez injoignable après plusieurs tentatives, ou si le produit s'avère indisponible, nous pouvons annuler la commande et vous en informer.",
        ),
      ),
      section(
        "Paiement",
        p(
          "Le paiement à la livraison est le seul mode de paiement accepté. Aucun paiement anticipé ni aucune information bancaire ne vous sont demandés sur le site.",
        ),
        p(
          "Vous réglez le montant total — prix du produit plus frais de livraison — en espèces au livreur, à la réception du colis.",
        ),
        p(
          "Si quelqu'un vous réclame un paiement anticipé en notre nom, n'y donnez pas suite et prévenez-nous immédiatement.",
        ),
      ),
      section(
        "Livraison",
        p(
          "Nous livrons dans les wilayas proposées dans le formulaire de commande. Deux modes sont généralement disponibles : la livraison à domicile ou le retrait au bureau du transporteur (stop desk).",
        ),
        p(
          `Le délai est généralement de ${f.deliveryMinDays} à ${f.deliveryMaxDays} jours ouvrables à compter de la confirmation. Les détails figurent dans la politique d'expédition et de livraison.`,
        ),
      ),
      section(
        "Annulation",
        p(
          "Vous pouvez annuler gratuitement votre commande à tout moment avant sa remise au transporteur, en nous contactant.",
        ),
        p(
          "À la livraison, vous pouvez inspecter le colis avant de payer et refuser de le prendre. Dans ce cas vous ne payez rien. Les retours après réception sont décrits dans la politique de retour et de remboursement.",
        ),
      ),
      section(
        "Vos obligations",
        ul(
          "Fournir un nom, un numéro de téléphone et une adresse exacts et complets.",
          "Rester joignable au numéro indiqué pour l'appel de confirmation et celui du livreur.",
          "Ne pas passer de commandes fictives ou répétées sans intention de les réceptionner.",
        ),
        p(
          "Des informations erronées ou incomplètes sont la première cause d'échec de livraison ; nous ne sommes pas responsables des retards qui en découlent.",
        ),
      ),
      section(
        "Limitation de responsabilité",
        p(
          "Nous répondons de la conformité du produit à ce qui vous a été présenté et confirmé. Nous ne sommes pas responsables des retards ou impossibilités dus à des circonstances indépendantes de notre volonté : intempéries, coupures de routes ou défaillance du transporteur.",
        ),
      ),
      section(
        "Données personnelles",
        p(
          "Vos données personnelles sont traitées comme indiqué dans la politique de confidentialité, conformément à la loi 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.",
        ),
      ),
      section(
        "Droit applicable",
        p(
          "Les présentes conditions sont soumises au droit algérien, notamment la loi 18-05 relative au commerce électronique et la loi 09-03 relative à la protection du consommateur et à la répression des fraudes. Tout litige est réglé à l'amiable en priorité, à défaut devant les juridictions algériennes compétentes.",
        ),
      ),
      section(
        "Modification des conditions",
        p("Ces conditions peuvent être mises à jour. La version en vigueur est celle affichée sur cette page."),
      ),
      section("Nous contacter", ...contactBlocks(f), noContact(f)),
    ),

  privacy: (f) =>
    doc(
      "Politique de confidentialité",
      `Comment ${f.storeName} collecte, utilise et protège vos données personnelles, et quels sont vos droits.`,
      section(
        "Responsable du traitement",
        p(
          `${seller(f)} est responsable du traitement des données personnelles que vous fournissez en commandant sur ${f.storeName}. Cette politique explique ce que nous collectons, pourquoi, et comment nous le protégeons.`,
        ),
        f.rcNumber ? p("Registre de commerce :", f.rcNumber) : null,
      ),
      section(
        "Données collectées",
        ul(
          "Nom et prénom.",
          "Numéro de téléphone.",
          "Wilaya et commune, ainsi que l'adresse en cas de livraison à domicile.",
          "Le détail et l'historique de vos commandes.",
          "Des données techniques sur votre visite (pages consultées, type d'appareil).",
        ),
        p("Aucune donnée bancaire n'est collectée, le paiement se faisant en espèces à la livraison."),
      ),
      section(
        "Finalités",
        ul(
          "Préparer et vous livrer votre commande.",
          "Vous appeler pour confirmer la commande ou vous informer de son état.",
          "Traiter les retours, les échanges et le service après-vente.",
          "Améliorer la boutique et mesurer l'efficacité de nos publicités.",
          "Respecter nos obligations légales et comptables.",
        ),
      ),
      section(
        "Destinataires",
        p("Nous ne vendons ni ne louons vos données. Nous les partageons uniquement dans la mesure nécessaire avec :"),
        ul(
          "Le transporteur chargé de votre colis — il reçoit vos nom, téléphone et adresse pour pouvoir livrer.",
          "Le prestataire SMS ou WhatsApp, lorsque la vérification du numéro est activée.",
          "Les plateformes de mesure publicitaire, lorsqu'elles sont activées, via des identifiants qui n'incluent pas votre adresse.",
          "Les autorités compétentes, lorsque la loi l'exige.",
        ),
      ),
      section(
        "Cookies et mesure d'audience",
        p(
          "Le site utilise des cookies nécessaires à son fonctionnement (par exemple la mémorisation du panier) et peut utiliser des outils de mesure pour connaître la performance de nos pages et de nos publicités. Vous pouvez supprimer ou bloquer les cookies depuis votre navigateur, étant entendu que certaines fonctions du site peuvent en être affectées.",
        ),
      ),
      section(
        "Durée de conservation",
        p(
          "Nous conservons les données de commande le temps nécessaire à son exécution et au service après-vente, puis pendant la durée imposée par nos obligations légales et comptables. Elles sont ensuite supprimées ou anonymisées.",
        ),
      ),
      section(
        "Vos droits",
        p(
          "Conformément à la loi 18-07, vous disposez d'un droit d'accès, de rectification et de suppression de vos données, ainsi que d'un droit d'opposition à leur usage à des fins de prospection.",
        ),
        p("Pour exercer ces droits, contactez-nous aux coordonnées ci-dessous. Nous répondons dans les meilleurs délais."),
      ),
      section(
        "Sécurité",
        p(
          "Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour protéger vos données contre la perte et l'accès non autorisé. Aucun système ne peut toutefois garantir une sécurité absolue.",
        ),
      ),
      section(
        "Mineurs",
        p("Notre boutique s'adresse à des personnes majeures. Nous ne collectons pas sciemment de données concernant des mineurs."),
      ),
      section(
        "Modification de cette politique",
        p("Cette politique peut être mise à jour. La version en vigueur est celle affichée sur cette page."),
      ),
      section("Nous contacter", ...contactBlocks(f), noContact(f)),
    ),

  refund: (f) =>
    doc(
      "Politique de retour et de remboursement",
      `Conditions de retour et de remboursement chez ${f.storeName} : inspection avant paiement, refus à la livraison, produit endommagé ou erroné.`,
      section(
        "Vérifiez avant de payer",
        p(
          "Le paiement se fait à la livraison, ce qui vous protège directement : vous pouvez ouvrir le colis et examiner le produit devant le livreur avant de payer quoi que ce soit.",
        ),
        p(
          "Si le produit ne correspond pas à votre commande ou arrive endommagé, ne payez pas — refusez le colis et prévenez-nous le jour même.",
        ),
      ),
      section(
        "Refus à la livraison",
        p(
          "Refuser le colis à la livraison ne vous coûte rien : ni le prix du produit, ni les frais de livraison. Le colis nous revient par le transporteur.",
        ),
        p(
          "Merci de ne refuser un colis que pour un motif réel. Des refus répétés sans motif peuvent nous conduire à ne plus accepter de commandes depuis le même numéro.",
        ),
      ),
      f.returnWindowDays > 0
        ? section(
            "Retour après réception",
            p(
              `Vous pouvez demander un retour dans un délai de ${f.returnWindowDays} jours à compter de la réception, à condition que le produit soit :`,
            ),
            ul(
              "dans son état d'origine et non utilisé ;",
              "dans son emballage d'origine avec tous ses accessoires ;",
              "accompagné d'une preuve d'achat (numéro de commande ou bon de livraison).",
            ),
            p("Contactez-nous avant tout retour. N'expédiez aucun produit sans accord préalable."),
          )
        : section(
            "Retour après réception",
            p(
              "L'inspection ayant lieu avant le paiement, nous n'acceptons pas de retour après acceptation et paiement du colis, sauf dans les cas de produit endommagé ou erroné décrits ci-dessous.",
            ),
          ),
      section(
        "Produit endommagé ou erroné",
        p(
          "Si vous constatez après réception que le produit est endommagé ou différent de celui commandé, contactez-nous sous 48 heures avec des photos nettes du produit et de l'emballage.",
        ),
        p(
          "Après vérification, nous procédons à l'échange ou au remboursement. Dans ce cas, les frais de retour sont à notre charge.",
        ),
      ),
      section(
        "Produits non retournables",
        ul(
          "Produits d'hygiène et de soin personnel dont l'emballage a été ouvert.",
          "Sous-vêtements et produits non revendables pour des raisons d'hygiène.",
          "Produits fabriqués ou personnalisés à votre demande.",
          "Produits endommagés par un mauvais usage après réception.",
        ),
      ),
      section(
        "Modalités de remboursement",
        p(
          "Le paiement étant en espèces, le remboursement s'effectue selon ce qui aura été convenu avec vous : en espèces lors de la récupération du produit, ou par virement sur votre compte CCP ou bancaire.",
        ),
        p("Le traitement intervient généralement sous quelques jours après réception et vérification du produit."),
      ),
      section(
        "Frais de retour",
        p(
          "Les frais de retour sont à notre charge lorsque l'erreur vient de nous — produit endommagé ou erroné. Dans les autres cas, ils restent à la charge de l'acheteur.",
        ),
      ),
      section("Nous contacter", ...contactBlocks(f), noContact(f)),
    ),

  shipping: (f) =>
    doc(
      "Politique d'expédition et de livraison",
      `Délais, frais et modes de livraison chez ${f.storeName} : livraison à domicile ou au bureau du transporteur, par wilaya.`,
      section(
        "Zones de livraison",
        p(
          "Nous livrons dans les wilayas proposées dans la liste du formulaire de commande. Si votre wilaya n'y figure pas, la livraison n'y est pas disponible pour le moment.",
        ),
      ),
      section(
        "Modes de livraison",
        p("Deux modes sont généralement disponibles, à choisir lors de la commande :"),
        ul(
          "Livraison à domicile : le livreur vous remet le colis à l'adresse indiquée.",
          "Retrait au bureau (stop desk) : vous récupérez votre colis au bureau du transporteur le plus proche, généralement à un tarif inférieur.",
        ),
      ),
      section(
        "Délais de livraison",
        p(
          `Le délai est généralement de ${f.deliveryMinDays} à ${f.deliveryMaxDays} jours ouvrables à compter de la confirmation téléphonique de la commande, et non de son envoi sur le site.`,
        ),
        p(
          "Il peut s'allonger dans les wilayas éloignées, pendant les fêtes et les périodes de forte activité, ainsi que pour des causes indépendantes de notre volonté comme les intempéries ou les coupures de routes.",
        ),
      ),
      section(
        "Frais de livraison",
        p(
          "Les frais varient selon la wilaya et le mode choisi. Ils sont affichés dans le formulaire de commande avant l'envoi et reconfirmés par téléphone par notre équipe.",
        ),
        p("Ils sont réglés en espèces au livreur, avec le prix du produit, à la réception."),
      ),
      section(
        "Confirmation de commande",
        p(
          "Aucune commande n'est expédiée avant confirmation téléphonique. Si vous restez injoignable après plusieurs tentatives, la commande reste en attente et peut être annulée.",
        ),
      ),
      section(
        "Suivi du colis",
        p("Une fois votre colis remis au transporteur, vous pouvez connaître son état en nous contactant avec votre numéro de commande."),
      ),
      section(
        "Tentatives de livraison",
        p(
          "Le livreur vous appelle à son arrivée dans votre wilaya. S'il ne parvient pas à vous joindre, le colis nous est retourné et la commande peut être annulée. Veillez à rester joignable.",
        ),
      ),
      section(
        "Inspection à la livraison",
        p(
          "Vous pouvez inspecter le colis avant de payer. Si le produit n'est pas conforme, vous pouvez refuser la livraison sans rien payer — voir la politique de retour et de remboursement.",
        ),
      ),
      section("Nous contacter", ...contactBlocks(f), noContact(f)),
    ),
};
