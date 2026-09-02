import { Sparkles } from "lucide-react";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { McpPageContent } from "@/features/mcp/components/McpPageContent";

function Gated() {
  const t = useT("mcp");
  return (
    <DashboardChrome currentPath="/mcp">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles size={17} aria-hidden="true" />
            </span>
            <span>{t("page_title")}</span>
          </span>
        }
        subtitle={t("page_subtitle")}
      />
      <McpPageContent />
    </DashboardChrome>
  );
}

export default function McpPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
