/**
 * CORS Middleware
 * 
 * Handles Cross-Origin Resource Sharing for client requests.
 * In production, restricts origins to the configured ALLOWED_ORIGINS list.
 * In development, allows all origins for easier local testing.
 */

import { Context, Next } from "hono";
import type { AppContext } from "@/types/app";

export async function corsMiddleware(c: Context<AppContext>, next: Next) {
  const env = c.env;
  const requestOrigin = c.req.header("origin");
  
  // Determine allowed origins based on environment
  let allowedOrigin = "*";
  
  if (env.ENVIRONMENT === "production" && env.ALLOWED_ORIGINS) {
    // In production, validate against whitelist
    const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map(o => o.trim());
    
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      allowedOrigin = requestOrigin;
    } else {
      // Default to first allowed origin if request origin doesn't match
      allowedOrigin = allowedOrigins[0] || "*";
    }
  } else if (requestOrigin) {
    // In development, echo back the request origin (allows localhost on any port)
    allowedOrigin = requestOrigin;
  }

  // Set CORS headers
  c.header("Access-Control-Allow-Origin", allowedOrigin);
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Store-API-Key, Accept, Authorization");
  c.header("Access-Control-Expose-Headers", "Content-Type, X-API-Key, X-Store-API-Key");
  c.header("Access-Control-Max-Age", "86400");
  
  // Only set credentials header if origin is specific (not *)
  if (allowedOrigin !== "*") {
    c.header("Access-Control-Allow-Credentials", "true");
  }

  // Handle preflight requests
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204, {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, X-Store-API-Key, Accept, Authorization",
      "Access-Control-Max-Age": "86400",
    });
  }

  await next();
}

