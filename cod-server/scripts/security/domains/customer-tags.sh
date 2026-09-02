ep GET    "/api/customer-tags"                            customer_tags:read
ep POST   "/api/customer-tags"                            customer_tags:manage   '{}'
ep GET    "/api/customer-tags/{id}"                       customer_tags:read
ep PATCH  "/api/customer-tags/{id}"                       customer_tags:manage   '{}'
ep DELETE "/api/customer-tags/{id}"                       customer_tags:manage
ep POST   "/api/customer-tags/{id}/assignments"           customer_tags:manage   '{}'
ep DELETE "/api/customer-tags/{id}/assignments/{cid}"     customer_tags:manage
