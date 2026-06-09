@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║        AutoFondo — Instalación       ║
echo ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/2] Instalando dependencias Python...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de Python. Asegurate de tener pip disponible.
    pause & exit /b 1
)
cd ..

echo.
echo [2/2] Instalando dependencias Node...
cd frontend
npm install
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de Node. Asegurate de tener npm disponible.
    pause & exit /b 1
)
cd ..

echo.
echo ✓ Instalacion completa.
echo   Ejecuta iniciar.bat para arrancar la app.
echo.
pause
