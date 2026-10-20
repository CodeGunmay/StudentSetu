@echo off
cd /d "%~dp0"
set "PATH=C:\msys64\ucrt64\bin;%PATH%"
if not exist build mkdir build
echo Building StudentSetu...
gcc -std=c11 -Wall -c matching/text.c -o build/text.o || exit /b 1
gcc -std=c11 -Wall -c matching/graph.c -o build/graph.o || exit /b 1
gcc -std=c11 -Wall -c matching/sort.c -o build/sort.o || exit /b 1
gcc -std=c11 -Wall -c services/hashtable.c -o build/hashtable.o || exit /b 1
gcc -std=c11 -Wall -c services/queue.c -o build/queue.o || exit /b 1
g++ -std=c++17 -Wall main.cpp build/text.o build/graph.o build/sort.o build/hashtable.o build/queue.o -o build/studentsetu.exe || exit /b 1
echo Build done.
