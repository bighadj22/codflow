import { useEffect, useState } from "react";
import { Crown, Lock, Save, Shield } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPE_CATEGORIES } from "../../../../../cod-shared/rbac/scopes";
import { grantTeamMemberScope, revokeTeamMemberScope } from "@/features/team/api";
import { teamErrorMessage } from "@/features/team/model";
import type { TeamMember } from "@/features/team/types";

interface Props {
  open: boolean;
  onClose: () => void;
  user: TeamMember;
  onSuccess?: () => void;
}

export function ScopeAssignmentDialog({ open, onClose, user, onSuccess }: Props) {
  const t = useT("team");
  const [loading, setLoading] = useState(false);
  const [userScopes, setUserScopes] = useState<string[]>([]);
  const [toGrant, setToGrant] = useState<string[]>([]);
  const [toRevoke, setToRevoke] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user.role === "admin";

  useEffect(() => {
    if (!open) return;
    setUserScopes(
      isAdmin
        ? Object.values(SCOPE_CATEGORIES).flatMap((category) => category.scopes)
        : (user.scopes ?? []),
    );
    setToGrant([]);
    setToRevoke([]);
    setError(null);
  }, [open, user, isAdmin]);

  const isScopeChecked = (scope: string) => {
    const currentlyHas = userScopes.includes(scope);
    if (toGrant.includes(scope)) return true;
    if (toRevoke.includes(scope)) return false;
    return currentlyHas;
  };

  const willChange = (scope: string) => toGrant.includes(scope) || toRevoke.includes(scope);

  function handleScopeToggle(scope: string, checked: boolean) {
    const currentlyHas = userScopes.includes(scope);
    if (checked && !currentlyHas) {
      setToGrant((current) =>
        current.includes(scope) ? current : [...current, scope],
      );
      setToRevoke((current) => current.filter((s) => s !== scope));
    } else if (!checked && currentlyHas) {
      setToRevoke((current) =>
        current.includes(scope) ? current : [...current, scope],
      );
      setToGrant((current) => current.filter((s) => s !== scope));
    } else {
      setToGrant((current) => current.filter((s) => s !== scope));
      setToRevoke((current) => current.filter((s) => s !== scope));
    }
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      for (const scope of toGrant) {
        await grantTeamMemberScope(user.id, scope);
      }
      for (const scope of toRevoke) {
        await revokeTeamMemberScope(user.id, scope);
      }
      notify.success(t("scope_dialog.success"));
      onClose();
      onSuccess?.();
    } catch (cause) {
      setError(teamErrorMessage(cause, t));
      notify.error(t("scope_dialog.error"));
    } finally {
      setLoading(false);
    }
  }

  const hasChanges = toGrant.length > 0 || toRevoke.length > 0;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title={
        <span className="inline-flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Shield size={16} />
          </span>
          <span>
            {t("scope_dialog.title")}
            <span className="ms-2 text-xs font-medium text-muted-foreground">
              {user.name}
            </span>
            {isAdmin && (
              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <Crown size={11} />
                {t("scope_dialog.admin_full_access")}
              </span>
            )}
          </span>
        </span>
      }
      className="max-w-2xl"
      showClose={!loading}
    >
      {error && (
        <p className="mb-4 text-sm font-semibold text-destructive">{error}</p>
      )}
      <div className="max-h-[60dvh] space-y-6 overflow-y-auto pe-1">
        {Object.entries(SCOPE_CATEGORIES).map(([key, category]) => (
          <section key={key}>
            <h3 className="mb-3 border-b border-border pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t(`scope_categories.${key}`)}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {category.scopes.map((scope) => {
                const checked = isScopeChecked(scope);
                const changed = willChange(scope);
                const granting = toGrant.includes(scope);
                const action = scope.split(":").pop() ?? "";
                return (
                  <label
                    key={scope}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? "border-primary/20 bg-primary/[0.03]"
                        : "border-border bg-muted/20 hover:bg-muted/40"
                    } ${changed ? "ring-1 ring-primary/30" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          handleScopeToggle(scope, event.currentTarget.checked)
                        }
                        disabled={loading}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-sm font-semibold ${checked ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {t(`scope_actions.${action}`)}
                        </span>
                        <span className="block truncate font-mono text-[10px] uppercase text-muted-foreground/50" dir="ltr">
                          {scope}
                        </span>
                      </span>
                    </span>
                    {changed && (
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight ${
                          granting
                            ? "bg-violet-500/10 text-violet-600"
                            : "bg-rose-500/10 text-rose-600"
                        }`}
                      >
                        {granting ? t("scope_dialog.will_grant") : t("scope_dialog.will_revoke")}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Lock size={13} className="shrink-0" />
          {t("scope_dialog.security_warning")}
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {t("scope_dialog.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={loading || !hasChanges}>
            <Save size={15} />
            {loading ? t("scope_dialog.saving") : t("scope_dialog.save_changes")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
