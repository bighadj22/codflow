"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useSettings } from "@/lib/translations";
import { Section, PasswordInput, FieldRow } from "./shared-fields";

export interface SecuritySettingsProps {
  // Security settings doesn't need storeConfig, it uses authClient directly
}

export function SecuritySettings({}: SecuritySettingsProps) {
  const t = useSettings();
  const s = t.store;

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<{
    current?: string;
    newPw?: string;
    confirm?: string;
  }>({});
  const [saving, startTransition] = useTransition();

  const handleSave = () => {
    // Validate password fields
    const errs: typeof pwErrors = {};
    if (!currentPw) errs.current = s.password_error_required;
    if (!newPw) errs.newPw = s.password_error_required;
    else if (newPw.length < 8) errs.newPw = s.password_error_min_length;
    if (!confirmPw) errs.confirm = s.password_error_required;
    else if (confirmPw !== newPw) errs.confirm = s.password_error_mismatch;

    setPwErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Proceed with password change
    startTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
        revokeOtherSessions: false,
      });

      if (error) {
        const isWrongPassword =
          error.message?.toLowerCase().includes("invalid") ||
          error.message?.toLowerCase().includes("incorrect");
        toast.error(isWrongPassword ? s.password_error_wrong : s.save_error);
      } else {
        toast.success(s.password_saved);
        // Clear form fields on success
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        setPwErrors({});
      }
    });
  };

  return (
    <Section
      icon={Lock}
      title={s.security_title}
      subtitle={s.security_subtitle}
      saving={saving}
      saveLabel={s.save}
      savingLabel={s.saving}
      onSave={handleSave}
    >
      <FieldRow label={s.current_password_label}>
        <PasswordInput
          value={currentPw}
          onChange={(v) => {
            setCurrentPw(v);
            setPwErrors((e) => ({ ...e, current: undefined }));
          }}
          placeholder={s.current_password_placeholder}
          error={pwErrors.current}
        />
      </FieldRow>

      <FieldRow label={s.new_password_label} hint={s.new_password_hint}>
        <PasswordInput
          value={newPw}
          onChange={(v) => {
            setNewPw(v);
            setPwErrors((e) => ({ ...e, newPw: undefined }));
          }}
          placeholder={s.new_password_placeholder}
          error={pwErrors.newPw}
        />
      </FieldRow>

      <FieldRow label={s.confirm_password_label}>
        <PasswordInput
          value={confirmPw}
          onChange={(v) => {
            setConfirmPw(v);
            setPwErrors((e) => ({ ...e, confirm: undefined }));
          }}
          placeholder={s.confirm_password_placeholder}
          error={pwErrors.confirm}
        />
      </FieldRow>
    </Section>
  );
}
