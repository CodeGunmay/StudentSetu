// Converts existing C graph matches into frontend API responses.
#ifndef SETU_MATCHING_ROUTES_H
#define SETU_MATCHING_ROUTES_H
#include "../database/Database.h"
#include "../vendor/json.hpp"
#include "../../matching/Matcher.h"
#include "../../matching/MatchValidator.h"
#include "../../services/SkillIndex.h"

class MatchingRoutes {
    Database &db;
    using Json = nlohmann::json;

    static Json person(Store &store, int id) {
        Student *s=store.findStudent(id);
        return Json{{"id",id},{"name",s->getName()},{"branch",s->getBranch()},
                    {"teaches",joinList(s->getHave())},{"wants",joinList(s->getWant())},
                    {"verified","1"}};
    }
    static void loadStudents(Database &db, Store &store) {
        auto rows=db.query("SELECT id,name,branch,teaches,wants FROM students WHERE verified=1");
        while (rows.next()) {
            store.addStudent(rows.number(0),rows.text(1),"",rows.text(2),0,
                             splitList(rows.text(3)),splitList(rows.text(4)));
        }
    }

public:
    explicit MatchingRoutes(Database &database) : db(database) {}
    Json findBarter(int viewer, const std::string &skill) {
        Store store;
        loadStudents(db,store);
        if (!store.findStudent(viewer) || skill.empty())
            return Json{{"ok",true},{"swaps",Json::array()},{"circle",Json::array()},{"oneWay",Json::array()}};
        Matcher matcher;
        SkillIndex index;
        index.build(&store);
        std::vector<int> teachers=index.find(skill), choices;
        for (int id:teachers) if (id!=viewer) choices.push_back(id);

        Json swaps=Json::array(), circle=Json::array(), oneWay=Json::array();
        for (const auto &match:matcher.barter(&store,viewer,choices)) {
            swaps.push_back(Json{{"student",person(store,match.id)},{"score",match.value},
                {"teaches",matcher.teaches(&store,match.id,skill)},
                {"skill",skill},{"skillLabel",matcher.teaches(&store,match.id,skill)},
                {"wantsFromYou",joinList(matcher.theyWant(&store,viewer,match.id))}});
        }
        Json members="";
        if (swaps.empty()) {
            auto ids=matcher.circle(&store,viewer,skill,choices);
            if (!ids.empty() && validExchangeCircle(store,matcher,ids,viewer,skill)) {
                std::string joined;
                for (size_t i=0;i<ids.size();++i) {
                    if (i) joined+=", ";
                    joined+=std::to_string(ids[i]);
                    int next=ids[(i+1)%ids.size()];
                    circle.push_back(Json{{"learner",person(store,ids[i])},
                        {"teacher",person(store,next)},
                        {"skill",matcher.learns(&store,ids[i],next,viewer,skill)}});
                }
                members=joined;
            } else {
                for (int id:choices) oneWay.push_back(person(store,id));
            }
        }
        return Json{{"ok",true},{"swaps",swaps},{"circle",circle},
                    {"circleMembers",members},{"oneWay",oneWay}};
    }
};
#endif
