@echo off
echo ====================================
echo Fixing Agora SDK Loading Issue
echo ====================================
echo.

echo Step 1: Stopping any running dev servers...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo Done!
echo.

echo Step 2: Clearing Next.js cache...
if exist .next rmdir /s /q .next
echo Done!
echo.

echo Step 3: Clearing node_modules cache...
if exist node_modules\.cache rmdir /s /q node_modules\.cache
echo Done!
echo.

echo Step 4: Reinstalling dependencies...
call npm install
echo Done!
echo.

echo ====================================
echo Fix Complete! Now starting dev server...
echo ====================================
echo.

call npm run dev

