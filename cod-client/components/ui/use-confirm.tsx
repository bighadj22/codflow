"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCommon } from "@/lib/translations";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const common = useCommon();
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  function handleConfirm() {
    state?.resolve(true);
    setState(null);
  }

  function handleCancel() {
    state?.resolve(false);
    setState(null);
  }

  const ConfirmDialog = state ? (
    <Dialog open onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
            state.variant === "destructive"
              ? "bg-destructive/10"
              : "bg-primary/10"
          }`}>
            {state.variant === "destructive"
              ? <AlertTriangle size={18} className="text-destructive" />
              : <HelpCircle size={18} className="text-primary" />
            }
          </div>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && (
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              {state.description}
            </p>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {state.cancelLabel ?? common.cancel}
          </Button>
          <Button
            variant={state.variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {state.confirmLabel ?? common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { confirm, ConfirmDialog };
}
