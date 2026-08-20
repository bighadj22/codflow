"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/translations";

export function NoAccess() {
  const auth = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <ShieldAlert className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-black mb-2 text-foreground">
        {auth.unauthorized}
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        {auth.no_access}
      </p>
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: "outline" }), "rounded-xl font-bold h-11 px-6")}
      >
        {auth.back_to_dashboard}
      </Link>
    </div>
  );
}
