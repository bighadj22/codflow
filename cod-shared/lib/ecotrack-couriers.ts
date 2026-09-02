/**
 * EcoTrack Tenant Catalog — 82 couriers on the EcoTrack platform
 *
 * One adapter (cod-server) serves every tenant: companies are DATA, not code.
 * Source of the courier list + keys: .agents/skills/Ecotrack/about.md
 * (dzship's EcoTrack guide). Keys must never drift from that table.
 *
 * Consumed by BOTH apps (single source of truth — never duplicate this list):
 *   - cod-server: providers/ecotrack/seed-sql.ts + scripts/seed-ecotrack-companies.mjs
 *   - cod-client-astro: features/delivery/types.ts (PROVIDER_CONFIGS EcoTrack entries)
 *
 * baseUrls follow the platform's documented subdomain pattern
 * (https://{key}.ecotrack.dz — confirmed for Packers). They are
 * pattern-derived defaults, editable per company row, and verified per
 * courier by the Test-connection endpoint before any courier is activated.
 * Companies seed INACTIVE with no token, so a wrong URL can never reach a
 * live dispatch.
 *
 * nameAr values are transliterations (or the brand's own Arabic name where
 * one exists, e.g. Mazaya, Rihal, Tawsil). They require one human review
 * pass before seeding a production database — see the Ecotrack skill PLAN.
 */

export interface EcotrackCourier {
  /** dzship courier key — matches the subdomain and about.md's table. */
  readonly key: string;
  /** Brand name in Latin script, as published by dzship. */
  readonly name: string;
  /** Arabic display name (transliteration unless the brand is Arabic). */
  readonly nameAr: string;
  /** Pattern-derived tenant base URL. */
  readonly baseUrl: string;
}

function courier(key: string, name: string, nameAr: string): EcotrackCourier {
  return { key, name, nameAr, baseUrl: `https://${key}.ecotrack.dz` };
}

export const ECOTRACK_COURIERS: readonly EcotrackCourier[] = [
  courier("e48hrlivraison", "48Hr Livraison", "48 ساعة للتوصيل"),
  courier("abdelivery", "AB Delivery", "إيه بي للتوصيل"),
  courier("alania", "Alania Express", "ألانيا إكسبريس"),
  courier("allolivraison", "Allo Livraison", "ألو للتوصيل"),
  courier("amana", "Amana Speed", "أمانة سبيد"),
  courier("andersondelivery", "Anderson Delivery", "أندرسون للتوصيل"),
  courier("aranex", "Aranex", "أرانكس"),
  courier("areex", "Areex", "أريكس"),
  courier("assildelivery", "Assil Delivery", "أصيل للتوصيل"),
  courier("atlasexpress", "Atlas Express", "أطلس إكسبريس"),
  courier("baconsult", "BA Consult", "بي إيه كونسلت"),
  courier("bfkexpress", "BFK Express", "بي إف كيه إكسبريس"),
  courier("boogi", "Boogi Technologie", "بوغي تكنولوجي"),
  courier("championlogistics", "Champion Logistics", "تشامبيون للخدمات اللوجستية"),
  courier("chronorex", "Chronorex", "كرونوركس"),
  courier("cirtaexpress", "Cirta Express", "سيرتا إكسبريس"),
  courier("colex", "Colex", "كولكس"),
  courier("colireli", "Colireli", "كوليريلي"),
  courier("colizone", "Colizone", "كوليزون"),
  courier("conexlog", "Conexlog", "كونكسلوج"),
  courier("coyoteexpress", "Coyote Express", "كويوت إكسبريس"),
  courier("delivromail", "Delivromail", "ديليفروميل"),
  courier("dhd", "DHD Livraison", "دي إتش دي للتوصيل"),
  courier("distazero", "Distazero", "ديستازيرو"),
  courier("ecorapideexpress", "Eco Rapide Express", "إيكو رابيد إكسبريس"),
  courier("elguidedelivery", "El Guide Delivery", "إل غيد للتوصيل"),
  courier("expediachrono", "Expedia Chrono", "إكسبيديا كرونو"),
  courier("fasthorse", "Fast Horse Express", "الحصان السريع إكسبريس"),
  courier("fretdirect", "FRET.Direct", "فرت ديريكت"),
  courier("fzdelivery", "FZ Delivery", "إف زد للتوصيل"),
  courier("golivri", "GOLIVRI", "غوليفري"),
  courier("gsecommerce", "GS Ecommerce", "جي إس للتجارة الإلكترونية"),
  courier("hhdexpress", "HHD Express", "إتش إتش دي إكسبريس"),
  courier("imir", "Imir Logistics", "إيمير للخدمات اللوجستية"),
  courier("jaguar", "Jaguar Livraison", "جاكوار للتوصيل"),
  courier("joexpress", "Jo Express", "جو إكسبريس"),
  courier("lihlihexpress", "LIH LIH Express", "ليه ليه إكسبريس"),
  courier("lynx", "Lynx Express", "لينكس إكسبريس"),
  courier("majorex", "Majorex", "ماجوركس"),
  courier("mazaya", "Mazaya Logistics", "مزايا للخدمات اللوجستية"),
  courier("medexpress", "Med Express", "ميد إكسبريس"),
  courier("monohub", "Mono Hub", "مونو هب"),
  courier("msmgo", "MSM Go", "إم إس إم جو"),
  courier("navexdelivery", "Navex Delivery", "نافكس للتوصيل"),
  courier("negmarexpress", "Negmar Express", "نجمار إكسبريس"),
  courier("oksbox", "OKS Box", "أو كي إس بوكس"),
  courier("omexpress", "OM Express", "أو إم إكسبريس"),
  courier("ontimeexpress", "On Time Express", "أون تايم إكسبريس"),
  courier("oneexpress", "One Express", "وان إكسبريس"),
  courier("ovred", "Ovred", "أوفريد"),
  courier("packers", "Packers", "باكرز"),
  courier("pdex", "PDEX", "بي دي إكس"),
  courier("prest", "Prest", "بريست"),
  courier("quickdeliverydz", "Quick Delivery DZ", "كويك ديليفري الجزائر"),
  courier("rblivraison", "RB Livraison", "آر بي للتوصيل"),
  courier("redex", "Red Ex", "ريد إكس"),
  courier("rexlivraison", "Rex Livraison", "ريكس للتوصيل"),
  courier("rihalexpress", "Rihal Express", "رحال إكسبريس"),
  courier("rj360express", "RJ 360 Express", "آر جي 360 إكسبريس"),
  courier("rmexpress", "RM Express", "آر إم إكسبريس"),
  courier("rocketdelivery", "Rocket Delivery", "روكيت للتوصيل"),
  courier("royaumedelivery", "Royaume Delivery", "روياوم للتوصيل"),
  courier("rsexpress", "RS Express", "آر إس إكسبريس"),
  courier("rutaexpress", "Ruta Express", "روتا إكسبريس"),
  courier("salvadelivery", "Salva Delivery", "سالفا للتوصيل"),
  courier("samex", "Samex", "سامكس"),
  courier("sbl", "SBL Express", "إس بي إل إكسبريس"),
  courier("siexpress", "SI Express", "إس آي إكسبريس"),
  courier("speeddelivery", "Speed Delivery", "سبيد للتوصيل"),
  courier("speedmail", "Speed Mail", "سبيد ميل"),
  courier("sultancolisexpress", "Sultan Colis Express", "سلطان للطرود إكسبريس"),
  courier("swiftexpress", "Swift Express", "سويفت إكسبريس"),
  courier("tawsilstar", "Tawsil Star", "توصيل ستار"),
  courier("tslexpress", "TSL Express", "تي إس إل إكسبريس"),
  courier("ultraexpress", "Ultra Express", "ألترا إكسبريس"),
  courier("univerdelivery", "Univer Delivery", "يونيفير للتوصيل"),
  courier("vitrans", "Vitrans", "فيترونز"),
  courier("wassimexpress", "Wassim Express", "وسيم إكسبريس"),
  courier("weeweedelivery", "Wee Wee Delivery", "وي وي للتوصيل"),
  courier("windelivery", "Win Delivery", "وين للتوصيل"),
  courier("worldexpress", "WorldExpress", "ورلد إكسبريس"),
  courier("zinyatec", "Zinya Tec", "زينيا تيك"),
];

/** Find a courier by its dzship key (exact match). */
export function findEcotrackCourier(key: string): EcotrackCourier | undefined {
  return ECOTRACK_COURIERS.find((c) => c.key === key);
}

/** Company code for a courier: `{key}_ecotrack` routes to the shared adapter. */
export function ecotrackCompanyCode(key: string): string {
  return `${key}_ecotrack`;
}
