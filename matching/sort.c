#include <stdlib.h>
#include "matching.h"

// equal values keep the smaller id first
static int before(SortItem a, SortItem b, int ascending) {
    if (a.value == b.value)
        return a.id < b.id;
    if (ascending)
        return a.value < b.value;
    return a.value > b.value;
}

static void merge(SortItem *arr, SortItem *temp, int left, int mid,
                  int right, int ascending) {
    int i = left, j = mid + 1, k = left;

    while (i <= mid && j <= right) {
        if (before(arr[j], arr[i], ascending))
            temp[k++] = arr[j++];
        else
            temp[k++] = arr[i++];
    }
    while (i <= mid)
        temp[k++] = arr[i++];
    while (j <= right)
        temp[k++] = arr[j++];

    for (k = left; k <= right; k++)
        arr[k] = temp[k];
}

static void sortPart(SortItem *arr, SortItem *temp, int left, int right,
                     int ascending) {
    int mid;
    if (left >= right)
        return;
    mid = (left + right) / 2;
    sortPart(arr, temp, left, mid, ascending);
    sortPart(arr, temp, mid + 1, right, ascending);
    merge(arr, temp, left, mid, right, ascending);
}

void mergeSort(SortItem *arr, int n, int ascending) {
    SortItem *temp;
    if (n < 2)
        return;
    temp = (SortItem *)malloc(n * sizeof(SortItem));
    if (temp == NULL)
        return;
    sortPart(arr, temp, 0, n - 1, ascending);
    free(temp);
}
