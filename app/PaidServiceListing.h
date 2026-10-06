#pragma once
#include "Listing.h"
#include "../matching/MatchingEngine.h"
#include <cmath>

// Phase 2 stores paid service details; booking and payment come later.
class PaidServiceListing : public Listing {
    double price;
public:
    PaidServiceListing(int id, int owner, const std::string& title,
                       const std::string& category, double price)
        : Listing(id, owner, title, category), price(price) {
        if (!std::isfinite(price) || price < 0)
            throw std::invalid_argument("Invalid service price");
    }
    double getPrice() const { return price; }
    std::string type() const override { return "paid"; }
    bool matches(const std::string& value) const override {
        return isActive() && cleanSkill(getCategory()) == cleanSkill(value);
    }
    void show(std::ostream& out) const override {
        out << getId() << " | " << getTitle() << " | price " << price
            << " | booking deferred\n";
    }
};
