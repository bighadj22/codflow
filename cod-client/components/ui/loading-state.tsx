import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * LoadingState Component
 * 
 * Displays a consistent loading state with spinner and optional message.
 * 
 * @example
 * ```tsx
 * <LoadingState message={message} />
 * ```
 */
export function LoadingState({ message, className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4",
        className
      )}
    >
      <Loader2 size={32} className="text-primary animate-spin mb-4" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
