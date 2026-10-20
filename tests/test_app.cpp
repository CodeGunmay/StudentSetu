#include <iostream>
#include "../app/Store.h"
using namespace std;

int failed = 0;

void check(bool ok, string name) {
    cout << (ok ? "PASS  " : "FAIL  ") << name << "\n";
    if (!ok)
        failed++;
}

int main() {
    cout << "-- helpers --\n";
    vector<string> list = splitList(" C++ , DBMS,,  python ");
    check(list.size() == 3 && list[0] == "C++" && list[2] == "python", "split list");
    check(joinList(list) == "C++, DBMS, python", "join list");
    check(sameSkill("DBMS", " dbms "), "same skill ignores case");
    check(sameSkill("python", "pyhton"), "same skill allows typo");
    check(!sameSkill("C", "C++"), "short names must be equal");

    cout << "-- student --\n";
    Store store;
    int a = store.addStudent(0, "Gunmay", "gunmay@geu.ac.in", "CSE", 11, splitList("C++, DBMS"),
                             splitList("Python"));
    int b = store.addStudent(0, "Ishwar", "ishwar@geu.ac.in", "CSE", 22, splitList("Python"),
                             splitList("DSA"));
    check(a == 1 && b == 2, "ids given in order");
    check(store.findByEmail("GUNMAY@geu.ac.in")->getId() == 1, "email ignores case");
    check(store.findStudent(1)->skillLike("dbms") == "DBMS", "skill lookup");
    check(store.findStudent(1)->wantLike("python") == "Python", "want lookup");
    check(store.findStudent(9) == NULL, "missing student");

    cout << "-- listings (inheritance and virtual functions) --\n";
    int i1 = store.addItem(0, 1, "Spare calculator", "Calculator", FREE, 500, "");
    int i2 = store.addItem(0, 2, "Book", "Books", SELL, 250, "");
    int t1 = store.addTeach(0, 1, "C++ basics", "C++", 200);
    Listing *l = store.findListing(i1);
    check(l->getType() == ITEM && l->getPrice() == 0, "free item has no price");
    check(store.findListing(i2)->getPrice() == 250, "sell price kept");
    check(store.findListing(t1)->getType() == TEACH, "teach listing type");
    check(l->info() == "[1] Spare calculator | Calculator | Free", "item info");
    check(store.findListing(t1)->info() == "[3] C++ | C++ basics | Rs 200 per hour", "teach info");
    check(l->matches("calclator") && !l->matches("guitar"), "matches uses 50% search");
    l->setActive(false);
    check(l->info().find("not available") != string::npos, "inactive shown");

    cout << "-- requests --\n";
    int r = store.addRequest(0, 1, 2, SWAP_REQ, 0, 0, "wants to learn python", PENDING);
    check(store.findRequest(r)->statusText() == "pending", "new request pending");
    store.findRequest(r)->setStatus(ACCEPTED);
    check(store.findRequest(r)->statusText() == "accepted", "status change");

    cout << "-- clear --\n";
    store.clear();
    check(store.studentCount() == 0 && store.listingCount() == 0, "clear frees all");
    check(store.addStudent(0, "X", "x@geu.ac.in", "CSE", 1, list, list) == 1, "ids restart");

    cout << "\n" << (failed ? "SOME TESTS FAILED" : "ALL TESTS PASSED") << " (" << failed << " failed)\n";
    return failed != 0;
}
