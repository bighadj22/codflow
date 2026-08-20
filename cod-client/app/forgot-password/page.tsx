import React from "react";
import { getDashboardBrand } from "@/lib/brand";
import { ForgotPasswordView } from "@/components/auth/forgot-password-view";

export default async function ForgotPasswordPage() {
  const brand = await getDashboardBrand();
  return (
    <div style={{ "--primary": brand.primaryColor, "--primary-foreground": "#ffffff" } as React.CSSProperties}>
      <ForgotPasswordView brandName={brand.brandName} />
    </div>
  );
}
