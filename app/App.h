#ifndef APP_H
#define APP_H

#include <iostream>
#include <cstdio>
#include "Input.h"
#include "Store.h"
#include "../matching/Matcher.h"
#include "../services/SkillIndex.h"
#include "../services/ItemSearch.h"
#include "../services/Waitlist.h"
#include "../services/Requests.h"
#include "../services/FileManager.h"
using namespace std;

class App {
    Store store;
    Waitlist wait;
    FileManager files;
    SkillIndex index;
    ItemSearch search;
    Matcher match;
    Requests req;
    int me;
    string file;

    void save() {
        if (!files.save(&store, &wait, file))
            cout << "Warning: could not save data.\n";
    }

    void title(string name) {
        cout << "\n========== " << name << " ==========\n";
    }

    // ---------- start: register, login, demo ----------

    void registerUser() {
        title("Register");
        string name = readNonEmpty("Name: ");
        string email = readNonEmpty("College email: ");
        string end = "@geu.ac.in";
        while (email.size() <= end.size() ||
               cleanText(email.substr(email.size() - end.size())) != end ||
               store.findByEmail(email) != NULL) {
            if (store.findByEmail(email) != NULL)
                cout << "This email is already registered.\n";
            else
                cout << "Use your college email (ends with @geu.ac.in).\n";
            email = readNonEmpty("College email: ");
        }
        string branch = readNonEmpty("Branch: ");
        string pass = readNonEmpty("Password (at least 4 characters): ");
        while (pass.size() < 4)
            pass = readNonEmpty("Too short. Password: ");

        vector<string> have = splitList(readLine("Skills you can teach (comma separated): "));
        while (have.size() == 0)
            have = splitList(readLine("Add at least one skill: "));
        vector<string> want = splitList(readLine("Skills you want to learn (comma separated): "));

        me = store.addStudent(0, name, email, branch, passwordHash(pass.c_str()), have, want);
        save();
        cout << "Account created. Welcome, " << name << "!\n";
    }

    void login() {
        title("Login");
        string email = readNonEmpty("College email: ");
        string pass = readNonEmpty("Password: ");
        Student *s = store.findByEmail(email);
        if (s == NULL || s->getPass() != passwordHash(pass.c_str())) {
            cout << "Wrong email or password.\n";
            return;
        }
        me = s->getId();
        cout << "Welcome back, " << s->getName() << "!\n";
    }

    void loadDemo() {
        string ok = readLine("This replaces all saved data with demo data. Type yes: ");
        if (ok != "yes")
            return;
        files.loadDemo(&store, &wait);
        save();
        cout << "Demo loaded. Log in with any of these (password 1234):\n";
        for (int i = 0; i < store.studentCount(); i++)
            cout << "  " << store.studentAt(i)->getEmail() << "\n";
    }

    // ---------- items ----------

    void listItem() {
        title("List an item");
        string name = readNonEmpty("Item name: ");
        string cat = readNonEmpty("Category (books, notes, calculator...): ");
        cout << "1 Free\n2 Barter (swap for something)\n3 Sell\n";
        int mode = readChoice("How do you want to give it? ", 1, 3);
        int price = 0;
        string back = "";
        if (mode == BARTER)
            back = readNonEmpty("What do you want in return? ");
        if (mode == SELL)
            price = readChoice("Price in Rs: ", 1, 100000);
        int id = store.addItem(0, me, name, cat, mode, price, back);
        save();
        cout << "Item listed with ID " << id << ".\n";
    }

    void showItems(vector<int> ids) {
        for (int i = 0; i < (int)ids.size(); i++) {
            Listing *l = store.findListing(ids[i]);
            cout << l->info() << " | by " << store.nameOf(l->getOwner()) << "\n";
        }
    }

    void requestItem(vector<int> ids) {
        int id = readInt("Enter item ID to request (0 to go back): ");
        if (id == 0)
            return;
        bool listed = false;
        for (int i = 0; i < (int)ids.size(); i++)
            if (ids[i] == id)
                listed = true;
        if (!listed) {
            cout << "That ID is not in the list.\n";
            return;
        }
        Listing *l = store.findListing(id);
        if (l->getOwner() == me) {
            cout << "This is your own item.\n";
            return;
        }
        ItemListing *item = (ItemListing *)l;

        if (item->getMode() == FREE) {
            int place = wait.join(&store, id, me);
            if (place == -1)
                cout << "You are already in the waitlist.\n";
            else if (place == 0)
                cout << "This item cannot be requested.\n";
            else
                cout << "You are number " << place << " in the waitlist.\n";
            save();
            return;
        }

        int offer = 0;
        if (item->getMode() == BARTER) {
            cout << "Owner wants: " << item->getWantBack() << "\nYour available items:\n";
            vector<int> mine;
            for (int i = 0; i < store.listingCount(); i++) {
                Listing *x = store.listingAt(i);
                if (x->getType() == ITEM && x->getOwner() == me && x->isActive()) {
                    mine.push_back(x->getId());
                    cout << x->info() << "\n";
                }
            }
            if (mine.size() == 0) {
                cout << "List an item first so you have something to offer.\n";
                return;
            }
            offer = readInt("ID of the item you offer: ");
            bool ok = false;
            for (int i = 0; i < (int)mine.size(); i++)
                if (mine[i] == offer)
                    ok = true;
            if (!ok) {
                cout << "That is not one of your available items.\n";
                return;
            }
        }

        if (req.send(&store, me, l->getOwner(), ITEM_REQ, id, offer, "") == 0)
            cout << "You already sent this request.\n";
        else
            cout << "Request sent to " << store.nameOf(l->getOwner()) << ".\n";
        save();
    }

    void searchItems() {
        title("Search items");
        string q = readNonEmpty("What are you looking for? ");
        cout << "0 All  1 Free  2 Barter  3 Sell\n";
        int mode = readChoice("Show: ", 0, 3);
        cout << "0 Newest  1 Price low to high  2 Price high to low\n";
        int order = readChoice("Sort: ", 0, 2);
        vector<int> ids = search.search(&store, q, mode, order, me);
        if (ids.size() == 0) {
            cout << "No items found.\n";
            return;
        }
        showItems(ids);
        requestItem(ids);
    }

    void browseItems() {
        title("Browse by category");
        search.build(&store);
        vector<string> cats = search.categories();
        if (cats.size() == 0) {
            cout << "No items yet.\n";
            return;
        }
        for (int i = 0; i < (int)cats.size(); i++)
            cout << i + 1 << " " << cats[i] << "\n";
        int c = readChoice("Category (0 to go back): ", 0, cats.size());
        if (c == 0)
            return;
        vector<int> all = search.browse(&store, cats[c - 1]);
        vector<int> ids;
        for (int i = 0; i < (int)all.size(); i++)
            if (store.findListing(all[i])->getOwner() != me)
                ids.push_back(all[i]);
        if (ids.size() == 0) {
            cout << "Nothing available from others here.\n";
            return;
        }
        showItems(ids);
        requestItem(ids);
    }

    void myItems() {
        title("My items");
        bool any = false;
        for (int i = 0; i < store.listingCount(); i++) {
            Listing *l = store.listingAt(i);
            if (l->getType() != ITEM || l->getOwner() != me)
                continue;
            any = true;
            cout << l->info();
            if (((ItemListing *)l)->getMode() == FREE && l->isActive())
                cout << " | waiting: " << wait.waiting(l->getId()).size();
            cout << "\n";
        }
        if (!any) {
            cout << "You have not listed any items.\n";
            return;
        }
        cout << "1 Give a free item to the next person in line\n"
             << "2 Make an item available again\n"
             << "3 Remove an item\n0 Back\n";
        int c = readChoice("Choice: ", 0, 3);
        if (c == 0)
            return;
        int id = readInt("Item ID: ");
        Listing *l = store.findListing(id);
        if (l == NULL || l->getType() != ITEM || l->getOwner() != me) {
            cout << "Not one of your items.\n";
            return;
        }
        if (c == 1) {
            int who = wait.handOff(&store, id);
            if (who == 0)
                cout << "Nobody is waiting, or the item is not available.\n";
            else
                cout << "Given to " << store.nameOf(who) << ". Contact: "
                     << store.findStudent(who)->getEmail() << "\n";
        } else if (c == 2) {
            l->setActive(true);
            cout << "Item is available again.\n";
        } else {
            l->setActive(false);
            cout << "Item removed from search.\n";
        }
        save();
    }

    void itemsMenu() {
        while (true) {
            title("Items");
            cout << "1 List an item\n2 Search items\n3 Browse by category\n4 My items\n0 Back\n";
            int c = readChoice("Choice: ", 0, 4);
            if (c == 0)
                return;
            if (c == 1) listItem();
            if (c == 2) searchItems();
            if (c == 3) browseItems();
            if (c == 4) myItems();
        }
    }

    // ---------- skills ----------

    void barter() {
        title("Barter");
        string q = readNonEmpty("What do you want to learn? ");
        index.build(&store);
        vector<int> found = index.find(q);
        vector<int> haveIt;
        for (int i = 0; i < (int)found.size(); i++)
            if (found[i] != me)
                haveIt.push_back(found[i]);
        if (haveIt.size() == 0) {
            cout << "Nobody has added " << q << " to their skills yet.\n";
            return;
        }

        vector<SortItem> swaps = match.barter(&store, me, haveIt);
        if (swaps.size() > 0) {
            cout << "Two-way swaps (best first):\n";
            for (int i = 0; i < (int)swaps.size(); i++) {
                int id = swaps[i].id;
                cout << "[" << id << "] " << store.nameOf(id) << " | teaches "
                     << match.teaches(&store, id, q) << " | wants from you: "
                     << joinList(match.theyWant(&store, me, id)) << "\n";
            }
            int to = readInt("Enter student ID to send a swap request (0 to go back): ");
            bool ok = false;
            for (int i = 0; i < (int)swaps.size(); i++)
                if (swaps[i].id == to)
                    ok = true;
            if (to == 0)
                return;
            if (!ok)
                cout << "That ID is not in the list.\n";
            else if (req.send(&store, me, to, SWAP_REQ, 0, 0, "wants to learn " + q) == 0)
                cout << "You already sent this request.\n";
            else
                cout << "Swap request sent to " << store.nameOf(to) << ".\n";
            save();
            return;
        }

        vector<int> ring = match.circle(&store, me, q, haveIt);
        if (ring.size() > 0) {
            cout << "No direct swap, but we found an exchange circle:\n";
            for (int i = 0; i < (int)ring.size(); i++) {
                int a = ring[i], b = ring[(i + 1) % ring.size()];
                cout << "  " << store.nameOf(a) << " learns "
                     << match.learns(&store, a, b, me, q) << " from " << store.nameOf(b) << "\n";
            }
            int c = readChoice("Send a request to everyone in the circle? 1 Yes  0 No: ", 0, 1);
            if (c == 1) {
                string names = "";
                for (int i = 0; i < (int)ring.size(); i++)
                    names += (i > 0 ? ", " : "") + store.nameOf(ring[i]);
                for (int i = 1; i < (int)ring.size(); i++)
                    req.send(&store, me, ring[i], SWAP_REQ, 0, 0, "exchange circle: " + names);
                save();
                cout << "Requests sent. The circle works once everyone accepts.\n";
            }
            return;
        }

        cout << "No swap found yet. These students teach " << q
             << " but want nothing you can teach:\n";
        for (int i = 0; i < (int)haveIt.size(); i++)
            cout << "  " << store.nameOf(haveIt[i]) << "\n";
        cout << "Try Skills > Paid, or add more skills to your profile.\n";
    }

    void teach() {
        title("Teach (paid)");
        string subject = readNonEmpty("Subject you will teach: ");
        string about = readNonEmpty("Short description: ");
        int price = readChoice("Price per hour in Rs: ", 1, 100000);
        int id = store.addTeach(0, me, about, subject, price);
        save();
        cout << "You are listed as a teacher (ID " << id << ").\n";
    }

    void learn() {
        title("Learn (paid)");
        string subject = readNonEmpty("What do you want to learn? ");
        int low = readChoice("Lowest price in Rs (0 for any): ", 0, 100000);
        int high = readChoice("Highest price in Rs (0 for no limit): ", 0, 100000);
        int order = readChoice("1 Price low to high  2 High to low: ", 1, 2);
        vector<int> ids = match.teachers(&store, me, subject, low, high, order == 1);
        if (ids.size() == 0) {
            cout << "No teachers found in this range.\n";
            return;
        }
        for (int i = 0; i < (int)ids.size(); i++) {
            Listing *l = store.findListing(ids[i]);
            cout << l->info() << " | " << store.nameOf(l->getOwner()) << "\n";
        }
        int id = readInt("Enter listing ID to send a request (0 to go back): ");
        if (id == 0)
            return;
        bool ok = false;
        for (int i = 0; i < (int)ids.size(); i++)
            if (ids[i] == id)
                ok = true;
        if (!ok) {
            cout << "That ID is not in the list.\n";
            return;
        }
        Listing *l = store.findListing(id);
        if (req.send(&store, me, l->getOwner(), PAID_REQ, id, 0, "wants to learn " + l->getTag()) == 0)
            cout << "You already sent this request.\n";
        else
            cout << "Request sent to " << store.nameOf(l->getOwner()) << ".\n";
        save();
    }

    void myTeaching() {
        title("My teaching");
        bool any = false;
        for (int i = 0; i < store.listingCount(); i++) {
            Listing *l = store.listingAt(i);
            if (l->getType() == TEACH && l->getOwner() == me) {
                cout << l->info() << "\n";
                any = true;
            }
        }
        if (!any) {
            cout << "You are not teaching anything yet.\n";
            return;
        }
        int id = readInt("Enter ID to pause or resume (0 to go back): ");
        Listing *l = store.findListing(id);
        if (id == 0)
            return;
        if (l == NULL || l->getType() != TEACH || l->getOwner() != me) {
            cout << "Not one of your listings.\n";
            return;
        }
        l->setActive(!l->isActive());
        save();
        cout << (l->isActive() ? "Resumed.\n" : "Paused.\n");
    }

    void paidMenu() {
        while (true) {
            title("Paid");
            cout << "1 Teach\n2 Learn\n3 My teaching\n0 Back\n";
            int c = readChoice("Choice: ", 0, 3);
            if (c == 0)
                return;
            if (c == 1) teach();
            if (c == 2) learn();
            if (c == 3) myTeaching();
        }
    }

    void skillsMenu() {
        while (true) {
            title("Skills");
            cout << "1 Barter (swap skills)\n2 Paid (teach or learn)\n0 Back\n";
            int c = readChoice("Choice: ", 0, 2);
            if (c == 0)
                return;
            if (c == 1) barter();
            if (c == 2) paidMenu();
        }
    }

    // ---------- my activity ----------

    string describe(Request *r) {
        Listing *l = store.findListing(r->getListing());
        if (r->getKind() == ITEM_REQ) {
            string s = "item: " + (l ? l->getTitle() : string("?"));
            Listing *o = store.findListing(r->getOffer());
            if (o != NULL)
                s += " (offers " + o->getTitle() + ")";
            return s;
        }
        if (r->getKind() == PAID_REQ)
            return "paid: " + r->getNote() + (l ? ", Rs " + to_string(l->getPrice()) + "/hr" : "");
        return "swap: " + r->getNote();
    }

    void activity() {
        while (true) {
            title("My Activity");
            cout << "Received:\n";
            int n = 0;
            for (int i = 0; i < store.requestCount(); i++) {
                Request *r = store.requestAt(i);
                if (r->getTo() != me)
                    continue;
                n++;
                cout << "  [" << r->getId() << "] " << store.nameOf(r->getFrom()) << " | "
                     << describe(r) << " | " << r->statusText();
                if (r->getStatus() == ACCEPTED)
                    cout << " | contact: " << store.findStudent(r->getFrom())->getEmail();
                cout << "\n";
            }
            if (n == 0)
                cout << "  nothing yet\n";

            cout << "Sent:\n";
            n = 0;
            for (int i = 0; i < store.requestCount(); i++) {
                Request *r = store.requestAt(i);
                if (r->getFrom() != me)
                    continue;
                n++;
                cout << "  [" << r->getId() << "] to " << store.nameOf(r->getTo()) << " | "
                     << describe(r) << " | " << r->statusText();
                if (r->getStatus() == ACCEPTED)
                    cout << " | contact: " << store.findStudent(r->getTo())->getEmail();
                cout << "\n";
            }
            if (n == 0)
                cout << "  nothing yet\n";

            cout << "1 Accept a request\n2 Decline a request\n0 Back\n";
            int c = readChoice("Choice: ", 0, 2);
            if (c == 0)
                return;
            int id = readInt("Request ID: ");
            if (c == 1) {
                int result = req.accept(&store, id, me);
                if (result == 1)
                    cout << "Accepted. You can now see each other's email.\n";
                else if (result == 2)
                    cout << "That item is no longer available, so the request was declined.\n";
                else
                    cout << "You can only accept pending requests sent to you.\n";
            } else {
                if (req.decline(&store, id, me))
                    cout << "Declined.\n";
                else
                    cout << "You can only decline pending requests sent to you.\n";
            }
            save();
        }
    }

    // ---------- profile ----------

    void profile() {
        while (true) {
            title("Profile");
            Student *s = store.findStudent(me);
            s->show();
            cout << "1 Edit skills I can teach\n2 Edit skills I want to learn\n0 Back\n";
            int c = readChoice("Choice: ", 0, 2);
            if (c == 0)
                return;
            vector<string> list = splitList(readLine("New list (comma separated): "));
            if (c == 1 && list.size() == 0) {
                cout << "Keep at least one skill.\n";
                continue;
            }
            if (c == 1)
                s->setHave(list);
            else
                s->setWant(list);
            save();
            cout << "Saved.\n";
        }
    }

    void home() {
        while (me != 0) {
            title("Home");
            cout << "Hi, " << store.nameOf(me) << "\n";
            cout << "1 Items\n2 Skills\n3 My Activity";
            int n = req.pendingFor(&store, me);
            if (n > 0)
                cout << " (" << n << " new)";
            cout << "\n4 Profile\n0 Logout\n";
            int c = readChoice("Choice: ", 0, 4);
            if (c == 0) me = 0;
            if (c == 1) itemsMenu();
            if (c == 2) skillsMenu();
            if (c == 3) activity();
            if (c == 4) profile();
        }
    }

public:
    App(string f) {
        me = 0;
        file = f;
        int result = files.load(&store, &wait, file);
        if (result == 2) {
            string backup = "damaged_" + file;
            rename(file.c_str(), backup.c_str());
            cout << "Saved data is damaged. It was kept as " << backup
                 << " and the app starts empty.\n";
        }
    }

    void run() {
        while (true) {
            title("StudentSetu");
            cout << "1 Register\n2 Login\n3 Load demo data\n0 Exit\n";
            int c = readChoice("Choice: ", 0, 3);
            if (c == 0)
                return;
            if (c == 1) registerUser();
            if (c == 2) login();
            if (c == 3) loadDemo();
            if (me != 0)
                home();
        }
    }
};

#endif
