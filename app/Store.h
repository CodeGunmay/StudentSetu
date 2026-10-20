#ifndef STORE_H
#define STORE_H

#include <vector>
#include "Student.h"
#include "Listing.h"
#include "Request.h"
using namespace std;

// all app data lives here, and every change goes through these functions
class Store {
    vector<Student> students;
    vector<Listing *> listings;
    vector<Request> requests;
    int nextStudent, nextListing, nextRequest;

public:
    Store() {
        nextStudent = 1;
        nextListing = 1;
        nextRequest = 1;
    }

    ~Store() { clear(); }

    void clear() {
        for (int i = 0; i < (int)listings.size(); i++)
            delete listings[i];
        listings.clear();
        students.clear();
        requests.clear();
        nextStudent = 1;
        nextListing = 1;
        nextRequest = 1;
    }

    int studentCount() { return students.size(); }
    int listingCount() { return listings.size(); }
    int requestCount() { return requests.size(); }
    Student *studentAt(int i) { return &students[i]; }
    Listing *listingAt(int i) { return listings[i]; }
    Request *requestAt(int i) { return &requests[i]; }

    Student *findStudent(int id) {
        for (int i = 0; i < (int)students.size(); i++)
            if (students[i].getId() == id)
                return &students[i];
        return NULL;
    }

    Student *findByEmail(string email) {
        for (int i = 0; i < (int)students.size(); i++)
            if (cleanText(students[i].getEmail()) == cleanText(email))
                return &students[i];
        return NULL;
    }

    Listing *findListing(int id) {
        for (int i = 0; i < (int)listings.size(); i++)
            if (listings[i]->getId() == id)
                return listings[i];
        return NULL;
    }

    Request *findRequest(int id) {
        for (int i = 0; i < (int)requests.size(); i++)
            if (requests[i].getId() == id)
                return &requests[i];
        return NULL;
    }

    string nameOf(int id) {
        Student *s = findStudent(id);
        if (s == NULL)
            return "Unknown";
        return s->getName();
    }

    // id = 0 means give the next free id; a loaded file passes its own id
    int addStudent(int id, string name, string email, string branch, unsigned long pass,
                   vector<string> have, vector<string> want) {
        if (id == 0)
            id = nextStudent;
        Student s(id, name, email, branch, pass);
        s.setHave(have);
        s.setWant(want);
        students.push_back(s);
        if (id >= nextStudent)
            nextStudent = id + 1;
        return id;
    }

    int addItem(int id, int owner, string title, string category, int mode, int price,
                string wantBack) {
        if (id == 0)
            id = nextListing;
        listings.push_back(new ItemListing(id, owner, title, category, mode, price, wantBack));
        if (id >= nextListing)
            nextListing = id + 1;
        return id;
    }

    int addTeach(int id, int owner, string title, string subject, int price) {
        if (id == 0)
            id = nextListing;
        listings.push_back(new TeachListing(id, owner, title, subject, price));
        if (id >= nextListing)
            nextListing = id + 1;
        return id;
    }

    int addRequest(int id, int from, int to, int kind, int listing, int offer, string note,
                   int status) {
        if (id == 0)
            id = nextRequest;
        Request r(id, from, to, kind, listing, offer, note);
        r.setStatus(status);
        requests.push_back(r);
        if (id >= nextRequest)
            nextRequest = id + 1;
        return id;
    }
};

#endif
