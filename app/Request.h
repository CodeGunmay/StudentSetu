#ifndef REQUEST_H
#define REQUEST_H

#include <string>
using namespace std;

const int ITEM_REQ = 1;
const int SWAP_REQ = 2;
const int PAID_REQ = 3;

const int PENDING = 0;
const int ACCEPTED = 1;
const int DECLINED = 2;

class Request {
    int id, from, to, kind, listing, offer, status;
    string note;

public:
    Request(int i, int f, int t, int k, int l, int o, string n) {
        id = i;
        from = f;
        to = t;
        kind = k;
        listing = l;
        offer = o;
        note = n;
        status = PENDING;
    }

    int getId() { return id; }
    int getFrom() { return from; }
    int getTo() { return to; }
    int getKind() { return kind; }
    int getListing() { return listing; }
    int getOffer() { return offer; }
    int getStatus() { return status; }
    string getNote() { return note; }
    void setStatus(int s) { status = s; }

    string statusText() {
        if (status == PENDING)
            return "pending";
        if (status == ACCEPTED)
            return "accepted";
        return "declined";
    }
};

#endif
