#include "Waitlist.h"
#include <algorithm>

bool Waitlist::join(int item, int student, const Data& data) {
    auto row = data.listing(item);
    if (!row || row->type() != "item" || !data.student(student) ||
        row->getOwner() == student) return false;
    auto& queue = queues[item];
    if (std::find(queue.begin(), queue.end(), student) != queue.end()) return false;
    queue.push_back(student);
    return true;
}

// Give an available item to the first valid requester and mark it unavailable.
int Waitlist::handOff(int item, Data& data) {
    auto row = data.listing(item);
    if (!row || row->type() != "item" || !row->isActive()) return 0;
    auto it = queues.find(item);
    if (it == queues.end()) return 0;
    auto& queue = it->second;
    while (!queue.empty()) {
        int student = queue.front();
        queue.pop_front();
        if (data.student(student) && student != row->getOwner()) {
            row->setActive(false);
            return student;
        }
    }
    return 0;
}

std::vector<int> Waitlist::show(int item) const {
    auto it = queues.find(item);
    if (it == queues.end()) return {};
    return {it->second.begin(), it->second.end()};
}
