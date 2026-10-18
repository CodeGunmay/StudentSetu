#pragma once
#include "Graph.h"
#include "Match.h"
#include <string>
#include <cstddef>

struct Data;
class Waitlist;
std::string cleanSkill(const std::string& value);
struct SkillOffer {
    int student, listing;
    std::string offer, need;
    bool active;
};
struct ListingMatch {
    int requester, provider, listing;
    std::string type;
    double price;
};
struct HandoffResult {
    int listing = 0;
    int recipient = 0;
    bool found() const { return recipient > 0; }
};
class MatchingEngine {
public:
    Graph buildGraph(const std::vector<SkillOffer>& offers) const;
    Match findMatch(int student, const std::vector<SkillOffer>& offers,
                    std::size_t maxCycle = 4) const;
    std::vector<ListingMatch> search(int requester, const std::string& query,
                                    const Data& data) const;
    std::vector<ListingMatch> paidServices(int requester, const std::string& category,
                                          double budget, const Data& data) const;
    std::vector<ListingMatch> peerTutors(int requester, const std::string& skill,
                                       const Data& data) const;
    HandoffResult handOff(int listing, Data& data, Waitlist& wait) const;
};
