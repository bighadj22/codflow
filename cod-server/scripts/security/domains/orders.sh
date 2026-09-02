# Orders — CRUD, lifecycle, carrier dispatch, shipments
ep GET    "/api/orders"                                   orders:read
ep GET    "/api/orders/{id}"                              orders:read
ep POST   "/api/orders"                                   orders:create          '{}'
ep DELETE "/api/orders/{id}"                              orders:delete
ep PATCH  "/api/orders/{id}/status"                       orders:update          '{}'
ep PATCH  "/api/orders/{id}/assign-driver"                orders:assign          '{}'
ep PATCH  "/api/orders/{id}/unassign"                     orders:assign
ep PATCH  "/api/orders/{id}/products/{plid}/return"       orders:update          '{}'
ep POST   "/api/orders/bulk-dispatch"                     delivery:dispatch      '{"orderIds":[]}'
ep POST   "/api/orders/{id}/dispatch"                     delivery:dispatch      '{}'
ep POST   "/api/orders/{id}/validate-shipment"            delivery:dispatch
ep POST   "/api/orders/{id}/update-shipment"              delivery:dispatch      '{}'
ep POST   "/api/orders/{id}/cancel-shipment"              delivery:dispatch
ep POST   "/api/orders/{id}/add-remark"                   delivery:dispatch      '{}'
ep GET    "/api/orders/{id}/remarks"                      orders:read
ep GET    "/api/orders/{id}/tracking-events"              orders:read
ep GET    "/api/orders/{id}/label"                        orders:read
