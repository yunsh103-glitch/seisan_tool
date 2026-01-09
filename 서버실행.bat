@echo off
cd /d "%~dp0"
echo AWS 비용 정산 툴 서버를 시작합니다...
echo.
echo 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요
echo.

:: 2초 후 브라우저 자동 열기 (서버가 시작될 시간을 줌)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

python app.py
pause
