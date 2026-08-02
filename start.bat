@echo off
echo ================================
echo    AI Data Analyst - Starting
echo ================================

:: 1. Start FastAPI Backend
start "FastAPI Backend" cmd /k "cd /d C:\Users\admin\Desktop\claude project\text-to-sql && venv\Scripts\activate && uvicorn backend.main:app --reload"

:: Wait for FastAPI to start
timeout /t 3 /nobreak

:: 2. Start React Frontend
start "React Frontend" cmd /k "cd /d C:\Users\admin\Desktop\claude project\text-to-sql\frontend && npm run dev"

:: 3. Open pgAdmin (change path if different on your PC)
start "" "C:\Program Files\pgAdmin 4\runtime\pgAdmin4.exe"

:: Wait then open browser tabs
timeout /t 5 /nobreak

:: 4. Open all browser tabs automatically
start "" "http://localhost:5173"
start "" "http://127.0.0.1:8000/docs"

echo.
echo ================================
echo  Everything is starting...
echo ================================
echo.
echo  React App  → http://localhost:5173
echo  FastAPI    → http://127.0.0.1:8000
echo  Swagger    → http://127.0.0.1:8000/docs
echo  pgAdmin    → opening separately
echo ================================
pause