#include "../matching/MatchingEngine.h"
#include "../matching/algorithms.h"
#include "../app/Data.h"
#include "../services/Waitlist.h"
#include <iostream>
#include <stdexcept>
#include <limits>

static void check(bool condition) {
    if (!condition) throw std::runtime_error("Matching test failed");
}
int main() {
    MatchingEngine engine;
    check(ss_similarity("abcd", "abxy") == 0.5);
    check(ss_search_matches("abcd", "abxy"));
    check(!ss_search_matches("abcd", "axyy"));
    check(ss_similarity("python", "pyhton") > 0.5);
    check(ss_search_matches("spare calculator", "calc"));
    check(!ss_search_matches("", "") && !ss_search_matches("book", ""));
    check(!ss_search_matches(nullptr, "book"));
    check(cleanSkill("  C++ \t Basics \n") == "c++ basics");
    std::vector<SkillOffer> rows = {
        {10, 101, "C++", " python ", true},
        {20, 102, "Python", "DSA", true},
        {30, 103, "DSA", "C++", true}
    };
    auto match = engine.findMatch(10, rows);
    check(match.students == std::vector<int>({10, 20, 30}));
    check(match.listings == std::vector<int>({102, 103, 101}));
    check(!match.direct() && match.found());
    check(!engine.findMatch(10, rows, 2).found());
    check(!engine.findMatch(999, rows).found());
    rows.push_back({40, 104, "Python", "C++", true});
    match = engine.findMatch(10, rows);
    check(match.direct() && match.students == std::vector<int>({10, 40}));
    check(match.listings == std::vector<int>({104, 101}));
    rows.back().active = false;
    check(!engine.findMatch(10, rows).direct());
    rows[2].active = false;
    check(!engine.findMatch(10, rows).found());
    check(!engine.findMatch(10, rows, 1).found());
    check(!engine.findMatch(10, {}).found());
    rows.push_back({10, 105, "Math", "Physics", true});
    bool rejected = false;
    try { engine.findMatch(10, rows); } catch (const std::invalid_argument&) { rejected = true; }
    check(rejected);
    std::vector<SkillOffer> backtrack = {
        {1, 1, "A", "B", true}, {2, 2, "B", "X", true},
        {3, 3, "B", "C", true}, {4, 4, "C", "A", true}
    };
    check(engine.findMatch(1, backtrack).students == std::vector<int>({1, 3, 4}));
    backtrack[3].need = "D";
    backtrack.push_back({5, 5, "D", "A", true});
    check(!engine.findMatch(1, backtrack, 3).found());
    check(engine.findMatch(1, backtrack, 4).students.size() == 4);
    check(engine.buildGraph(backtrack).neighbours(1).size() == 2);
    check(engine.buildGraph({{1, 1, "A", "A", true}}).neighbours(1).empty());

    Data data;
    for (int i = 1; i <= 4; ++i) data.students.emplace_back(i, "Student");
    data.listings = {
        std::make_shared<ItemListing>(1, 2, "Spare Calculator", "calculator"),
        std::make_shared<SkillListing>(2, 2, "Peer math help", "Math", "C++"),
        std::make_shared<PaidServiceListing>(3, 3, "Math tutor", "Math", 120),
        std::make_shared<PaidServiceListing>(4, 4, "Math lessons", "Math", 80),
        std::make_shared<PaidServiceListing>(5, 1, "Own lessons", "Math", 10)
    };
    auto found = engine.search(1, " calculator ", data);
    check(found.size() == 1 && found[0].provider == 2 && found[0].listing == 1);
    check(engine.search(1, "SpArE", data).size() == 1);
    check(engine.search(1, "calclator", data).size() == 1);
    check(engine.search(1, "zzzzzzzzzz", data).empty());
    check(engine.search(1, "", data).empty());
    check(engine.search(99, "math", data).empty());
    auto tutors = engine.peerTutors(1, " math ", data);
    check(tutors.size() == 1 && tutors[0].type == "skill" && tutors[0].requester == 1);
    check(engine.peerTutors(2, "math", data).empty());
    auto paid = engine.paidServices(1, "math", 120, data);
    check(paid.size() == 2 && paid[0].listing == 4 && paid[1].price == 120);
    check(engine.paidServices(1, "math", 79, data).empty());
    check(engine.paidServices(1, "math", -1, data).empty());
    check(engine.paidServices(1, "math", std::numeric_limits<double>::quiet_NaN(), data).empty());
    data.listing(4)->setActive(false);
    check(engine.paidServices(1, "math", 120, data).size() == 1);
    Waitlist wait;
    check(wait.join(1, 1, data) && wait.join(1, 3, data));
    auto handoff = engine.handOff(1, data, wait);
    check(handoff.found() && handoff.recipient == 1 && handoff.listing == 1);
    check(!engine.handOff(1, data, wait).found());
    check(engine.search(1, "calculator", data).empty());
    check(wait.show(1) == std::vector<int>({3}));
    data.listing(1)->setActive(true);
    check(engine.handOff(1, data, wait).recipient == 3);
    check(!engine.handOff(2, data, wait).found());
    check(!engine.handOff(999, data, wait).found());
    std::cout << "Matching tests passed\n";
}
