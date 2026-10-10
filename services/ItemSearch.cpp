#include "ItemSearch.h"
#include "../matching/algorithms.h"
#include <algorithm>

void ItemSearch::build(const Data& data) {
    index.clear();
    for (const auto& row : data.listings) {
        if (row->type() == "item")
            index[cleanSkill(row->getCategory())].push_back(row->getId());
    }
}

// Filter inactive items at query time so an old index cannot return them.
std::vector<int> ItemSearch::find(const std::string& category, const Data& data) const {
    std::vector<int> result;
    auto key = cleanSkill(category);
    if (key.empty()) return result;
    for (const auto& entry : index) {
        for (int id : entry.second) {
            auto row = data.listing(id);
            if (row && row->type() == "item" && row->isActive() &&
                (ss_search_matches(cleanSkill(row->getCategory()).c_str(), key.c_str()) ||
                 ss_search_matches(cleanSkill(row->getTitle()).c_str(), key.c_str())))
                result.push_back(id);
        }
    }
    std::sort(result.begin(), result.end());
    return result;
}
