#include <stdexcept>
#include "Application.h"
#include <iostream>
#include <sstream>

// Read entire lines so names with spaces and invalid numbers are handled safely.
static std::string readText(const std::string& prompt) {
    std::cout << prompt;
    std::string text;
    if (!std::getline(std::cin, text)) throw std::runtime_error("Input ended");
    return text;
}

static int readNumber(const std::string& prompt) {
    std::istringstream in(readText(prompt));
    int value;
    if (!(in >> value)) throw std::invalid_argument("Enter a whole number");
    in >> std::ws;
    if (!in.eof()) throw std::invalid_argument("Enter only one whole number");
    return value;
}

void Application::addStudent() {
    Student row(data.nextStudent, readText("Name: "));
    data.students.push_back(row);
    ++data.nextStudent;
    std::cout << "Student ID: " << row.getId() << '\n';
}

// Create either a swap listing or a one-way item listing for an existing student.
void Application::addListing(bool skill) {
    int owner = readNumber("Owner student ID: ");
    if (!data.student(owner)) throw std::invalid_argument("Student not found");
    if (skill) {
        for (const auto& row : data.skills())
            if (row.student == owner && row.active)
                throw std::invalid_argument("Only one active skill swap per student in Phase 2");
    }
    std::string title = readText("Title: ");
    std::shared_ptr<Listing> row;
    if (skill) {
        std::string offer = readText("Skill offered: ");
        std::string need = readText("Skill needed: ");
        row = std::make_shared<SkillListing>(data.nextListing, owner, title, offer, need);
    } else {
        std::string category = readText("Item category: ");
        row = std::make_shared<ItemListing>(data.nextListing, owner, title, category);
    }
    data.listings.push_back(row);
    ++data.nextListing;
    search.build(data);
    std::cout << "Listing ID: " << row->getId() << '\n';
}

// Display who receives each skill, instead of leaving arrow direction unclear.
void Application::showMatch() {
    int id = readNumber("Student ID: ");
    if (!data.student(id)) throw std::invalid_argument("Student not found");
    Match match = MatchingEngine().findMatch(id, data.skills());
    if (!match.found()) { std::cout << "No skill exchange found.\n"; return; }
    std::cout << (match.direct() ? "Direct exchange\n" : "Exchange cycle\n");
    for (std::size_t i = 0; i < match.students.size(); ++i) {
        int next = match.students[(i + 1) % match.students.size()];
        std::cout << data.student(match.students[i])->getName() << " receives from "
                  << data.student(next)->getName() << " using listing " << match.listings[i] << '\n';
    }
}

// Replace the current session only after the user explicitly chooses demo data.
void Application::demo() {
    if (readText("Replace current session with demo data? Type YES: ") != "YES") return;
    data = Data(); wait = Waitlist();
    const char* names[] = {"Gunmay", "Ishwar", "Gaurav", "Asha", "Ravi"};
    for (int i = 0; i < 5; ++i) data.students.emplace_back(i + 1, names[i]);
    data.listings = {
        std::make_shared<SkillListing>(1, 1, "C++ help", "C++", "Python"),
        std::make_shared<SkillListing>(2, 2, "Python help", "Python", "DSA"),
        std::make_shared<SkillListing>(3, 3, "DSA help", "DSA", "C++"),
        std::make_shared<SkillListing>(4, 4, "Math help", "Math", "Physics"),
        std::make_shared<SkillListing>(5, 5, "Physics help", "Physics", "Math"),
        std::make_shared<ItemListing>(6, 3, "Spare calculator", "calculator")
    };
    data.nextStudent = 6; data.nextListing = 7;
    search.build(data);
    std::cout << "Demo loaded: cycle IDs 1/2/3, direct pair 4/5, item 6.\n";
}

// Route menu actions to the correct teammate's module.
void Application::run() {
    while (std::cin) {
        std::cout << "\nStudentSetu\n1 Student  2 Skill swap  3 Item  4 List records\n"
                  << "5 Match  6 Item search  7 Join item queue  8 Show queue\n"
                  << "9 Hand off item  10 Mark item available  11 Save  12 Load\n"
                  << "13 Demo data  0 Exit\n";
        try {
            int choice = readNumber("Choice: ");
            if (choice == 0) return;
            if (choice == 1) addStudent();
            else if (choice == 2 || choice == 3) addListing(choice == 2);
            else if (choice == 4) {
                for (const auto& s : data.students)
                    std::cout << "Student " << s.getId() << " | " << s.getName() << '\n';
                for (const auto& row : data.listings) row->show(std::cout);
            } else if (choice == 5) showMatch();
            else if (choice == 6) {
                auto ids = search.find(readText("Category: "), data);
                if (ids.empty()) std::cout << "No available item in this category.\n";
                for (int id : ids) data.listing(id)->show(std::cout);
            } else if (choice == 7) {
                int item = readNumber("Item listing ID: ");
                int student = readNumber("Requester student ID: ");
                std::cout << (wait.join(item, student, data) ? "Added to queue.\n" : "Invalid or duplicate request.\n");
            } else if (choice == 8) {
                auto ids = wait.show(readNumber("Item listing ID: "));
                if (ids.empty()) std::cout << "Queue is empty.\n";
                for (int id : ids) std::cout << id << ' ';
                std::cout << '\n';
            } else if (choice == 9) {
                int id = wait.handOff(readNumber("Item listing ID: "), data);
                if (id) std::cout << "Item handed to student " << id << '\n';
                else std::cout << "No eligible request or item unavailable.\n";
            } else if (choice == 10) {
                auto row = data.listing(readNumber("Item listing ID: "));
                if (!row || row->type() != "item") throw std::invalid_argument("Item not found");
                row->setActive(true);
                std::cout << "Item is available again.\n";
            } else if (choice == 11 || choice == 12) {
                std::string error;
                bool ok = choice == 11 ? files.save("studentsetu.txt", data, wait, error)
                                       : files.load("studentsetu.txt", data, wait, error);
                if (ok) search.build(data);
                std::cout << (ok ? "Done.\n" : error + "\n");
            } else if (choice == 13) demo();
            else std::cout << "Choose a menu number.\n";
        } catch (const std::exception& e) {
            if (!std::cin) return;
            std::cout << "Error: " << e.what() << '\n';
        }
    }
}
