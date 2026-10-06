#include "Graph.h"

void Graph::addStudent(int id) { edges[id]; }

void Graph::addEdge(int from, int to, int listing) {
    if (from == to) return;
    addStudent(from);
    addStudent(to);
    edges[from].push_back({to, listing});
}

const std::vector<Edge>& Graph::neighbours(int id) const {
    static const std::vector<Edge> empty;
    auto it = edges.find(id);
    return it == edges.end() ? empty : it->second;
}
