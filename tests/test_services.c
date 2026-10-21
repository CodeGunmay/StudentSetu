#include <stdio.h>
#include "../services/services.h"

int failed = 0;

void check(int ok, const char *name) {
    printf("%s  %s\n", ok ? "PASS" : "FAIL", name);
    if (!ok)
        failed++;
}

int main() {
    HashTable t;
    Queue q;
    int ids[10], n;

    printf("-- hash table --\n");
    hashInit(&t);
    hashAdd(&t, "DBMS", 1);
    hashAdd(&t, " dbms ", 3);
    hashAdd(&t, "dbms", 1);
    hashAdd(&t, "Python", 2);
    n = hashGet(&t, "Dbms", ids, 10);
    check(n == 2 && ids[0] == 1 && ids[1] == 3, "same key, no repeat");
    check(hashGet(&t, "java", ids, 10) == 0, "missing key");
    check(hashGet(&t, "dbms", ids, 1) == 1, "max respected");
    hashFree(&t);
    check(hashGet(&t, "dbms", ids, 10) == 0, "empty after free");
    check(passwordHash("abc123") == passwordHash("abc123"), "same password same hash");
    check(passwordHash("abc123") != passwordHash("abc124"), "different password");

    printf("-- queue --\n");
    queueInit(&q);
    check(dequeue(&q) == 0, "empty dequeue");
    check(enqueue(&q, 5) && enqueue(&q, 7), "enqueue");
    check(!enqueue(&q, 5), "no duplicate");
    n = queueToArray(&q, ids, 10);
    check(n == 2 && ids[0] == 5 && ids[1] == 7, "order kept");
    check(dequeue(&q) == 5 && dequeue(&q) == 7, "first in first out");
    check(q.front == NULL && q.rear == NULL && q.size == 0, "empty again");
    enqueue(&q, 9);
    queueFree(&q);
    check(q.size == 0, "free");

    printf("\n%s (%d failed)\n", failed ? "SOME TESTS FAILED" : "ALL TESTS PASSED", failed);
    return failed != 0;
}
