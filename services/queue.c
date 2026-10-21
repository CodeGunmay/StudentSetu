#include <stdlib.h>
#include "services.h"

void queueInit(Queue *q) {
    q->front = NULL;
    q->rear = NULL;
    q->size = 0;
}

int queueHas(Queue *q, int id) {
    QNode *node;
    for (node = q->front; node != NULL; node = node->next)
        if (node->id == id)
            return 1;
    return 0;
}

int enqueue(Queue *q, int id) {
    QNode *node;
    if (queueHas(q, id))
        return 0;
    node = (QNode *)malloc(sizeof(QNode));
    if (node == NULL)
        return 0;
    node->id = id;
    node->next = NULL;
    if (q->rear == NULL)
        q->front = node;
    else
        q->rear->next = node;
    q->rear = node;
    q->size++;
    return 1;
}

int dequeue(Queue *q) {
    QNode *node = q->front;
    int id;
    if (node == NULL)
        return 0;
    id = node->id;
    q->front = node->next;
    if (q->front == NULL)
        q->rear = NULL;
    free(node);
    q->size--;
    return id;
}

int queueToArray(Queue *q, int *ids, int max) {
    QNode *node;
    int n = 0;
    for (node = q->front; node != NULL && n < max; node = node->next) {
        ids[n] = node->id;
        n++;
    }
    return n;
}

void queueFree(Queue *q) {
    while (q->front != NULL)
        dequeue(q);
}
