#pragma once
#include "Student.h"
#include "SkillListing.h"
#include "ItemListing.h"
#include "PaidServiceListing.h"
#include <memory>
#include <vector>

// All modules refer to this same set of records.
struct Data {
    std::vector<Student> students;
    std::vector<std::shared_ptr<Listing>> listings;
    int nextStudent = 1;
    int nextListing = 1;
    const Student* student(int id) const {
        for (const auto& row : students) if (row.getId() == id) return &row;
        return nullptr;
    }
    std::shared_ptr<Listing> listing(int id) const {
        for (const auto& row : listings) if (row->getId() == id) return row;
        return nullptr;
    }
    std::vector<SkillOffer> skills() const {
        std::vector<SkillOffer> result;
        for (const auto& row : listings) {
            auto skill = std::dynamic_pointer_cast<SkillListing>(row);
            if (skill) result.push_back(skill->record());
        }
        return result;
    }
};
