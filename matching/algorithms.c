#include "algorithms.h"
#include <stdlib.h>
#include <string.h>

size_t ss_build_edges(const SS_Skill *skills, size_t count,
                      SS_Edge *edges, size_t capacity) {
    size_t from, to, total = 0;
    if (count && !skills) return 0;
    for (from = 0; from < count; ++from) {
        for (to = 0; to < count; ++to) {
            if (from == to || !skills[from].need || !skills[to].offer ||
                strcmp(skills[from].need, skills[to].offer) != 0) continue;
            if (edges && total < capacity) {
                edges[total].from = from;
                edges[total].to = to;
                edges[total].listing = skills[to].listing;
            }
            ++total;
        }
    }
    return total;
}

int ss_contains(const char *text, const char *query) {
    return text && query && *query && strstr(text, query) != NULL;
}

static size_t dfs(size_t start, size_t current, const SS_Edge *edges,
                  size_t count, size_t limit, size_t depth,
                  unsigned char *visited, size_t *path, int *listings) {
    size_t i;
    for (i = 0; i < count; ++i) {
        const SS_Edge *edge = &edges[i];
        if (edge->from != current) continue;
        if (edge->to == start && depth >= 2) {
            listings[depth - 1] = edge->listing;
            return depth;
        }
        if (depth >= limit || visited[edge->to]) continue;
        listings[depth - 1] = edge->listing;
        path[depth] = edge->to;
        visited[edge->to] = 1;
        {
            size_t result = dfs(start, edge->to, edges, count, limit,
                                depth + 1, visited, path, listings);
            if (result) return result;
        }
        visited[edge->to] = 0;
    }
    return 0;
}

size_t ss_find_cycle(size_t start, size_t vertices, const SS_Edge *edges,
                     size_t count, size_t limit, size_t *path, int *listings) {
    size_t i, j, result;
    unsigned char *visited;
    if (start >= vertices || limit < 2 || !path || !listings ||
        (count && !edges)) return 0;
    for (i = 0; i < count; ++i)
        if (edges[i].from >= vertices || edges[i].to >= vertices) return 0;
    path[0] = start;
    for (i = 0; i < count; ++i) {
        if (edges[i].from != start || edges[i].to == start) continue;
        for (j = 0; j < count; ++j) {
            if (edges[j].from == edges[i].to && edges[j].to == start) {
                path[1] = edges[i].to;
                listings[0] = edges[i].listing;
                listings[1] = edges[j].listing;
                return 2;
            }
        }
    }
    visited = (unsigned char *)calloc(vertices, sizeof(*visited));
    if (!visited) return 0;
    visited[start] = 1;
    result = dfs(start, start, edges, count, limit, 1, visited, path, listings);
    free(visited);
    return result;
}
