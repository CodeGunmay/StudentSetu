// Validates proposed exchange circles before students receive invitations.
#ifndef SETU_MATCH_VALIDATOR_H
#define SETU_MATCH_VALIDATOR_H
#include "Matcher.h"
#include <set>

inline bool validExchangeCircle(Store &store, Matcher &matcher, const std::vector<int> &ids,
                                int owner, const std::string &skill) {
    if (ids.size() < 3 || ids.size() > 4 || ids.front() != owner) return false;
    std::set<int> unique(ids.begin(), ids.end());
    if (unique.size() != ids.size()) return false;
    for (size_t i = 0; i < ids.size(); ++i) {
        if (!store.findStudent(ids[i])) return false;
        if (matcher.learns(&store, ids[i], ids[(i + 1) % ids.size()], owner, skill).empty()) return false;
    }
    return true;
}
#endif
