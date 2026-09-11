#!/usr/bin/env python3
"""Generate organized ZR Express API reference tree for the zr-express skill.
Reads the downloaded swagger.json and re-emits every operation VERBATIM,
grouped per domain. No endpoint data is altered."""
import json, os, shutil, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "swagger.json")
OUT = HERE

d = json.load(open(SRC))
schemas = d.get("components", {}).get("schemas", {})

DOMAINS = {
    "catalog":         ["catalog"],
    "claims":          ["claims"],
    "customers":       ["customers"],
    "orders":          ["orders"],
    "delivery-pricing": ["delivery-pricing", "rates", "service-pricing", "specific-prices", "deprecated"],
    "hubs":            ["hubs"],
    "supplier":        ["supplier"],
    "treasury":        ["treasury", "treasury-transactions"],
    "users":           ["users"],
    "webhooks":        ["webhooks"],
}
TAG_TO_DOMAIN = {t: dom for dom, tags in DOMAINS.items() for t in tags}

def schema_summary(s):
    if not isinstance(s, dict):
        return ""
    t = s.get("type", "")
    fmt = f" ({s['format']})" if s.get("format") else ""
    enum = f" enum={s['enum']}" if s.get("enum") else ""
    items = s.get("items")
    if items:
        if "$ref" in items:
            return f"{t}{fmt} of {items['$ref'].split('/')[-1]}{enum}"
        return f"{t}{fmt} of {items.get('type','?')}{enum}"
    return f"{t}{fmt}{enum}"

def param_repr(p):
    parts = []
    if p.get("description"):
        parts.append(p["description"].strip().replace("\n", " "))
    base = p.get("schema", {})
    s = schema_summary(base)
    if s:
        parts.append(f"`{s}`")
    if base.get("default") is not None:
        parts.append(f"default=`{base['default']}`")
    return " — ".join(parts)

def media_schema_refs(content):
    refs = []
    for mt, c in (content or {}).items():
        sch = c.get("schema", {})
        if "$ref" in sch:
            refs.append(sch["$ref"].split("/")[-1])
        else:
            refs.append(f"(inline {schema_summary(sch) or json.dumps(sch)})")
    return refs

def op_markdown(method, path, op):
    lines = []
    lines.append(f"### `{method.upper()} {path}`")
    lines.append("")
    lines.append(f"**operationId:** `{op.get('operationId','')}`")
    lines.append("")
    tags = ", ".join(f"`{t}`" for t in op.get("tags", []))
    lines.append(f"**tags:** {tags}")
    lines.append("")
    if op.get("summary"):
        lines.append(f"**summary:** {op['summary']}")
        lines.append("")
    if op.get("description"):
        lines.append("**description:**")
        lines.append(f"> {op['description'].strip()}")
        lines.append("")
    params = op.get("parameters", [])
    if params:
        lines.append("**parameters:**")
        lines.append("")
        lines.append("| # | name | in | required | description / schema |")
        lines.append("|---|------|----|----------|----------------------|")
        for i, p in enumerate(params, 1):
            req = "yes" if p.get("required") else "no"
            lines.append(f"| {i} | `{p.get('name','')}` | {p.get('in','')} | {req} | {param_repr(p)} |")
        lines.append("")
    rb = op.get("requestBody")
    if rb:
        lines.append("**requestBody:**")
        lines.append("")
        rb_refs = media_schema_refs(rb.get("content"))
        for mt in rb.get("content", {}):
            lines.append(f"- `{mt}` → schema `{rb_refs[0] if rb_refs else '?'}`")
        if rb.get("required"):
            lines.append("- **required**")
        lines.append("")
    resps = op.get("responses", {})
    if resps:
        lines.append("**responses:**")
        lines.append("")
        lines.append("| status | description | schema |")
        lines.append("|--------|-------------|--------|")
        for code in sorted(resps):
            r = resps[code]
            refs = media_schema_refs(r.get("content"))
            refs_s = ", ".join(f"`{x}`" for x in refs) if refs else "-"
            lines.append(f"| {code} | {r.get('description','').strip()} | {refs_s} |")
        lines.append("")
    sec = op.get("security")
    if sec is not None:
        lines.append(f"**security (override):** `{json.dumps(sec)}`")
        lines.append("")
    return "\n".join(lines)

def collect_op(dom, path, method, op):
    body = op_markdown(method, path, op)
    refs = set()
    for p in op.get("parameters", []):
        s = p.get("schema", {})
        if "$ref" in s:
            refs.add(s["$ref"].split("/")[-1])
    for c in op.get("requestBody", {}).get("content", {}).values():
        if "$ref" in c.get("schema", {}):
            refs.add(c["schema"]["$ref"].split("/")[-1])
    for r in op.get("responses", {}).values():
        for c in (r.get("content") or {}).values():
            if "$ref" in c.get("schema", {}):
                refs.add(c["schema"]["$ref"].split("/")[-1])
    return body, refs


# Build per-domain operations (dedupe multi-tag ops by first tag matching domain)
seen = set()
dom_ops = {k: [] for k in DOMAINS}
dom_refs = {k: set() for k in DOMAINS}
for path, ops in d["paths"].items():
    for method, op in ops.items():
        key = (path, method)
        if key in seen:
            continue
        seen.add(key)
        primary_tag = (op.get("tags") or [None])[0]
        dom = TAG_TO_DOMAIN.get(primary_tag)
        if not dom:
            print("WARN unknown tag", primary_tag, path)
            continue
        md, refs = collect_op(dom, path, method, op)
        dom_ops[dom].append((method.upper(), path, md))
        dom_refs[dom].update(refs)


def sort_key(item):
    method, path, _ = item
    mrank = {"POST": 0, "PATCH": 1, "PUT": 2, "GET": 3, "DELETE": 4}.get(method, 5)
    return (path.replace("/{version}", ""), mrank)


os.makedirs(os.path.join(OUT, "references"), exist_ok=True)
os.makedirs(os.path.join(OUT, "schemas"), exist_ok=True)
if os.path.abspath(SRC) != os.path.abspath(os.path.join(OUT, "swagger.json")):
    shutil.copyfile(SRC, os.path.join(OUT, "swagger.json"))

from datetime import date
DATE = date.today().isoformat()
RULE = "> Do not alter. Machine-generated verbatim from "


def resolve_schemas(ref_names, schemas):
    out = {}
    stack = list(ref_names)
    while stack:
        n = stack.pop()
        if n in out or n not in schemas:
            continue
        out[n] = schemas[n]

        def walk(o):
            if isinstance(o, dict):
                if "$ref" in o:
                    stack.append(o["$ref"].split("/")[-1])
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)

        walk(schemas[n])
    return out


index_lines = []
index_lines.append("# ZR Express — API Endpoints Index")
index_lines.append("")
index_lines.append("Source: `https://api.zrexpress.app/swagger/public-v1/swagger.json`")
index_lines.append(f"OpenAPI `{d.get('openapi')}` · `{d.get('info',{}).get('title','')}` v{d.get('info',{}).get('version','')}")
index_lines.append(RULE + f"`swagger.json`. Fetched {DATE}.")
index_lines.append("")
index_lines.append(f"- **{len(seen)} unique endpoints** · **{len(d['paths'])} paths** · **{len(schemas)} component schemas**")
index_lines.append("- Base URL: `https://api.zrexpress.app` (path prefix `/api/v1/…`)")
index_lines.append("- Auth: `X-Api-Key: {apiKey}` + `X-Tenant: {tenantId}` headers (bearer also accepted)")
index_lines.append("")
index_lines.append("| Domain | File | Endpoints |")
index_lines.append("|--------|------|-----------|")
total = 0
for dom, items in dom_ops.items():
    total += len(items)
    index_lines.append(f"| {dom} | `references/{dom}.md` | {len(items)} |")
index_lines.append(f"| **total** | | **{total}** |")
index_lines.append("")
index_lines.append("## Auth")
index_lines.append("")
index_lines.append("| Scheme | Where | Value |")
index_lines.append("|--------|-------|-------|")
index_lines.append("| `bearerAuth` | `Authorization: Bearer {token}` | JWT bearer token |")
index_lines.append("| `apiKey` | `X-Api-Key: {apiKey}` | API key |")
index_lines.append("")
index_lines.append("Most endpoints **also require the `X-Tenant` header** (tenant/supplier Id). The `version` path parameter defaults to `1`.")
index_lines.append("")
index_lines.append("## Endpoint inventory by domain")
index_lines.append("")
for dom in sorted(dom_ops):
    items = sorted(dom_ops[dom], key=sort_key)
    index_lines.append(f"### {dom}")
    index_lines.append("")
    for method, path, _ in items:
        index_lines.append(f"- `{method:6s} {path}`")
    index_lines.append("")

with open(os.path.join(OUT, "endpoints-index.md"), "w") as f:
    f.write("\n".join(index_lines) + "\n")

for dom, items in dom_ops.items():
    items = sorted(items, key=sort_key)
    lines = []
    lines.append(f"# ZR Express API — `{dom}`")
    lines.append("")
    lines.append(RULE + f"`swagger.json`. Re-run the generator to refresh.")
    lines.append("")
    lines.append("Source spec: `swagger.json` (raw) · Index: `endpoints-index.md`")
    lines.append(f"Full request/response shapes: `../schemas/{dom}.json`")
    lines.append("")
    lines.append(f"Endpoints in this domain: **{len(items)}**")
    lines.append("")
    lines.append("| Method | Path | Summary |")
    lines.append("|--------|------|---------|")
    md_by_key = {}
    orig_by_key = {}
    for method, path, md in items:
        orig = ""
        for p, ops in d["paths"].items():
            if p == path:
                for m, op in ops.items():
                    if m.upper() == method:
                        orig = op.get("summary", "")
        md_by_key[(method, path)] = md
        orig_by_key[(method, path)] = orig
        lines.append(f"| `{method}` | `{path}` | {orig} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    for method, path, _ in items:
        lines.append(md_by_key[(method, path)])
        lines.append("")
        lines.append("---")
        lines.append("")
    with open(os.path.join(OUT, "references", f"{dom}.md"), "w") as f:
        f.write("\n".join(lines))

    subset = resolve_schemas(dom_refs[dom], schemas)
    with open(os.path.join(OUT, "schemas", f"{dom}.json"), "w") as f:
        json.dump(subset, f, indent=2, ensure_ascii=False)

print("Wrote", len(dom_ops), "domain files;", total, "endpoints total.")
print("Domains:", json.dumps({k: len(v) for k, v in dom_ops.items()}))