// Handles student passwords, verification codes, and login sessions.
#ifndef SETU_AUTH_SERVICE_H
#define SETU_AUTH_SERVICE_H
#include "../database/Database.h"
#include "../vendor/json.hpp"
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/sha.h>
#include <algorithm>
#include <cctype>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <stdexcept>

class AuthService {
    Database &db;
    using Json = nlohmann::json;
    static long now() { return std::chrono::system_clock::to_time_t(std::chrono::system_clock::now()); }
    static std::string hex(const unsigned char *data, size_t n) {
        std::ostringstream result;
        for (size_t i = 0; i < n; ++i) result << std::hex << std::setw(2) << std::setfill('0') << (int)data[i];
        return result.str();
    }
    static std::string randomHex(int n) {
        std::string bytes(n, '\0');
        if (RAND_bytes((unsigned char *)bytes.data(), n) != 1) throw std::runtime_error("Secure randomness unavailable");
        return hex((const unsigned char *)bytes.data(), bytes.size());
    }
    static std::string digest(const std::string &value) {
        unsigned char sum[SHA256_DIGEST_LENGTH];
        SHA256((const unsigned char *)value.data(), value.size(), sum);
        return hex(sum, sizeof(sum));
    }
    static std::string passwordHash(const std::string &password) {
        std::string salt = randomHex(16);
        unsigned char result[32];
        const int rounds = 210000;
        if (PKCS5_PBKDF2_HMAC(password.c_str(), (int)password.size(), (const unsigned char *)salt.data(), (int)salt.size(), rounds, EVP_sha256(), 32, result) != 1)
            throw std::runtime_error("Password hashing failed");
        return std::to_string(rounds) + "$" + salt + "$" + hex(result, 32);
    }
    static bool passwordMatches(const std::string &password, const std::string &stored) {
        auto first = stored.find('$'), second = stored.find('$', first + 1);
        if (first == std::string::npos || second == std::string::npos) return false;
        int rounds = 0;
        try { rounds = std::stoi(stored.substr(0, first)); } catch (...) { return false; }
        if (rounds < 100000 || rounds > 1000000) return false;
        std::string salt = stored.substr(first + 1, second - first - 1);
        std::string expected = stored.substr(second + 1);
        if (expected.size() != 64) return false;
        unsigned char output[32];
        if (PKCS5_PBKDF2_HMAC(password.c_str(), (int)password.size(), (const unsigned char *)salt.data(), (int)salt.size(), rounds, EVP_sha256(), 32, output) != 1) return false;
        std::string actual = hex(output, 32);
        return CRYPTO_memcmp(actual.data(), expected.data(), 64) == 0;
    }
    static std::string cleanEmail(std::string email) {
        std::transform(email.begin(), email.end(), email.begin(), [](unsigned char c){ return (char)std::tolower(c); });
        return email;
    }
    Json profile(int id) {
        auto row = db.query("SELECT id,name,email,branch,year,teaches,wants,free_time,verified,rating_sum,rating_count FROM students WHERE id=?");
        row.bind(1, id);
        if (!row.next()) throw std::runtime_error("Student not found");
        int count = row.number(10);
        return Json{{"id",row.number(0)},{"name",row.text(1)},{"email",row.text(2)},{"branch",row.text(3)},
            {"year",row.number(4)},{"teaches",row.text(5)},{"wants",row.text(6)},{"freeTime",row.text(7)},
            {"verified",row.number(8) ? "1" : "0"},{"rating",count ? (double)row.number(9)/count : 0.0},{"ratingCount",count}};
    }
    Json signIn(int id) {
        std::string token = randomHex(32);
        auto row = db.query("INSERT INTO sessions(token_hash,student_id,expires_at) VALUES(?,?,?)");
        row.bind(1, digest(token)); row.bind(2, id); row.bind(3, (int)(now() + 7 * 86400)); row.next();
        return Json{{"ok",true},{"token",token},{"user",profile(id)}};
    }

public:
    explicit AuthService(Database &database) : db(database) {}
    Json registerStudent(const Json &body, bool developmentOtp) {
        std::string email = cleanEmail(body.value("email", ""));
        std::string password = body.value("password", "");
        std::string name = body.value("name", "");
        int year = body.value("year", 0);
        const std::string domain = "@geu.ac.in";
        if (email.size() <= domain.size() || email.substr(email.size() - domain.size()) != domain) throw std::invalid_argument("Use your college email ending in @geu.ac.in");
        if (name.size() < 2 || password.size() < 8 || year < 1 || year > 4 || body.value("teaches", "").empty())
            throw std::invalid_argument("Complete your name, year, skills, and an 8-character password");
        if (!developmentOtp) throw std::runtime_error("Email delivery is not configured; registration is unavailable");
        auto exists = db.query("SELECT id FROM students WHERE email=?"); exists.bind(1,email);
        if (exists.next()) throw std::invalid_argument("That email is already registered");
        std::string otp = std::to_string(100000 + (std::stoul(randomHex(4),nullptr,16) % 900000));
        auto row = db.query("INSERT INTO students(name,email,branch,year,password_hash,teaches,wants,otp_hash,otp_expires,otp_sent) VALUES(?,?,?,?,?,?,?,?,?,?)");
        row.bind(1,name); row.bind(2,email); row.bind(3,body.value("branch", "")); row.bind(4,year);
        row.bind(5,passwordHash(password)); row.bind(6,body.value("teaches", "")); row.bind(7,body.value("wants", ""));
        row.bind(8,digest(otp)); row.bind(9,(int)(now()+600)); row.bind(10,(int)now()); row.next();
        return Json{{"ok",true},{"email",email},{"devOtp",otp}};
    }
    Json verify(const Json &body) {
        auto row = db.query("SELECT id,otp_hash,otp_expires,otp_attempts FROM students WHERE email=? AND verified=0");
        row.bind(1,cleanEmail(body.value("email", "")));
        if (!row.next()) throw std::invalid_argument("No unverified account with that email");
        int id = row.number(0);
        if (row.number(3) >= 5 || row.number(2) < now()) throw std::invalid_argument("Code expired or too many attempts");
        auto counter = db.query("UPDATE students SET otp_attempts=otp_attempts+1 WHERE id=?"); counter.bind(1,id); counter.next();
        std::string code = body.value("otp", "");
        if (code.size()!=6 || digest(code)!=row.text(1)) throw std::invalid_argument("That verification code is not correct");
        auto update = db.query("UPDATE students SET verified=1,otp_hash=NULL,otp_expires=NULL WHERE id=?"); update.bind(1,id); update.next();
        return signIn(id);
    }
    Json resend(const Json &body, bool developmentOtp) {
        if (!developmentOtp) throw std::runtime_error("Email delivery is not configured");
        auto row = db.query("SELECT id,verified,otp_sent FROM students WHERE email=?");
        row.bind(1,cleanEmail(body.value("email", "")));
        if (!row.next()) throw std::invalid_argument("No account with that college email");
        if (row.number(1)) throw std::invalid_argument("This account is already verified");
        if (now()-row.number(2)<30) throw std::invalid_argument("Wait 30 seconds before requesting another code");
        int id=row.number(0);
        std::string otp=std::to_string(100000+(std::stoul(randomHex(4),nullptr,16)%900000));
        auto update=db.query("UPDATE students SET otp_hash=?,otp_expires=?,otp_sent=?,otp_attempts=0 WHERE id=?");
        update.bind(1,digest(otp)); update.bind(2,(int)(now()+600)); update.bind(3,(int)now()); update.bind(4,id); update.next();
        return Json{{"ok",true},{"devOtp",otp}};
    }
    Json login(const Json &body) {
        auto row = db.query("SELECT id,password_hash,verified FROM students WHERE email=?");
        row.bind(1,cleanEmail(body.value("email", "")));
        if (!row.next() || !passwordMatches(body.value("password", ""),row.text(1))) throw std::invalid_argument("Wrong email or password");
        if (!row.number(2)) throw std::invalid_argument("Confirm your college email to finish signing up");
        return signIn(row.number(0));
    }
    int authenticate(const std::string &authorization) {
        if (authorization.rfind("Bearer ",0)!=0) return 0;
        auto row = db.query("SELECT student_id FROM sessions WHERE token_hash=? AND expires_at>?");
        row.bind(1,digest(authorization.substr(7))); row.bind(2,(int)now());
        return row.next() ? row.number(0) : 0;
    }
    Json me(int id) { Json result=profile(id);result["ok"]=true;return result; }
    void logout(const std::string &authorization) {
        if (authorization.rfind("Bearer ",0)!=0) return;
        auto row=db.query("DELETE FROM sessions WHERE token_hash=?"); row.bind(1,digest(authorization.substr(7))); row.next();
    }
};
#endif
