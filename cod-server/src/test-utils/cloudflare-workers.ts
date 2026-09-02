/**
 * Test stub for the `cloudflare:workers` runtime module, which does not exist
 * under Node. Vitest aliases `cloudflare:workers` to this file so packages
 * that extend `WorkerEntrypoint` (e.g. @cloudflare/workers-oauth-provider)
 * can be imported in unit tests. Only symbols actually referenced by those
 * packages are implemented.
 */
export class WorkerEntrypoint {}
