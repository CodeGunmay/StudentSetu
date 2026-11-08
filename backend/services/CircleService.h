// Stores group invitations and reveals contacts after unanimous approval.
#ifndef SETU_CIRCLE_SERVICE_H
#define SETU_CIRCLE_SERVICE_H
#include "Common.h"
#include "../../matching/Matcher.h"
#include "../../matching/MatchValidator.h"

class CircleService {
    Database &db;
    using Json=SetuJson;
    static std::vector<int> parseIds(const std::string &csv) {
        std::vector<int> ids;std::stringstream text(csv);std::string token;
        while (std::getline(text,token,',')) {
            try { ids.push_back(std::stoi(token)); } catch (...) { throw ApiFailure(400,"Invalid circle member id"); }
        }
        return ids;
    }
    void load(Store &store) {
        auto row=db.query("SELECT id,name,branch,teaches,wants FROM students WHERE verified=1");
        while (row.next()) store.addStudent(row.number(0),row.text(1),"",row.text(2),0,splitList(row.text(3)),splitList(row.text(4)));
    }
    Json circle(int id,int viewer) {
        auto c=db.query("SELECT owner_id,skill,status FROM circles WHERE id=?");
        c.bind(1,id);require(c.next(),"Exchange circle not found",404);
        int owner=c.number(0);std::string skill=c.text(1),status=c.text(2);
        auto rows=db.query("SELECT student_id,answer FROM circle_members WHERE circle_id=? ORDER BY member_order");
        rows.bind(1,id);
        Json members=Json::array(),links=Json::array();std::vector<int> ids;
        bool waiting=false;
        while (rows.next()) {
            int student=rows.number(0);std::string answer=rows.text(1);
            ids.push_back(student);
            Json person=publicPerson(db,student);
            Json member={{"student",person},{"answer",answer}};
            if (status=="active" && student!=viewer) member["contact"]=publicPerson(db,student,true)["email"];
            members.push_back(member);
            if (student==viewer && answer=="waiting") waiting=true;
        }
        Store store;load(store);Matcher matcher;
        for(size_t i=0;i<ids.size();++i) {
            int next=ids[(i+1)%ids.size()];
            links.push_back(Json{{"learner",publicPerson(db,ids[i])},{"teacher",publicPerson(db,next)},
                {"skill",matcher.learns(&store,ids[i],next,owner,skill)}});
        }
        return Json{{"id",id},{"createdBy",owner},{"skill",skill},{"status",status},
            {"members",members},{"links",links},{"waitingForMe",waiting}};
    }
public:
    explicit CircleService(Database &database):db(database) {}
    Json mine(int viewer) {
        auto row=db.query("SELECT circle_id FROM circle_members WHERE student_id=? ORDER BY circle_id DESC");
        row.bind(1,viewer);std::vector<int> ids;
        while(row.next()) ids.push_back(row.number(0));
        Json result=Json::array();for(int id:ids) result.push_back(circle(id,viewer));
        return Json{{"ok",true},{"circles",result},{"count",result.size()}};
    }
    Json propose(int viewer,const std::string &skill,const std::string &members) {
        auto ids=parseIds(members);
        if (ids.empty() || ids.front()!=viewer) ids.insert(ids.begin(),viewer);
        Store store;load(store);Matcher matcher;
        require(validExchangeCircle(store,matcher,ids,viewer,skill),"These students do not form a valid exchange circle",400);
        auto duplicate=db.query("SELECT id FROM circles WHERE owner_id=? AND skill=? AND status IN ('waiting','active')");
        duplicate.bind(1,viewer);duplicate.bind(2,skill);
        require(!duplicate.next(),"Your circle for this skill already exists",409);
        db.execute("BEGIN IMMEDIATE");int id=0;
        try {
            auto add=db.query("INSERT INTO circles(owner_id,skill) VALUES(?,?)");
            add.bind(1,viewer);add.bind(2,skill);add.next();id=db.lastId();
            for(size_t i=0;i<ids.size();++i) {
                auto member=db.query("INSERT INTO circle_members(circle_id,student_id,answer,member_order) VALUES(?,?,?,?)");
                member.bind(1,id);member.bind(2,ids[i]);member.bind(3,ids[i]==viewer?"yes":"waiting");member.bind(4,(int)i);member.next();
            }
            db.execute("COMMIT");
        } catch (...) {db.execute("ROLLBACK");throw;}
        return Json{{"ok",true},{"sent",ids.size()-1},{"circle",circle(id,viewer)}};
    }
    Json answer(int viewer,int id,bool yes) {
        auto check=db.query("SELECT answer FROM circle_members WHERE circle_id=? AND student_id=?");
        check.bind(1,id);check.bind(2,viewer);
        require(check.next(),"You are not part of this circle",403);
        require(check.text(0)=="waiting" || !yes,"You already responded to this circle",409);
        auto status=db.query("SELECT status FROM circles WHERE id=?");status.bind(1,id);status.next();
        require(status.text(0)=="waiting","This circle is no longer waiting",409);
        db.execute("BEGIN IMMEDIATE");
        try {
            auto update=db.query("UPDATE circle_members SET answer=? WHERE circle_id=? AND student_id=?");
            update.bind(1,yes?"yes":"no");update.bind(2,id);update.bind(3,viewer);update.next();
            auto tally=db.query("SELECT SUM(answer='yes'),SUM(answer='no'),COUNT(*) FROM circle_members WHERE circle_id=?");
            tally.bind(1,id);tally.next();
            std::string next=tally.number(1)?"cancelled":tally.number(0)==tally.number(2)?"active":"waiting";
            auto change=db.query("UPDATE circles SET status=? WHERE id=?");change.bind(1,next);change.bind(2,id);change.next();
            db.execute("COMMIT");
        } catch (...) {db.execute("ROLLBACK");throw;}
        return Json{{"ok",true},{"circle",circle(id,viewer)}};
    }
};
#endif
