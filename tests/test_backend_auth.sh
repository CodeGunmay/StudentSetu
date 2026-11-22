#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Checks backend registration, verification, login, and protected profiles.
set -euo pipefail

test_dir=$(mktemp -d)
export SETU_DATABASE="$test_dir/studentsetu.db"
export SETU_DEV_OTP=1
export PORT=18082

./build/studentsetu-api &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 1

curl -fsS "http://127.0.0.1:$PORT/api/health" | jq -e '.ok == true' >/dev/null

registered=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Student","email":"test.student@geu.ac.in","branch":"CSE","year":2,"password":"StrongPass123","teaches":"Python","wants":"C++"}')
otp=$(printf '%s' "$registered" | jq -r '.devOtp')
test "${#otp}" -eq 6

verified=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"test.student@geu.ac.in\",\"otp\":\"$otp\"}")
token=$(printf '%s' "$verified" | jq -r '.token')
test "${#token}" -eq 64

curl -fsS "http://127.0.0.1:$PORT/api/me" \
  -H "Authorization: Bearer $token" | jq -e '.verified == "1"' >/dev/null

login=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test.student@geu.ac.in","password":"StrongPass123"}')
printf '%s' "$login" | jq -e '.ok == true and (.token | length == 64)' >/dev/null

status=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/me")
test "$status" = 401

echo 'PASS: backend registration, OTP, login, profile, and authorization'
