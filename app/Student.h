#ifndef STUDENT_H
#define STUDENT_H

#include <iostream>
#include <string>
#include <vector>
#include "../matching/matching.h"
using namespace std;

inline string cleanText(string s) {
    char buf[TEXT_LEN];
    textClean(buf, s.c_str());
    return buf;
}

// "C++, DBMS ,  python" -> {"C++", "DBMS", "python"}
inline vector<string> splitList(string s) {
    vector<string> list;
    string word = "";
    for (int i = 0; i <= (int)s.size(); i++) {
        if (i == (int)s.size() || s[i] == ',') {
            int a = 0, b = word.size() - 1;
            while (a <= b && word[a] == ' ')
                a++;
            while (b >= a && word[b] == ' ')
                b--;
            if (a <= b)
                list.push_back(word.substr(a, b - a + 1));
            word = "";
        } else {
            word += s[i];
        }
    }
    return list;
}

inline string joinList(vector<string> list) {
    string s = "";
    for (int i = 0; i < (int)list.size(); i++) {
        if (i > 0)
            s += ", ";
        s += list[i];
    }
    return s;
}

// two skill names are the same if equal after cleaning, or 50% similar when both are long enough
inline bool sameSkill(string a, string b) {
    string x = cleanText(a), y = cleanText(b);
    if (x == y)
        return true;
    if (x.size() < 3 || y.size() < 3)
        return false;
    return fuzzyMatch(x.c_str(), y.c_str());
}

class Student {
    int id;
    string name, email, branch;
    unsigned long pass;
    vector<string> have, want;

public:
    Student() {
        id = 0;
        pass = 0;
    }

    Student(int i, string n, string e, string b, unsigned long p) {
        id = i;
        name = n;
        email = e;
        branch = b;
        pass = p;
    }

    int getId() { return id; }
    string getName() { return name; }
    string getEmail() { return email; }
    string getBranch() { return branch; }
    unsigned long getPass() { return pass; }
    vector<string> getHave() { return have; }
    vector<string> getWant() { return want; }

    void setHave(vector<string> list) { have = list; }
    void setWant(vector<string> list) { want = list; }

    string skillLike(string s) {
        for (int i = 0; i < (int)have.size(); i++)
            if (sameSkill(have[i], s))
                return have[i];
        return "";
    }

    string wantLike(string s) {
        for (int i = 0; i < (int)want.size(); i++)
            if (sameSkill(want[i], s))
                return want[i];
        return "";
    }

    void show() {
        cout << "Name     : " << name << "\n";
        cout << "Email    : " << email << "\n";
        cout << "Branch   : " << branch << "\n";
        cout << "I can    : " << joinList(have) << "\n";
        cout << "I want   : " << joinList(want) << "\n";
    }
};

#endif
