@echo off
chcp 65001
cls
echo ===================================================
echo       🖥️ Building Windows App (Secure)
echo ===================================================
echo.

:: 1. Try to find Java 17 (Microsoft or Standard) just in case
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot"
if not exist "%JAVA_HOME%" (
    for /d %%i in ("C:\Program Files\Microsoft\jdk-17*") do set "JAVA_HOME=%%i"
)
if exist "%JAVA_HOME%" (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

echo [1] Cleaning previous builds...
call C:\flutter\bin\flutter.bat clean

echo.
echo [2] Fetching libraries...
call C:\flutter\bin\flutter.bat pub get

echo.
echo [3] Compiling EXE (Release Mode)...
echo     (This takes 1-2 minutes)
call C:\flutter\bin\flutter.bat build windows --release

echo.
echo ===================================================
if %errorlevel% neq 0 (
    echo ❌ Build Failed.
) else (
    echo ✅ Build SUCCEEDED!
    echo.
    echo Your App is ready at:
    echo build\windows\x64\runner\Release
    echo.
    echo IMPORTANT: You must send the WHOLE 'Release' folder to the student,
    echo            not just the .exe file.
    echo.
    explorer build\windows\x64\runner\Release
)
pause
