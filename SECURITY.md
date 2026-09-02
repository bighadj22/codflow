# Security Policy

## Supported Versions

CodFlow is released software. Only the latest code on the `main` branch and
the most recent tagged release receive security fixes. Fixes are backported to
earlier releases only when explicitly stated in the release notes.

| Version               | Supported          |
|-----------------------|--------------------|
| `main` branch         | :white_check_mark: |
| Latest tagged release | :white_check_mark: |
| Older releases        | :x:                |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub
issues, discussions, or pull requests.

Instead, report them privately through **GitHub private vulnerability
reporting** for this repository:

`https://github.com/bighadj22/codflow/security/advisories/new`

If private vulnerability reporting is unavailable for the report, email the
maintainers at `124762008+bighadj22@users.noreply.github.com`.

### What to include

- The affected project and version, tag, or commit SHA
- A description of the issue and why you believe it is security-sensitive
- Steps to reproduce or a proof of concept
- Any relevant logs, payloads, or screenshots
- The potential impact
- Suggested mitigations or fixes, if known

### What to expect

- An acknowledgment within **3 business days** of receipt
- Triage and follow-up questions, if any
- Coordinated disclosure: if the report is confirmed, we will develop a fix
  and coordinate public disclosure timing with you when appropriate
- If the issue is validated, a GitHub Security Advisory may be published once
  remediation details are ready

## Scope

Everything under `cod-server/`, `cod-client-astro/`, `cod-shared/`, and the
`cod-astro/theme01/` storefront is in scope. Live production deployments
(Cloudflare Workers, D1, R2, KV) are in scope only for issues reproducible
against publicly accessible endpoints.