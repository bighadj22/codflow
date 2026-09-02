import { apiFetch } from "@/lib/api";
import type { CreateOfferData, Offer } from "./types";

interface ListEnvelope<T> {
  success: boolean;
  data: T[];
  count?: number;
}

interface DataEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function json(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  };
}

export async function listOffers() {
  return (await apiFetch<ListEnvelope<Offer>>("/api/offers")).data;
}

export async function getOffer(id: string) {
  return (await apiFetch<DataEnvelope<Offer>>(`/api/offers/${encodeURIComponent(id)}`)).data;
}

export function createOffer(body: CreateOfferData) {
  return apiFetch<DataEnvelope<Offer>>("/api/offers", json({ method: "POST", body: JSON.stringify(body) }));
}

export function updateOffer(id: string, body: Partial<CreateOfferData>) {
  return apiFetch<DataEnvelope<Offer>>(`/api/offers/${encodeURIComponent(id)}`, json({ method: "PATCH", body: JSON.stringify(body) }));
}

export function deleteOffer(id: string) {
  return apiFetch<DataEnvelope<null>>(`/api/offers/${encodeURIComponent(id)}`, { method: "DELETE" });
}
