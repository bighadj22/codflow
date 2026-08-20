"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useCommon } from "@/lib/translations";

interface ErrorStateProps {
  message: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({ message, retry, className }: ErrorStateProps) {
  const common = useCommon();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={28} className="text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{common.error_occurred}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{message}</p>
      {retry && (
        <Button onClick={retry} variant="outline" className="h-11">
          {common.retry}
        </Button>
      )}
    </div>
  );
}
