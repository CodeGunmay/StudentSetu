#pragma once
#include "Data.h"
#include "../services/ItemSearch.h"
#include "../services/Waitlist.h"
#include "../services/FileManager.h"

// The console owns one session and calls the matching and item modules.
class Application {
    Data data;
    ItemSearch search;
    Waitlist wait;
    FileManager files;
    void addStudent();
    void addListing(bool skill);
    void showMatch();
    void demo();
public:
    void run();
};
