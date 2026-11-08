#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Verifies C graph matching through the new HTTP endpoint.
set -euo pipefail

test_dir=$(mktemp -d)
export SETU_DATABASE="$test_dir/studentsetu.db" SETU_DEV_OTP=1 PORT=18083
./build/studentsetu-api &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 1

for entry in 'Gunmay:gunmay:C++, DBMS:Python' 'Ishwar:ishwar:Python:DSA' 'Gaurav:gaurav:DSA:C++'; do
  IFS=: read -r name handle teaches wants <<<"$entry"
  payload=$(jq -n --arg name "$name" --arg email "$handle@geu.ac.in" \
    --arg teaches "$teaches" --arg wants "$wants" \
    '{name:$name,email:$email,branch:"CSE",year:2,password:"StrongPass123",teaches:$teaches,wants:$wants}')
  registered=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/register" \
    -H 'Content-Type: application/json' -d "$payload")
  otp=$(printf '%s' "$registered" | jq -r '.devOtp')
  verified=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/verify" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$handle@geu.ac.in\",\"otp\":\"$otp\"}")
  if [ "$handle" = gunmay ]; then token=$(printf '%s' "$verified" | jq -r '.token'); fi
  if [ "$handle" = ishwar ]; then ishwar_token=$(printf '%s' "$verified" | jq -r '.token'); fi
  if [ "$handle" = gaurav ]; then gaurav_token=$(printf '%s' "$verified" | jq -r '.token'); fi
done

result=$(curl -fsS -G "http://127.0.0.1:$PORT/api/barter" \
  -H "Authorization: Bearer $token" --data-urlencode 'skill=Python')
printf '%s' "$result" | jq -e '.ok == true and (.swaps|length)==0 and (.circle|length)==3' >/dev/null
printf '%s' "$result" | jq -e '.circleMembers == "1, 2, 3"' >/dev/null
created=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/circles" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" -d '{"members":"2, 3","skill":"Python"}')
circle_id=$(printf '%s' "$created" | jq -r '.circle.id')
printf '%s' "$created" | jq -e '.circle.status=="waiting"' >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/api/circles/answer" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ishwar_token" -d "{\"id\":$circle_id,\"yes\":\"1\"}" | jq -e '.circle.status=="waiting"' >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/api/circles/answer" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $gaurav_token" -d "{\"id\":$circle_id,\"yes\":\"1\"}" | jq -e '.circle.status=="active"' >/dev/null
echo 'PASS: original C graph finds the exchange circle through the HTTP API'
