ep GET    "/api/drivers"                                  delivery:read
ep POST   "/api/drivers"                                  delivery:manage        '{}'
ep GET    "/api/drivers/{id}"                             delivery:read
ep PATCH  "/api/drivers/{id}"                             delivery:manage        '{}'
ep PATCH  "/api/drivers/{id}/status"                      delivery:manage        '{}'
ep DELETE "/api/drivers/{id}"                             delivery:manage
ep GET    "/api/drivers/{id}/compensations"               delivery:read
ep PUT    "/api/drivers/{id}/compensations/{wid}"         delivery:manage        '{}'
ep DELETE "/api/drivers/{id}/compensations/{wid}"         delivery:manage
