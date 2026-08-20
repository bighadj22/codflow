import React from "react";
import { getDashboardBrand } from "@/lib/brand";
import { ResetPasswordView } from "@/components/auth/reset-password-view";

export default async function ResetPasswordPage() {
  const brand = await getDashboardBrand();
  return (
    <div style={{ "--primary": brand.primaryColor, "--primary-foreground": "#ffffff" } as React.CSSProperties}>
      <ResetPasswordView brandName={brand.brandName} />
    </div>
  );
}
