#ifndef STUDENTSETU_ALGORITHMS_H
#define STUDENTSETU_ALGORITHMS_H
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct { size_t from, to; int listing; } SS_Edge;
typedef struct { const char *offer, *need; int listing; } SS_Skill;
size_t ss_build_edges(const SS_Skill *skills, size_t count,
                      SS_Edge *edges, size_t capacity);
size_t ss_find_cycle(size_t start, size_t vertices, const SS_Edge *edges,
                     size_t count, size_t limit, size_t *path, int *listings);
int ss_contains(const char *text, const char *query);
double ss_similarity(const char *text, const char *query);
int ss_search_matches(const char *text, const char *query);
#ifdef __cplusplus
}
#endif
#endif
