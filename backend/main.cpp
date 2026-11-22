// Serves authenticated StudentSetu requests using persistent SQLite storage.
#include "vendor/httplib.h"
#include "vendor/json.hpp"
#include "database/Database.h"
#include "auth/AuthService.h"
#include "routes/MatchingRoutes.h"
#include "services/Common.h"
#include "services/ListingService.h"
#include "services/RequestService.h"
#include "services/CircleService.h"
#include "services/ProfileService.h"
#include "services/BookingService.h"
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <mutex>
#include <sstream>

using Json = nlohmann::json;

static std::string env(const char *key, const std::string &fallback) {
    const char *value = std::getenv(key);
    return value && *value ? value : fallback;
}

int main() {
    try {
        Database db(env("SETU_DATABASE", "studentsetu.db"));
        std::ifstream file("backend/database/schema.sql");
        if (!file) throw std::runtime_error("Run the server from the project root (schema.sql not found)");
        std::stringstream contents; contents << file.rdbuf();
        db.execute(contents.str());
        AuthService auth(db);
        MatchingRoutes matching(db);
        ListingService listings(db);
        RequestService requests(db,listings);
        CircleService circles(db);
        ProfileService profiles(db);
        BookingService bookings(db);
        httplib::Server server;
        std::mutex lock;
        const bool developmentOtp = env("SETU_DEV_OTP", "0") == "1";

        server.set_pre_routing_handler([](const httplib::Request &, httplib::Response &res) {
            res.set_header("Access-Control-Allow-Origin", "*");
            res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            return httplib::Server::HandlerResponse::Unhandled;
        });
        server.Options(R"(/api/.*)", [](const httplib::Request &, httplib::Response &res) { res.status=204; });

        auto handle = [&](const httplib::Request &req, httplib::Response &res, const auto &action) {
            std::lock_guard<std::mutex> guard(lock);
            try {
                auto input = req.body.empty() ? Json::object() : Json::parse(req.body);
                res.set_content(action(input).dump(),"application/json");
            } catch (const ApiFailure &ex) {
                res.status=ex.status; res.set_content(Json{{"ok",false},{"error",ex.what()}}.dump(),"application/json");
            } catch (const std::invalid_argument &ex) {
                res.status=400; res.set_content(Json{{"ok",false},{"error",ex.what()}}.dump(),"application/json");
            } catch (const std::exception &ex) {
                std::cerr << "API error: " << ex.what() << '\n';
                res.status=500; res.set_content(Json{{"ok",false},{"error","The server could not complete this request."}}.dump(),"application/json");
            }
        };
        server.Get("/api/health", [&](const httplib::Request &req, httplib::Response &res) {
            handle(req,res,[](const Json &){ return Json{{"ok",true},{"status","ready"}}; });
        });
        server.Post("/api/register", [&](const httplib::Request &req, httplib::Response &res) {
            handle(req,res,[&](const Json &body){ return auth.registerStudent(body,developmentOtp); });
        });
        server.Post("/api/verify", [&](const httplib::Request &req, httplib::Response &res) {
            handle(req,res,[&](const Json &body){ return auth.verify(body); });
        });
        server.Post("/api/otp/resend", [&](const httplib::Request &req, httplib::Response &res) {
            handle(req,res,[&](const Json &body){ return auth.resend(body,developmentOtp); });
        });
        server.Post("/api/login", [&](const httplib::Request &req, httplib::Response &res) {
            handle(req,res,[&](const Json &body){ return auth.login(body); });
        });
        server.Get("/api/me", [&](const httplib::Request &req, httplib::Response &res) {
            if (!auth.authenticate(req.get_header_value("Authorization"))) {
                res.status=401;
                res.set_content(Json{{"ok",false},{"error","Your session has expired. Sign in again."}}.dump(),"application/json");
                return;
            }
            handle(req,res,[&](const Json &){
                int id=auth.authenticate(req.get_header_value("Authorization"));
                return auth.me(id);
            });
        });
        server.Get("/api/barter", [&](const httplib::Request &req, httplib::Response &res) {
            int id=auth.authenticate(req.get_header_value("Authorization"));
            if (!id) {
                res.status=401;
                res.set_content(Json{{"ok",false},{"error","Sign in to search for matches."}}.dump(),"application/json");
                return;
            }
            handle(req,res,[&](const Json &){ return matching.findBarter(id,req.get_param_value("skill")); });
        });
        server.Post("/api/logout", [&](const httplib::Request &req, httplib::Response &res) {
            handle(req,res,[&](const Json &){ auth.logout(req.get_header_value("Authorization")); return Json{{"ok",true}}; });
        });
        auto protectedRoute=[&](const httplib::Request &req,httplib::Response &res,const auto &action) {
            int viewer=auth.authenticate(req.get_header_value("Authorization"));
            if (!viewer) {
                res.status=401;res.set_content(Json{{"ok",false},{"error","Sign in to continue."}}.dump(),"application/json");
                return;
            }
            handle(req,res,[&](const Json &body){ return action(viewer,body); });
        };
        server.Get("/api/items",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.items(id,req.get_param_value("q"),req.get_param_value("mode"),req.get_param_value("sort")); });
        });
        server.Get("/api/items/categories",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.categories(id); });
        });
        server.Get("/api/items/category",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.items(id,"","","new",req.get_param_value("name")); });
        });
        server.Get("/api/items/one",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.item(std::atoi(req.get_param_value("id").c_str()),id); });
        });
        server.Get("/api/items/mine",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.mine(id); });
        });
        server.Post("/api/items",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return listings.addItem(id,body); });
        });
        server.Post("/api/items/active",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return listings.setActive(id,body.value("id",0),enabled(body,"active"),"item"); });
        });
        server.Get("/api/tutors",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.tutors(id,req.get_param_value("subject"),std::atoi(req.get_param_value("min").c_str()),std::atoi(req.get_param_value("max").c_str()),req.get_param_value("sort")); });
        });
        server.Get("/api/top-tutors",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.topTutors(id,std::atoi(req.get_param_value("k").c_str())); });
        });
        server.Post("/api/teach",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return listings.addTutor(id,body); });
        });
        server.Get("/api/teach/mine",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return listings.myTutors(id); });
        });
        server.Post("/api/teach/active",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return listings.setActive(id,body.value("id",0),enabled(body,"active"),"teach"); });
        });
        server.Get("/api/requests",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return requests.list(id); });
        });
        server.Post("/api/items/request",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return requests.sendItem(id,body.value("id",0),body.value("offer",0)); });
        });
        server.Post("/api/items/handoff",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return requests.handoff(id,body.value("id",0)); });
        });
        server.Post("/api/barter/request",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return requests.sendSwap(id,body.value("to",0),body.value("skill","")); });
        });
        server.Post("/api/tutors/request",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return requests.sendTutor(id,body.value("id",0)); });
        });
        for (const std::string action:{"accept","decline","cancel"}) {
            server.Post("/api/requests/"+action,[&,action](const httplib::Request &req,httplib::Response &res) {
                protectedRoute(req,res,[&](int id,const Json &body){ return requests.answer(id,body.value("id",0),action); });
            });
        }
        server.Post("/api/requests/complete",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return requests.complete(id,body.value("id",0)); });
        });
        server.Post("/api/ratings",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return requests.rate(id,body.value("request",0),body.value("stars",0)); });
        });
        server.Get("/api/circles",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return circles.mine(id); });
        });
        server.Post("/api/circles",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return circles.propose(id,body.value("skill",""),body.value("members","")); });
        });
        server.Post("/api/circles/answer",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return circles.answer(id,body.value("id",0),enabled(body,"yes")); });
        });
        server.Post("/api/me/skills",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return profiles.updateSkills(id,body); });
        });
        server.Post("/api/me/free-time",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return profiles.updateTime(id,body); });
        });
        server.Get("/api/student",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int,const Json &){ return profiles.student(std::atoi(req.get_param_value("id").c_str())); });
        });
        server.Get("/api/meet",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return profiles.meet(id,std::atoi(req.get_param_value("with").c_str())); });
        });
        server.Get("/api/bookings",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &){ return bookings.list(id); });
        });
        server.Post("/api/bookings",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return bookings.create(id,body); });
        });
        server.Post("/api/bookings/answer",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return bookings.answer(id,body.value("id",0),enabled(body,"accept")); });
        });
        server.Post("/api/bookings/cancel",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return bookings.cancel(id,body.value("id",0)); });
        });
        server.Post("/api/bookings/payment",[&](const httplib::Request &req,httplib::Response &res) {
            protectedRoute(req,res,[&](int id,const Json &body){ return bookings.payment(id,body.value("id",0),body.value("status","")); });
        });
        server.set_error_handler([](const httplib::Request &,httplib::Response &res){
            if (res.status == 404 && res.body.empty())
                res.set_content(Json{{"ok",false},{"error","This API route is not implemented yet."}}.dump(),"application/json");
        });
        int port=std::stoi(env("PORT","8080"));
        std::cout << "StudentSetu API listening on " << port << std::endl;
        server.listen("0.0.0.0",port);
    } catch (const std::exception &ex) {
        std::cerr << "Startup failed: " << ex.what() << '\n';
        return 1;
    }
}
