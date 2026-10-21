#ifndef WAITLIST_H
#define WAITLIST_H

#include <vector>
#include "services.h"
#include "../app/Store.h"
using namespace std;

// one FIFO queue for each free item
class Waitlist {
    vector<int> items;
    vector<Queue> queues;

    int findItem(int item) {
        for (int i = 0; i < (int)items.size(); i++)
            if (items[i] == item)
                return i;
        return -1;
    }

public:
    ~Waitlist() { clear(); }

    void clear() {
        for (int i = 0; i < (int)queues.size(); i++)
            queueFree(&queues[i]);
        items.clear();
        queues.clear();
    }

    // returns place in line, -1 if already waiting, 0 if not allowed
    int join(Store *store, int item, int student) {
        Listing *l = store->findListing(item);
        if (l == NULL || l->getType() != ITEM || !l->isActive() || l->getOwner() == student)
            return 0;
        if (((ItemListing *)l)->getMode() != FREE || store->findStudent(student) == NULL)
            return 0;

        int i = findItem(item);
        if (i == -1) {
            Queue q;
            queueInit(&q);
            items.push_back(item);
            queues.push_back(q);
            i = items.size() - 1;
        }
        if (!enqueue(&queues[i], student))
            return -1;
        return queues[i].size;
    }

    // used when loading the file: put back the saved line exactly as it was
    void restore(int item, int student) {
        int i = findItem(item);
        if (i == -1) {
            Queue q;
            queueInit(&q);
            items.push_back(item);
            queues.push_back(q);
            i = items.size() - 1;
        }
        enqueue(&queues[i], student);
    }

    // give the item to the first student in line; returns their id, or 0
    int handOff(Store *store, int item) {
        Listing *l = store->findListing(item);
        int i = findItem(item);
        if (l == NULL || !l->isActive() || i == -1)
            return 0;
        while (queues[i].size > 0) {
            int student = dequeue(&queues[i]);
            if (store->findStudent(student) != NULL) {
                l->setActive(false);
                store->addRequest(0, student, l->getOwner(), ITEM_REQ, item, 0,
                                  "free item from waitlist", ACCEPTED);
                return student;
            }
        }
        return 0;
    }

    vector<int> waiting(int item) {
        vector<int> list;
        int i = findItem(item);
        if (i == -1)
            return list;
        int ids[200];
        int n = queueToArray(&queues[i], ids, 200);
        for (int k = 0; k < n; k++)
            list.push_back(ids[k]);
        return list;
    }

    int itemCount() { return items.size(); }
    int itemAt(int i) { return items[i]; }
};

#endif
