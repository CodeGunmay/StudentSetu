#include <stdio.h>
#include "../matching/matching.h"

int failed = 0;

void check(int ok, const char *name) {
    printf("%s  %s\n", ok ? "PASS" : "FAIL", name);
    if (!ok)
        failed++;
}

int main() {
    char buf[TEXT_LEN];
    int circle[10], n;
    Graph g;

    printf("-- search --\n");
    check(textLength("python") == 6, "length");
    textClean(buf, "  C++   Basics \n");
    check(textEqual(buf, "c++ basics"), "clean");
    check(textContains("spare calculator", "calc"), "contains");
    check(editDistance("kitten", "sitting") == 3, "edit distance");
    check(similarity("abcd", "abxy") == 50, "similarity 50");
    check(fuzzyMatch("abcd", "abxy"), "exactly 50% accepted");
    check(!fuzzyMatch("abcd", "axyy"), "25% rejected");
    check(fuzzyMatch("Spare Calculator", "calc"), "part match");
    check(fuzzyMatch("Spare Calculator", "calclator"), "typo");
    check(fuzzyMatch("Python Programming", "pyhton"), "typo in one word");
    check(fuzzyMatch("DBMS", "dbms"), "case ignored");
    check(!fuzzyMatch("DBMS", "java"), "unrelated rejected");
    check(fuzzyMatch("DBMS", "db x"), "short words: 50% is loose");
    check(!fuzzyMatch("Do", "db"), "2 letters: no fuzzy");
    check(fuzzyMatch("C++ Basics", "c"), "1 letter: start of word");
    check(!fuzzyMatch("Physics", "c"), "1 letter: not inside a word");
    check(!fuzzyMatch("book", ""), "empty query");

    printf("-- graph --\n");
    graphInit(&g);
    graphAddEdge(&g, 10, 20);
    graphAddEdge(&g, 20, 30);
    graphAddEdge(&g, 30, 10);
    n = graphFindCircle(&g, 10, 4, circle);
    check(n == 3 && circle[0] == 10 && circle[1] == 20 && circle[2] == 30, "3 person circle");
    check(graphFindCircle(&g, 10, 2, circle) == 0, "limit 2 blocks circle");
    graphAddEdge(&g, 10, 40);
    graphAddEdge(&g, 40, 10);
    n = graphFindCircle(&g, 10, 4, circle);
    check(n == 2 && circle[1] == 40, "direct pair first");
    check(graphFindCircle(&g, 99, 4, circle) == 0, "unknown student");
    graphFree(&g);

    graphInit(&g);
    graphAddEdge(&g, 1, 2);
    graphAddEdge(&g, 1, 3);
    graphAddEdge(&g, 3, 4);
    graphAddEdge(&g, 4, 1);
    n = graphFindCircle(&g, 1, 4, circle);
    check(n == 3 && circle[1] == 3 && circle[2] == 4, "backtracking");
    graphFree(&g);

    graphInit(&g);
    graphAddEdge(&g, 1, 2);
    graphAddEdge(&g, 2, 3);
    graphAddEdge(&g, 3, 4);
    graphAddEdge(&g, 4, 1);
    check(graphFindCircle(&g, 1, 3, circle) == 0, "4 circle blocked at 3");
    check(graphFindCircle(&g, 1, 4, circle) == 4, "4 circle found at 4");
    graphAddEdge(&g, 2, 1);
    check(graphFindCircle(&g, 1, 4, circle) == 2, "smallest circle wins");
    graphAddEdge(&g, 1, 1);
    check(g.count == 4, "self edge ignored");
    graphFree(&g);

    printf("-- sort --\n");
    {
        SortItem a[] = {{1, 300}, {2, 100}, {3, 200}, {4, 100}};
        mergeSort(a, 4, 1);
        check(a[0].id == 2 && a[1].id == 4 && a[2].id == 3 && a[3].id == 1, "low to high");
        mergeSort(a, 4, 0);
        check(a[0].id == 1 && a[1].id == 3 && a[2].id == 2 && a[3].id == 4, "high to low");
        mergeSort(a, 0, 1);
        check(1, "empty list");
    }

    printf("\n%s (%d failed)\n", failed ? "SOME TESTS FAILED" : "ALL TESTS PASSED", failed);
    return failed != 0;
}
