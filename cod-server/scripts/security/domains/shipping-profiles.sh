ep GET    "/api/shipping-profiles"                                       delivery:read
ep POST   "/api/shipping-profiles"                                       delivery:manage        '{}'
ep GET    "/api/shipping-profiles/default/rules"                         delivery:read
ep GET    "/api/shipping-profiles/{id}"                                  delivery:read
ep PATCH  "/api/shipping-profiles/{id}"                                  delivery:manage        '{}'
ep DELETE "/api/shipping-profiles/{id}"                                  delivery:manage
ep PUT    "/api/shipping-profiles/{id}/rules"                            delivery:manage        '{}'
ep GET    "/api/shipping-profiles/{id}/rules/{wid}/communes"             delivery:read
ep PUT    "/api/shipping-profiles/{id}/rules/{wid}/communes/{cid}"       delivery:manage        '{}'
ep DELETE "/api/shipping-profiles/{id}/rules/{wid}/communes/{cid}"       delivery:manage
