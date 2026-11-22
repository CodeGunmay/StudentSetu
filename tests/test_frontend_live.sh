#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Runs the existing React contract suite against real C++ routes.
set -euo pipefail
project_root=$(pwd)
test_dir=$(mktemp -d)
export SETU_DATABASE="$test_dir/studentsetu.db" SETU_DEV_OTP=1 PORT=18087
./build/studentsetu-api &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 1

for name in gunmay ishwar gaurav; do
  payload=$(jq -n --arg name "$name Student" --arg email "$name@geu.ac.in" \
    '{name:$name,email:$email,branch:"CSE",year:2,password:"StrongPass123",teaches:"Python, DBMS",wants:"C++"}')
  result=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/register" -H 'Content-Type: application/json' -d "$payload")
  otp=$(printf '%s' "$result" | jq -r '.devOtp')
  verified=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/verify" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$name@geu.ac.in\",\"otp\":\"$otp\"}")
  if [ "$name" = gunmay ]; then gunmay_token=$(printf '%s' "$verified" | jq -r '.token'); fi
  if [ "$name" = ishwar ]; then ishwar_token=$(printf '%s' "$verified" | jq -r '.token'); fi
done

curl -fsS -X POST "http://127.0.0.1:$PORT/api/items" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $gunmay_token" \
  -d '{"title":"Spare calculator","category":"Calculator","mode":"sell","price":150}' >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/api/items" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ishwar_token" \
  -d '{"title":"Programming notes","category":"Notes","mode":"sell","price":100}' >/dev/null

cd "$project_root/frontend"
SETU_API_URL="http://127.0.0.1:$PORT" SETU_EMAIL=gunmay@geu.ac.in \
  SETU_PASSWORD=StrongPass123 SETU_PEER_EMAIL=ishwar@geu.ac.in \
  SETU_PEER_PASSWORD=StrongPass123 SETU_LIVE_WRITE=1 npm run test:live
