// Updates student skills and calculates shared meeting windows.
#ifndef SETU_PROFILE_SERVICE_H
#define SETU_PROFILE_SERVICE_H
#include "Common.h"
#include <regex>
#include <cstdio>
#include <sstream>
#include <iomanip>
#include <vector>

class ProfileService {
    Database &db;
    using Json=SetuJson;
    struct Window {std::string day;int start,end;};
    static std::vector<Window> windows(const std::string &text) {
        static const std::regex format(R"(^\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*$)",std::regex::icase);
        std::stringstream stream(text);std::string piece;
        std::vector<Window> result;
        while(std::getline(stream,piece,',')) {
            std::smatch match;
            require(std::regex_match(piece,match,format),"Use a time such as Mon 14:00-17:00");
            int h1=std::stoi(match[2]),m1=std::stoi(match[3]),h2=std::stoi(match[4]),m2=std::stoi(match[5]);
            require(h1<24 && h2<=24 && m1<60 && m2<60 && (h1*60+m1<h2*60+m2),"Invalid availability window");
            std::string day=match[1];day[0]=(char)std::toupper(day[0]);
            for(size_t i=1;i<day.size();++i) day[i]=(char)std::tolower(day[i]);
            result.push_back({day,h1*60+m1,h2*60+m2});
        }
        return result;
    }
    static std::string clock(int minutes) {
        std::ostringstream result;
        result << std::setfill('0') << std::setw(2) << minutes/60 << ':' << std::setw(2) << minutes%60;
        return result.str();
    }
public:
    explicit ProfileService(Database &database):db(database) {}
    Json updateSkills(int viewer,const Json &body) {
        std::string teaches=body.value("teaches", ""),wants=body.value("wants", "");
        require(!teaches.empty(),"Add at least one skill you can teach");
        auto row=db.query("UPDATE students SET teaches=?,wants=? WHERE id=?");
        row.bind(1,teaches);row.bind(2,wants);row.bind(3,viewer);row.next();
        return Json{{"ok",true},{"user",publicPerson(db,viewer,true)}};
    }
    Json updateTime(int viewer,const Json &body) {
        std::string text=body.value("freeTime", "");
        if(!text.empty()) require(windows(text).size()<=8,"Use at most eight availability windows");
        auto row=db.query("UPDATE students SET free_time=? WHERE id=?");row.bind(1,text);row.bind(2,viewer);row.next();
        return Json{{"ok",true},{"freeTime",text}};
    }
    Json student(int id) {return Json{{"ok",true},{"student",publicPerson(db,id)}};}
    Json meet(int viewer,int other) {
        auto a=db.query("SELECT free_time FROM students WHERE id=?");a.bind(1,viewer);a.next();
        auto b=db.query("SELECT free_time FROM students WHERE id=?");b.bind(1,other);
        require(b.next(),"Student not found",404);
        auto own=a.text(0),theirs=b.text(0);
        if(own.empty() || theirs.empty()) return Json{{"ok",true},{"commonFreeTime",""}};
        std::vector<std::string> overlaps;
        for(const auto &left:windows(own))for(const auto &right:windows(theirs)) {
            if(left.day!=right.day) continue;
            int start=std::max(left.start,right.start),end=std::min(left.end,right.end);
            if(start<end) {
                std::string slot=left.day+" "+clock(start)+"-"+clock(end);
                if(std::find(overlaps.begin(),overlaps.end(),slot)==overlaps.end()) overlaps.push_back(slot);
            }
        }
        std::string joined;
        for(const auto &slot:overlaps) {if(!joined.empty()) joined+=", ";joined+=slot;}
        return Json{{"ok",true},{"commonFreeTime",joined}};
    }
};
#endif
