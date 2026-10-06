#pragma once
#include "../app/Data.h"
#include <map>
#include <deque>

// Each item has its own FIFO queue; duplicate and owner requests are rejected.
class Waitlist {
    std::map<int, std::deque<int>> queues;
public:
    bool join(int item, int student, const Data& data);
    int handOff(int item, Data& data);
    std::vector<int> show(int item) const;
    const std::map<int, std::deque<int>>& records() const { return queues; }
};
