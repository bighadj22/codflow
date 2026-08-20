"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      dir="ltr"
      className={cn(
        // Base layout — force LTR so thumb travels left→right regardless of page dir (RTL fix)
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        // Expanded touch target for mobile
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        // Transitions + focus
        "transition-colors duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        // Sizes (border-2 is included in these dimensions)
        "data-[size=default]:h-6 data-[size=default]:w-11",
        "data-[size=sm]:h-5 data-[size=sm]:w-9",
        // Track colors
        "data-checked:bg-primary data-unchecked:bg-input",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          // Default: thumb is size-5 (20px), container inner is 40px → travels 0→20px
          "group-data-[size=default]/switch:size-5",
          "group-data-[size=default]/switch:data-unchecked:translate-x-0",
          "group-data-[size=default]/switch:data-checked:translate-x-5",
          // Sm: thumb is size-4 (16px), container inner is 32px → travels 0→16px
          "group-data-[size=sm]/switch:size-4",
          "group-data-[size=sm]/switch:data-unchecked:translate-x-0",
          "group-data-[size=sm]/switch:data-checked:translate-x-4",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
