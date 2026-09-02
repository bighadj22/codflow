import type { McpConnection } from "./types";

/** The MCP endpoint for a given API base URL, e.g. "https://api.example.com/mcp". */
export function mcpApiUrl(apiBase: string): string {
  return `${apiBase.replace(/\/+$/, "")}/mcp`;
}

/** Replace `{name}` placeholders in a template string. */
export function interp(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

/** Pick the singular/plural template and fill in the count. */
export function pluralize(
  oneKey: string,
  otherKey: string,
  count: number,
  t: (key: string) => string,
): string {
  const template = count === 1 ? t(oneKey) : t(otherKey);
  return interp(template, { count: String(count) });
}

/** "just now" → "N minutes ago" → "N days ago" → locale date. */
export function relativeTime(
  iso: string,
  t: (key: string) => string,
  locale: "ar" | "en" | "fr",
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "-";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return t("time.just_now");
  if (diffMin < 60) return pluralize("time.minutes_ago_one", "time.minutes_ago_other", diffMin, t);
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return pluralize("time.hours_ago_one", "time.hours_ago_other", diffHr, t);
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return pluralize("time.days_ago_one", "time.days_ago_other", diffDay, t);
  return new Date(iso).toLocaleDateString(
    locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  );
}

/** Keep the admin's own connections out of the team tab. */
export function otherUsersConnections(teamConnections: McpConnection[], currentUserId: string) {
  return teamConnections.filter((connection) => connection.user && connection.user.id !== currentUserId);
}

/** Stable identity for a connection row, used for pending-revoke state and list keys. */
export function connectionKey(conn: McpConnection): string {
  return conn.user ? `${conn.user.id}:${conn.clientId}` : conn.clientId;
}

export function mcpErrorMessage(cause: unknown, t: (key: string) => string) {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "MCP_CONNECTION_NOT_FOUND") return t("my_connections.revoke_error");
  if (code === "PERMISSION_DENIED") return t("my_connections.revoke_error");
  return t("my_connections.revoke_error");
}
