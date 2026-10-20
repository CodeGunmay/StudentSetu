#ifndef INPUT_H
#define INPUT_H

#include <iostream>
#include <string>
#include <cstdlib>
using namespace std;

inline int readInt(string msg) {
    int n;
    while (true) {
        cout << msg;
        if (cin >> n) {
            cin.ignore(1000, '\n');
            return n;
        }
        if (cin.eof())
            exit(0);
        cin.clear();
        cin.ignore(1000, '\n');
        cout << "Please enter a number.\n";
    }
}

inline int readChoice(string msg, int low, int high) {
    int n = readInt(msg);
    while (n < low || n > high) {
        cout << "Choose between " << low << " and " << high << ".\n";
        n = readInt(msg);
    }
    return n;
}

// '|' is used to separate fields in the save file, so it is not allowed in input
inline string readLine(string msg) {
    string s;
    cout << msg;
    if (!getline(cin, s))
        exit(0);
    for (int i = 0; i < (int)s.size(); i++)
        if (s[i] == '|' || s[i] == '\r')
            s[i] = ' ';
    int a = 0, b = s.size() - 1;
    while (a <= b && s[a] == ' ')
        a++;
    while (b >= a && s[b] == ' ')
        b--;
    return s.substr(a, b - a + 1);
}

inline string readNonEmpty(string msg) {
    string s = readLine(msg);
    while (s == "") {
        cout << "This cannot be empty.\n";
        s = readLine(msg);
    }
    return s;
}

#endif
