import { useEffect, useState, type SyntheticEvent } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { PageHeader, Input, Select, Button, Alert } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { fetchIdentity } from "@/lib/session";
import { notify } from "@/lib/notify";
import { useT } from "@/i18n/react";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Self-service profile: display name + email language (the fields a member
 * owns), and password change (current password required). Privileged fields
 * (role, status, API key) are server-rejected on this endpoint — see
 * server.ts `input: false` — so nothing here can touch them.
 */
function ProfileContent() {
  const t = useT("profile");
  const identity = useIdentity();
  const [name, setName] = useState(identity?.user.name ?? "");
  const [emailLanguage, setEmailLanguage] = useState<"ar" | "en">("en");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (!identity?.user) return;
    setName(identity.user.name ?? "");
    setEmailLanguage(identity.user.language === "ar" ? "ar" : "en");
  }, [identity?.user]);

  async function saveProfile(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    try {
      // The bare client doesn't infer server additionalFields (language);
      // a non-fresh object keeps the runtime payload while satisfying the
      // narrower client type.
      const updates: { name: string; language: "ar" | "en" } = {
        name: name.trim(),
        language: emailLanguage,
      };
      const { error } = await authClient.updateUser(updates);
      if (error) {
        setProfileError(t("save_error"));
        notify.error(t("save_error"));
        return;
      }
      notify.flashSuccess(t("saved"));
      await fetchIdentity();
    } catch {
      setProfileError(t("save_error"));
      notify.error(t("save_error"));
    } finally {
      setSavingProfile(false);
    }
  }

  function validatePassword(): string | null {
    if (!currentPassword) return t("password_error_required");
    if (newPassword.length < MIN_PASSWORD_LENGTH) return t("password_error_min_length");
    if (newPassword !== confirmPassword) return t("password_error_mismatch");
    return null;
  }

  async function changePassword(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validatePassword();
    if (invalid) {
      setPasswordError(invalid);
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        const message =
          error.code === "INVALID_PASSWORD"
            ? t("password_error_wrong")
            : t("save_error");
        setPasswordError(message);
        notify.error(message);
        return;
      }
      setPasswordSaved(true);
      notify.flashSuccess(t("password_saved"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => setPasswordSaved(false), 4000);
    } catch {
      setPasswordError(t("save_error"));
      notify.error(t("save_error"));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form onSubmit={saveProfile} className="rounded-xl border border-border bg-card" noValidate>
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <UserRound size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("identity_title")}</h2>
            <p className="text-xs text-muted-foreground">{t("identity_subtitle")}</p>
          </div>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="profile-name">
              {t("name_label")}
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder={t("name_placeholder")}
              disabled={savingProfile}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="profile-email">
              {t("email_label")}
            </label>
            <Input
              id="profile-email"
              dir="ltr"
              value={identity?.user.email ?? ""}
              readOnly
              disabled
              className="opacity-70"
            />
            <p className="text-xs text-muted-foreground">{t("email_hint")}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="profile-language">
              {t("language_label")}
            </label>
            <Select
              id="profile-language"
              value={emailLanguage}
              onChange={(event) => setEmailLanguage(event.currentTarget.value as "ar" | "en")}
              disabled={savingProfile}
            >
              <option value="ar">{t("language_ar")}</option>
              <option value="en">{t("language_en")}</option>
            </Select>
            <p className="text-xs text-muted-foreground">{t("language_hint")}</p>
          </div>
          {profileError && (
            <Alert role="alert" tone="critical">
              {profileError}
            </Alert>
          )}
        </div>
        <div className="flex items-center justify-end border-t border-border px-5 py-4">
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? t("saving") : t("save")}
          </Button>
        </div>
      </form>

      <form onSubmit={changePassword} className="rounded-xl border border-border bg-card" noValidate>
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("security_title")}</h2>
            <p className="text-xs text-muted-foreground">{t("security_subtitle")}</p>
          </div>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="current-password">
              {t("current_password_label")}
            </label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.currentTarget.value)}
              placeholder={t("current_password_placeholder")}
              disabled={savingPassword}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="new-password">
              {t("new_password_label")}
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(event) => setNewPassword(event.currentTarget.value)}
              placeholder={t("new_password_placeholder")}
              disabled={savingPassword}
            />
            <p className="text-xs text-muted-foreground">{t("new_password_hint")}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="confirm-password">
              {t("confirm_password_label")}
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              placeholder={t("confirm_password_placeholder")}
              disabled={savingPassword}
            />
          </div>
          {passwordSaved && (
            <Alert role="status" tone="success">
              {t("password_saved")}
            </Alert>
          )}
          {passwordError && (
            <Alert role="alert" tone="critical">
              {passwordError}
            </Alert>
          )}
        </div>
        <div className="flex items-center justify-end border-t border-border px-5 py-4">
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? t("changing") : t("security_title")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Gated() {
  const t = useT("profile");
  return (
    <DashboardChrome currentPath="/profile">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ProfileContent />
    </DashboardChrome>
  );
}

export default function ProfilePageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}
