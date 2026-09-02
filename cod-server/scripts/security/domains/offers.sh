ep GET    "/api/offers"                     offers:read
ep GET    "/api/offers/{id}"                offers:read
ep POST   "/api/offers"                     offers:manage          '{}'
ep PATCH  "/api/offers/{id}"                offers:manage          '{}'
ep DELETE "/api/offers/{id}"                offers:manage
