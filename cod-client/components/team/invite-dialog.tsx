"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useTeam, useCommon } from "@/lib/translations";
import { createUser } from "@/actions/users";
import { SCOPE_CATEGORIES } from "@/../cod-shared/rbac/scopes";
import { UserPlus, Mail, User, KeyRound, ChevronDown, ChevronUp, Copy, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type DialogState = "form" | "success";

export function InviteDialog({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>("form");
  const [createdApiKey, setCreatedApiKey] = useState("");
  const [createdTempPassword, setCreatedTempPassword] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const t = useTeam();
  const common = useCommon();

  const isAdmin = role === "admin";

  function resetForm() {
    setName("");
    setEmail("");
    setRole("staff");
    setSelectedScopes([]);
    setExpandedGroups([]);
    setCreatedApiKey("");
    setCreatedTempPassword("");
    setCreatedName("");
    setCopied(false);
    setCopiedPassword(false);
    setDialogState("form");
  }

  function handleDone() {
    resetForm();
    onClose();
    onSuccess?.();
  }

  function handleOpenChange(open: boolean) {
    if (!open && !loading) {
      resetForm();
      onClose();
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function toggleScope(scope: string, checked: boolean) {
    setSelectedScopes((prev) =>
      checked ? [...prev, scope] : prev.filter((s) => s !== scope),
    );
  }

  function toggleAllInGroup(scopes: readonly string[], allChecked: boolean) {
    if (allChecked) {
      setSelectedScopes((prev) => prev.filter((s) => !scopes.includes(s)));
    } else {
      setSelectedScopes((prev) => [...new Set([...prev, ...scopes])]);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(createdApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(createdTempPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error(t.invite_dialog.validation_error);
      return;
    }

    setLoading(true);
    try {
      const { user, apiKey, tempPassword } = await createUser({
        name: name.trim(),
        email: email.trim(),
        role,
        scopes: isAdmin ? [] : selectedScopes,
      });
      setCreatedApiKey(apiKey);
      setCreatedTempPassword(tempPassword);
      setCreatedName(user.name ?? name.trim());
      setDialogState("success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : t.invite_dialog.error;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-border/30 glass-card rounded-3xl">

        {/* ── Success state ── */}
        {dialogState === "success" && (
          <>
            <DialogHeader className="p-6 sm:p-8 border-b border-border/10 bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-foreground tracking-tight font-display uppercase">
                    {t.invite_dialog_extra.success_title}
                  </DialogTitle>
                  <p className="text-[10px] sm:text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest mt-0.5">
                    {createdName}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="p-6 sm:p-8 space-y-5">
              <div className="space-y-3">
                <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ms-1 flex items-center gap-1.5">
                  <KeyRound size={10} className="text-primary/50" />
                  {t.invite_dialog_extra.api_key_label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={createdApiKey}
                    readOnly
                    className="h-11 bg-muted/20 border-border/40 rounded-2xl px-4 text-sm font-bold font-mono tracking-wider text-foreground"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyKey}
                    className="h-11 w-11 shrink-0 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 p-0 flex items-center justify-center transition-all active:scale-95"
                  >
                    {copied
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <Copy className="w-4 h-4 text-muted-foreground" />
                    }
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ms-1 flex items-center gap-1.5">
                  <KeyRound size={10} className="text-amber-500/70" />
                  {t.invite_dialog_extra.temp_password_label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={createdTempPassword}
                    readOnly
                    className="h-11 bg-amber-50/50 dark:bg-amber-500/5 border-amber-200/40 dark:border-amber-500/20 rounded-2xl px-4 text-sm font-bold font-mono tracking-wider text-foreground"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyPassword}
                    className="h-11 w-11 shrink-0 rounded-2xl border-amber-200/40 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-0 flex items-center justify-center transition-all active:scale-95"
                  >
                    {copiedPassword
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <Copy className="w-4 h-4 text-amber-600" />
                    }
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/15 flex items-start gap-2.5">
                <KeyRound className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] text-foreground/70 font-bold leading-relaxed">
                    {t.invite_dialog_extra.api_key_warning}
                  </p>
                  <p className="text-[10px] text-amber-600 font-bold leading-relaxed">
                    {t.invite_dialog_extra.temp_password_warning}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-5 border-t border-border/10 bg-muted/5">
              <Button
                onClick={handleDone}
                className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 transition-all active:scale-95"
              >
                Done
              </Button>
            </div>
          </>
        )}

        {/* ── Form state ── */}
        {dialogState === "form" && (
          <>
            <DialogHeader className="p-6 sm:p-8 border-b border-border/10 bg-muted/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-foreground tracking-tight font-display uppercase">
                    {t.invite_dialog.title}
                  </DialogTitle>
                  <p className="text-[10px] sm:text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest mt-0.5">
                    {t.invite_dialog_extra.success_subtitle}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh]">
              <form id="invite-form" onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">

                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ms-1">
                    {t.invite_dialog.name} *
                  </Label>
                  <div className="relative">
                    <User size={14} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.invite_dialog.name_placeholder}
                      className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl ps-11 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ms-1">
                    {t.invite_dialog.email} *
                  </Label>
                  <div className="relative">
                    <Mail size={14} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.invite_dialog.email_placeholder}
                      className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl ps-11 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all"
                      required
                      disabled={loading}
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ms-1">
                    {t.invite_dialog.role} *
                  </Label>
                  <Select
                    value={role}
                    onValueChange={(v) => {
                      setRole(v ?? "staff");
                      if (v === "admin") setSelectedScopes([]);
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-card rounded-2xl">
                      <SelectItem value="staff" className="font-bold">{common.roles.staff}</SelectItem>
                      <SelectItem value="admin" className="font-bold">{common.roles.admin}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Scopes — staff only */}
                {!isAdmin && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ms-1">
                      <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest flex items-center gap-1.5">
                        <KeyRound size={10} className="text-primary/50" />
                        {t.invite_dialog_extra.permissions_label}
                      </Label>
                      <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">
                        {t.invite_dialog_extra.n_selected.replace("{{count}}", String(selectedScopes.length))}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-border/30 bg-muted/10 overflow-hidden divide-y divide-border/20">
                      {Object.entries(SCOPE_CATEGORIES).map(([key, group]) => {
                        const isExpanded = expandedGroups.includes(key);
                        const groupScopes = group.scopes as readonly string[];
                        const checkedCount = groupScopes.filter((s) => selectedScopes.includes(s)).length;
                        const allChecked = checkedCount === groupScopes.length;
                        const someChecked = checkedCount > 0 && !allChecked;

                        return (
                          <div key={key}>
                            <button
                              type="button"
                              onClick={() => toggleGroup(key)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                              disabled={loading}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={allChecked}
                                  data-state={someChecked ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                                  onCheckedChange={() => toggleAllInGroup(groupScopes, allChecked)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded-md"
                                  disabled={loading}
                                />
                                <span className="text-[11px] font-black text-foreground uppercase tracking-widest">
                                  {t.scope_categories[key as keyof typeof t.scope_categories] ?? group.label}
                                </span>
                                {checkedCount > 0 && (
                                  <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                    {checkedCount}/{groupScopes.length}
                                  </span>
                                )}
                              </div>
                              {isExpanded
                                ? <ChevronUp size={14} className="text-muted-foreground/40 shrink-0" />
                                : <ChevronDown size={14} className="text-muted-foreground/40 shrink-0" />
                              }
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-3 pt-1 space-y-1 bg-muted/5">
                                {groupScopes.map((scope) => (
                                  <label
                                    key={scope}
                                    className={cn(
                                      "flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2 transition-colors hover:bg-muted/30",
                                      selectedScopes.includes(scope) && "bg-primary/5",
                                    )}
                                  >
                                    <Checkbox
                                      checked={selectedScopes.includes(scope)}
                                      onCheckedChange={(checked) => toggleScope(scope, !!checked)}
                                      disabled={loading}
                                      className="rounded-md"
                                    />
                                    <div className="min-w-0">
                                      <span className="block text-[11px] font-bold text-foreground/80">
                                        {t.scope_actions[scope.split(':').pop() as keyof typeof t.scope_actions] ?? scope.split(':').pop()?.replace(/_/g, ' ')}
                                      </span>
                                      <span className="block text-[9px] font-mono text-muted-foreground/40 uppercase" dir="ltr">
                                        {scope}
                                      </span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex items-start gap-2.5">
                    <KeyRound className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground/70 font-medium leading-relaxed">
                      {t.invite_dialog_extra.admin_full_access}
                    </p>
                  </div>
                )}

              </form>
            </ScrollArea>

            <div className="px-6 sm:px-8 py-5 border-t border-border/10 bg-muted/5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => { resetForm(); onClose(); }}
                disabled={loading}
                className="flex-1 h-11 sm:h-12 rounded-xl sm:rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95"
              >
                {t.invite_dialog.cancel}
              </Button>
              <Button
                type="submit"
                form="invite-form"
                disabled={loading}
                className="flex-1 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 transition-all active:scale-95"
              >
                {loading ? "..." : t.invite_dialog.send_invite}
              </Button>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
