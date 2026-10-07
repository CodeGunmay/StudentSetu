#pragma once
#include <string>
#include <stdexcept>

// Keep a student's identity in one place.
class Student {
    int id;
    std::string name;
public:
    Student(int id, const std::string& name) : id(id), name(name) {
        if (id <= 0 || name.find_first_not_of(" \t\r\n") == std::string::npos)
            throw std::invalid_argument("Student needs a positive ID and a name");
    }
    int getId() const { return id; }
    const std::string& getName() const { return name; }
};
