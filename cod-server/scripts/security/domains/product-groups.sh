ep GET    "/api/product-groups"                           product_groups:read
ep POST   "/api/product-groups"                           product_groups:manage  '{}'
ep GET    "/api/product-groups/{id}"                      product_groups:read
ep PATCH  "/api/product-groups/{id}"                      product_groups:manage  '{}'
ep DELETE "/api/product-groups/{id}"                      product_groups:manage
