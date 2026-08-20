/**
 * Root route — internal-tool entry point.
 *
 * No landing page: the dashboard is private to the tenant's team, so an
 * unauthenticated visitor has nothing to read on `/`. We redirect straight
 * to the relevant target:
 *   • already signed in  → /dashboard
 *   • not signed in      → /sign-in
 *
 * Server-side redirect (not a client-side `<a>`) so there's no flash of
 * empty page and no extra round-trip.
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function RootPage() {
  const user = await getUser();
  redirect(user ? "/dashboard" : "/sign-in");
}
