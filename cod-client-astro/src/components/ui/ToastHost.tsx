import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useLocale } from "@/i18n/react";
import { consumeFlashToast } from "@/lib/notify";

export function ToastHost() {
  const locale = useLocale();
  const rtl = locale === "ar";

  useEffect(() => {
    consumeFlashToast();
  }, []);

  return (
    <Toaster
      position={rtl ? "top-left" : "top-right"}
      gutter={8}
      containerStyle={{ top: 68, left: 16, right: 16 }}
      toastOptions={{
        duration: 4000,
        ariaProps: { role: "status", "aria-live": "polite" },
        style: {
          direction: rtl ? "rtl" : "ltr",
          maxWidth: "min(26rem, calc(100vw - 2rem))",
          padding: "12px 14px",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          boxShadow: "0 8px 24px rgb(0 0 0 / 0.14)",
          fontFamily: "var(--font-active)",
          fontSize: "14px",
          lineHeight: "1.5",
        },
        success: {
          iconTheme: { primary: "var(--success)", secondary: "var(--card)" },
        },
        error: {
          duration: 6000,
          ariaProps: { role: "alert", "aria-live": "assertive" },
          iconTheme: { primary: "var(--destructive)", secondary: "var(--card)" },
        },
      }}
    />
  );
}
