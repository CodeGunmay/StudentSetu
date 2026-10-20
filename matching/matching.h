#ifndef MATCHING_H
#define MATCHING_H

#ifdef __cplusplus
extern "C" {
#endif

#define TEXT_LEN 100
#define MAX_NODES 200

int textLength(const char *s);
void textCopy(char *dest, const char *src);
void textClean(char *dest, const char *src);
int textEqual(const char *a, const char *b);
int textContains(const char *text, const char *word);
int editDistance(const char *a, const char *b);
int similarity(const char *a, const char *b);
int fuzzyMatch(const char *text, const char *query);

typedef struct Edge {
    int to;
    struct Edge *next;
} Edge;

typedef struct {
    int count;
    int ids[MAX_NODES];
    Edge *adj[MAX_NODES];
} Graph;

void graphInit(Graph *g);
int graphAddStudent(Graph *g, int id);
void graphAddEdge(Graph *g, int from, int to);
int graphFindCircle(Graph *g, int start, int maxSize, int *circle);
void graphFree(Graph *g);

typedef struct {
    int id;
    int value;
} SortItem;

void mergeSort(SortItem *arr, int n, int ascending);

#ifdef __cplusplus
}
#endif

#endif
