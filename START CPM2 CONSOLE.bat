@echo off
rem ============================================================
rem  CPM2 Fleet Console — one-click launcher (KAMI)
rem  Double-click me: starts the tracker server if needed,
rem  then opens it in its own app window (no browser chrome).
rem  Closing the window never kills the server.
rem
rem  v3: AUTO-REFRESH ON COMMITS — if any source file is newer
rem  than the last production build, it rebuilds + restarts the
rem  server before opening the window. No more stale app.
rem ============================================================
title CPM2 Fleet Console
cd /d "C:\Users\ojuni\Documents\GAMES\cpm2"

rem --- Edge location (start needs a full path — msedge is not on PATH) ---
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

rem --- 1. agent's DEV server on 3002? -> it hot-reloads by itself ---
netstat -ano | findstr /R /C:":3002 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo Dev server running on 3002 - opening window ^(hot-reload mode^)...
  start "" "%EDGE%" --app=http://127.0.0.1:3002/ --window-size=1280,860
  exit /b 0
)

rem --- 2. staleness check: newest source file vs the production build ---
rem (inline PS broke on cmd quoting; the real logic lives in scripts/check-stale.ps1)
set STALE=1
if exist ".next\BUILD_ID" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\check-stale.ps1"
  if not errorlevel 1 set STALE=0
)

rem --- 3. stale build -> stop old prod server, rebuild, restart fresh ---
if "%STALE%"=="1" (
  echo New commits detected - rebuilding the app...
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3457 .*LISTENING"') do taskkill /PID %%P /T /F >nul 2>&1
  call npm run build
  if errorlevel 1 (
    echo Build FAILED - keeping the old version running. Check the output above.
    pause
    exit /b 1
  )
)

rem --- 4. prod server already up (and fresh)? -> just open the window ---
netstat -ano | findstr /R /C:":3457 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo Tracker running on 3457 - opening window...
  start "" "%EDGE%" --app=http://127.0.0.1:3457/ --window-size=1280,860
  exit /b 0
)

rem --- 5. start the production server FULLY HIDDEN (no taskbar window at all) ---
rem binds 0.0.0.0 so KAMI's phone can open it on the same Wi-Fi (see section 6)
echo Starting server (runs hidden)...
powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c','cd /d C:\Users\ojuni\Documents\GAMES\cpm2 && npm run start -- -H 0.0.0.0 --port 3457 > %TEMP%\cpm2-server.log 2>&1' -WindowStyle Hidden"

set /a tries=0
:wait
timeout /t 2 /nobreak >nul
curl -s -o nul http://127.0.0.1:3457/ && goto ready
set /a tries+=1
if %tries% lss 15 goto wait
echo Server did not start - log: %TEMP%\cpm2-server.log
pause
exit /b 1

:ready
echo Ready - opening the app window...
echo.
echo PHONE (same Wi-Fi): open http://192.168.8.126:3457
echo   - find this PC's IP any time: ipconfig ^| findstr IPv4
echo.
start "" "%EDGE%" --app=http://127.0.0.1:3457/ --window-size=1280,860
exit /b 0
