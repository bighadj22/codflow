import React from "react";
import { getDashboardBrand } from "@/lib/brand";
import { SignInView } from "@/components/auth/sign-in-view";

export default async function SignInPage() {
  const brand = await getDashboardBrand();
  return (
    <div style={{ "--primary": brand.primaryColor, "--primary-foreground": "#ffffff" } as React.CSSProperties}>
      <SignInView brandName={brand.brandName} brandLogoUrl={brand.logoUrl} />
    </div>
  );
}
