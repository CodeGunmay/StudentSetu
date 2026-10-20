@echo off
cd /d "%~dp0"
call build.bat || exit /b 1
set "O=build/text.o build/graph.o build/sort.o build/hashtable.o build/queue.o"
gcc -std=c11 -Wall matching/text.c matching/graph.c matching/sort.c tests/test_matching.c -o build/test_matching.exe || exit /b 1
gcc -std=c11 -Wall matching/text.c services/hashtable.c services/queue.c tests/test_services.c -o build/test_services.exe || exit /b 1
g++ -std=c++17 -Wall tests/test_app.cpp %O% -o build/test_app.exe || exit /b 1
g++ -std=c++17 -Wall tests/test_storage.cpp %O% -o build/test_storage.exe || exit /b 1
g++ -std=c++17 -Wall tests/test_matcher.cpp %O% -o build/test_matcher.exe || exit /b 1
echo.
echo === Gunmay: matching ===
build\test_matching.exe
echo === Gunmay: matcher ===
build\test_matcher.exe
echo === Ishwar: app classes ===
build\test_app.exe
echo === Gaurav: hash table and queue ===
build\test_services.exe
echo === Gaurav: search, waitlist, requests, storage ===
build\test_storage.exe
