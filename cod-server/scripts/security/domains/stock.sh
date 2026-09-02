# Stock overview + adjustments (product-level under /api/stock, variant-level under /api/products)
ep GET    "/api/stock/overview"                           products:read
ep GET    "/api/stock/alerts"                             products:read
ep POST   "/api/stock/{id}/stock/adjust"                  stock:manage           '{}'
ep GET    "/api/stock/{id}/stock/history"                 stock:read
ep PATCH  "/api/stock/{id}/stock/threshold"               stock:manage           '{}'
ep POST   "/api/products/{id}/variants/{vid}/stock/adjust"   stock:manage        '{}'
ep PATCH  "/api/products/{id}/variants/{vid}/stock/threshold" stock:manage       '{}'
