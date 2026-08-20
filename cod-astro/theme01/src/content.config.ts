// Products and categories are fetched at SSR request time in each page
// via fetchProductsRaw() / fetchCategoriesRaw() from @/core/api/client.
// Build-time content loaders can't use the runtime STORE_API_KEY secret.
export const collections = {};
