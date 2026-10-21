#include <iostream>
#include <cstdio>
#include "../app/Store.h"
#include "../services/Waitlist.h"
#include "../services/Requests.h"
#include "../services/ItemSearch.h"
#include "../services/SkillIndex.h"
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
    Requests req;
    files.loadDemo(&store, &wait);

    cout << "-- skill index --\n";
    SkillIndex index;
    index.build(&store);
    check(index.find("dbms").size() == 2, "exact skill from hash");
    check(index.find("pyhton").size() == 1, "similar skill name");
    check(index.find("guitar").size() == 0, "unknown skill");

    cout << "-- item search --\n";
    ItemSearch search;
    vector<int> r = search.search(&store, "calclator", 0, 0, 1);
    check(r.size() == 1 && r[0] == 1, "typo finds calculator");
    r = search.search(&store, "lab", 3, 1, 1);
    check(r.size() == 1 && r[0] == 4, "sell filter");
    check(search.search(&store, "calculator", 0, 0, 3).size() == 0, "own item hidden");
    search.build(&store);
    check(search.browse(&store, "lab equipment").size() == 2, "browse category");

    cout << "-- waitlist --\n";
    check(wait.join(&store, 1, 1) == 1 && wait.join(&store, 1, 2) == 2, "join in order");
    check(wait.join(&store, 1, 1) == -1, "no duplicate");
    check(wait.join(&store, 1, 3) == 0, "owner cannot join");
    check(wait.join(&store, 3, 1) == 0, "sell item has no waitlist");
    check(wait.handOff(&store, 1) == 1, "first in line gets it");
    check(!store.findListing(1)->isActive(), "item now unavailable");
    check(wait.handOff(&store, 1) == 0, "no second hand off");

    cout << "-- requests --\n";
    int id = req.send(&store, 1, 2, ITEM_REQ, 3, 0, "");
    check(id > 0, "send");
    check(req.send(&store, 1, 2, ITEM_REQ, 3, 0, "") == 0, "no duplicate pending");
    int other = req.send(&store, 5, 2, ITEM_REQ, 3, 0, "");
    check(req.pendingFor(&store, 2) == 2, "pending count");
    check(req.accept(&store, id, 1) == 0, "only receiver accepts");
    check(req.accept(&store, id, 2) == 1, "accept");
    check(store.findRequest(other)->getStatus() == DECLINED, "others told item is gone");
    check(!req.decline(&store, id, 2), "cannot decline accepted");

    cout << "-- save and load --\n";
    check(files.save(&store, &wait, "test_save.txt"), "save");
    Store loaded;
    Waitlist loadedWait;
    check(files.load(&loaded, &loadedWait, "test_save.txt") == 0, "load");
    check(loaded.studentCount() == 5 && loaded.listingCount() == 10, "counts");
    check(loadedWait.waiting(1).size() == 1 && loadedWait.waiting(1)[0] == 2, "queue order kept");
    check(!loaded.findListing(1)->isActive(), "status kept");
    check(loaded.findRequest(id)->getStatus() == ACCEPTED, "request kept");
    check(loaded.addStudent(0, "New", "n@geu.ac.in", "CSE", 1, splitList("a"), splitList("b")) == 6,
          "ids continue after load");
    check(files.load(&loaded, &loadedWait, "missing.txt") == 1, "missing file");
    {
        ofstream bad("test_bad.txt");
        bad << "S|1|x\n";
    }
    check(files.load(&loaded, &loadedWait, "test_bad.txt") == 2, "damaged file");
    check(loaded.studentCount() == 6, "damaged file changes nothing");
    remove("test_save.txt");
    remove("test_bad.txt");

    cout << "\n" << (failed ? "SOME TESTS FAILED" : "ALL TESTS PASSED") << " (" << failed << " failed)\n";
    return failed != 0;
}
