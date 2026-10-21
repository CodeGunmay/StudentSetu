#ifndef FILEMANAGER_H
#define FILEMANAGER_H

#include <fstream>
#include <string>
#include <vector>
#include "../app/Store.h"
#include "Waitlist.h"
using namespace std;

/* one line per record, fields split by '|'
   S|id|name|email|branch|password hash|skills have|skills want
   I|id|owner|active|title|price|category|mode|wants in return
   T|id|owner|active|title|price|subject
   R|id|from|to|kind|listing|offer|status|note
   Q|item|student      (queue lines are saved front to back) */
class FileManager {
    vector<string> split(string line) {
        vector<string> parts;
        string part = "";
        for (int i = 0; i < (int)line.size(); i++) {
            if (line[i] == '|') {
                parts.push_back(part);
                part = "";
            } else if (line[i] != '\r') {
                part += line[i];
            }
        }
        parts.push_back(part);
        return parts;
    }

    bool rightSize(vector<string> p) {
        if (p[0] == "S") return p.size() == 8;
        if (p[0] == "I") return p.size() == 9;
        if (p[0] == "T") return p.size() == 7;
        if (p[0] == "R") return p.size() == 9;
        if (p[0] == "Q") return p.size() == 3;
        return false;
    }

public:
    bool save(Store *store, Waitlist *wait, string file) {
        ofstream out(file);
        if (!out)
            return false;

        for (int i = 0; i < store->studentCount(); i++) {
            Student *s = store->studentAt(i);
            out << "S|" << s->getId() << "|" << s->getName() << "|" << s->getEmail() << "|"
                << s->getBranch() << "|" << s->getPass() << "|" << joinList(s->getHave())
                << "|" << joinList(s->getWant()) << "\n";
        }
        for (int i = 0; i < store->listingCount(); i++) {
            Listing *l = store->listingAt(i);
            if (l->getType() == ITEM) {
                ItemListing *item = (ItemListing *)l;
                out << "I|" << l->getId() << "|" << l->getOwner() << "|" << l->isActive() << "|"
                    << l->getTitle() << "|" << l->getPrice() << "|" << l->getTag() << "|"
                    << item->getMode() << "|" << item->getWantBack() << "\n";
            } else {
                out << "T|" << l->getId() << "|" << l->getOwner() << "|" << l->isActive() << "|"
                    << l->getTitle() << "|" << l->getPrice() << "|" << l->getTag() << "\n";
            }
        }
        for (int i = 0; i < store->requestCount(); i++) {
            Request *r = store->requestAt(i);
            out << "R|" << r->getId() << "|" << r->getFrom() << "|" << r->getTo() << "|"
                << r->getKind() << "|" << r->getListing() << "|" << r->getOffer() << "|"
                << r->getStatus() << "|" << r->getNote() << "\n";
        }
        for (int i = 0; i < wait->itemCount(); i++) {
            int item = wait->itemAt(i);
            vector<int> line = wait->waiting(item);
            for (int k = 0; k < (int)line.size(); k++)
                out << "Q|" << item << "|" << line[k] << "\n";
        }
        out.close();
        return !out.fail();
    }

    // 0 = loaded, 1 = no file yet, 2 = file is damaged (current data is kept)
    int load(Store *store, Waitlist *wait, string file) {
        ifstream in(file);
        if (!in)
            return 1;

        // read and check everything first, so a bad file changes nothing
        vector<vector<string> > rows;
        string line;
        try {
            while (getline(in, line)) {
                if (line == "" || line == "\r")
                    continue;
                vector<string> p = split(line);
                if (!rightSize(p))
                    return 2;
                for (int i = 1; i < (int)p.size(); i++) {
                    bool number = (p[0] == "S" && (i == 1 || i == 5)) ||
                                  ((p[0] == "I" || p[0] == "T") && (i <= 3 || i == 5 || i == 7)) ||
                                  (p[0] == "R" && i <= 7) || p[0] == "Q";
                    if (number)
                        stoul(p[i]);
                }
                rows.push_back(p);
            }
        } catch (...) {
            return 2;
        }

        store->clear();
        wait->clear();
        for (int i = 0; i < (int)rows.size(); i++) {
            vector<string> p = rows[i];
            if (p[0] == "S")
                store->addStudent(stoi(p[1]), p[2], p[3], p[4], stoul(p[5]),
                                  splitList(p[6]), splitList(p[7]));
            else if (p[0] == "I")
                store->addItem(stoi(p[1]), stoi(p[2]), p[4], p[6], stoi(p[7]), stoi(p[5]), p[8]);
            else if (p[0] == "T")
                store->addTeach(stoi(p[1]), stoi(p[2]), p[4], p[6], stoi(p[5]));
            else if (p[0] == "R")
                store->addRequest(stoi(p[1]), stoi(p[2]), stoi(p[3]), stoi(p[4]), stoi(p[5]),
                                  stoi(p[6]), p[8], stoi(p[7]));

            if (p[0] == "I" || p[0] == "T")
                store->findListing(stoi(p[1]))->setActive(p[3] == "1");
        }
        // queues last, after every item exists
        for (int i = 0; i < (int)rows.size(); i++)
            if (rows[i][0] == "Q")
                wait->restore(stoi(rows[i][1]), stoi(rows[i][2]));
        return 0;
    }

    void loadDemo(Store *store, Waitlist *wait) {
        store->clear();
        wait->clear();
        unsigned long pass = passwordHash("1234");

        store->addStudent(0, "Gunmay", "gunmay@geu.ac.in", "CSE", pass, splitList("C++, DBMS"), splitList("Python"));
        store->addStudent(0, "Ishwar", "ishwar@geu.ac.in", "CSE", pass, splitList("Python"), splitList("DSA"));
        store->addStudent(0, "Gaurav", "gaurav@geu.ac.in", "CSE", pass, splitList("DSA"), splitList("C++"));
        store->addStudent(0, "Asha", "asha@geu.ac.in", "ECE", pass, splitList("Maths, Physics"), splitList("DBMS"));
        store->addStudent(0, "Ravi", "ravi@geu.ac.in", "ME", pass, splitList("DBMS"), splitList("Maths"));

        store->addItem(0, 3, "Spare calculator", "Calculator", FREE, 0, "");
        store->addItem(0, 4, "DSA handwritten notes", "Notes", BARTER, 0, "Physics notes");
        store->addItem(0, 2, "Let Us C++ book", "Books", SELL, 250, "");
        store->addItem(0, 5, "Lab coat", "Lab equipment", SELL, 150, "");
        store->addItem(0, 5, "Drafter", "Lab equipment", FREE, 0, "");

        store->addTeach(0, 1, "C++ from basics", "C++", 200);
        store->addTeach(0, 4, "Maths for first year", "Maths", 150);
        store->addTeach(0, 5, "Maths quick revision", "Maths", 120);
        store->addTeach(0, 5, "DBMS and SQL", "DBMS", 100);
        store->addTeach(0, 2, "Python with projects", "Python", 180);
    }
};

#endif
