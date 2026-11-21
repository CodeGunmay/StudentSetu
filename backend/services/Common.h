// Shares validation and public profile formatting across API services.
#ifndef SETU_COMMON_H
#define SETU_COMMON_H
#include "../database/Database.h"
#include "../vendor/json.hpp"
#include <algorithm>
#include <cctype>
#include <stdexcept>

using SetuJson = nlohmann::json;
class ApiFailure : public std::runtime_error {
public:
    int status;
    ApiFailure(int code, const std::string &reason) : std::runtime_error(reason),status(code) {}
};
inline void require(bool condition, const std::string &message, int status=400) {
    if (!condition) throw ApiFailure(status,message);
}
inline std::string lower(std::string text) {
    std::transform(text.begin(),text.end(),text.begin(),[](unsigned char c){ return (char)std::tolower(c); });
    return text;
}
inline bool enabled(const SetuJson &body, const std::string &key) {
    if (!body.contains(key)) return false;
    const auto &value=body[key];
    if (value.is_boolean()) return value.get<bool>();
    if (value.is_number_integer()) return value.get<int>()!=0;
    return value.is_string() && (value.get<std::string>()=="1" || value.get<std::string>()=="true");
}
inline SetuJson publicPerson(Database &db, int id, bool withEmail=false) {
    auto row=db.query("SELECT id,name,email,branch,year,teaches,wants,free_time,verified,rating_sum,rating_count FROM students WHERE id=?");
    row.bind(1,id);
    require(row.next(),"Student not found",404);
    int count=row.number(10);
    SetuJson result={{"id",row.number(0)},{"name",row.text(1)},{"branch",row.text(3)},
        {"year",row.number(4)},{"teaches",row.text(5)},{"wants",row.text(6)},
        {"freeTime",row.text(7)},{"verified",row.number(8) ? "1":"0"},
        {"rating",count ? (double)row.number(9)/count : 0.0},{"ratingCount",count}};
    if (withEmail) result["email"]=row.text(2);
    return result;
}
#endif
