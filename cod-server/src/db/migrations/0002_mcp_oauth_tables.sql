-- Migration: 0002_mcp_oauth_tables
-- Adds the tables required by the Better Auth OAuth 2.1 Provider + JWT plugins
-- so the dashboard can act as an OAuth Authorization Server for MCP clients
-- (Claude Desktop, Claude.ai, ChatGPT, custom agents).
--
-- Five new tables:
--   jwkss               RSA keypair storage used to sign OAuth access tokens.
--                       Public half served via /api/auth/jwks.
--   oauthClients        OAuth clients (self-registered or admin-created).
--   oauthAccessTokens   Issued access tokens; verified by cod-server offline
--                       against jwkss. Row is created so revocation works.
--   oauthRefreshTokens  Long-lived refresh tokens tied to sessions.
--   oauthConsents       Per-user-per-client consent records driving the
--                       consent page + "remember this app" behavior.
--
-- See MCP_PLAN.md §5 for rationale.
--
-- Naming note: Better Auth's Cloudflare adapter with `usePlural: true` maps
-- each model to its plural table name by appending "s". The `jwks` model
-- (from the jwt() plugin) therefore becomes `jwkss` on disk — intentional.
-- The oauth-provider model names are already singular camelCase, yielding
-- `oauthClients` / `oauthAccessTokens` / etc.
--
-- Hand-authored (NOT via `drizzle-kit generate`) to avoid re-emitting
-- CREATE-TABLE statements for existing tables; cod-server's meta/ snapshots
-- do not reflect the 0000_complete.sql baseline so drizzle-kit generate
-- currently produces a destructive diff. Keep this file idempotent-adjacent
-- by adding only new objects.

CREATE TABLE `jwkss` (
  `id`          text PRIMARY KEY NOT NULL,
  `public_key`  text NOT NULL,
  `private_key` text NOT NULL,
  `created_at`  integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `expires_at`  integer
);
--> statement-breakpoint

CREATE TABLE `oauthClients` (
  `id`                         text PRIMARY KEY NOT NULL,
  `client_id`                  text NOT NULL,
  `client_secret`              text,
  `disabled`                   integer DEFAULT false,
  `skip_consent`               integer,
  `enable_end_session`         integer,
  `subject_type`               text,
  `scopes`                     text,                 -- JSON string[]
  `user_id`                    text,
  `name`                       text,
  `uri`                        text,
  `icon`                       text,
  `contacts`                   text,                 -- JSON string[]
  `tos`                        text,
  `policy`                     text,
  `software_id`                text,
  `software_version`           text,
  `software_statement`         text,
  `redirect_uris`              text NOT NULL,        -- JSON string[]
  `post_logout_redirect_uris`  text,                 -- JSON string[]
  `token_endpoint_auth_method` text,
  `grant_types`                text,                 -- JSON string[]
  `response_types`             text,                 -- JSON string[]
  `type`                       text,
  `public`                     integer,
  `client_id_issued_at`        integer,
  `client_secret_expires_at`   integer,
  `require_pkce`               integer,
  `reference_id`               text,
  `metadata`                   text,                 -- JSON
  `created_at`                 integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at`                 integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthClients_client_id_unique` ON `oauthClients` (`client_id`);--> statement-breakpoint
CREATE INDEX        `oauthClients_user_id_idx`      ON `oauthClients` (`user_id`);--> statement-breakpoint

CREATE TABLE `oauthRefreshTokens` (
  `id`           text PRIMARY KEY NOT NULL,
  `token`        text NOT NULL,
  `client_id`    text NOT NULL,
  `session_id`   text,
  `user_id`      text NOT NULL,
  `reference_id` text,
  `expires_at`   integer NOT NULL,
  `created_at`   integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `revoked`      integer,
  `auth_time`    integer,
  `scopes`       text NOT NULL,                       -- JSON string[]
  FOREIGN KEY (`client_id`)  REFERENCES `oauthClients`(`client_id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`)            ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)               ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauthRefreshTokens_token_idx`     ON `oauthRefreshTokens` (`token`);--> statement-breakpoint
CREATE INDEX `oauthRefreshTokens_user_id_idx`   ON `oauthRefreshTokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshTokens_client_id_idx` ON `oauthRefreshTokens` (`client_id`);--> statement-breakpoint

CREATE TABLE `oauthAccessTokens` (
  `id`           text PRIMARY KEY NOT NULL,
  `token`        text,
  `client_id`    text NOT NULL,
  `session_id`   text,
  `user_id`      text,
  `reference_id` text,
  `refresh_id`   text,
  `expires_at`   integer NOT NULL,
  `created_at`   integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `scopes`       text NOT NULL,                       -- JSON string[]
  FOREIGN KEY (`client_id`)  REFERENCES `oauthClients`(`client_id`)       ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`)                  ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)                     ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`refresh_id`) REFERENCES `oauthRefreshTokens`(`id`)        ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthAccessTokens_token_unique`    ON `oauthAccessTokens` (`token`);--> statement-breakpoint
CREATE INDEX        `oauthAccessTokens_user_id_idx`     ON `oauthAccessTokens` (`user_id`);--> statement-breakpoint
CREATE INDEX        `oauthAccessTokens_client_id_idx`   ON `oauthAccessTokens` (`client_id`);--> statement-breakpoint

CREATE TABLE `oauthConsents` (
  `id`           text PRIMARY KEY NOT NULL,
  `client_id`    text NOT NULL,
  `user_id`      text,
  `reference_id` text,
  `scopes`       text NOT NULL,                       -- JSON string[]
  `created_at`   integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at`   integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`client_id`) REFERENCES `oauthClients`(`client_id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`user_id`)   REFERENCES `users`(`id`)               ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauthConsents_user_client_idx` ON `oauthConsents` (`user_id`, `client_id`);
