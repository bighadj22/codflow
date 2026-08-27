# Known Limitations

Honest list of what needs more testing or improvement.

---

## Platform Constraints

### Cloudflare Workers

- **Worker↔Worker on workers.dev blocked** — Both storefront and backend cannot be on `*.workers.dev`. Deploy at least one to a custom domain.
- **D1 single-region** — Database is in one region, not globally distributed.
- **D1 is beta** — No full-text search, limited storage (2GB free / 10GB paid).

---

## Not Fully Tested

### Meta CAPI Workflow

⚠️ **Not production-tested** — The `CodCapiWorkflow` exists and runs locally, but has not been verified with real Meta Pixel accounts in production.

### Carrier Integrations

**Yalidine & ZR Express:**
- Webhook handlers exist with HMAC verification
- Need more real-world testing and improvements

**NOEST & EcoTrack:**
- API integration exists
- No webhook support — tracking must be polled manually
