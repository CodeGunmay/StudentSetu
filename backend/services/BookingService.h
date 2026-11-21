// Tracks tutor bookings, availability conflicts, and offline payment states.
#ifndef SETU_BOOKING_SERVICE_H
#define SETU_BOOKING_SERVICE_H
#include "Common.h"
#include <regex>
#include <vector>

class BookingService {
    Database &db;
    using Json=SetuJson;
    struct Booking {int id,tutor,learner,listing;std::string start,end,status,payment;};
    Booking find(int id) {
        auto row=db.query("SELECT id,tutor_id,learner_id,listing_id,slot_start,slot_end,status,payment_status FROM bookings WHERE id=?");
        row.bind(1,id);require(row.next(),"Booking not found",404);
        return {row.number(0),row.number(1),row.number(2),row.number(3),row.text(4),row.text(5),row.text(6),row.text(7)};
    }
    Json view(int id) {
        auto b=find(id);
        auto row=db.query("SELECT category,price FROM listings WHERE id=?");row.bind(1,b.listing);row.next();
        return Json{{"id",b.id},{"tutor",publicPerson(db,b.tutor)},{"learner",publicPerson(db,b.learner)},
            {"listingId",b.listing},{"subject",row.text(0)},{"pricePerHour",row.number(1)},
            {"slotStart",b.start},{"slotEnd",b.end},{"status",b.status},{"paymentStatus",b.payment}};
    }
    void update(int id,const std::string &field,const std::string &value) {
        require(field=="status" || field=="payment_status","Invalid booking field");
        auto row=db.query("UPDATE bookings SET "+field+"=? WHERE id=?");row.bind(1,value);row.bind(2,id);row.next();
    }
public:
    explicit BookingService(Database &database):db(database) {}
    Json list(int viewer) {
        auto row=db.query("SELECT id FROM bookings WHERE tutor_id=? OR learner_id=? ORDER BY id DESC");
        row.bind(1,viewer);row.bind(2,viewer);
        std::vector<int> ids;while(row.next()) ids.push_back(row.number(0));
        Json all=Json::array();for(int id:ids) all.push_back(view(id));
        return Json{{"ok",true},{"bookings",all}};
    }
    Json create(int viewer,const Json &body) {
        int listing=body.value("listing",0);
        std::string start=body.value("slotStart", ""),end=body.value("slotEnd", "");
        const std::regex iso(R"(^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$)");
        require(std::regex_match(start,iso) && std::regex_match(end,iso) && start<end,
            "Choose valid starting and ending times");
        auto tutor=db.query("SELECT owner_id,active FROM listings WHERE id=? AND kind='teach'");
        tutor.bind(1,listing);require(tutor.next() && tutor.number(1),"Tutor listing not available",409);
        int teacher=tutor.number(0);require(teacher!=viewer,"You cannot book your own tutoring session");
        auto duplicate=db.query("SELECT id FROM bookings WHERE listing_id=? AND learner_id=? AND status IN ('pending','confirmed') AND slot_start=?");
        duplicate.bind(1,listing);duplicate.bind(2,viewer);duplicate.bind(3,start);
        require(!duplicate.next(),"Your booking request for this time already exists",409);
        auto overlap=db.query("SELECT id FROM bookings WHERE tutor_id=? AND status='confirmed' AND slot_start<? AND slot_end>?");
        overlap.bind(1,teacher);overlap.bind(2,end);overlap.bind(3,start);
        require(!overlap.next(),"This tutor is already booked at that time",409);
        auto insert=db.query("INSERT INTO bookings(tutor_id,learner_id,listing_id,slot_start,slot_end) VALUES(?,?,?,?,?)");
        insert.bind(1,teacher);insert.bind(2,viewer);insert.bind(3,listing);insert.bind(4,start);insert.bind(5,end);insert.next();
        return Json{{"ok",true},{"booking",view(db.lastId())}};
    }
    Json answer(int viewer,int id,bool accept) {
        auto b=find(id);
        require(viewer==b.tutor,"Only the tutor can confirm a booking",403);
        require(b.status=="pending","Booking is no longer pending",409);
        if (accept) {
            auto overlap=db.query("SELECT id FROM bookings WHERE tutor_id=? AND id<>? AND status='confirmed' AND slot_start<? AND slot_end>?");
            overlap.bind(1,b.tutor);overlap.bind(2,id);overlap.bind(3,b.end);overlap.bind(4,b.start);
            require(!overlap.next(),"Another confirmed booking overlaps this time",409);
        }
        update(id,"status",accept?"confirmed":"cancelled");
        if (!accept) update(id,"payment_status","cancelled");
        return Json{{"ok",true},{"booking",view(id)}};
    }
    Json cancel(int viewer,int id) {
        auto b=find(id);
        require(viewer==b.tutor || viewer==b.learner,"Not your booking",403);
        require(b.status=="pending" || b.status=="confirmed","This booking cannot be cancelled",409);
        update(id,"status","cancelled");update(id,"payment_status","cancelled");
        return Json{{"ok",true},{"booking",view(id)}};
    }
    Json payment(int viewer,int id,const std::string &status) {
        auto b=find(id);
        require(viewer==b.tutor,"Only the tutor can record payment received",403);
        require(b.status=="confirmed","Confirm the booking before recording payment",409);
        require(status=="paid" || status=="pending","Use Pending or Paid for offline tracking");
        update(id,"payment_status",status);
        return Json{{"ok",true},{"booking",view(id)}};
    }
};
#endif
