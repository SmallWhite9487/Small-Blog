@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Python 3 or Flask is unavailable. Install Python and run:
    echo py -3 -m pip install Flask
    pause
    exit /b 1
)
py -3 editor-server.py
if errorlevel 1 pause
endlocal
