#include "../services/ItemSearch.h"
#include "../services/FileManager.h"
#include <fstream>
#include <iostream>
#include <cstdio>

void check(bool value) { if (!value) throw std::runtime_error("Services test failed"); }

// Test search, queue order and persistence using one small shared dataset.
int main() {
    Data data;
    for (int i = 1; i <= 3; ++i) data.students.emplace_back(i, "Student " + std::to_string(i));
    data.listings.push_back(std::make_shared<ItemListing>(1, 1, "Old calculator", "Calculator"));
    data.listings.push_back(std::make_shared<SkillListing>(2, 2, "Swap", "C++", "DSA"));
    data.listings.push_back(std::make_shared<PaidServiceListing>(3, 3, "Tuition", "Math", 120.5));
    ItemSearch search; search.build(data);
    check(search.find(" calculator ", data) == std::vector<int>({1}));
    check(search.find("book", data).empty());
    Waitlist wait;
    check(!wait.join(1, 1, data));
    check(!wait.join(99, 2, data));
    check(wait.join(1, 2, data) && wait.join(1, 3, data));
    check(!wait.join(1, 2, data));
    check(wait.handOff(1, data) == 2);
    check(wait.handOff(1, data) == 0);
    check(search.find("calculator", data).empty());
    FileManager files; std::string error;
    check(files.save("test_snapshot.txt", data, wait, error));
    Data loaded; Waitlist loadedWait;
    check(files.load("test_snapshot.txt", loaded, loadedWait, error));
    check(loaded.students.size() == 3 && loaded.listings.size() == 3);
    check(loadedWait.show(1) == std::vector<int>({3}));
    check(!loaded.listing(1)->isActive());
    check(loaded.nextStudent == 4 && loaded.nextListing == 4);
    check(std::dynamic_pointer_cast<SkillListing>(loaded.listing(2))->getOffer() == "C++");
    check(std::dynamic_pointer_cast<PaidServiceListing>(loaded.listing(3))->getPrice() == 120.5);
    loaded.listing(1)->setActive(true);
    check(loadedWait.handOff(1, loaded) == 3);
    { std::ofstream bad("test_bad.txt"); bad << "STUDENTSETU 1\nL item 1 99 1 \"Book\" \"notes\"\n"; }
    check(!files.load("test_bad.txt", loaded, loadedWait, error));
    check(loaded.students.size() == 3);
    check(!files.load("missing_directory/no_file.txt", loaded, loadedWait, error));
    { std::ofstream empty("test_bad.txt"); }
    check(!files.load("test_bad.txt", loaded, loadedWait, error));
    std::remove("test_snapshot.txt"); std::remove("test_bad.txt");
    std::cout << "Services tests passed\n";
}
