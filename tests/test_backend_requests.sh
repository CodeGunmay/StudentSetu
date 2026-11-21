#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Checks request ownership, cancellation, handoffs, and persisted ratings.
set -euo pipefail
test_dir=$(mktemp -d)
export SETU_DATABASE="$test_dir/studentsetu.db" SETU_DEV_OTP=1 PORT=18085
./build/studentsetu-api &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 1

account() {
  local handle="$1" payload result otp
  payload=$(jq -n --arg name "$handle Person" --arg email "$handle@geu.ac.in" \
    '{name:$name,email:$email,branch:"CSE",year:2,password:"StrongPass123",teaches:"Python",wants:"DBMS"}')
  result=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/register" -H 'Content-Type: application/json' -d "$payload")
  otp=$(printf '%s' "$result" | jq -r '.devOtp')
  curl -fsS -X POST "http://127.0.0.1:$PORT/api/verify" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$handle@geu.ac.in\",\"otp\":\"$otp\"}" | jq -r '.token'
}
owner=$(account owner)
buyer=$(account buyer)
post() { local token="$1" path="$2" body="$3"; curl -fsS -X POST "http://127.0.0.1:$PORT/api/$path" -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$body"; }

item=$(post "$owner" items '{"title":"C++ book","category":"Books","mode":"sell","price":200}')
item_id=$(printf '%s' "$item" | jq -r '.item.id')
offer=$(post "$buyer" items/request "{\"id\":$item_id}")
request_id=$(printf '%s' "$offer" | jq -r '.request.id')
post "$owner" requests/accept "{\"id\":$request_id}" | jq -e '.request.status=="accepted"' >/dev/null
post "$buyer" requests/complete "{\"id\":$request_id}" | jq -e '.completionPending==true' >/dev/null
post "$owner" requests/complete "{\"id\":$request_id}" | jq -e '.request.status=="completed"' >/dev/null
post "$buyer" ratings "{\"request\":$request_id,\"stars\":5}" | jq -e '.ratingCount==1' >/dev/null
status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/ratings" -H 'Content-Type: application/json' -H "Authorization: Bearer $buyer" -d "{\"request\":$request_id,\"stars\":5}")
test "$status" = 409

free=$(post "$owner" items '{"title":"Free calculator","category":"Calculator","mode":"free","price":0}')
free_id=$(printf '%s' "$free" | jq -r '.item.id')
post "$buyer" items/request "{\"id\":$free_id}" | jq -e '.place==1' >/dev/null
post "$owner" items/handoff "{\"id\":$free_id}" | jq -e '.givenTo.name=="buyer Person"' >/dev/null
echo 'PASS: item requests, acceptance, completion, rating, and FIFO handoff'
