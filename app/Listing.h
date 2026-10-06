#pragma once
#include <string>
#include <ostream>
#include <stdexcept>

// Store common listing fields; derived classes describe their own behaviour.
class Listing {
    int id, owner;
    std::string title, category;
    bool active = true;
public:
    Listing(int id, int owner, const std::string& title, const std::string& category)
        : id(id), owner(owner), title(title), category(category) {
        if (id <= 0 || owner <= 0 ||
            title.find_first_not_of(" \t\r\n") == std::string::npos ||
            category.find_first_not_of(" \t\r\n") == std::string::npos)
            throw std::invalid_argument("Invalid listing fields");
    }
    virtual ~Listing() = default;
    int getId() const { return id; }
    int getOwner() const { return owner; }
    const std::string& getTitle() const { return title; }
    const std::string& getCategory() const { return category; }
    bool isActive() const { return active; }
    void setActive(bool value) { active = value; }
    virtual std::string type() const = 0;
    virtual bool matches(const std::string& need) const = 0;
    virtual void show(std::ostream& out) const = 0;
};
