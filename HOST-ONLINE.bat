@echo off
title Domain Break - ONLINE HOST (keep this window open)
cd /d "%~dp0"
echo.
echo  DOMAIN BREAK - play online with a friend
echo  -----------------------------------------
echo  1. The game opens in your browser (use Chrome or Edge).
echo  2. Click PLAY ONLINE WITH A FRIEND, then HOST, and share THIS TAB.
echo  3. Press COPY INVITE LINK and send it to your friend (WhatsApp etc).
echo.
python online_server.py
if errorlevel 1 (
  echo.
  echo  Python is needed. Install it from https://www.python.org/downloads/ ^(tick "Add python to PATH"^)
  pause
)
