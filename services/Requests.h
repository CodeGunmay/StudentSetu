#ifndef REQUESTS_H
#define REQUESTS_H

#include "../app/Store.h"

// rules for sending, accepting and declining requests
class Requests {
public:
    // returns the new request id, or 0 if the same request is already pending
    int send(Store *store, int from, int to, int kind, int listing, int offer, string note) {
        if (from == to || store->findStudent(to) == NULL)
            return 0;
        for (int i = 0; i < store->requestCount(); i++) {
            Request *r = store->requestAt(i);
            if (r->getStatus() == PENDING && r->getFrom() == from && r->getTo() == to &&
                r->getKind() == kind && r->getListing() == listing)
                return 0;
        }
        return store->addRequest(0, from, to, kind, listing, offer, note, PENDING);
    }

    int pendingFor(Store *store, int me) {
        int n = 0;
        for (int i = 0; i < store->requestCount(); i++) {
            Request *r = store->requestAt(i);
            if (r->getTo() == me && r->getStatus() == PENDING)
                n++;
        }
        return n;
    }

    // 1 = accepted, 2 = item no longer available (request declined), 0 = not allowed
    int accept(Store *store, int id, int me) {
        Request *r = store->findRequest(id);
        if (r == NULL || r->getTo() != me || r->getStatus() != PENDING)
            return 0;
        if (r->getKind() != ITEM_REQ) {
            r->setStatus(ACCEPTED);
            return 1;
        }

        Listing *item = store->findListing(r->getListing());
        Listing *offer = store->findListing(r->getOffer());
        if (item == NULL || !item->isActive() || (r->getOffer() != 0 && (offer == NULL || !offer->isActive()))) {
            r->setStatus(DECLINED);
            return 2;
        }

        r->setStatus(ACCEPTED);
        item->setActive(false);
        if (offer != NULL)
            offer->setActive(false);

        // other people asking for the same item are told it is gone
        for (int i = 0; i < store->requestCount(); i++) {
            Request *x = store->requestAt(i);
            if (x->getStatus() == PENDING && x->getKind() == ITEM_REQ &&
                (x->getListing() == item->getId() || (offer != NULL && x->getListing() == offer->getId())))
                x->setStatus(DECLINED);
        }
        return 1;
    }

    bool decline(Store *store, int id, int me) {
        Request *r = store->findRequest(id);
        if (r == NULL || r->getTo() != me || r->getStatus() != PENDING)
            return false;
        r->setStatus(DECLINED);
        return true;
    }
};

#endif
