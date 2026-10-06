#include "ItemSearch.h"

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
    auto it = index.find(cleanSkill(category));
    if (it == index.end()) return result;
    for (int id : it->second) {
        auto row = data.listing(id);
        if (row && row->type() == "item" && row->matches(category)) result.push_back(id);
    }
    return result;
}
