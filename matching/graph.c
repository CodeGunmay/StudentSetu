#include <stdlib.h>
#include "matching.h"

// edge a -> b means a wants a skill that b has, so a learns from b

void graphInit(Graph *g) {
    int i;
    g->count = 0;
    for (i = 0; i < MAX_NODES; i++)
        g->adj[i] = NULL;
}

static int findIndex(Graph *g, int id) {
    int i;
    for (i = 0; i < g->count; i++)
        if (g->ids[i] == id)
            return i;
    return -1;
}

int graphAddStudent(Graph *g, int id) {
    int i = findIndex(g, id);
    if (i != -1)
        return i;
    if (g->count == MAX_NODES)
        return -1;
    g->ids[g->count] = id;
    g->adj[g->count] = NULL;
    g->count++;
    return g->count - 1;
}

void graphAddEdge(Graph *g, int from, int to) {
    int a, b;
    Edge *e;
    if (from == to)
        return;
    a = graphAddStudent(g, from);
    b = graphAddStudent(g, to);
    if (a == -1 || b == -1)
        return;

    for (e = g->adj[a]; e != NULL; e = e->next)
        if (e->to == b)
            return;

    e = (Edge *)malloc(sizeof(Edge));
    if (e == NULL)
        return;
    e->to = b;
    e->next = g->adj[a];
    g->adj[a] = e;
}

static int hasEdge(Graph *g, int a, int b) {
    Edge *e;
    for (e = g->adj[a]; e != NULL; e = e->next)
        if (e->to == b)
            return 1;
    return 0;
}

static int dfs(Graph *g, int start, int cur, int *path, int len,
               int limit, int *visited) {
    Edge *e;
    for (e = g->adj[cur]; e != NULL; e = e->next) {
        int next = e->to;
        int found;

        if (next == start && len >= 3)
            return len;
        if (visited[next] || len == limit)
            continue;

        // try this student, go deeper, undo if it fails (backtracking)
        visited[next] = 1;
        path[len] = next;
        found = dfs(g, start, next, path, len + 1, limit, visited);
        if (found)
            return found;
        visited[next] = 0;
    }
    return 0;
}

/* direct pair first, then circles of 3, 4 ... up to maxSize,
   so the smallest circle is always found first.
   circle[] gets the ids in order starting with start */
int graphFindCircle(Graph *g, int start, int maxSize, int *circle) {
    int s = findIndex(g, start);
    int path[MAX_NODES], visited[MAX_NODES];
    int i, limit, size;
    Edge *e;

    if (s == -1 || maxSize < 2)
        return 0;

    for (e = g->adj[s]; e != NULL; e = e->next) {
        if (hasEdge(g, e->to, s)) {
            circle[0] = start;
            circle[1] = g->ids[e->to];
            return 2;
        }
    }

    if (maxSize > g->count)
        maxSize = g->count;

    for (limit = 3; limit <= maxSize; limit++) {
        for (i = 0; i < g->count; i++)
            visited[i] = 0;
        visited[s] = 1;
        path[0] = s;
        size = dfs(g, s, s, path, 1, limit, visited);
        if (size) {
            for (i = 0; i < size; i++)
                circle[i] = g->ids[path[i]];
            return size;
        }
    }
    return 0;
}

void graphFree(Graph *g) {
    int i;
    for (i = 0; i < g->count; i++) {
        Edge *e = g->adj[i];
        while (e != NULL) {
            Edge *next = e->next;
            free(e);
            e = next;
        }
        g->adj[i] = NULL;
    }
    g->count = 0;
}
