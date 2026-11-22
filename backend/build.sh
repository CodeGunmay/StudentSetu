#!/usr/bin/env bash
# Runs repeatable StudentSetu builds and validation checks.
# Builds the C++ API with its bundled dependencies.
set -euo pipefail
mkdir -p build
gcc -O2 -c backend/vendor/sqlite3.c -o build/sqlite3.o
for module in matching/text matching/graph matching/sort services/hashtable services/queue; do
  gcc -std=c11 -O2 -c "$module.c" -o "build/$(basename "$module").o"
done
g++ -std=c++17 -O2 -pthread -Ibackend backend/main.cpp build/*.o -lcrypto -o build/studentsetu-api
