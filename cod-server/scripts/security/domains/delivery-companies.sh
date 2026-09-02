# Carrier connections. INTENDED scopes encoded from CONTEXT.md ("credentials are manage-level");
# the matrix verifies the code actually enforces them.
ep GET    "/api/delivery-companies"                              delivery:read
ep GET    "/api/delivery-companies/{id}"                         delivery:read
ep POST   "/api/delivery-companies"                              delivery:manage        '{}'
ep PATCH  "/api/delivery-companies/{id}"                         delivery:manage        '{}'
ep DELETE "/api/delivery-companies/{id}"                         delivery:manage
ep GET    "/api/delivery-companies/{id}/stop-desks"              delivery:read
ep POST   "/api/delivery-companies/{id}/sync-stop-desks"         delivery:manage
ep PATCH  "/api/delivery-companies/{id}/stop-desks/{code}/toggle" delivery:manage       '{}'
ep POST   "/api/delivery-companies/{id}/webhook/register"        delivery:manage
ep DELETE "/api/delivery-companies/{id}/webhook/register"        delivery:manage
ep PATCH  "/api/delivery-companies/{id}/webhook/secret"          delivery:manage        '{}'
ep PATCH  "/api/delivery-companies/{id}/webhook/mapping"         delivery:manage        '{}'
