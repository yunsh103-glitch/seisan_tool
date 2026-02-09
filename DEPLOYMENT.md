# Render 웹 배포 가이드

## 📋 배포 전 준비사항

1. **GitHub 저장소 생성**
   - GitHub에서 새 저장소 생성
   - 현재 프로젝트를 Git에 커밋 및 푸시

2. **Render 계정 생성**
   - [Render.com](https://render.com) 접속
   - GitHub 계정으로 회원가입/로그인

## 🚀 Render 배포 단계

### 1단계: Git 저장소 초기화 (처음 한 번만)

```bash
git init
git add .
git commit -m "Initial commit for AWS cost calculator"
git remote add origin https://github.com/your-username/your-repo-name.git
git push -u origin main
```

### 2단계: Render에서 Web Service 생성

1. Render 대시보드에서 **"New +"** 클릭
2. **"Web Service"** 선택
3. GitHub 저장소 연결
4. 프로젝트 저장소 선택

### 3단계: 배포 설정

Render가 `render.yaml` 파일을 자동으로 감지하지만, 수동 설정도 가능합니다:

- **Name**: `aws-cost-calculator` (또는 원하는 이름)
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn app:app`

### 4단계: 환경 변수 설정

Render 대시보드의 Environment 탭에서 다음 변수 추가:

- `SECRET_KEY`: (자동 생성 또는 직접 입력)
- `KOREA_EXIM_API_KEY`: `K7Ns1BMF9j5ZZN9daJAMjMqlTbWTJlg6`
- `PYTHON_VERSION`: `3.11`

### 5단계: 배포 시작

**"Create Web Service"** 버튼을 클릭하면 자동으로 배포가 시작됩니다.

## 🌐 배포 후

- 배포 완료 후 Render가 제공하는 URL로 접속 가능
- 예: `https://aws-cost-calculator-xxxx.onrender.com`
- 무료 플랜은 15분간 활동이 없으면 슬립 모드로 전환됩니다

## 📝 주요 변경사항

이 프로젝트에 다음 파일들이 추가되었습니다:

1. **requirements.txt**: `gunicorn` 추가
2. **.gitignore**: 불필요한 파일 제외
3. **render.yaml**: Render 자동 배포 설정
4. **app.py**: 환경 변수 처리 개선

## ⚙️ 로컬 테스트

배포 전 로컬에서 Gunicorn으로 테스트:

```bash
pip install gunicorn
gunicorn app:app
```

브라우저에서 `http://localhost:8000` 접속

## 🔧 문제 해결

**배포 실패 시:**
- Render 로그에서 에러 메시지 확인
- Python 버전 호환성 확인
- requirements.txt의 모든 패키지가 설치되는지 확인

**업로드 폴더 권한 문제:**
- Render는 임시 파일 시스템 사용
- 파일은 재시작 시 삭제될 수 있음

## 💡 팁

- 코드 변경 후 Git push하면 자동으로 재배포됩니다
- 환경 변수 변경 시 수동으로 재배포 필요
- 무료 플랜에서도 HTTPS가 자동으로 적용됩니다

## 📞 지원

문제 발생 시: [Render 문서](https://render.com/docs)
