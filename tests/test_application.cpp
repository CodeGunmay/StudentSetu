#include "../app/Data.h"
#include <stdexcept>
#include <iostream>
#include <sstream>

void check(bool value) { if (!value) throw std::runtime_error("Application test failed"); }

// Check validation and virtual calls through the common Listing base class.
int main() {
    bool rejected = false;
    try { Student bad(0, "A"); } catch (const std::invalid_argument&) { rejected = true; }
    check(rejected);
    rejected = false;
    try { SkillListing bad(1, 1, "Swap", " ", "DSA"); }
    catch (const std::invalid_argument&) { rejected = true; }
    check(rejected);
    Data data;
    data.students.emplace_back(1, "Asha");
    data.listings.push_back(std::make_shared<SkillListing>(1, 1, "Swap", "C++", "DSA"));
    data.listings.push_back(std::make_shared<ItemListing>(2, 1, "Book", "Notes"));
    data.listings.push_back(std::make_shared<PaidServiceListing>(3, 1, "Tuition", "Math", 100));
    check(data.student(1) && !data.student(2));
    check(data.skills().size() == 1);
    check(data.listing(2)->matches(" notes "));
    data.listing(2)->setActive(false);
    check(!data.listing(2)->matches("notes"));
    std::ostringstream out;
    for (const auto& row : data.listings) row->show(out);
    check(out.str().find("booking deferred") != std::string::npos);
    std::cout << "Application tests passed\n";
}
