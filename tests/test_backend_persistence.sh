#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Confirms actual records survive stopping and restarting backend.
set -euo pipefail
test_dir=$(mktemp -d)
export SETU_DATABASE="$test_dir/studentsetu.db" SETU_DEV_OTP=1 PORT=18088
server_pid=''
stop_server() {
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    server_pid=''
  fi
}
trap stop_server EXIT
start_server() {
  ./build/studentsetu-api > "$test_dir/server.log" 2>&1 &
  server_pid=$!
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then return; fi
    sleep 1
  done
  echo 'Backend did not start' >&2
  return 1
}
post() {
  curl -fsS -X POST "http://127.0.0.1:$PORT/api/$2" \
    -H 'Content-Type: application/json' -H "Authorization: Bearer $1" -d "$3"
}
start_server
registered=$(post '' register '{"name":"Persistence Student","email":"persistence@geu.ac.in","branch":"CSE","year":2,"password":"SecurePassword123","teaches":"Python","wants":"C++"}')
otp=$(printf '%s' "$registered" | jq -r '.devOtp')
confirmed=$(post '' verify "{\"email\":\"persistence@geu.ac.in\",\"otp\":\"$otp\"}")
token=$(printf '%s' "$confirmed" | jq -r '.token')
item=$(post "$token" items '{"title":"Persistent C++ guide","category":"Books","mode":"sell","price":130}')
item_id=$(printf '%s' "$item" | jq -r '.item.id')
post "$token" teach '{"subject":"Discrete Maths","about":"Weekend support","price":180}' >/dev/null
stop_server
start_server
logged_in=$(post '' login '{"email":"persistence@geu.ac.in","password":"SecurePassword123"}')
new_token=$(printf '%s' "$logged_in" | jq -r '.token')
curl -fsS "http://127.0.0.1:$PORT/api/items/mine" -H "Authorization: Bearer $new_token" |
  jq -e --argjson id "$item_id" '.items | any(.item.id == $id and .item.title == "Persistent C++ guide")' >/dev/null
curl -fsS "http://127.0.0.1:$PORT/api/teach/mine" -H "Authorization: Bearer $new_token" |
  jq -e '.listings | any(.category == "Discrete Maths")' >/dev/null
echo 'PASS: account, password login, item, and tutoring listing survived restart'
