import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  createDeliveryCompany,
  listAllDeliveryCompanies,
  updateDeliveryCompany,
} from "@/features/delivery/api";
import type { DeliveryCompany } from "@/features/delivery/types";
import { getProviderConfig } from "@/features/delivery/types";
import {
  Alert,
  PageHeader,
  useConfirmDialog,
} from "@/components/ui";
import { CompanyCredentialsFormCard } from "@/features/delivery/components/CompanyCredentialsFormCard";
import { CompanyCredentialsSidebar } from "@/features/delivery/components/CompanyCredentialsSidebar";
import { notify } from "@/lib/notify";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

function Notice({
  message,
  tone,
  onDismiss,
}: {
  message: string;
  tone: "success" | "error";
  onDismiss: () => void;
}) {
  const common = useT("common");
  return (
    <Alert
      role={tone === "error" ? "alert" : "status"}
      tone={tone === "error" ? "critical" : "info"}
    >
      {tone === "error" ? (
        <AlertCircle size={18} className="shrink-0" />
      ) : (
        <CheckCircle2 size={18} className="shrink-0" />
      )}
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} aria-label={common("cancel")}>
        <X size={16} />
      </button>
    </Alert>
  );
}

export function CompanyCredentialsDetail({ providerCode }: { providerCode: string }) {
  const t = useT("delivery_companies");
  const auth = useT("auth");
  const common = useT("common");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [company, setCompany] = useState<DeliveryCompany | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [apiToken, setApiToken] = useState("");
  const [apiUserGuid, setApiUserGuid] = useState("");
  const [fromWilayaName, setFromWilayaName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");

  const config = getProviderConfig(providerCode);

  async function load() {
    setLoadError(null);
    try {
      const companies = await listAllDeliveryCompanies();
      const found = companies.find((item) => item.code === providerCode);
      setCompany(found ?? null);
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.DELIVERY_READ)) void load();
  }, [identity?.role, identity?.scopes.join(","), providerCode]);

  useEffect(() => {
    setApiToken("");
    setApiUserGuid("");
    setApiEndpoint(company?.apiEndpoint ?? config?.endpointDefault ?? "");
    let parsedWilaya = "";
    if (company?.notes) {
      try {
        const notes = JSON.parse(company.notes) as { from_wilaya_name?: string };
        parsedWilaya = notes.from_wilaya_name ?? "";
      } catch {
        parsedWilaya = "";
      }
    }
    setFromWilayaName(parsedWilaya);
  }, [company?.id, company?.apiEndpoint, company?.notes, config?.endpointDefault]);

  async function handleSave() {
    if (!config) return;

    if (!apiToken.trim()) {
      const message = `${config.tokenLabel ?? t("api_token")} ${t("error_required")}`;
      setNotice({ message, tone: "error" });
      notify.error(message);
      return;
    }
    if (config.requiresUserGuid && !apiUserGuid.trim()) {
      const message = `${config.guidLabel ?? t("user_guid")} ${t("error_required")}`;
      setNotice({ message, tone: "error" });
      notify.error(message);
      return;
    }

    setNotice(null);
    setLoading(true);
    try {
      const credentials: Record<string, unknown> = {
        apiToken: apiToken.trim(),
        ...(config.requiresUserGuid ? { apiUserGuid: apiUserGuid.trim() } : {}),
        ...(config.requiresEndpoint
          ? { apiEndpoint: apiEndpoint.trim() || config.endpointDefault || config.apiEndpoint }
          : {}),
      };

      if (config.requiresFromWilaya) {
        const notesJson: Record<string, string> = {};
        const wilaya = fromWilayaName.trim();
        if (wilaya) notesJson.from_wilaya_name = wilaya;
        credentials.notes = Object.keys(notesJson).length > 0 ? JSON.stringify(notesJson) : null;
      }

      if (company) {
        await updateDeliveryCompany(company.id, { ...credentials, active: true });
      } else {
        await createDeliveryCompany({
          name: config.name,
          nameAr: config.nameAr,
          code: config.code,
          website: config.website,
          apiEndpoint: config.apiEndpoint,
          supportsHomeDelivery: config.supportsHomeDelivery,
          supportsStopDesk: config.supportsStopDesk,
          supportsTracking: config.supportsTracking,
          active: true,
          ...credentials,
        });
      }
      notify.flashSuccess(
        company?.isConnected ? t("success_updated") : t("success_connected"),
      );
      window.location.assign(`/delivery/companies/${providerCode}`);
    } catch {
      const message = t("error_saving");
      setNotice({ message, tone: "error" });
      notify.error(message);
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!company) return;
    const ok = await confirm({
      title: t("disconnect_confirm_title"),
      description: `${t("disconnect_confirm_body")} ${config?.name}?`,
      confirmLabel: t("disconnect"),
      cancelLabel: common("cancel"),
      tone: "danger",
    });
    if (!ok) return;

    setNotice(null);
    setDisconnecting(true);
    try {
      await updateDeliveryCompany(company.id, { active: false });
      notify.flashSuccess(t("success_disconnected"));
      window.location.assign(`/delivery/companies/${providerCode}`);
    } catch {
      const message = t("error_saving");
      setNotice({ message, tone: "error" });
      notify.error(message);
      setDisconnecting(false);
    }
  }

  if (!canScope(identity, SCOPES.DELIVERY_MANAGE)) {
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  }

  if (!config) {
    return (
      <Alert role="alert" tone="critical">
        {t("error_not_found")}
      </Alert>
    );
  }

  if (loadError) {
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("error_load")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  }

  if (company === undefined) return <Loading />;

  const isConnected = company?.isConnected ?? false;
  const busy = loading || disconnecting;

  return (
    <div className="space-y-5">
      {notice && (
        <Notice
          message={notice.message}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      )}

      <PageHeader
        title={isConnected ? t("credentials_title_configure") : t("credentials_title_connect")}
        subtitle={config.name}
        backHref={`/delivery/companies/${providerCode}`}
        backLabel={common("cancel")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CompanyCredentialsFormCard
          config={config}
          company={company}
          apiToken={apiToken}
          onApiTokenChange={setApiToken}
          apiUserGuid={apiUserGuid}
          onApiUserGuidChange={setApiUserGuid}
          fromWilayaName={fromWilayaName}
          onFromWilayaNameChange={setFromWilayaName}
          apiEndpoint={apiEndpoint}
          onApiEndpointChange={setApiEndpoint}
          busy={busy}
        />

        <CompanyCredentialsSidebar
          providerCode={providerCode}
          isConnected={isConnected}
          busy={busy}
          loading={loading}
          disconnecting={disconnecting}
          onSave={() => void handleSave()}
          onDisconnect={() => void handleDisconnect()}
        />
      </div>
    </div>
  );
}
