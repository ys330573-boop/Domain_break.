@echo off
title Domain Break - local server
cd /d "%~dp0"
echo Starting Domain Break at http://localhost:8765
start "" http://localhost:8765/index.html
python -m http.server 8765
