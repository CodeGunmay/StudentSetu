#ifndef SKILLINDEX_H
#define SKILLINDEX_H

#include <vector>
#include <string>
#include "services.h"
#include "../app/Store.h"
using namespace std;

// hash table: skill name -> ids of students who can teach it
class SkillIndex {
    HashTable table;
    vector<string> keys;

    void addUnique(vector<int> *list, int id) {
        for (int i = 0; i < (int)list->size(); i++)
            if ((*list)[i] == id)
                return;
        list->push_back(id);
    }

public:
    SkillIndex() { hashInit(&table); }
    ~SkillIndex() { hashFree(&table); }

    void build(Store *store) {
        hashFree(&table);
        keys.clear();
        for (int i = 0; i < store->studentCount(); i++) {
            Student *s = store->studentAt(i);
            vector<string> have = s->getHave();
            for (int j = 0; j < (int)have.size(); j++) {
                string key = cleanText(have[j]);
                hashAdd(&table, key.c_str(), s->getId());
                bool found = false;
                for (int k = 0; k < (int)keys.size(); k++)
                    if (keys[k] == key)
                        found = true;
                if (!found)
                    keys.push_back(key);
            }
        }
    }

    // exact name from the hash table first; if nothing, try similar skill names
    vector<int> find(string query) {
        vector<int> result;
        int ids[200];
        int n = hashGet(&table, query.c_str(), ids, 200);
        for (int i = 0; i < n; i++)
            result.push_back(ids[i]);
        if (n > 0)
            return result;

        for (int k = 0; k < (int)keys.size(); k++) {
            if (fuzzyMatch(keys[k].c_str(), query.c_str())) {
                n = hashGet(&table, keys[k].c_str(), ids, 200);
                for (int i = 0; i < n; i++)
                    addUnique(&result, ids[i]);
            }
        }
        return result;
    }
};

#endif
