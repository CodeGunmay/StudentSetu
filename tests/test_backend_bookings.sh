#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Verifies tutor booking confirmation and offline payment tracking.
set -euo pipefail
test_dir=$(mktemp -d)
export SETU_DATABASE="$test_dir/studentsetu.db" SETU_DEV_OTP=1 PORT=18086
./build/studentsetu-api &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 1
account() {
  local handle="$1" result otp
  result=$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/register" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$handle Student\",\"email\":\"$handle@geu.ac.in\",\"branch\":\"CSE\",\"year\":2,\"password\":\"StrongPass123\",\"teaches\":\"DBMS\"}")
  otp=$(printf '%s' "$result" | jq -r '.devOtp')
  curl -fsS -X POST "http://127.0.0.1:$PORT/api/verify" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$handle@geu.ac.in\",\"otp\":\"$otp\"}" | jq -r '.token'
}
tutor=$(account tutor)
student=$(account student)
post() { curl -fsS -X POST "http://127.0.0.1:$PORT/api/$2" -H 'Content-Type: application/json' -H "Authorization: Bearer $1" -d "$3"; }
listing=$(post "$tutor" teach '{"subject":"Mathematics","about":"First year maths support","price":200}')
listing_id=$(printf '%s' "$listing" | jq -r '.listing.id')
booking=$(post "$student" bookings "{\"listing\":$listing_id,\"slotStart\":\"2026-11-09T14:00\",\"slotEnd\":\"2026-11-09T15:00\"}")
id=$(printf '%s' "$booking" | jq -r '.booking.id')
printf '%s' "$booking" | jq -e '.booking.status=="pending" and .booking.paymentStatus=="pending"' >/dev/null
post "$tutor" bookings/answer "{\"id\":$id,\"accept\":\"1\"}" | jq -e '.booking.status=="confirmed"' >/dev/null
post "$tutor" bookings/payment "{\"id\":$id,\"status\":\"paid\"}" | jq -e '.booking.paymentStatus=="paid"' >/dev/null
post "$student" bookings/cancel "{\"id\":$id}" | jq -e '.booking.status=="cancelled" and .booking.paymentStatus=="cancelled"' >/dev/null
echo 'PASS: booking creation, tutor confirmation, offline status, cancellation'
