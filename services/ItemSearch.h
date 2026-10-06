#pragma once
#include "../app/Data.h"
#include <unordered_map>

// Rebuild the category index whenever listings change or data is loaded.
class ItemSearch {
    std::unordered_map<std::string, std::vector<int>> index;
public:
    void build(const Data& data);
    std::vector<int> find(const std::string& category, const Data& data) const;
};
