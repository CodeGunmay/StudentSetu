#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Checks real item listings, search, ownership, and tutoring.
set -euo pipefail
test_dir=$(mktemp -d)
export SETU_DATABASE="$test_dir/studentsetu.db" SETU_DEV_OTP=1 PORT=18084
./build/studentsetu-api &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 1

register() {
  local name="$1"
  local payload result otp verified
  payload=$(jq -n --arg name "$name" --arg email "$name@geu.ac.in" \
    '{name:$name,email:$email,branch:"CSE",year:2,password:"StrongPass123",teaches:"Python",wants:"DBMS"}')
  result=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/register" -H 'Content-Type: application/json' -d "$payload")
  otp=$(printf '%s' "$result" | jq -r '.devOtp')
  verified=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/verify" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$name@geu.ac.in\",\"otp\":\"$otp\"}")
  printf '%s' "$verified" | jq -r '.token'
}
owner=$(register owner)
buyer=$(register buyer)
item=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/items" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $owner" \
  -d '{"title":"Spare calculator","category":"Calculator","mode":"sell","price":250}')
item_id=$(printf '%s' "$item" | jq -r '.item.id')
curl -fsS -G "http://127.0.0.1:$PORT/api/items" -H "Authorization: Bearer $buyer" \
  --data-urlencode 'q=calclator' | jq -e --argjson id "$item_id" '.items[0].id==$id' >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/api/items/active" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $owner" \
  -d "{\"id\":$item_id,\"active\":\"0\"}" | jq -e '.item.active=="0"' >/dev/null
curl -fsS "http://127.0.0.1:$PORT/api/items/mine" -H "Authorization: Bearer $owner" \
  | jq -e '.items|length==1' >/dev/null

curl -fsS -X POST "http://127.0.0.1:$PORT/api/teach" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $owner" \
  -d '{"subject":"Mathematics","about":"First year tutoring","price":180}' | jq -e '.listing.price==180' >/dev/null
curl -fsS "http://127.0.0.1:$PORT/api/tutors" -H "Authorization: Bearer $buyer" \
  | jq -e '.tutors|length==1' >/dev/null
curl -fsS -G "http://127.0.0.1:$PORT/api/tutors" -H "Authorization: Bearer $buyer" \
  --data-urlencode 'subject=Mathematics' --data-urlencode 'min=0' --data-urlencode 'max=1000' \
  | jq -e '.tutors|length==1' >/dev/null
echo 'PASS: persistent listings, fuzzy search, ownership, and tutor discovery'
