#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Tests original algorithms, persistent API, and React together.
set -euo pipefail
cd "$(dirname "$0")/.."

echo '=== Phase 2 original C/C++ regression tests ==='
bash backend/build.sh
gcc -std=c11 -Wall -Wextra matching/text.c matching/graph.c matching/sort.c tests/test_matching.c -o build/test_matching
gcc -std=c11 -Wall -Wextra matching/text.c services/hashtable.c services/queue.c tests/test_services.c -o build/test_services
for test_name in app storage matcher; do
  g++ -std=c++17 -Wall -Wextra "tests/test_${test_name}.cpp" \
    build/text.o build/graph.o build/sort.o build/hashtable.o build/queue.o -o "build/test_${test_name}"
done
for test_name in matching matcher app services storage; do
  echo "--- Original $test_name ---"
  "build/test_${test_name}"
done
g++ -std=c++17 -Wall -Wextra main.cpp \
  build/text.o build/graph.o build/sort.o build/hashtable.o build/queue.o -o build/studentsetu-cli
printf '0\n' | build/studentsetu-cli | grep -q 'Bye!'
echo 'PASS: original Phase 2 interactive command-line app starts and exits cleanly'

echo '=== Real C++ API, SQLite, and original algorithm integration ==='
for test_name in auth matching marketplace requests bookings; do
  bash "tests/test_backend_${test_name}.sh"
done
bash tests/test_backend_persistence.sh

echo '=== React build and frontend regressions ==='
(
  cd frontend
  npm run build
  npm run test:all
)

echo '=== React-to-real-C++ API end-to-end contract ==='
bash tests/test_frontend_live.sh

echo 'PASS: full integrated StudentSetu regression run'
