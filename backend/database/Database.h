// Opens SQLite and safely manages prepared database statements.
#ifndef SETU_DATABASE_H
#define SETU_DATABASE_H
#include "../vendor/sqlite3.h"
#include <stdexcept>
#include <string>

class Database {
    sqlite3 *db = nullptr;
public:
    explicit Database(const std::string &path) {
        if (sqlite3_open(path.c_str(), &db) != SQLITE_OK) {
            std::string reason = sqlite3_errmsg(db);
            sqlite3_close(db);
            throw std::runtime_error(reason);
        }
        sqlite3_busy_timeout(db, 5000);
        execute("PRAGMA foreign_keys=ON");
        execute("PRAGMA journal_mode=WAL");
    }
    ~Database() { sqlite3_close(db); }
    Database(const Database &) = delete;
    Database &operator=(const Database &) = delete;
    sqlite3 *handle() const { return db; }
    void execute(const std::string &sql) {
        char *message = nullptr;
        if (sqlite3_exec(db, sql.c_str(), nullptr, nullptr, &message) != SQLITE_OK) {
            std::string reason = message ? message : "Database error";
            sqlite3_free(message);
            throw std::runtime_error(reason);
        }
    }
    class Statement {
        sqlite3_stmt *stmt = nullptr;
    public:
        Statement(sqlite3 *db, const std::string &sql) {
            if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK)
                throw std::runtime_error(sqlite3_errmsg(db));
        }
        ~Statement() { sqlite3_finalize(stmt); }
        Statement(const Statement &) = delete;
        Statement &operator=(const Statement &) = delete;
        void bind(int n, int value) { sqlite3_bind_int(stmt, n, value); }
        void bindNull(int n) { sqlite3_bind_null(stmt,n); }
        void bind(int n, const std::string &value) { sqlite3_bind_text(stmt, n, value.c_str(), -1, SQLITE_TRANSIENT); }
        bool next() {
            int status = sqlite3_step(stmt);
            if (status == SQLITE_ROW) return true;
            if (status == SQLITE_DONE) return false;
            throw std::runtime_error(sqlite3_errmsg(sqlite3_db_handle(stmt)));
        }
        int number(int n) const { return sqlite3_column_int(stmt, n); }
        std::string text(int n) const {
            auto value = sqlite3_column_text(stmt, n);
            return value ? reinterpret_cast<const char *>(value) : "";
        }
    };
    Statement query(const std::string &sql) { return Statement(db, sql); }
    int lastId() const { return (int)sqlite3_last_insert_rowid(db); }
};
#endif
