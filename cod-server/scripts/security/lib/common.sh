#!/usr/bin/env bash
# Shared engine for the RBAC black-box suite. Domain files only REGISTER
# endpoints (via `ep`); rbac.sh sources them and calls run_suite.
#
# Expectations enforced for every endpoint:
#   anon / invalid-key      → 401
#   inactive staff          → 401 or 403
#   staff w/o needed scope  → 403
#   staff WITH needed scope → any non-40x (400/404 fine — wall passed, body rejected later)
#   admin                   → any non-40x

BASE_URL="${BASE_URL:-https://api.codflow.store}"
DB_NAME="codflow-os-db"
PARALLEL="${PARALLEL:-12}"
SEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$SEC_DIR/../.."
KEYS_CACHE="/tmp/codflow-sectest-keys.${DB_NAME}.txt"
EP_FILE=""
OUT_FILE=""

sec_init() {
  if [[ "${SKIP_SEED:-0}" != "1" ]]; then
    echo "• Seeding personas into $DB_NAME (remote, idempotent)…"
    (cd "$SERVER_DIR" && npx wrangler d1 execute "$DB_NAME" --remote --file "$SEC_DIR/seed-personas.sql" -y >/dev/null 2>&1) \
      || { echo "✗ seed failed"; exit 1; }
  fi
  if [[ -s "$KEYS_CACHE" && "${REFRESH_KEYS:-0}" != "1" ]]; then
    echo "• Persona keys from cache ($KEYS_CACHE; REFRESH_KEYS=1 to refetch)"
  else
    echo "• Fetching persona keys from D1…"
    local json
    json=$( (cd "$SERVER_DIR" && npx wrangler d1 execute "$DB_NAME" --remote --json \
      --command "SELECT id, api_key FROM users WHERE email LIKE 'sectest-%' AND api_key IS NOT NULL") )
    printf '%s' "$json" | node -e '
      let raw=""; process.stdin.on("data",d=>raw+=d).on("end",()=>{
        const s=raw.slice(raw.indexOf("["), raw.lastIndexOf("]")+1);
        JSON.parse(s).flatMap(r=>r.results||[])
          .filter(r=>r.id.startsWith("sectest-"))
          .forEach(r=>console.log(r.id+"="+r.api_key));
      });' > "$KEYS_CACHE" || { echo "✗ key fetch failed"; exit 1; }
  fi
  KEYLIST=$(cat "$KEYS_CACHE")
  export KEYLIST BASE_URL PARALLEL
  local n; n=$(printf '%s\n' "$KEYLIST" | wc -l | tr -d ' ')
  [[ "$n" -ge 43 ]] || { echo "✗ only $n personas cached — run with REFRESH_KEYS=1"; exit 1; }
  echo "• Target: $BASE_URL  ($n personas, PARALLEL=$PARALLEL)"
}

ep() { # ep METHOD PATH REQUIRED_SCOPE [JSON_BODY]
  [[ -z "$EP_FILE" ]] && EP_FILE="$(mktemp)"
  if [[ $# -ge 4 ]]; then printf '%s|%s|%s|%s\n' "$1" "$2" "$3" "$4" >> "$EP_FILE";
  else printf '%s|%s|%s|\n' "$1" "$2" "$3" >> "$EP_FILE"; fi
}

worker() { # $1 = persona|m|path|scope|body  → prints got|persona|label|scope
  IFS='|' read -r persona m path scope body <<< "$1"
  local args=(-s -o /dev/null -w "%{http_code}" --max-time 20 -X "$m" "$BASE_URL$path")
  case "$persona" in
    none)    : ;;
    invalid) args+=(-H "X-API-Key: invalid-key-probe") ;;
    *)       local k; k=$(printf '%s' "$KEYLIST" | grep "^sectest-$persona=" | head -1 | cut -d= -f2-)
             args+=(-H "X-API-Key: $k") ;;
  esac
  [[ -n "$body" ]] && args+=(-H "Content-Type: application/json" -d "$body")
  local got; got=$(curl "${args[@]}" 2>/dev/null)
  if [[ -z "$got" || "$got" == "000" ]]; then sleep 2; got=$(curl "${args[@]}" 2>/dev/null); fi
  echo "${got:-000}|$persona|$m $path|$scope"
}
export -f worker

# persona slug (dash form) → the exact scope string it holds
persona_scope() {
  case "$1" in
    s-dashboard-view)          echo "dashboard:view" ;;
    s-orders-read)             echo "orders:read" ;;
    s-orders-create)           echo "orders:create" ;;
    s-orders-update)           echo "orders:update" ;;
    s-orders-delete)           echo "orders:delete" ;;
    s-orders-assign)           echo "orders:assign" ;;
    s-customers-read)          echo "customers:read" ;;
    s-customers-create)        echo "customers:create" ;;
    s-customers-update)        echo "customers:update" ;;
    s-customers-delete)        echo "customers:delete" ;;
    s-products-read)           echo "products:read" ;;
    s-products-create)         echo "products:create" ;;
    s-products-update)         echo "products:update" ;;
    s-products-delete)         echo "products:delete" ;;
    s-products-manage)         echo "products:manage" ;;
    s-delivery-read)           echo "delivery:read" ;;
    s-delivery-create)         echo "delivery:create" ;;
    s-delivery-update)         echo "delivery:update" ;;
    s-delivery-delete)         echo "delivery:delete" ;;
    s-delivery-assign)         echo "delivery:assign" ;;
    s-delivery-manage)         echo "delivery:manage" ;;
    s-delivery-dispatch)       echo "delivery:dispatch" ;;
    s-customer-groups-read)    echo "customer_groups:read" ;;
    s-customer-groups-manage)  echo "customer_groups:manage" ;;
    s-customer-tags-read)      echo "customer_tags:read" ;;
    s-customer-tags-manage)    echo "customer_tags:manage" ;;
    s-product-groups-read)     echo "product_groups:read" ;;
    s-product-groups-manage)   echo "product_groups:manage" ;;
    s-stock-read)              echo "stock:read" ;;
    s-stock-manage)            echo "stock:manage" ;;
    s-settings-view)           echo "settings:view" ;;
    s-settings-team)           echo "settings:team" ;;
    s-settings-integrations)   echo "settings:integrations" ;;
    s-settings-notifications)  echo "settings:notifications" ;;
    s-reviews-read)            echo "reviews:read" ;;
    s-reviews-manage)          echo "reviews:manage" ;;
    s-offers-read)             echo "offers:read" ;;
    s-offers-manage)           echo "offers:manage" ;;
    s-abandoned-orders-read)   echo "abandoned_orders:read" ;;
    s-abandoned-orders-manage) echo "abandoned_orders:manage" ;;
    *)                         echo "__unknown__" ;;
  esac
}

verdict() { # verdict PERSONA SCOPE GOT → 0 iff behaviour matches design
  local persona="$1" scope="$2" got="$3" held=""
  [[ "$scope" == "PUBLIC" ]] && return 0
  case "$persona" in
    none|invalid) [[ "$got" == "401" ]]; return ;;
    inactive)     [[ "$got" == "401" || "$got" == "403" ]]; return ;;
    admin)        [[ ! "$got" =~ ^(401|403)$ ]]; return ;;
    noscopes)     held="" ;;
    s-*)          held=$(persona_scope "$persona") ;;
    *)            held="__unknown__" ;;
  esac
  if    [[ "$scope" == "ADMIN_ONLY" ]]; then [[ "$got" == "403" ]]
  elif  [[ "$scope" == "*" ]];          then [[ ! "$got" =~ ^(401|403)$ ]]
  elif  [[ ",$held," == *",$scope,"* ]];then [[ ! "$got" =~ ^(401|403)$ ]]
  else                                       [[ "$got" == "403" ]]
  fi
}

short_name() {
  case "$1" in
    none)     echo "anon" ;;
    invalid)  echo "invalid" ;;
    admin)    echo "admin" ;;
    noscopes) echo "noscopes" ;;
    inactive) echo "inactive" ;;
    s-*)      echo "s:${1#s-}" ;;
    *)        echo "$1" ;;
  esac
}

run_suite() { # run_suite DOMAIN_NAME  (sets SUITE_PASS / SUITE_FAIL)
  OUT_FILE="$(mktemp)"
  local jobs; jobs="$(mktemp)"

  local ids; ids=$(printf '%s' "$KEYLIST" | cut -d= -f1 | sed 's/^sectest-//')
  while IFS='|' read -r m p scope body; do
    [[ -z "$m" ]] && continue
    local path; path=$(printf '%s' "$p" | sed 's/{[a-z]*}/sectest-nonexistent/g')
    for persona in none invalid $ids; do
      printf '%s|%s|%s|%s|%s|%s|%s\n' "$persona" "$m" "$path" "$scope" "$body" "$p" "$m $p" >> "$jobs"
    done
  done < "$EP_FILE"

  local total; total=$(wc -l < "$jobs" | tr -d ' ')
  echo ""
  echo "━━━ $1 ━ $total probes ━━━"
  tr '\n' '\0' < "$jobs" | xargs -0 -P "$PARALLEL" -n1 bash -c '
    IFS="|" read -r persona m path scope body orig lbl <<< "$0"
    worker "$persona|$m|$path|$scope|$body" | sed "s#|$m $path|#|$lbl|#"
  ' >> "$OUT_FILE"

  PASS=0; FAIL=0
  local labels; labels=$(cut -d'|' -f3 "$OUT_FILE" | awk '!seen[$0]++')
  while IFS= read -r lbl; do
    [[ -z "$lbl" ]] && continue
    local rows n fcount=0 detail="" scope_disp=""
    rows=$(grep -F "|$lbl|" "$OUT_FILE")
    n=$(printf '%s\n' "$rows" | wc -l | tr -d ' ')
    scope_disp=$(printf '%s\n' "$rows" | head -1 | cut -d'|' -f4)
    while IFS='|' read -r got persona l scope; do
      [[ -z "$got" ]] && continue
      if verdict "$persona" "$scope" "$got"; then
        PASS=$((PASS+1))
      else
        FAIL=$((FAIL+1)); fcount=$((fcount+1))
        detail="$detail
         ✗ $(short_name "$persona") → ${got:-net-err}"
      fi
    done <<EOF2
$rows
EOF2
    if [[ $fcount == 0 ]]; then
      printf '  \033[32mPASS\033[0m %-56s [%s] %s/%s\n' "$lbl" "$scope_disp" "$n" "$n"
    else
      printf '  \033[31mFAIL\033[0m %-56s [%s] %d/%s mismatch%s\n' "$lbl" "$scope_disp" "$fcount" "$n" "$detail"
    fi
  done <<< "$labels"

  SUITE_PASS=$PASS; SUITE_FAIL=$FAIL
  printf '\n  «%s» \033[32m%d ok\033[0m / \033[31m%d mismatched\033[0m\n\n' "$1" "$PASS" "$FAIL"
}
