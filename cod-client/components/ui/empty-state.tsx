"use client";

import { LucideIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in-up",
      "glass-card rounded-[3rem] border-white/40 dark:border-white/5 shadow-premium overflow-hidden relative group",
      className
    )}>
      {/* Texture & Ambient Glow */}
      <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center max-w-sm mx-auto">
        {/* Animated Icon Container */}
        <div className="relative mb-8 group-hover:scale-110 transition-transform duration-700">
          <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="relative w-24 h-24 rounded-[2.5rem] bg-white dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-xl flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
            <Icon size={40} className="text-primary group-hover:rotate-6 transition-transform duration-500" />
          </div>
        </div>

        {/* Text Content */}
        <h3 className="text-2xl font-black text-foreground tracking-tight mb-3">
          {title}
        </h3>
        <p className="text-[14px] font-medium text-muted-foreground/80 leading-relaxed mb-10">
          {description}
        </p>

        {/* Action Button */}
        {onAction && actionLabel && (
          <Button
            onClick={onAction}
            className="h-12 px-8 rounded-2xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <Plus size={16} className="me-2" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
