#ifndef MATCHER_H
#define MATCHER_H

#include <vector>
#include <string>
#include "matching.h"
#include "../app/Store.h"
using namespace std;

class Matcher {
public:
    // skills of mine that the other student wants
    vector<string> theyWant(Store *store, int me, int other) {
        vector<string> list;
        Student *a = store->findStudent(me);
        Student *b = store->findStudent(other);
        if (a == NULL || b == NULL)
            return list;
        vector<string> have = a->getHave();
        for (int i = 0; i < (int)have.size(); i++)
            if (b->wantLike(have[i]) != "")
                list.push_back(have[i]);
        return list;
    }

    string teaches(Store *store, int id, string query) {
        Student *s = store->findStudent(id);
        if (s == NULL)
            return "";
        vector<string> have = s->getHave();
        for (int i = 0; i < (int)have.size(); i++)
            if (fuzzyMatch(have[i].c_str(), query.c_str()))
                return have[i];
        return "";
    }

    /* two-way swaps: people from the list who also want something I can teach.
       score = how many of my skills they want, best first */
    vector<SortItem> barter(Store *store, int me, vector<int> haveIt) {
        vector<SortItem> result;
        for (int i = 0; i < (int)haveIt.size(); i++) {
            if (haveIt[i] == me)
                continue;
            int score = theyWant(store, me, haveIt[i]).size();
            if (score > 0) {
                SortItem s;
                s.id = haveIt[i];
                s.value = score;
                result.push_back(s);
            }
        }
        if (result.size() > 0)
            mergeSort(&result[0], result.size(), 0);
        return result;
    }

    // what student a would learn from student b
    string learns(Store *store, int a, int b, int me, string query) {
        if (a == me)
            return teaches(store, b, query);
        Student *x = store->findStudent(a);
        Student *y = store->findStudent(b);
        vector<string> want = x->getWant();
        for (int i = 0; i < (int)want.size(); i++)
            if (y->skillLike(want[i]) != "")
                return y->skillLike(want[i]);
        return "";
    }

    /* edge a -> b when a can learn from b. my own edges only go to people who
       teach what I searched for. returns the circle of 3 or 4 people, or empty */
    vector<int> circle(Store *store, int me, string query, vector<int> haveIt) {
        Graph g;
        graphInit(&g);
        for (int i = 0; i < (int)haveIt.size(); i++)
            graphAddEdge(&g, me, haveIt[i]);

        for (int i = 0; i < store->studentCount(); i++) {
            Student *a = store->studentAt(i);
            if (a->getId() == me)
                continue;
            for (int j = 0; j < store->studentCount(); j++) {
                Student *b = store->studentAt(j);
                if (i != j && learns(store, a->getId(), b->getId(), me, query) != "")
                    graphAddEdge(&g, a->getId(), b->getId());
            }
        }

        int ids[MAX_NODES];
        int n = graphFindCircle(&g, me, 4, ids);
        graphFree(&g);

        vector<int> result;
        if (n >= 3)
            for (int i = 0; i < n; i++)
                result.push_back(ids[i]);
        return result;
    }

    // paid teachers for a subject inside a price range; maxPrice 0 means no limit
    vector<int> teachers(Store *store, int me, string subject, int minPrice, int maxPrice,
                         int lowFirst) {
        vector<SortItem> found;
        for (int i = 0; i < store->listingCount(); i++) {
            Listing *l = store->listingAt(i);
            if (l->getType() != TEACH || !l->isActive() || l->getOwner() == me)
                continue;
            if (!l->matches(subject))
                continue;
            if (l->getPrice() < minPrice || (maxPrice > 0 && l->getPrice() > maxPrice))
                continue;
            SortItem s;
            s.id = l->getId();
            s.value = l->getPrice();
            found.push_back(s);
        }
        if (found.size() > 0)
            mergeSort(&found[0], found.size(), lowFirst);

        vector<int> result;
        for (int i = 0; i < (int)found.size(); i++)
            result.push_back(found[i].id);
        return result;
    }
};

#endif
