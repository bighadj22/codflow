# MCP Context

The door AI agents use to operate the store: an OAuth-protected Model Context Protocol server where every tool a agent can see is decided by scopes before the conversation starts, destructive actions demand a human click, and everything gets audited.

## Language

### The Surface

**MCP Server**:
The remote endpoint at `/mcp` where external agents (Claude, ChatGPT, custom clients) connect over streamable HTTP. Each connection runs as its own session with state that lives only for that connection.
_Avoid_: API, bot, integration

**Tool Registry**:
The single table deciding which tools exist per caller — one entry per scope requirement, each selecting named tools from a domain's bundle. Adding a domain means adding rows here and nothing else.
_Avoid_: Plugin list, capability map

**Registration-Time Gating**:
Tools are withheld at session start if the caller's scopes don't qualify — the agent's model literally never sees a tool it lacks permission to run. Stronger than checking permissions when the tool fires.
_Avoid_: Runtime permission check, execute-time guard

**Session Props**:
The identity snapshot (user ID, role, scopes, name, email) projected from the verified token onto the session. Every tool execution attributes its work through these fields.
_Avoid_: User context, session data

### Trust

**Bearer Verification**:
Every request presents an OAuth access token verified offline against the identity provider's published key set — issuer, audience, and expiry checked locally with no auth-server round trip.
_Avoid_: Login, password flow

**Protected Resource Discovery**:
A public metadata endpoint telling MCP clients which authorization server to use and which scopes this resource understands. No auth by design; short cache lifetime.
_Avoid_: Config file, private settings

**Audience Leniency**:
Token acceptance tolerates three shapes of the intended-audience claim — bare origin, trailing slash, or the `/mcp` path — because different MCP clients send different forms.

**Expiry Workaround**:
A known identity-library bug serializes token expiry as a duration instead of a timestamp; verification detects and corrects it until the library ships a fix.

### Safety

**Dangerous Tools Gate**:
A hard-coded allowlist of tools that always demand human confirmation first — deletes across domains, driver settlements, stock adjustments, order status changes. Risk classification lives in one auditable place.
_Avoid_: Blacklist, auto-block

**Elicitation Confirmation**:
The protocol-native confirmation dialog rendered by the MCP client itself. A decline is a normal outcome: logged, reported tersely, never thrown.
_Avoid_: Error, rejection failure

**Tool Call Audit**:
Every agent invocation lands in the activity trail tagged as via-MCP with its arguments and outcome — including declines and failures — so operations can reconstruct exactly what each agent did.

**Connection Revocation**:
Cutting an agent's access revokes the provider grant — the grant and every access token under it disappear, and token validation rejects any token whose grant is gone, so live sessions die instantly. Retries are safe; revocation is idempotent.

### Management

**Connection**:
A view per user-and-client pair assembled from the provider's KV grants: unioned grant scopes, a last-used marker written at every token issuance, plus the client's display name (from the registered client, falling back to grant metadata for CIMD clients).
_Avoid_: Account, login device

**Self vs Team Views**:
Members see and revoke only their own connections; admins additionally see everyone's and may revoke on any member's behalf.

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **The actual work**: every tool wraps logic owned by its domain context — MCP changes nothing about business rules
- **Scope vocabulary**: defined once in shared RBAC; the registry references it, never redefines it
- **Audit storage**: Activity Logs context holds the trail; this context only writes entries tagged via-MCP
- **Token issuing**: Better Auth on the dashboard side owns the authorization server; this module verifies and revokes

## Edge Cases

**No props, no tools**: If session identity ever fails to attach, the agent starts with an empty tool list rather than crashing — fail-closed by construction.

**Confirmation needs a capable client**: Elicitation support is announced by the MCP client, not advertised by the server; incapable clients skip the dialog entirely, so the gate depends on client capability.

**Three ways to decline**: Denying the dialog, leaving the confirm box unchecked, or timing out all count identically as decline — recorded, never raised.

**Revocation closes the race window**: Revoking the grant removes the grant itself, and token validation requires the grant to exist, so an in-flight agent call cannot slip through after revocation.

**Schemas come from one source**: Tool parameter definitions are the same Zod objects the tools validate with — the MCP surface advertises and enforces them, so clients receive proper schemas and drift is impossible.
