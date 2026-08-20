"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useTeam } from "@/lib/translations";
import { grantScope, revokeScope } from "@/actions/users";
import { SCOPE_CATEGORIES } from "@/../cod-shared/rbac/scopes";
import type { User } from "@/actions/users";
import { Shield, Save, X, Info, Lock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  user: User;
  onSuccess?: () => void;
}

export function ScopeAssignmentDialog({ open, onClose, user, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  // For admin users, show all available scopes as if they have them all
  const initialScopes = user.role === "admin" 
    ? Object.values(SCOPE_CATEGORIES).flatMap(category => category.scopes)
    : (user.scopes || []);
  const [userScopes, setUserScopes] = useState<string[]>(initialScopes);
  const [pendingChanges, setPendingChanges] = useState<{
    toGrant: string[];
    toRevoke: string[];
  }>({ toGrant: [], toRevoke: [] });

  const t = useTeam();

  useEffect(() => {
    // For admin users, show all available scopes as if they have them all
    const initialScopes = user.role === "admin" 
      ? Object.values(SCOPE_CATEGORIES).flatMap(category => category.scopes)
      : (user.scopes || []);
    setUserScopes(initialScopes);
    setPendingChanges({ toGrant: [], toRevoke: [] });
  }, [user]);

  const handleScopeToggle = (scope: string, checked: boolean) => {
    const currentlyHas = userScopes.includes(scope);
    
    if (checked && !currentlyHas) {
      setPendingChanges(prev => ({
        toGrant: [...prev.toGrant.filter(s => s !== scope), scope],
        toRevoke: prev.toRevoke.filter(s => s !== scope)
      }));
    } else if (!checked && currentlyHas) {
      setPendingChanges(prev => ({
        toGrant: prev.toGrant.filter(s => s !== scope),
        toRevoke: [...prev.toRevoke.filter(s => s !== scope), scope]
      }));
    } else {
      setPendingChanges(prev => ({
        toGrant: prev.toGrant.filter(s => s !== scope),
        toRevoke: prev.toRevoke.filter(s => s !== scope)
      }));
    }
  };

  const isScopeChecked = (scope: string) => {
    const currentlyHas = userScopes.includes(scope);
    const willGrant = pendingChanges.toGrant.includes(scope);
    const willRevoke = pendingChanges.toRevoke.includes(scope);
    
    if (willGrant) return true;
    if (willRevoke) return false;
    return currentlyHas;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const scope of pendingChanges.toGrant) {
        await grantScope(user.id, scope);
      }
      for (const scope of pendingChanges.toRevoke) {
        await revokeScope(user.id, scope);
      }
      toast.success(t.scope_dialog.success);
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(t.scope_dialog.error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = pendingChanges.toGrant.length > 0 || pendingChanges.toRevoke.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-border/30 glass-card rounded-3xl">
        <DialogHeader className="p-6 sm:p-8 border-b border-border/10 bg-muted/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-foreground tracking-tight font-display uppercase">
                {t.scope_dialog.title}
              </DialogTitle>
              <p className="text-[10px] sm:text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest mt-0.5">
                Managing permissions for {user.name}
              </p>
              {user.role === "admin" && (
                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mt-1 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  Admin users have all permissions by default
                </p>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 sm:p-8 space-y-8">
            {Object.entries(SCOPE_CATEGORIES).map(([key, category]) => (
              <div key={key} className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/5">
                  <div className="w-1.5 h-4 bg-primary/20 rounded-full" />
                  <h3 className="font-black text-xs uppercase tracking-widest text-foreground/60">{t.scope_categories[key as keyof typeof t.scope_categories] ?? category.label}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {category.scopes.map((scope) => {
                    const checked = isScopeChecked(scope);
                    const willGrant = pendingChanges.toGrant.includes(scope);
                    const willRevoke = pendingChanges.toRevoke.includes(scope);
                    
                    return (
                      <label
                        key={scope}
                        className={cn(
                          "group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer active:scale-[0.98]",
                          checked 
                            ? "bg-primary/[0.03] border-primary/20" 
                            : "bg-muted/20 border-border/40 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Checkbox
                            id={scope}
                            checked={checked}
                            onCheckedChange={(c) => handleScopeToggle(scope, c as boolean)}
                            className="rounded-md"
                          />
                          <div className="min-w-0">
                            <p className={cn(
                              "text-xs font-bold truncate transition-colors",
                              checked ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {t.scope_actions[scope.split(':').pop() as keyof typeof t.scope_actions] ?? scope.split(':').pop()?.replace(/_/g, ' ')}
                            </p>
                            <p className="text-[9px] font-mono text-muted-foreground/40 truncate uppercase">{scope}</p>
                          </div>
                        </div>
                        
                        {(willGrant || willRevoke) && (
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[8px] font-black uppercase tracking-tighter py-0 h-4 border-none shrink-0 ml-2",
                              willGrant ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                            )}
                          >
                            {willGrant ? t.scope_dialog.will_grant : t.scope_dialog.will_revoke}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-6 sm:p-8 border-t border-border/10 bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 opacity-60">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight leading-tight">
              {t.scope_dialog.security_warning}
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1 sm:flex-none h-11 px-6 rounded-xl border-border/40 bg-white/50 dark:bg-muted/20 font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95"
            >
              {t.scope_dialog.cancel}
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={loading || !hasChanges}
              className="flex-1 sm:flex-none h-11 px-8 rounded-xl bg-primary text-primary-foreground font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "..." : <><Save className="w-3.5 h-3.5 me-2" /> {t.scope_dialog.save_changes}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
