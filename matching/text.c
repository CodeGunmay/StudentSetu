#include "matching.h"

int textLength(const char *s) {
    int n = 0;
    while (s[n] != '\0')
        n++;
    return n;
}

void textCopy(char *dest, const char *src) {
    int i = 0;
    while (src[i] != '\0' && i < TEXT_LEN - 1) {
        dest[i] = src[i];
        i++;
    }
    dest[i] = '\0';
}

// lowercase and single spaces, so "  C++   Basics " becomes "c++ basics"
void textClean(char *dest, const char *src) {
    int i = 0, j = 0, space = 0;
    while (src[i] != '\0' && j < TEXT_LEN - 2) {
        char c = src[i];
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
            if (j > 0)
                space = 1;
        } else {
            if (space) {
                dest[j] = ' ';
                j++;
                space = 0;
            }
            if (c >= 'A' && c <= 'Z')
                c = c + 32;
            dest[j] = c;
            j++;
        }
        i++;
    }
    dest[j] = '\0';
}

int textEqual(const char *a, const char *b) {
    int i = 0;
    while (a[i] != '\0' && a[i] == b[i])
        i++;
    return a[i] == b[i];
}

int textContains(const char *text, const char *word) {
    int i, j;
    if (word[0] == '\0')
        return 0;
    for (i = 0; text[i] != '\0'; i++) {
        j = 0;
        while (word[j] != '\0' && text[i + j] == word[j])
            j++;
        if (word[j] == '\0')
            return 1;
    }
    return 0;
}

// edit distance using two rows of the DP table
int editDistance(const char *a, const char *b) {
    int prev[TEXT_LEN + 1], cur[TEXT_LEN + 1];
    int n = textLength(a), m = textLength(b);
    int i, j;
    if (n > TEXT_LEN)
        n = TEXT_LEN;
    if (m > TEXT_LEN)
        m = TEXT_LEN;

    for (j = 0; j <= m; j++)
        prev[j] = j;

    for (i = 1; i <= n; i++) {
        cur[0] = i;
        for (j = 1; j <= m; j++) {
            int x = prev[j - 1] + (a[i - 1] != b[j - 1]);
            int y = prev[j] + 1;
            int z = cur[j - 1] + 1;
            if (y < x)
                x = y;
            if (z < x)
                x = z;
            cur[j] = x;
        }
        for (j = 0; j <= m; j++)
            prev[j] = cur[j];
    }
    return prev[m];
}

int similarity(const char *a, const char *b) {
    int n = textLength(a), m = textLength(b);
    int big = n > m ? n : m;
    if (big == 0)
        return 0;
    return 100 - editDistance(a, b) * 100 / big;
}

// 50% or more: distance / big <= 1/2, written as 2 * distance <= big
static int halfSame(const char *a, const char *b) {
    int n = textLength(a), m = textLength(b);
    int big = n > m ? n : m;
    if (big == 0)
        return 0;
    return 2 * editDistance(a, b) <= big;
}

static int wordStarts(const char *t, const char *q) {
    int i, j;
    for (i = 0; t[i] != '\0'; i++) {
        if (i > 0 && t[i - 1] != ' ')
            continue;
        j = 0;
        while (q[j] != '\0' && t[i + j] == q[j])
            j++;
        if (q[j] == '\0')
            return 1;
    }
    return 0;
}

/* search rule: queries under 3 letters only match the start of a word ("c" -> "c++").
   longer queries: part match ("calc" -> "spare calculator"), then 50% on the
   whole text, then 50% on each word ("pyhton" -> "python lab") */
int fuzzyMatch(const char *text, const char *query) {
    char t[TEXT_LEN], q[TEXT_LEN], word[TEXT_LEN];
    int i = 0, w = 0;

    textClean(t, text);
    textClean(q, query);
    if (q[0] == '\0' || t[0] == '\0')
        return 0;
    if (textLength(q) < 3)
        return wordStarts(t, q);
    if (textContains(t, q))
        return 1;
    if (halfSame(t, q))
        return 1;

    while (1) {
        if (t[i] == ' ' || t[i] == '\0') {
            word[w] = '\0';
            if (w > 0 && halfSame(word, q))
                return 1;
            w = 0;
            if (t[i] == '\0')
                break;
        } else {
            word[w] = t[i];
            w++;
        }
        i++;
    }
    return 0;
}
