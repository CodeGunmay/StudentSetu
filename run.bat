@echo off
cd /d "%~dp0"
call build.bat || exit /b 1
build\studentsetu.exe
