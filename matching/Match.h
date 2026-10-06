#pragma once
#include <vector>

// Store a closed exchange: each student receives from the next student.
struct Match {
    std::vector<int> students;
    std::vector<int> listings;
    bool direct() const { return students.size() == 2; }
    bool found() const { return !students.empty(); }
};
