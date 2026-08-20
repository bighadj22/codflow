// Team and user related types

export type TeamRole = "admin" | "staff";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "active" | "inactive";
  joinedAt: string;
  scopes?: string[];
}
