#include "algorithms.h"
#include <stdlib.h>

static size_t text_length(const char *text) {
    size_t length = 0;
    while (text[length]) ++length;
    return length;
}

static int text_equal(const char *left, const char *right) {
    size_t i = 0;
    while (left[i] && left[i] == right[i]) ++i;
    return left[i] == right[i];
}

size_t ss_build_edges(const SS_Skill *skills, size_t count,
                      SS_Edge *edges, size_t capacity) {
    size_t from, to, total = 0;
    if (count && !skills) return 0;
    for (from = 0; from < count; ++from) {
        for (to = 0; to < count; ++to) {
            if (from == to || !skills[from].need || !skills[to].offer ||
                !text_equal(skills[from].need, skills[to].offer)) continue;
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
    size_t i, j;
    if (!text || !query || !*query) return 0;
    for (i = 0; text[i]; ++i) {
        for (j = 0; query[j] && text[i + j] && text[i + j] == query[j]; ++j) {}
        if (!query[j]) return 1;
    }
    return 0;
}

double ss_similarity(const char *text, const char *query) {
    size_t n, m, i, j, diagonal, above, cost, *row;
    double result;
    if (!text || !query || !*text || !*query) return 0.0;
    n = text_length(text); m = text_length(query);
    if (m > ((size_t)-1) / sizeof(*row) - 1) return 0.0;
    row = (size_t *)malloc((m + 1) * sizeof(*row));
    if (!row) return 0.0;
    for (j = 0; j <= m; ++j) row[j] = j;
    for (i = 1; i <= n; ++i) {
        diagonal = row[0]; row[0] = i;
        for (j = 1; j <= m; ++j) {
            above = row[j];
            cost = diagonal + (text[i - 1] != query[j - 1]);
            if (above + 1 < cost) cost = above + 1;
            if (row[j - 1] + 1 < cost) cost = row[j - 1] + 1;
            row[j] = cost;
            diagonal = above;
        }
    }
    result = 1.0 - (double)row[m] / (double)(n > m ? n : m);
    free(row);
    return result;
}

int ss_search_matches(const char *text, const char *query) {
    return ss_contains(text, query) || ss_similarity(text, query) >= 0.5;
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
