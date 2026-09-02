export type TeamRole = "admin" | "staff";
export type TeamStatus = "active" | "inactive";

/** A team member as returned by the users API (apiKey is stripped server-side). */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: TeamStatus;
  createdAt: string;
  updatedAt: string;
  /** Admins carry the wildcard scope only; staff carry their grants. */
  scopes: string[];
}

/** A single immutable audit trail row. metadata is a JSON string. */
export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: "admin" | "staff";
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  metadata: string | null;
  createdAt: string;
}

/** Parsed JSON payload of an activity log row. */
export interface ActivityLogMeta {
  status?: string;
  delta?: number;
  stockType?: string | null;
  reason?: string | null;
  scope?: string;
  role?: string;
  rating?: number;
  [key: string]: unknown;
}

/** Form values for the invite dialog. */
export interface TeamMemberFormValues {
  name: string;
  email: string;
  role: TeamRole;
  scopes: string[];
}

export interface CreateTeamMemberResult {
  user: TeamMember;
  apiKey: string;
  tempPassword: string;
}
