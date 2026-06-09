@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║          AutoFondo — Inicio          ║
echo ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo Iniciando backend (puerto 8000)...
start "AutoFondo — Backend" cmd /k "cd /d "%~dp0backend" && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Esperando que el backend cargue el modelo IA...
timeout /t 6 /nobreak >nul

echo Iniciando frontend (puerto 5173)...
start "AutoFondo — Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 4 /nobreak >nul

echo.
echo ═══════════════════════════════════════════════════
echo  ✓ App lista!
echo.
echo  Desde esta PC:    http://localhost:5173
echo  Desde el celular: mirá la ventana del Frontend
echo                    y usá la URL "Network" que muestra
echo  (ej: http://192.168.x.x:5173)
echo ═══════════════════════════════════════════════════
echo.
echo  Asegurate de que el celular esté en la misma WiFi.
echo.

start http://localhost:5173

pause
