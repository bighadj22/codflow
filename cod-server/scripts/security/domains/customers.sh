# Customers CRUD + relations
ep GET    "/api/customers"                                customers:read
ep POST   "/api/customers"                                customers:create       '{}'
ep GET    "/api/customers/{id}"                           customers:read
ep PATCH  "/api/customers/{id}"                           customers:update       '{}'
ep DELETE "/api/customers/{id}"                           customers:delete
ep GET    "/api/customers/{id}/orders"                    customers:read
ep GET    "/api/customers/{id}/groups"                    customer_groups:read
ep GET    "/api/customers/{id}/tags"                      customer_tags:read
