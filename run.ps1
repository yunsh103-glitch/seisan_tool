# 웹 서버 실행 스크립트
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "AWS 비용 정산 툴 시작" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan

# 필요한 패키지 설치 확인
Write-Host "`n패키지 설치 확인 중..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

Write-Host "`n웹 서버 시작 중..." -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "브라우저에서 다음 주소로 접속하세요:" -ForegroundColor Green
Write-Host "  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "종료하려면 Ctrl+C를 누르세요." -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Flask 앱 실행
python app.py
