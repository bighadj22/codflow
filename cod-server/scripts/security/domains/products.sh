# Products + variants + product images
ep GET    "/api/products"                                 products:read
ep POST   "/api/products"                                 products:manage        '{}'
ep GET    "/api/products/{id}"                            products:read
ep PATCH  "/api/products/{id}"                            products:manage        '{}'
ep DELETE "/api/products/{id}"                            products:manage
ep PATCH  "/api/products/{id}/status"                     products:manage        '{}'
ep GET    "/api/products/{id}/images"                     products:read
ep POST   "/api/products/{id}/images"                     products:manage        '{}'
ep PATCH  "/api/products/{id}/images/reorder"             products:manage        '{}'
ep DELETE "/api/products/{id}/images/{imid}"              products:manage
ep GET    "/api/products/{id}/variants"                   products:read
ep POST   "/api/products/{id}/variants"                   products:manage        '{}'
ep GET    "/api/products/{id}/variants/{vid}"             products:read
ep PATCH  "/api/products/{id}/variants/{vid}"             products:manage        '{}'
ep DELETE "/api/products/{id}/variants/{vid}"             products:manage
