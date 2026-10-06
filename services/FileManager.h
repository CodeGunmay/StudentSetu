#pragma once
#include "Waitlist.h"
#include <string>

// Save one versioned snapshot and replace live data only after a valid load.
class FileManager {
public:
    bool save(const std::string& path, const Data& data, const Waitlist& wait,
              std::string& error) const;
    bool load(const std::string& path, Data& data, Waitlist& wait,
              std::string& error) const;
};
