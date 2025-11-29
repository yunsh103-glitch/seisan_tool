@echo off
cd /d "%~dp0"
echo AWS 비용 정산 툴 서버를 시작합니다...
echo.
echo 브라우저에서 http://localhost:5000 으로 접속하세요
echo 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요
echo.
python app.py
pause
