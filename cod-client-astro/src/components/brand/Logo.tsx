import darkLogoUrl from "@/images/logo-codflow.svg?url";
import lightLogoUrl from "@/images/logo-codflow-light.svg?url";

const VARIANT_SRC = {
  dark: darkLogoUrl,
  light: lightLogoUrl,
} as const;

export type LogoVariant = keyof typeof VARIANT_SRC;

/**
 * CodFlow wordmark logo (icon + "codflow" text, intrinsic 2172×724).
 *
 * - `dark`  — purple mark + purple text, for light backgrounds
 * - `light` — purple mark + near-white text, for dark/brand backgrounds
 *
 * Sizing uses inline styles on purpose: Tailwind preflight resets imgs to
 * `height: auto`, which would otherwise drop the height attribute and render
 * the logo at its intrinsic 2172px width. Inline `height` + `width: auto`
 * keeps the aspect ratio locked at every render size.
 */
export function Logo({
  variant = "dark",
  height = 28,
  alt = "CodFlow",
  className,
}: {
  variant?: LogoVariant;
  height?: number;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={VARIANT_SRC[variant]}
      alt={alt}
      width={Math.round((height * 2172) / 724)}
      style={{ height: `${height}px`, width: "auto" }}
      className={className}
      decoding="async"
      draggable={false}
    />
  );
}

export default Logo;
