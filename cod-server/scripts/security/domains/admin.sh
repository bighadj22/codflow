# Admin-only walls: team management, store settings, audit trail.
# THE critical questions: can staff add/remove team members, change roles,
# grant/revoke scopes, rotate API keys, or read settings? Expected: 403.
ep GET    "/api/stores/me"                         ADMIN_ONLY
ep PATCH  "/api/stores/me"                         ADMIN_ONLY             '{}'
ep GET    "/api/stores/pixel-config"               ADMIN_ONLY
ep POST   "/api/stores/pixel-config"               ADMIN_ONLY             '{}'
ep GET    "/api/users"                             ADMIN_ONLY
ep POST   "/api/users"                             ADMIN_ONLY             '{}'
ep GET    "/api/users/{id}"                        ADMIN_ONLY
ep PATCH  "/api/users/{id}"                        ADMIN_ONLY             '{}'
ep PATCH  "/api/users/{id}/role"                   ADMIN_ONLY             '{}'   # staff promoting self?
ep POST   "/api/users/{id}/scopes"                 ADMIN_ONLY             '{"scope":"orders:read"}'   # staff granting scopes?
ep DELETE "/api/users/{id}/scopes/{scope}"         ADMIN_ONLY                  # staff revoking scopes?
ep POST   "/api/users/{id}/api-key/rotate"         ADMIN_ONLY                  # staff stealing accounts?
ep GET    "/api/activity-logs"                     ADMIN_ONLY
ep GET    "/api/activity-logs/users/{uid}"         ADMIN_ONLY
