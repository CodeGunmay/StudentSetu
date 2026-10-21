#include <stdlib.h>
#include "services.h"
#include "../matching/matching.h"

void hashInit(HashTable *t) {
    int i;
    for (i = 0; i < TABLE_SIZE; i++)
        t->slots[i] = NULL;
}

int hashCode(const char *key) {
    unsigned long h = 0;
    int i = 0;
    while (key[i] != '\0') {
        h = h * 31 + (unsigned char)key[i];
        i++;
    }
    return (int)(h % TABLE_SIZE);
}

static Bucket *findBucket(HashTable *t, const char *key) {
    Bucket *b = t->slots[hashCode(key)];
    while (b != NULL) {
        if (textEqual(b->key, key))
            return b;
        b = b->next;
    }
    return NULL;
}

// keys are cleaned first, so "DBMS" and " dbms " go to the same bucket
void hashAdd(HashTable *t, const char *key, int id) {
    char k[KEY_LEN];
    Bucket *b;
    IdNode *node, *last = NULL;

    textClean(k, key);
    if (k[0] == '\0')
        return;

    b = findBucket(t, k);
    if (b == NULL) {
        int slot = hashCode(k);
        b = (Bucket *)malloc(sizeof(Bucket));
        if (b == NULL)
            return;
        textCopy(b->key, k);
        b->ids = NULL;
        b->next = t->slots[slot];
        t->slots[slot] = b;
    }

    for (node = b->ids; node != NULL; node = node->next) {
        if (node->id == id)
            return;
        last = node;
    }

    node = (IdNode *)malloc(sizeof(IdNode));
    if (node == NULL)
        return;
    node->id = id;
    node->next = NULL;
    if (last == NULL)
        b->ids = node;
    else
        last->next = node;
}

int hashGet(HashTable *t, const char *key, int *ids, int max) {
    char k[KEY_LEN];
    Bucket *b;
    IdNode *node;
    int n = 0;

    textClean(k, key);
    b = findBucket(t, k);
    if (b == NULL)
        return 0;
    for (node = b->ids; node != NULL && n < max; node = node->next) {
        ids[n] = node->id;
        n++;
    }
    return n;
}

void hashFree(HashTable *t) {
    int i;
    for (i = 0; i < TABLE_SIZE; i++) {
        Bucket *b = t->slots[i];
        while (b != NULL) {
            Bucket *nextB = b->next;
            IdNode *node = b->ids;
            while (node != NULL) {
                IdNode *nextN = node->next;
                free(node);
                node = nextN;
            }
            free(b);
            b = nextB;
        }
        t->slots[i] = NULL;
    }
}

// djb2 hash, so the real password is never saved in the file
unsigned long passwordHash(const char *pass) {
    unsigned long h = 5381;
    int i = 0;
    while (pass[i] != '\0') {
        h = h * 33 + (unsigned char)pass[i];
        i++;
    }
    return h;
}
