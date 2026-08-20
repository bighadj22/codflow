"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, KeyRound, Copy, Check, AlertTriangle } from "lucide-react";
import { TeamTable } from "@/components/team/team-table";
import { InviteDialog } from "@/components/team/invite-dialog";
import { ScopeAssignmentDialog } from "@/components/team/scope-assignment-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTeam } from "@/lib/translations";
import { rotateApiKey } from "@/actions/users";
import type { User } from "@/actions/users";
import { cn } from "@/lib/utils";

interface TeamViewProps {
  users: User[];
}

export function TeamView({ users }: TeamViewProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [rotatedKeyUser, setRotatedKeyUser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const t = useTeam();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleManageScopes = (user: User) => {
    setSelectedUser(user);
    setScopeDialogOpen(true);
  };

  const handleRotateApiKey = async (user: User) => {
    const ok = await confirm({
      title: (t.rotate_key_dialog?.confirm_title || "Rotate API Key for {name}?").replace("{name}", user.name),
      description: t.rotate_key_dialog?.confirm_description || "The current key will be immediately invalidated. The new key is shown once — copy it before closing.",
      confirmLabel: t.rotate_key_dialog?.confirm_button || "Rotate Key",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      const result = await rotateApiKey(user.id);
      setRotatedKey(result.apiKey);
      setRotatedKeyUser(user.name);
      setCopied(false);
    } catch (err) {
      console.error("Failed to rotate API key:", err);
    }
  };

  const handleCopyKey = () => {
    if (!rotatedKey) return;
    navigator.clipboard.writeText(rotatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/5 border border-primary/10 rounded-xl w-fit">
          <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-primary/80">
            {users.length} {t.team_members}
          </p>
        </div>
        
        <Button
          size="sm"
          className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all px-4 sm:px-6"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 me-1.5 sm:me-2" />
          {t.invite_user}
        </Button>
      </div>

      <TeamTable
        users={users}
        onManageScopes={handleManageScopes}
        onRotateApiKey={handleRotateApiKey}
      />

      {/* Dialogs */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />

      {selectedUser && (
        <ScopeAssignmentDialog
          open={scopeDialogOpen}
          onClose={() => {
            setScopeDialogOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Rotate API Key result dialog */}
      <Dialog open={!!rotatedKey} onOpenChange={(open) => { if (!open) { setRotatedKey(null); setRotatedKeyUser(null); } }}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-1">
              <KeyRound size={18} className="text-amber-600" />
            </div>
            <DialogTitle>{t.rotate_key_dialog?.result_title || "New API Key"}</DialogTitle>
            {rotatedKeyUser && (
              <p className="text-sm text-muted-foreground font-medium">
                {(t.rotate_key_dialog?.result_subtitle || "Key rotated for {name}").replace("{name}", rotatedKeyUser)}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono bg-muted/60 border border-border/40 rounded-xl px-3 py-2.5 text-foreground truncate select-all">
                {rotatedKey}
              </code>
              <Button
                size="icon-sm"
                variant="outline"
                className="shrink-0 rounded-xl"
                onClick={handleCopyKey}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-rose-500/8 border border-rose-500/15 px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-[11px] font-bold text-rose-600 leading-relaxed">
                {t.rotate_key_dialog?.warning || "This key will not be shown again. Copy it now and share it securely."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => { setRotatedKey(null); setRotatedKeyUser(null); }}
            >
              {t.rotate_key_dialog?.done || "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </div>
  );
}
