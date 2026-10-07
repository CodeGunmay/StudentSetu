#pragma once
#include "Listing.h"
#include "../matching/MatchingEngine.h"

// One-way item listings are searched by category instead of skill cycles.
class ItemListing : public Listing {
public:
    ItemListing(int id, int owner, const std::string& title, const std::string& category)
        : Listing(id, owner, title, category) {}
    std::string type() const override { return "item"; }
    bool matches(const std::string& value) const override {
        return isActive() && cleanSkill(getCategory()) == cleanSkill(value);
    }
    void show(std::ostream& out) const override {
        out << getId() << " | student " << getOwner() << " | " << getTitle()
            << " | category " << getCategory()
            << (isActive() ? " | available\n" : " | unavailable\n");
    }
};
