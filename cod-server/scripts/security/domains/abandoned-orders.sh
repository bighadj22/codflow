ep GET    "/api/abandoned-orders"           abandoned_orders:read
ep GET    "/api/abandoned-orders/stats"     abandoned_orders:read
ep PATCH  "/api/abandoned-orders/{id}/status" abandoned_orders:manage '{}'
ep DELETE "/api/abandoned-orders/{id}"      abandoned_orders:manage
