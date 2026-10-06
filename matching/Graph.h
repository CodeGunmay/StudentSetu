#pragma once
#include <map>
#include <vector>

struct Edge {
    int to;
    int listing;
};

// An edge A -> B means B can provide the skill that A needs.
class Graph {
    std::map<int, std::vector<Edge>> edges;
public:
    void addStudent(int id);
    void addEdge(int from, int to, int listing);
    const std::vector<Edge>& neighbours(int id) const;
};
