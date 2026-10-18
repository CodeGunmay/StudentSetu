#include "MatchingEngine.h"
#include "algorithms.h"
#include "../app/Data.h"
#include "../services/Waitlist.h"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <map>
#include <stdexcept>

std::string cleanSkill(const std::string& value) {
    std::string result;
    bool space = false;
    for (unsigned char c : value) {
        if (std::isspace(c)) { space = !result.empty(); continue; }
        if (space) result += ' ';
        result += static_cast<char>(std::tolower(c));
        space = false;
    }
    return result;
}

static std::vector<SkillOffer> activeOffers(const std::vector<SkillOffer>& offers) {
    std::vector<SkillOffer> result;
    std::map<int, bool> students, listings;
    for (auto row : offers) {
        if (!row.active) continue;
        row.offer = cleanSkill(row.offer); row.need = cleanSkill(row.need);
        if (row.student <= 0 || row.listing <= 0 || row.offer.empty() || row.need.empty() ||
            students.count(row.student) || listings.count(row.listing))
            throw std::invalid_argument("Invalid or duplicate active skill swap");
        students[row.student] = true; listings[row.listing] = true;
        result.push_back(row);
    }
    std::sort(result.begin(), result.end(), [](const SkillOffer& a, const SkillOffer& b) {
        return a.student < b.student;
    });
    return result;
}

Graph MatchingEngine::buildGraph(const std::vector<SkillOffer>& offers) const {
    auto rows = activeOffers(offers);
    std::vector<SS_Skill> skills;
    for (const auto& row : rows)
        skills.push_back({row.offer.c_str(), row.need.c_str(), row.listing});
    std::vector<SS_Edge> edges(ss_build_edges(skills.data(), skills.size(), nullptr, 0));
    ss_build_edges(skills.data(), skills.size(), edges.data(), edges.size());
    Graph graph;
    for (const auto& row : rows) graph.addStudent(row.student);
    for (const auto& edge : edges)
        graph.addEdge(rows[edge.from].student, rows[edge.to].student, edge.listing);
    return graph;
}

Match MatchingEngine::findMatch(int student, const std::vector<SkillOffer>& offers,
                                std::size_t maxCycle) const {
    auto rows = activeOffers(offers);
    std::map<int, std::size_t> index;
    for (std::size_t i = 0; i < rows.size(); ++i) index[rows[i].student] = i;
    auto start = index.find(student);
    if (start == index.end() || maxCycle < 2) return {};
    auto graph = buildGraph(rows);
    std::vector<SS_Edge> edges;
    for (const auto& row : rows)
        for (const auto& edge : graph.neighbours(row.student))
            edges.push_back({index.at(row.student), index.at(edge.to), edge.listing});
    auto limit = std::min(maxCycle, rows.size());
    std::vector<std::size_t> path(limit);
    std::vector<int> listings(limit);
    auto count = ss_find_cycle(start->second, rows.size(), edges.data(), edges.size(),
                               limit, path.data(), listings.data());
    Match result;
    for (std::size_t i = 0; i < count; ++i) {
        result.students.push_back(rows[path[i]].student);
        result.listings.push_back(listings[i]);
    }
    return result;
}

static ListingMatch record(int requester, const std::shared_ptr<Listing>& row) {
    auto paid = std::dynamic_pointer_cast<PaidServiceListing>(row);
    return {requester, row->getOwner(), row->getId(), row->type(),
            paid ? paid->getPrice() : 0.0};
}

std::vector<ListingMatch> MatchingEngine::search(int requester, const std::string& query,
                                               const Data& data) const {
    std::vector<ListingMatch> result;
    auto key = cleanSkill(query);
    if (!data.student(requester) || key.empty()) return result;
    for (const auto& row : data.listings) {
        if (!row || !row->isActive() || row->getOwner() == requester ||
            !data.student(row->getOwner())) continue;
        auto skill = std::dynamic_pointer_cast<SkillListing>(row);
        if (ss_search_matches(cleanSkill(row->getCategory()).c_str(), key.c_str()) ||
            ss_search_matches(cleanSkill(row->getTitle()).c_str(), key.c_str()) ||
            (skill && ss_search_matches(cleanSkill(skill->getOffer()).c_str(), key.c_str())))
            result.push_back(record(requester, row));
    }
    return result;
}

std::vector<ListingMatch> MatchingEngine::paidServices(int requester, const std::string& category,
                                                     double budget, const Data& data) const {
    std::vector<ListingMatch> result;
    if (!std::isfinite(budget) || budget < 0 || !data.student(requester) ||
        cleanSkill(category).empty()) return result;
    for (const auto& row : data.listings) {
        auto paid = std::dynamic_pointer_cast<PaidServiceListing>(row);
        if (paid && paid->getOwner() != requester && data.student(paid->getOwner()) &&
            paid->matches(category) && paid->getPrice() <= budget)
            result.push_back(record(requester, row));
    }
    std::sort(result.begin(), result.end(), [](const ListingMatch& a, const ListingMatch& b) {
        return a.price == b.price ? a.listing < b.listing : a.price < b.price;
    });
    return result;
}

std::vector<ListingMatch> MatchingEngine::peerTutors(int requester, const std::string& skill,
                                                   const Data& data) const {
    std::vector<ListingMatch> result;
    if (!data.student(requester) || cleanSkill(skill).empty()) return result;
    for (const auto& row : data.listings) {
        auto tutor = std::dynamic_pointer_cast<SkillListing>(row);
        if (tutor && tutor->getOwner() != requester && data.student(tutor->getOwner()) &&
            tutor->matches(skill)) result.push_back(record(requester, row));
    }
    return result;
}

HandoffResult MatchingEngine::handOff(int listing, Data& data, Waitlist& wait) const {
    return {listing, wait.handOff(listing, data)};
}
