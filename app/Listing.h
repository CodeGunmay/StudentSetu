#ifndef LISTING_H
#define LISTING_H

#include <string>
#include "../matching/matching.h"
using namespace std;

const int ITEM = 1;
const int TEACH = 2;

const int FREE = 1;
const int BARTER = 2;
const int SELL = 3;

class Listing {
protected:
    int id, owner, price;
    string title;
    bool active;

public:
    Listing(int i, int o, string t, int p) {
        id = i;
        owner = o;
        title = t;
        price = p;
        active = true;
    }

    virtual ~Listing() {}

    int getId() { return id; }
    int getOwner() { return owner; }
    int getPrice() { return price; }
    string getTitle() { return title; }
    bool isActive() { return active; }
    void setActive(bool a) { active = a; }

    virtual int getType() = 0;
    virtual string getTag() = 0;
    virtual string info() = 0;

    bool matches(string query) {
        return fuzzyMatch(title.c_str(), query.c_str()) ||
               fuzzyMatch(getTag().c_str(), query.c_str());
    }
};

class ItemListing : public Listing {
    string category, wantBack;
    int mode;

public:
    ItemListing(int i, int o, string t, string c, int m, int p, string w)
        : Listing(i, o, t, p) {
        category = c;
        mode = m;
        wantBack = w;
        if (mode != SELL)
            price = 0;
    }

    int getType() { return ITEM; }
    string getTag() { return category; }
    int getMode() { return mode; }
    string getWantBack() { return wantBack; }

    string info() {
        string s = "[" + to_string(id) + "] " + title + " | " + category + " | ";
        if (mode == FREE)
            s += "Free";
        else if (mode == BARTER)
            s += "Barter, wants: " + wantBack;
        else
            s += "Sell, Rs " + to_string(price);
        if (!active)
            s += " | not available";
        return s;
    }
};

class TeachListing : public Listing {
    string subject;

public:
    TeachListing(int i, int o, string t, string s, int p) : Listing(i, o, t, p) {
        subject = s;
    }

    int getType() { return TEACH; }
    string getTag() { return subject; }

    string info() {
        string s = "[" + to_string(id) + "] " + subject + " | " + title +
                   " | Rs " + to_string(price) + " per hour";
        if (!active)
            s += " | paused";
        return s;
    }
};

#endif
