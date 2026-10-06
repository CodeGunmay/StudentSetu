#pragma once
#include "Listing.h"
#include "../matching/MatchingEngine.h"

// A skill swap contains both the offered skill and the requested skill.
class SkillListing : public Listing {
    std::string offer, need;
public:
    SkillListing(int id, int owner, const std::string& title,
                 const std::string& offer, const std::string& need)
        : Listing(id, owner, title, "skill"), offer(offer), need(need) {
        if (cleanSkill(offer).empty() || cleanSkill(need).empty())
            throw std::invalid_argument("Offer and need cannot be empty");
    }
    const std::string& getOffer() const { return offer; }
    const std::string& getNeed() const { return need; }
    std::string type() const override { return "skill"; }
    bool matches(const std::string& value) const override {
        return isActive() && cleanSkill(offer) == cleanSkill(value);
    }
    SkillOffer record() const {
        return {getOwner(), getId(), offer, need, isActive()};
    }
    void show(std::ostream& out) const override {
        out << getId() << " | student " << getOwner() << " | " << getTitle()
            << " | offers " << offer << " | needs " << need
            << (isActive() ? " | active\n" : " | inactive\n");
    }
};
