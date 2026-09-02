ep GET    "/api/customer-groups"                          customer_groups:read
ep POST   "/api/customer-groups"                          customer_groups:manage '{}'
ep GET    "/api/customer-groups/{id}"                     customer_groups:read
ep PATCH  "/api/customer-groups/{id}"                     customer_groups:manage '{}'
ep DELETE "/api/customer-groups/{id}"                     customer_groups:manage
ep POST   "/api/customer-groups/{id}/members"             customer_groups:manage '{}'
ep DELETE "/api/customer-groups/{id}/members/{cid}"       customer_groups:manage
