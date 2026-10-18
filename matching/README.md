# Phase 2 matching module

Compile `algorithms.c` as C11 and link it with the C++17 sources. The existing
application uses `findMatch` without any changes to teammate files.

`buildGraph` creates requester-to-provider edges. `findMatch` prefers a direct
exchange, then runs DFS for a cycle containing the requested student. The default
limit is four participants, including the requester. Results pair each recipient
with the next participant's listing, including the closing edge. Inactive offers
are excluded. One active skill swap per student is required, as in the console.
IDs need not be consecutive. Search order is deterministic by student ID.

`search` and the console item search accept normalized category/skill or title
substrings, plus fuzzy matches at **50% similarity or higher**, including exactly
50%. Similarity is `1 - Levenshtein distance / max(text length, query length)`.
The C implementation counts insertions, deletions, and substitutions. Empty
queries return no results. Exact/substring matching remains supported so short
queries such as `calc` still find `calculator`. Case and whitespace are normalized
by the C++ caller. This is byte-based text matching for the current English data.
Fuzzy search does not change barter graph edges or paid-service budget filtering.
String length, equality, substring search, and edit distance are implemented
manually in `algorithms.c`; the module does not call `strcmp`, `strstr`, or `strlen`.
`peerTutors` finds skill providers without requiring reciprocal barter; these are
candidate providers, not confirmed free sessions. `paidServices` filters by exact
normalized category and budget, sorted by price and listing ID. Neither API books
sessions or processes payment. Structured results include requester, provider,
listing, type, and price. `handOff` delegates to the team's existing FIFO waitlist
and returns the recipient; successful handoff marks the item unavailable.

Build and run with GCC/G++ from the repository root:

```sh
mkdir -p build
gcc -std=c11 -Wall -Wextra -Werror -c matching/algorithms.c -o build/algorithms.o
g++ -std=c++17 -Wall -Wextra -Werror tests/test_matching.cpp matching/MatchingEngine.cpp matching/Graph.cpp services/Waitlist.cpp build/algorithms.o -o build/test_matching
g++ -std=c++17 -Wall -Wextra -Werror tests/test_services.cpp matching/MatchingEngine.cpp matching/Graph.cpp services/ItemSearch.cpp services/Waitlist.cpp services/FileManager.cpp build/algorithms.o -o build/test_services
g++ -std=c++17 -Wall -Wextra -Werror main.cpp app/Application.cpp matching/MatchingEngine.cpp matching/Graph.cpp services/ItemSearch.cpp services/Waitlist.cpp services/FileManager.cpp build/algorithms.o -o build/studentsetu
./build/test_matching
./build/test_services
```

The matching tests cover direct preference, cycle direction, DFS backtracking,
cycle limits, sparse IDs, inactive and invalid offers, search, tutoring, budgets,
and FIFO handoff. Existing service tests verify persistence and queue behavior.
