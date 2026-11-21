// Manages marketplace items, tutor listings, and availability changes.
#ifndef SETU_LISTING_SERVICE_H
#define SETU_LISTING_SERVICE_H
#include "Common.h"
#include "../../matching/matching.h"
#include <vector>
#include <map>

class ListingService {
    Database &db;
    using Json=SetuJson;

    Json row(int id, const std::string &kind) {
        auto result=db.query("SELECT id,owner_id,title,category,mode,price,wants,active,created_at FROM listings WHERE id=? AND kind=?");
        result.bind(1,id); result.bind(2,kind);
        require(result.next(),"That listing does not exist",404);
        Json value={{"id",result.number(0)},{"type",kind},{"owner",publicPerson(db,result.number(1))},
            {"title",result.text(2)},{"category",result.text(3)},
            {"mode",result.text(4)},{"price",result.number(5)},
            {"wantsInReturn",result.text(6)},{"active",result.number(7) ? "1":"0"},
            {"createdAt",result.text(8)}};
        if (kind=="teach") {
            value["subject"]=result.text(3);
            value["about"]=result.text(2);
        }
        return value;
    }

public:
    explicit ListingService(Database &database):db(database) {}

    Json item(int id, int viewer) {
        Json result=row(id,"item");
        auto waiting=db.query("SELECT COUNT(*) FROM waitlists WHERE item_id=?");
        waiting.bind(1,id); waiting.next(); result["waitingCount"]=waiting.number(0);
        auto place=db.query("SELECT student_id FROM waitlists WHERE item_id=? ORDER BY joined_at,rowid");
        place.bind(1,id);
        int position=0;
        while (place.next()) { ++position; if (place.number(0)==viewer) result["place"]=position; }
        return result;
    }
    Json items(int viewer, const std::string &q, const std::string &mode,
               const std::string &sort, const std::string &category="") {
        auto found=db.query("SELECT id,title,category,mode,price FROM listings WHERE kind='item' AND active=1 AND owner_id<>?");
        found.bind(1,viewer);
        struct Entry {int id;int price;};
        std::vector<Entry> hits;
        while (found.next()) {
            if (!mode.empty() && mode!="all" && found.text(3)!=mode) continue;
            if (!category.empty() && found.text(2)!=category) continue;
            if (!q.empty() && !fuzzyMatch((found.text(1)+" "+found.text(2)).c_str(),q.c_str())) continue;
            hits.push_back({found.number(0),found.number(4)});
        }
        std::sort(hits.begin(),hits.end(),[&](const Entry &a,const Entry &b){
            if (sort=="low") return a.price!=b.price ? a.price<b.price : a.id<b.id;
            if (sort=="high") return a.price!=b.price ? a.price>b.price : a.id<b.id;
            return a.id>b.id;
        });
        Json result=Json::array();
        for (const auto &hit:hits) result.push_back(item(hit.id,viewer));
        return Json{{"ok",true},{"items",result},{"total",result.size()}};
    }
    Json categories(int viewer) {
        auto result=db.query("SELECT category,COUNT(*) FROM listings WHERE kind='item' AND active=1 AND owner_id<>? GROUP BY category ORDER BY category");
        result.bind(1,viewer);
        Json categories=Json::array();
        while (result.next()) categories.push_back(Json{{"name",result.text(0)},{"count",result.number(1)}});
        return Json{{"ok",true},{"categories",categories}};
    }
    Json mine(int viewer) {
        auto all=db.query("SELECT id FROM listings WHERE kind='item' AND owner_id=? ORDER BY id DESC");
        all.bind(1,viewer);
        std::vector<int> ids;
        while (all.next()) ids.push_back(all.number(0));
        Json result=Json::array();
        for (int id:ids) {
            auto wait=db.query("SELECT s.name FROM waitlists w JOIN students s ON s.id=w.student_id WHERE w.item_id=? ORDER BY w.joined_at,w.rowid");
            wait.bind(1,id); Json names=Json::array();
            while (wait.next()) names.push_back(wait.text(0));
            auto requests=db.query("SELECT COUNT(*) FROM requests WHERE listing_id=? AND status='pending'");
            requests.bind(1,id); requests.next();
            Json entry=item(id,viewer); entry["openRequests"]=requests.number(0);
            result.push_back(Json{{"item",entry},{"waiting",names}});
        }
        return Json{{"ok",true},{"items",result}};
    }
    Json addItem(int viewer, const Json &body) {
        std::string title=body.value("title", ""), category=body.value("category", ""), mode=body.value("mode", "");
        int price=body.value("price",0);
        require(title.size()>=3 && !category.empty(),"Give the item a title and category");
        require(mode=="free" || mode=="barter" || mode=="sell","Choose Free, Barter or Sell");
        if (mode=="sell") require(price>0 && price<=100000,"Enter a valid selling price");
        auto insert=db.query("INSERT INTO listings(owner_id,kind,title,category,mode,price,wants) VALUES(?,'item',?,?,?,?,?)");
        insert.bind(1,viewer); insert.bind(2,title); insert.bind(3,category); insert.bind(4,mode);
        insert.bind(5,mode=="sell"?price:0); insert.bind(6,body.value("wantsInReturn", "")); insert.next();
        return Json{{"ok",true},{"item",item(db.lastId(),viewer)}};
    }
    Json setActive(int viewer,int id,bool active,const std::string &kind) {
        auto lookup=db.query("SELECT owner_id FROM listings WHERE id=? AND kind=?");
        lookup.bind(1,id); lookup.bind(2,kind);
        require(lookup.next(),"Listing not found",404);
        require(lookup.number(0)==viewer,"Only the owner can change this listing",403);
        auto update=db.query("UPDATE listings SET active=? WHERE id=?");
        update.bind(1,active?1:0); update.bind(2,id); update.next();
        return kind=="item" ? Json{{"ok",true},{"item",item(id,viewer)}} : Json{{"ok",true},{"listing",row(id,kind)}};
    }
    Json tutors(int viewer,const std::string &subject,int min,int max,const std::string &sort) {
        auto result=db.query("SELECT id,category,price FROM listings WHERE kind='teach' AND active=1 AND owner_id<>?");
        result.bind(1,viewer);
        struct Entry {int id;int price;};std::vector<Entry> hits;
        while (result.next()) {
            int price=result.number(2);
            if ((!subject.empty() && !fuzzyMatch(result.text(1).c_str(),subject.c_str())) || price<min || (max>0 && price>max)) continue;
            hits.push_back({result.number(0),price});
        }
        std::sort(hits.begin(),hits.end(),[&](const Entry &a,const Entry &b){
            return a.price==b.price ? a.id<b.id : (sort=="high" ? a.price>b.price : a.price<b.price);
        });
        Json list=Json::array();for (auto x:hits) list.push_back(row(x.id,"teach"));
        return Json{{"ok",true},{"tutors",list}};
    }
    Json topTutors(int viewer,int count) {
        auto result=tutors(viewer,"",0,0,"low")["tutors"];
        if (count<1 || count>30) count=6;
        Json top=Json::array();
        for (const auto &r:result) {
            if ((int)top.size()>=count) break;
            top.push_back(Json{{"person",r["owner"]},{"subject",r["subject"]},
                {"pricePerHour",r["price"]},{"rating",r["owner"]["rating"]},
                {"ratingCount",r["owner"]["ratingCount"]}});
        }
        return Json{{"ok",true},{"tutors",top}};
    }
    Json addTutor(int viewer,const Json &body) {
        std::string subject=body.value("subject", ""),about=body.value("about", "");
        int price=body.value("price",0);
        require(subject.size()>=3 && about.size()>=10 && price>0 && price<=5000,"Enter a subject, description and fair hourly price");
        auto insert=db.query("INSERT INTO listings(owner_id,kind,title,category,mode,price) VALUES(?,'teach',?,?,'paid',?)");
        insert.bind(1,viewer);insert.bind(2,about);insert.bind(3,subject);insert.bind(4,price);insert.next();
        return Json{{"ok",true},{"listing",row(db.lastId(),"teach")}};
    }
    Json myTutors(int viewer) {
        auto rows=db.query("SELECT id FROM listings WHERE owner_id=? AND kind='teach' ORDER BY id DESC");
        rows.bind(1,viewer);std::vector<int> ids;
        while (rows.next()) ids.push_back(rows.number(0));
        Json result=Json::array();for (int id:ids) result.push_back(row(id,"teach"));
        return Json{{"ok",true},{"listings",result}};
    }
};
#endif
