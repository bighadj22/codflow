# Users Context

The store's team roster and their keys to the building: who can sign in, which dashboard actions each person may take, and the one-time secrets that let systems talk to the API.

## Language

### Identity

**Team Member**:
A person provisioned to work in the store — distinct from customers, who buy things and never sign in.
_Avoid_: User account (ambiguous with shoppers), staff member as a role

**Role**:
Exactly two levels: `admin` (everything, always) and `staff` (only what scopes grant). No middle tiers exist.
_Avoid_: Permission group, access level

**Temporary Password**:
A randomly generated credential issued once at creation, shown exactly once in that response. The member should replace it at first sign-in.
_Avoid_: Default password, reset link

**32-Hex Identity**:
User IDs are 32-character hexadecimal strings matching Better Auth's format — not UUIDs with dashes.
_Avoid_: UUID, GUID

### Permissions

**Wildcard Scope**:
Admins implicitly hold `["*"]` — every scope check passes for them, and individually granted scopes are meaningless on an admin.
_Avoid_: Superuser flag

**Scope Grant / Revoke**:
The two levers of staff power, recorded with who granted them. Revoking a scope nobody had succeeds silently.
_Avoid_: Role editing (role is separate)

**Scope Cache Invalidation**:
Permission checks are cached for speed; every role or scope change clears that user's cache so new powers apply immediately.
_Avoid_: Eventual permissions, propagation delay

### Credentials

**API Key**:
A `cod_`-prefixed secret enabling programmatic access, stored as-is and compared verbatim against the incoming header. Its secrecy lives entirely in one-time display — creation and rotation are the only moments it is ever visible.
_Avoid__: Hashed key, token session

**API Key Rotation**:
Issuing a replacement key instantly kills the previous one. Used when a key leaks or a integration changes hands.

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Sign-in sessions**: Better Auth's credential provider owns authentication; this module only provisions the account and password hash
- **What the scopes unlock**: each endpoint context defines its own read/manage requirements
- **Who did it**: every management action here lands in Activity Logs with actor attribution
- **Shopper identity**: Customers context — completely separate universe from team members

## Edge Cases

**Admin is a wall, not a scope**: Staff cannot reach any users endpoint even with every individual scope granted — role gates come before scope checks.

**Email collisions crash late on update**: Creation pre-checks duplicates with a friendly conflict; changing an email to an existing one surfaces as a raw database constraint error instead.

**Scopes vanish silently on promotion**: Granting admin makes stored scope rows irrelevant; demoting back to staff does not restore them — they must be re-granted explicitly.

**One-time means one-time**: Neither the temporary password nor the raw API key can ever be retrieved again — losing them forces rotation or password reset through other means.

**Inactive Kills Access Instantly**: Flipping a member to `inactive` makes their API key rejected at the authentication gate before any scope check runs — the key remains valid-looking but is dead in practice.
