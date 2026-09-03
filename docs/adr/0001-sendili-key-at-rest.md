# Sendili API key stored in D1, unencrypted — masked at every read

The Sendili API key is per-store, merchant-editable integration config (like
the dzverify key and carrier tokens), not a deployment secret — merchants paste
it in the dashboard settings UI at runtime, so it cannot live in
`wrangler secret`. We store it in the `store_email_config` D1 table in
plaintext and enforce safety at the interface: `getEmailConfigRaw` (full row)
is server-side only, every HTTP response returns a masked hint
(`••••` + last 4), and saving with an empty key keeps the stored one.

## Considered Options

- **AES-GCM encryption at rest, key shared by both workers**: rejected. The
  threat model is unchanged versus secrets already in the same database
  (scrypt password hashes, `cod_` API keys compared verbatim, carrier tokens,
  Meta + dzverify tokens) — anyone who can read D1 can read the decryption
  key from Worker config. Meanwhile it adds key-loss = unrecoverable config
  plus a rotation procedure nobody operates.
- **Cloudflare secrets store / wrangler secrets**: rejected — not
  per-store-editable from the dashboard without a redeploy or an API dance
  that just moves the problem.

## Consequences

- Rotating a leaked key is a dashboard action (paste new key → save); no
  re-encryption step, no data migration.
- D1 backups contain the usable key — treat database access as key access
  (already true for every other stored credential).
- If the platform later gains per-store secret storage, migrating is a
  read-transform-write on one table — acceptable cost, consciously accepted.
