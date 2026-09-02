/**
 * EcoTrack Mock Server — Documented Response Fixtures
 *
 * Every body here is taken from the official Postman collection
 * (postman_collection.json) example responses, or crafted to the documented
 * shape where examples are truncated. These are the fixtures the mock server
 * (mock-server.ts) serves and the adapter characterization tests assert
 * against — until real tenant credentials exist.
 */

import type {
  EcotrackCommunesResponse,
  EcotrackGetMajResponse,
  EcotrackTrackingInfoResponse,
} from "../types";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const TOKEN_VALID_RESPONSE = { success: true, message: "VALID_TOKEN" } as const;
export const TOKEN_INVALID_RESPONSE = { success: false, message: "INVALID_TOKEN" } as const;
export const TOKEN_NOT_ALLOWED_RESPONSE = { success: false, message: "TOKEN_NOT_ALLOWED" } as const;
export const UNAUTHENTICATED_RESPONSE = { message: "Unauthenticated." } as const;

// ─── Rate limit ───────────────────────────────────────────────────────────────

export const RATE_LIMIT_RESPONSE = { message: "Too Many Attempts." } as const;

// ─── Create order ─────────────────────────────────────────────────────────────

export const CREATE_SUCCESS_RESPONSE = {
  success: true,
  tracking: "ECQFLD2103047673",
} as const;

export const CREATE_WILAYA_REFUSED_RESPONSE = {
  success: false,
  error: 10002,
  message: "Pas de livraison pour la wilaya sélectionnée",
} as const;

/** French field labels for the Laravel 422 bag — from the collection examples. */
export const VALIDATION_FIELD_LABELS: Record<string, string> = {
  nom_client: "nom client",
  telephone: "téléphone",
  telephone_2: "téléphone",
  adresse: "adresse",
  commune: "commune",
  code_wilaya: "code wilaya",
  montant: "montant",
  type: "type",
  tracking: "tracking",
  content: "contenu",
};

/** Build a Laravel "The given data was invalid." body for the given fields. */
export function validationErrorBag(fields: string[]): {
  message: string;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};
  for (const field of fields) {
    const label = VALIDATION_FIELD_LABELS[field] ?? field;
    errors[field] = [`Le champ ${label} est obligatoire.`];
  }
  return { message: "The given data was invalid.", errors };
}

export const TRACKING_INVALID_422 = {
  message: "The given data was invalid.",
  errors: { tracking: ["Le champ tracking sélectionné est invalide."] },
} as const;

// ─── Update / delete / validate ───────────────────────────────────────────────

export const UPDATE_SUCCESS_RESPONSE = {
  success: true,
  message: "Commande modifiée avec succès",
} as const;

export const NOT_MODIFIABLE_RESPONSE = {
  success: false,
  error: 10001,
  message: "Commande non modifiable",
} as const;

export const DELETE_SUCCESS_RESPONSE = {
  success: true,
  message: "Commande supprimée",
} as const;

/** Legacy delete shape — observed in the wild, adapter must accept both. */
export const DELETE_LEGACY_FAIL_RESPONSE = { delete: "fail" } as const;

export const VALIDATE_SUCCESS_RESPONSE = {
  success: true,
  message: "Commande expedier avec succès",
} as const;

// ─── Returns ──────────────────────────────────────────────────────────────────

export const RETURNS_VALIDATED_RESPONSE = { returned: "success" } as const;
export const RETURNS_NOT_ELIGIBLE_RESPONSE = { returned: "fail" } as const;

export const ASK_RETURN_SUCCESS_RESPONSE = {
  success: true,
  message: "Retour demandé avec succès",
} as const;

export const ASK_RETURN_REFUSED_RESPONSE = {
  success: false,
  error: 10003,
  message: "Le retour ne peut pas etre demandé pour cette commande",
} as const;

// ─── Remarks (maj) ────────────────────────────────────────────────────────────

export const ADD_MAJ_SUCCESS_RESPONSE = {
  success: true,
  message: "Mise a jour avec success",
} as const;

export const MAJ_LIST_FIXTURE: EcotrackGetMajResponse = [
  {
    remarque: "Test Shop : TEST MAJ",
    station: "",
    livreur: "",
    created_at: "2021-03-05 11:04:19",
    tracking: "ECQFLD2103047673",
  },
  {
    remarque: "Test Shop : Livraison avant 17:00 h",
    station: "",
    livreur: "",
    created_at: "2021-03-05 11:04:51",
    tracking: "ECQFLD2103047673",
  },
  {
    remarque: "لا يرد على الإتصال",
    station: "Centre draria",
    livreur: "testhasna test",
    created_at: "2021-03-05 11:16:27",
    tracking: "ECQFLD2103047673",
  },
];

// ─── Tracking ─────────────────────────────────────────────────────────────────

export const TRACKING_INFO_FIXTURE: EcotrackTrackingInfoResponse = {
  recipientName: "client",
  shippedBy: "Test Shop",
  originCity: 16,
  destLocationCity: 16,
  currentStation: "",
  activity: [
    { date: "2021-03-04", time: "22:32:47", status: "order_information_received_by_carrier" },
    { date: "2021-03-05", time: "11:04:49", status: "notification_on_order" },
    { date: "2021-03-05", time: "11:05:21", status: "notification_on_order" },
    { date: "2021-03-05", time: "11:15:26", status: "picked" },
    { date: "2021-03-05", time: "11:16:05", status: "accepted_by_carrier" },
    { date: "2021-03-05", time: "11:16:37", status: "dispatched_to_driver", station: "HUB" },
    { date: "2021-03-05", time: "11:16:57", status: "attempt_delivery" },
  ],
  reasons: [],
};

/** Terminal-parcel history: delivered → cashed → paid (for status-mapping tests). */
export const TRACKING_INFO_TERMINAL_FIXTURE: EcotrackTrackingInfoResponse = {
  ...TRACKING_INFO_FIXTURE,
  activity: [
    ...TRACKING_INFO_FIXTURE.activity!,
    { date: "2021-03-06", time: "09:10:00", status: "livred" },
    { date: "2021-03-06", time: "09:10:01", status: "encaissed" },
    { date: "2021-03-10", time: "14:00:00", status: "payed" },
  ],
};

// ─── Configuration endpoints ─────────────────────────────────────────────────

/**
 * Active wilayas for the mock tenant. Mirrors the collection example: wilaya
 * 12 (Tbessa) is absent — this tenant does not deliver there (create/order
 * with code_wilaya=12 answers error 10002).
 */
export const WILAYAS_FIXTURE = [
  { wilaya_id: 1, wilaya_name: "Adrar" },
  { wilaya_id: 2, wilaya_name: "Chlef" },
  { wilaya_id: 3, wilaya_name: "Laghouat" },
  { wilaya_id: 5, wilaya_name: "Batna" },
  { wilaya_id: 6, wilaya_name: "Béjaïa" },
  { wilaya_id: 9, wilaya_name: "Blida" },
  { wilaya_id: 11, wilaya_name: "Tamanrasset" },
  { wilaya_id: 13, wilaya_name: "Tlemcen" },
  { wilaya_id: 16, wilaya_name: "Alger" },
  { wilaya_id: 19, wilaya_name: "Sétif" },
  { wilaya_id: 25, wilaya_name: "Constantine" },
  { wilaya_id: 31, wilaya_name: "Oran" },
  { wilaya_id: 35, wilaya_name: "Boumerdès" },
] as const;

export const ACTIVE_WILAYA_IDS: ReadonlySet<number> = new Set(
  WILAYAS_FIXTURE.map((w) => w.wilaya_id)
);

export const DESKS_FIXTURE = {
  my_desk: {
    hub_id: 6,
    hub_name: "Station Batna",
    location: {
      wilaya: "Batna",
      commune: "Batna",
      adresse: "lorem ipsum",
      phone: "0660000000",
      phone2: "0770000000",
      email: "test@test.test",
      map: "https://maps.app.goo.gl/FC2477wQmJBEde4D9",
    },
    working_hours: [
      { days: "Dimanche – Mardi, Jeudi", hours: "09:00 - 17:00" },
      { days: "Mercredi", hours: "09:00 - 16:00" },
    ],
  },
  other_desks: [
    {
      name: "Station Adrar",
      phone: "05555555",
      phone2: null,
      code_wilaya: "1",
      wilaya: "Adrar",
      commune: "Adrar",
      adresse: "أدرار",
      map: null,
    },
    {
      name: "station chlef",
      phone: null,
      phone2: null,
      code_wilaya: "2",
      wilaya: "Chlef",
      commune: "Chlef",
      adresse: null,
      map: null,
    },
    {
      name: "station bechar",
      phone: null,
      phone2: null,
      code_wilaya: "8",
      wilaya: "Béchar",
      commune: "Bechar",
      adresse: null,
      map: null,
    },
  ],
} as const;

/**
 * Index-keyed commune object (NOT an array). Four communes carry
 * has_stop_desk=1 so stop-desk filtering has real data to slice.
 */
export const COMMUNES_FIXTURE: EcotrackCommunesResponse = {
  "0": { nom: "Abadla", wilaya_id: 1, code_postal: "817", has_stop_desk: 0 },
  "1": { nom: "Adrar", wilaya_id: 1, code_postal: "101", has_stop_desk: 0 },
  "2": { nom: "Alger Centre", wilaya_id: 16, code_postal: "16001", has_stop_desk: 1 },
  "3": { nom: "Bab Ezzouar", wilaya_id: 16, code_postal: "16100", has_stop_desk: 1 },
  "4": { nom: "Chlef", wilaya_id: 2, code_postal: "202", has_stop_desk: 0 },
  "5": { nom: "Constantine", wilaya_id: 25, code_postal: "25001", has_stop_desk: 1 },
  "6": { nom: "Oran", wilaya_id: 31, code_postal: "31001", has_stop_desk: 1 },
  "7": { nom: "Sétif", wilaya_id: 19, code_postal: "19001", has_stop_desk: 0 },
  "8": { nom: "Batna", wilaya_id: 5, code_postal: "501", has_stop_desk: 0 },
  "9": { nom: "Tamanrasset", wilaya_id: 11, code_postal: "1101", has_stop_desk: 0 },
  "10": { nom: "Tlemcen", wilaya_id: 13, code_postal: "1301", has_stop_desk: 0 },
  "11": { nom: "Laghouat", wilaya_id: 3, code_postal: "301", has_stop_desk: 0 },
};

export const FEES_FIXTURE = {
  livraison: [
    { wilaya_id: 1, tarif: "1300", tarif_stopdesk: "900" },
    { wilaya_id: 2, tarif: "850", tarif_stopdesk: "450" },
    { wilaya_id: 5, tarif: "900", tarif_stopdesk: "500" },
    { wilaya_id: 16, tarif: "650", tarif_stopdesk: "400" },
    { wilaya_id: 11, tarif: "1500", tarif_stopdesk: "0" },
    { wilaya_id: 25, tarif: "800", tarif_stopdesk: "550" },
  ],
} as const;

export const PRODUCTS_LIST_FIXTURE = {
  products: [
    {
      reference: "290444",
      barcode: null,
      title: "kas",
      is_active: 1,
      image: null,
      stock_disponible: 1,
      stock_reserve: 1,
      stock_phisique: 2,
    },
  ],
  pagination: { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1 },
} as const;

// ─── Orders list / status filter ──────────────────────────────────────────────

export const ORDERS_PAGE_FIXTURE = {
  current_page: 1,
  data: [
    {
      tracking: "ECG4SU2112195902",
      reference: null,
      client: "kas",
      phone: "0560351041",
      phone_2: null,
      adresse: "Alger",
      commune: "Ain Taya",
      wilaya_id: 16,
      montant: "500",
      tarif_prestation: "400",
      tarif_retour: "200",
      type_id: 1,
      created_at: "2021-12-19",
      payment_id: null,
      return_id: null,
      status: "prete_a_expedier",
      products: "Prod 1",
    },
    {
      tracking: "ECG4SU2111175434",
      reference: "REF123",
      client: "client 1",
      phone: "0500000000",
      phone_2: null,
      adresse: "ouled fayet",
      commune: "Ouled Fayet",
      wilaya_id: 16,
      montant: "21900",
      tarif_prestation: "400",
      tarif_retour: "200",
      type_id: 1,
      created_at: "2021-11-16",
      payment_id: 312,
      return_id: null,
      status: "payé_et_archivé",
      products: "Prod 1",
    },
  ],
  from: 1,
  last_page: 1,
  per_page: 40,
  to: 2,
  total: 2,
} as const;

export const ORDERS_STATUS_FIXTURE = {
  data: {
    ECLWIT2505052286: {
      status: "en_preparation",
      order_id: "1237",
      desk_phone: "",
      desk_commune: "",
      desk_map_link: "",
      desk_address: "",
      activity: [
        {
          reason: "Client ne réponds pas",
          details: "",
          station: "Station principale",
          driver: "HINI Djamel",
          date: "2025-07-16",
          time: "02:08:51",
          postponed_to: null,
        },
        {
          reason: "Le client est absent",
          details: "test 000029",
          station: "Station principale",
          driver: "HINI Djamel",
          date: "2025-07-16",
          time: "02:09:11",
          postponed_to: "2025-07-19",
        },
      ],
    },
    ECLWIT2507162547: {
      status: "en_livraison",
      order_id: "",
      driver_phone: "0550000000",
      activity: [],
    },
  },
} as const;

// ─── Label ────────────────────────────────────────────────────────────────────

/** Minimal PDF header bytes ("%PDF-1.4") the label endpoint returns. */
export const LABEL_PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
]);

/** Create-order required fields, per the official param table. */
export const CREATE_REQUIRED_FIELDS = [
  "nom_client",
  "telephone",
  "adresse",
  "code_wilaya",
  "commune",
  "montant",
  "type",
] as const;
