#include "FileManager.h"
#include <fstream>
#include <sstream>
#include <iomanip>
#include <limits>
#include <set>
#include <algorithm>

// Quoted fields preserve spaces in names, titles and skill descriptions.
bool FileManager::save(const std::string& path, const Data& data,
                       const Waitlist& wait, std::string& error) const {
    error.clear();
    std::ofstream out(path);
    if (!out) { error = "Cannot open save file"; return false; }
    out << "STUDENTSETU 1\n";
    for (const auto& s : data.students)
        out << "S " << s.getId() << ' ' << std::quoted(s.getName()) << '\n';
    for (const auto& row : data.listings) {
        out << "L " << row->type() << ' ' << row->getId() << ' ' << row->getOwner()
            << ' ' << row->isActive() << ' ' << std::quoted(row->getTitle())
            << ' ' << std::quoted(row->getCategory());
        if (auto skill = std::dynamic_pointer_cast<SkillListing>(row))
            out << ' ' << std::quoted(skill->getOffer()) << ' ' << std::quoted(skill->getNeed());
        if (auto paid = std::dynamic_pointer_cast<PaidServiceListing>(row))
            out << ' ' << std::setprecision(17) << paid->getPrice();
        out << '\n';
    }
    for (const auto& pair : wait.records())
        for (int student : pair.second) out << "Q " << pair.first << ' ' << student << '\n';
    out.close();
    if (!out) { error = "Save failed while writing"; return false; }
    return true;
}

// Parse into temporary records so a bad file cannot erase the current session.
bool FileManager::load(const std::string& path, Data& data,
                       Waitlist& wait, std::string& error) const {
    error.clear();
    std::ifstream in(path);
    if (!in) { error = "Save file not found"; return false; }
    std::string line;
    if (!std::getline(in, line) || line != "STUDENTSETU 1") {
        error = "Unsupported or empty save file"; return false;
    }
    Data temp;
    Waitlist newWait;
    std::set<int> students, listings;
    std::vector<std::pair<int, int>> requests;
    int lineNo = 1;
    try {
        while (std::getline(in, line)) {
            ++lineNo;
            if (line.empty()) continue;
            std::istringstream row(line);
            char kind;
            row >> kind;
            if (kind == 'S') {
                int id; std::string name;
                if (!(row >> id >> std::quoted(name)) || id == std::numeric_limits<int>::max() ||
                    !students.insert(id).second) throw std::runtime_error("Invalid student");
                temp.students.emplace_back(id, name);
                temp.nextStudent = std::max(temp.nextStudent, id + 1);
            } else if (kind == 'L') {
                int id, owner, active; std::string type, title, category;
                if (!(row >> type >> id >> owner >> active >> std::quoted(title) >> std::quoted(category)) ||
                    (active != 0 && active != 1) || id == std::numeric_limits<int>::max() ||
                    !listings.insert(id).second) throw std::runtime_error("Invalid listing");
                std::shared_ptr<Listing> item;
                if (type == "skill") {
                    std::string offer, need;
                    if (!(row >> std::quoted(offer) >> std::quoted(need)) || category != "skill")
                        throw std::runtime_error("Invalid skill");
                    item = std::make_shared<SkillListing>(id, owner, title, offer, need);
                } else if (type == "item") {
                    item = std::make_shared<ItemListing>(id, owner, title, category);
                } else if (type == "paid") {
                    double price;
                    if (!(row >> price)) throw std::runtime_error("Invalid price");
                    item = std::make_shared<PaidServiceListing>(id, owner, title, category, price);
                } else throw std::runtime_error("Unknown listing type");
                item->setActive(active == 1);
                temp.listings.push_back(item);
                temp.nextListing = std::max(temp.nextListing, id + 1);
            } else if (kind == 'Q') {
                int item, student;
                if (!(row >> item >> student)) throw std::runtime_error("Invalid queue record");
                requests.push_back({item, student});
            } else throw std::runtime_error("Unknown record");
            row >> std::ws;
            if (!row.eof()) throw std::runtime_error("Unexpected extra data");
        }
        if (in.bad()) throw std::runtime_error("Read failed");
        for (const auto& row : temp.listings)
            if (!temp.student(row->getOwner())) throw std::runtime_error("Listing owner missing");
        MatchingEngine().buildGraph(temp.skills());
        for (const auto& request : requests)
            if (!newWait.join(request.first, request.second, temp))
                throw std::runtime_error("Invalid or duplicate queue request");
    } catch (const std::exception& e) {
        error = "Load failed near line " + std::to_string(lineNo) + ": " + e.what();
        return false;
    }
    data = std::move(temp);
    wait = std::move(newWait);
    return true;
}
