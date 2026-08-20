/**
 * Reference lyt
 * 
 * Full-screen layout for API documentation.
 * Still requires authentication but no dashboard sidebar.
 */


import { requireUser } from "@/lib/auth";

export default async function ReferenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require authentication
  await requireUser();

  return (
    <div dir="ltr" className="[direction:ltr]">
      {children}
    </div>
  );
}
