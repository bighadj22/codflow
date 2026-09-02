import { Logo } from "@/components/brand/Logo";

const SIZES: Record<number, string> = {
  4: "h-4 w-4 border-2",
  7: "h-7 w-7 border-2",
};

/**
 * Bare ring spinner (inline, for buttons and small waits).
 * The branded variant (`<GateSpinner branded />`) shows the CodFlow logo
 * with a soft pulse for full-page loading gates — no text, per the
 * silent-gates rule.
 */
export default function GateSpinner({
  size = 7,
  branded = false,
}: {
  size?: number;
  branded?: boolean;
}) {
  if (branded) {
    return (
      <span role="status" className="inline-flex flex-col items-center gap-4">
        <Logo variant="dark" height={36} className="w-auto animate-pulse" />
      </span>
    );
  }
  return (
    <span
      role="status"
      className={`inline-block ${SIZES[size] ?? SIZES[7]} animate-spin rounded-full border-primary/30 border-t-primary`}
    />
  );
}
