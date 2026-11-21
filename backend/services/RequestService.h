// Tracks requests, item waitlists, handoffs, and exchange ratings.
#ifndef SETU_REQUEST_SERVICE_H
#define SETU_REQUEST_SERVICE_H
#include "ListingService.h"

class RequestService {
    Database &db;
    ListingService &listings;
    using Json=SetuJson;

    struct RequestData { int id,from,to,listing,offer;std::string kind,status,note; };
    RequestData get(int id) {
        auto row=db.query("SELECT id,sender_id,receiver_id,listing_id,offer_id,kind,status,note FROM requests WHERE id=?");
        row.bind(1,id);require(row.next(),"Request not found",404);
        return {row.number(0),row.number(1),row.number(2),row.number(3),row.number(4),row.text(5),row.text(6),row.text(7)};
    }
    std::pair<int,std::string> listingOwner(int listing) {
        auto row=db.query("SELECT owner_id,kind FROM listings WHERE id=? AND active=1");
        row.bind(1,listing);require(row.next(),"Listing is no longer available",409);
        return {row.number(0),row.text(1)};
    }
    int send(int from,int to,const std::string &kind,int listing,int offer,const std::string &note) {
        require(from!=to,"You cannot send yourself a request");
        auto duplicate=db.query("SELECT id FROM requests WHERE sender_id=? AND receiver_id=? AND kind=? AND COALESCE(listing_id,0)=? AND status='pending'");
        duplicate.bind(1,from);duplicate.bind(2,to);duplicate.bind(3,kind);duplicate.bind(4,listing);
        require(!duplicate.next(),"That request is already pending",409);
        auto row=db.query("INSERT INTO requests(sender_id,receiver_id,kind,listing_id,offer_id,note) VALUES(?,?,?,?,?,?)");
        row.bind(1,from);row.bind(2,to);row.bind(3,kind);
        if (listing) row.bind(4,listing); else row.bindNull(4);
        if (offer) row.bind(5,offer); else row.bindNull(5);
        row.bind(6,note);row.next();return db.lastId();
    }
    Json listingView(int id,int viewer) {
        auto row=db.query("SELECT kind FROM listings WHERE id=?");row.bind(1,id);
        if (!row.next()) return nullptr;
        if (row.text(0)=="item") return listings.item(id,viewer);
        auto details=db.query("SELECT l.id,l.title,l.category,l.price,l.active,l.owner_id FROM listings l WHERE l.id=?");
        details.bind(1,id);details.next();
        return Json{{"id",details.number(0)},{"type","teach"},{"about",details.text(1)},
            {"subject",details.text(2)},{"price",details.number(3)},
            {"active",details.number(4)?"1":"0"},{"owner",publicPerson(db,details.number(5))}};
    }
    void updateStatus(int id,const std::string &status) {
        auto row=db.query("UPDATE requests SET status=? WHERE id=?");row.bind(1,status);row.bind(2,id);row.next();
    }

public:
    RequestService(Database &database, ListingService &list):db(database),listings(list) {}
    Json view(int id,int viewer) {
        auto r=get(id);
        Json result={{"id",r.id},{"kind",r.kind},{"status",r.status},{"note",r.note},
            {"from",publicPerson(db,r.from)},{"to",publicPerson(db,r.to)}};
        if (r.listing) result["listing"]=listingView(r.listing,viewer);
        if (r.offer) result["offer"]=listingView(r.offer,viewer);
        if (r.status=="accepted" || r.status=="completed") {
            int other=r.from==viewer?r.to:r.from;
            result["contact"]=publicPerson(db,other,true)["email"];
        }
        auto rating=db.query("SELECT id FROM ratings WHERE request_id=? AND reviewer_id=?");
        rating.bind(1,id);rating.bind(2,viewer);
        result["canRate"]=(r.status=="completed" && !rating.next() && (viewer==r.from || viewer==r.to));
        return result;
    }
    Json list(int viewer) {
        auto row=db.query("SELECT id,sender_id,receiver_id,status FROM requests WHERE sender_id=? OR receiver_id=? ORDER BY id DESC");
        row.bind(1,viewer);row.bind(2,viewer);
        struct Entry {int id,from,to;std::string status;};std::vector<Entry> ids;
        int pending=0;
        while (row.next()) {ids.push_back({row.number(0),row.number(1),row.number(2),row.text(3)});if(row.number(2)==viewer && row.text(3)=="pending") ++pending;}
        Json sent=Json::array(),received=Json::array();
        for (const auto &r:ids) (r.to==viewer?received:sent).push_back(view(r.id,viewer));
        return Json{{"ok",true},{"sent",sent},{"received",received},{"newCount",pending}};
    }
    Json sendSwap(int viewer,int to,const std::string &skill) {
        require(!skill.empty(),"Choose a skill to exchange");
        auto row=db.query("SELECT id FROM students WHERE id=? AND verified=1");row.bind(1,to);
        require(row.next(),"Student not found",404);
        int id=send(viewer,to,"swap",0,0,"wants to learn "+skill);
        return Json{{"ok",true},{"request",view(id,viewer)}};
    }
    Json sendTutor(int viewer,int listing) {
        auto owner=listingOwner(listing);
        require(owner.second=="teach","That tutoring listing is unavailable",409);
        int id=send(viewer,owner.first,"paid",listing,0,"Tutor session request");
        return Json{{"ok",true},{"request",view(id,viewer)}};
    }
    Json sendItem(int viewer,int listing,int offer) {
        auto owner=listingOwner(listing);
        require(owner.second=="item","Item not found",404);
        auto mode=db.query("SELECT mode FROM listings WHERE id=?");mode.bind(1,listing);mode.next();
        if (mode.text(0)=="free") {
            require(owner.first!=viewer,"You cannot join your own waitlist");
            auto existing=db.query("SELECT COUNT(*) FROM waitlists WHERE item_id=? AND student_id=?");
            existing.bind(1,listing);existing.bind(2,viewer);existing.next();
            require(!existing.number(0),"Already waiting for this item",409);
            auto join=db.query("INSERT INTO waitlists(item_id,student_id) VALUES(?,?)");
            join.bind(1,listing);join.bind(2,viewer);join.next();
            auto queue=db.query("SELECT COUNT(*) FROM waitlists WHERE item_id=?");queue.bind(1,listing);queue.next();
            return Json{{"ok",true},{"place",queue.number(0)}};
        }
        if (mode.text(0)=="barter") {
            require(offer>0,"Choose an item to offer for barter");
            auto offered=db.query("SELECT owner_id,active FROM listings WHERE id=? AND kind='item'");offered.bind(1,offer);
            require(offered.next() && offered.number(0)==viewer && offered.number(1),"Your offered item is unavailable",409);
        }
        int id=send(viewer,owner.first,"item",listing,offer,"Item exchange request");
        return Json{{"ok",true},{"request",view(id,viewer)}};
    }
    Json answer(int viewer,int id,const std::string &action) {
        auto r=get(id);
        require(r.status=="pending","This request has already been answered",409);
        if (action=="cancel") require(r.from==viewer,"Only the sender can withdraw",403);
        else require(r.to==viewer,"Only the receiver can answer",403);
        if (action=="accept" && r.kind=="item" && r.listing) {
            listingOwner(r.listing);
            db.execute("BEGIN IMMEDIATE");
            try {
                auto take=db.query("UPDATE listings SET active=0 WHERE id=? AND active=1");take.bind(1,r.listing);take.next();
                if(r.offer) {auto other=db.query("UPDATE listings SET active=0 WHERE id=? AND active=1");other.bind(1,r.offer);other.next();}
                auto decline=db.query("UPDATE requests SET status='declined' WHERE id<>? AND status='pending' AND kind='item' AND (listing_id=? OR offer_id=?)");
                decline.bind(1,id);decline.bind(2,r.listing);decline.bind(3,r.listing);decline.next();
                updateStatus(id,"accepted");db.execute("COMMIT");
            } catch (...) {db.execute("ROLLBACK");throw;}
        } else updateStatus(id,action=="accept"?"accepted":action=="decline"?"declined":"cancelled");
        return Json{{"ok",true},{"request",view(id,viewer)}};
    }
    Json complete(int viewer,int id) {
        auto r=get(id);
        require(r.from==viewer || r.to==viewer,"Not your exchange",403);
        require(r.status=="accepted","The exchange must be accepted first",409);
        db.execute("BEGIN IMMEDIATE");
        bool finished=false;
        try {
            auto mark=db.query("INSERT OR IGNORE INTO completion_confirmations(request_id,student_id) VALUES(?,?)");
            mark.bind(1,id);mark.bind(2,viewer);mark.next();
            auto count=db.query("SELECT COUNT(*) FROM completion_confirmations WHERE request_id=?");count.bind(1,id);count.next();
            finished=count.number(0)==2;
            if (finished) updateStatus(id,"completed");
            db.execute("COMMIT");
        } catch (...) {db.execute("ROLLBACK");throw;}
        return Json{{"ok",true},{"completionPending",!finished},{"request",view(id,viewer)}};
    }
    Json handoff(int viewer,int item) {
        auto owner=listingOwner(item);
        require(owner.first==viewer && owner.second=="item","Only this item's owner may hand it over",403);
        auto row=db.query("SELECT student_id FROM waitlists WHERE item_id=? ORDER BY joined_at,rowid LIMIT 1");row.bind(1,item);
        require(row.next(),"Nobody is waiting for this item",409);
        int student=row.number(0);
        db.execute("BEGIN IMMEDIATE");
        try {
            auto inactive=db.query("UPDATE listings SET active=0 WHERE id=?");inactive.bind(1,item);inactive.next();
            auto clear=db.query("DELETE FROM waitlists WHERE item_id=?");clear.bind(1,item);clear.next();
            auto record=db.query("INSERT INTO requests(sender_id,receiver_id,kind,listing_id,note,status) VALUES(?,?,'item',?,'Free item handoff','completed')");
            record.bind(1,student);record.bind(2,viewer);record.bind(3,item);record.next();
            db.execute("COMMIT");
        } catch (...) {db.execute("ROLLBACK");throw;}
        auto person=publicPerson(db,student,true);
        return Json{{"ok",true},{"givenTo",person},{"contact",person["email"]},{"remaining",0}};
    }
    Json rate(int viewer,int id,int stars) {
        require(stars>=1 && stars<=5,"Choose 1 to 5 stars");
        auto r=get(id);
        require(r.status=="completed","Complete the exchange before rating",409);
        require(r.kind!="paid" && (r.from==viewer || r.to==viewer),"Only participants can rate an exchange",403);
        int other=r.from==viewer?r.to:r.from;
        auto exists=db.query("SELECT id FROM ratings WHERE request_id=? AND reviewer_id=?");exists.bind(1,id);exists.bind(2,viewer);
        require(!exists.next(),"You already rated this exchange",409);
        db.execute("BEGIN IMMEDIATE");
        try {
            auto insert=db.query("INSERT INTO ratings(request_id,reviewer_id,target_id,stars) VALUES(?,?,?,?)");
            insert.bind(1,id);insert.bind(2,viewer);insert.bind(3,other);insert.bind(4,stars);insert.next();
            auto update=db.query("UPDATE students SET rating_sum=rating_sum+?,rating_count=rating_count+1 WHERE id=?");
            update.bind(1,stars);update.bind(2,other);update.next();db.execute("COMMIT");
        } catch (...) {db.execute("ROLLBACK");throw;}
        Json student=publicPerson(db,other);
        return Json{{"ok",true},{"rating",student["rating"]},{"ratingCount",student["ratingCount"]}};
    }
};
#endif
