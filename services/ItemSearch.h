#ifndef ITEMSEARCH_H
#define ITEMSEARCH_H

#include <vector>
#include <string>
#include "services.h"
#include "../app/Store.h"
using namespace std;

// hash table: category -> item ids, plus 50% search on title and category
class ItemSearch {
    HashTable table;
    vector<string> cats;

public:
    ItemSearch() { hashInit(&table); }
    ~ItemSearch() { hashFree(&table); }

    void build(Store *store) {
        hashFree(&table);
        cats.clear();
        for (int i = 0; i < store->listingCount(); i++) {
            Listing *l = store->listingAt(i);
            if (l->getType() != ITEM)
                continue;
            string key = cleanText(l->getTag());
            hashAdd(&table, key.c_str(), l->getId());
            bool found = false;
            for (int k = 0; k < (int)cats.size(); k++)
                if (cats[k] == key)
                    found = true;
            if (!found)
                cats.push_back(key);
        }
    }

    vector<string> categories() { return cats; }

    vector<int> browse(Store *store, string category) {
        vector<int> result;
        int ids[200];
        int n = hashGet(&table, category.c_str(), ids, 200);
        for (int i = 0; i < n; i++) {
            Listing *l = store->findListing(ids[i]);
            if (l != NULL && l->isActive())
                result.push_back(ids[i]);
        }
        return result;
    }

    // mode 0 = all; order 1 = price low to high, 2 = high to low, 0 = newest first
    vector<int> search(Store *store, string query, int mode, int order, int me) {
        vector<SortItem> found;
        for (int i = 0; i < store->listingCount(); i++) {
            Listing *l = store->listingAt(i);
            if (l->getType() != ITEM || !l->isActive() || l->getOwner() == me)
                continue;
            ItemListing *item = (ItemListing *)l;
            if (mode != 0 && item->getMode() != mode)
                continue;
            if (!l->matches(query))
                continue;
            SortItem s;
            s.id = l->getId();
            s.value = order == 0 ? l->getId() : l->getPrice();
            found.push_back(s);
        }
        if (found.size() > 0)
            mergeSort(&found[0], found.size(), order == 1);

        vector<int> result;
        for (int i = 0; i < (int)found.size(); i++)
            result.push_back(found[i].id);
        return result;
    }
};

#endif
