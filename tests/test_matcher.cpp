#include <iostream>
#include "../matching/Matcher.h"
#include "../services/FileManager.h"
using namespace std;

int failed = 0;

void check(bool ok, string name) {
    cout << (ok ? "PASS  " : "FAIL  ") << name << "\n";
    if (!ok)
        failed++;
}

int main() {
    Store store;
    Waitlist wait;
    FileManager files;
    Matcher match;
    files.loadDemo(&store, &wait);

    cout << "-- barter --\n";
    vector<int> dbms;
    dbms.push_back(1);
    dbms.push_back(5);
    vector<SortItem> s = match.barter(&store, 4, dbms);
    check(s.size() == 1 && s[0].id == 5, "Asha swaps with Ravi only");
    check(match.theyWant(&store, 4, 5)[0] == "Maths", "Ravi wants Maths from Asha");
    check(match.teaches(&store, 5, "dbms") == "DBMS", "what Ravi teaches");

    store.findStudent(1)->setWant(splitList("Python, Maths"));
    s = match.barter(&store, 4, dbms);
    check(s.size() == 2, "both now swap");
    store.findStudent(1)->setWant(splitList("Python, Maths, Physics"));
    s = match.barter(&store, 4, dbms);
    check(s[0].id == 1 && s[0].value == 2, "more skills wanted ranks first");
    store.findStudent(1)->setWant(splitList("Python"));

    cout << "-- circle --\n";
    vector<int> py;
    py.push_back(2);
    check(match.barter(&store, 1, py).size() == 0, "no direct swap for Gunmay");
    vector<int> ring = match.circle(&store, 1, "python", py);
    check(ring.size() == 3 && ring[0] == 1 && ring[1] == 2 && ring[2] == 3, "Gunmay, Ishwar, Gaurav");
    check(match.learns(&store, 2, 3, 1, "python") == "DSA", "Ishwar learns DSA from Gaurav");
    check(match.learns(&store, 3, 1, 1, "python") == "C++", "Gaurav learns C++ from Gunmay");
    store.findStudent(3)->setWant(splitList("Java"));
    check(match.circle(&store, 1, "python", py).size() == 0, "broken link, no circle");

    cout << "-- paid --\n";
    vector<int> t = match.teachers(&store, 1, "maths", 0, 0, 1);
    check(t.size() == 2 && t[0] == 8 && t[1] == 7, "low to high");
    t = match.teachers(&store, 1, "maths", 0, 0, 0);
    check(t[0] == 7, "high to low");
    check(match.teachers(&store, 1, "maths", 130, 0, 1).size() == 1, "min price");
    check(match.teachers(&store, 1, "maths", 0, 100, 1).size() == 0, "max price");
    check(match.teachers(&store, 1, "c++", 0, 0, 1).size() == 0, "own listing hidden");

    cout << "\n" << (failed ? "SOME TESTS FAILED" : "ALL TESTS PASSED") << " (" << failed << " failed)\n";
    return failed != 0;
}
