#ifndef SERVICES_H
#define SERVICES_H

#ifdef __cplusplus
extern "C" {
#endif

#define KEY_LEN 100
#define TABLE_SIZE 31

typedef struct IdNode {
    int id;
    struct IdNode *next;
} IdNode;

typedef struct Bucket {
    char key[KEY_LEN];
    IdNode *ids;
    struct Bucket *next;
} Bucket;

typedef struct {
    Bucket *slots[TABLE_SIZE];
} HashTable;

void hashInit(HashTable *t);
int hashCode(const char *key);
void hashAdd(HashTable *t, const char *key, int id);
int hashGet(HashTable *t, const char *key, int *ids, int max);
void hashFree(HashTable *t);
unsigned long passwordHash(const char *pass);

typedef struct QNode {
    int id;
    struct QNode *next;
} QNode;

typedef struct {
    QNode *front;
    QNode *rear;
    int size;
} Queue;

void queueInit(Queue *q);
int enqueue(Queue *q, int id);
int dequeue(Queue *q);
int queueHas(Queue *q, int id);
int queueToArray(Queue *q, int *ids, int max);
void queueFree(Queue *q);

#ifdef __cplusplus
}
#endif

#endif
