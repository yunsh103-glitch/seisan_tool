# AWS 비용 정산 툴 - 데이터 변환 모듈

클라우드체커(CloudCheckr)에서 다운로드한 CSV 파일을 표준 데이터 형식으로 자동 변환하는 Python 모듈입니다.

## 주요 기능

- ✅ 클라우드체커 CSV 파일 자동 파싱
- ✅ 표준 데이터 모델로 변환 (Pydantic 기반)
- ✅ 다양한 날짜/비용 형식 자동 인식
- ✅ 태그 기반 부서/프로젝트 정보 추출
- ✅ CSV/Excel 형식으로 내보내기
- ✅ 데이터 필터링 및 집계 기능

## 설치 방법

```powershell
# 필요한 패키지 설치
pip install -r requirements.txt
```

## 프로젝트 구조

```
seisan_tool/
├── src/
│   ├── __init__.py
│   ├── cost_data_converter.py      # 메인 변환 모듈
│   ├── models/
│   │   ├── __init__.py
│   │   └── standard_data.py        # 표준 데이터 모델
│   ├── parsers/
│   │   ├── __init__.py
│   │   └── cloudchecker_parser.py  # CSV 파서
│   └── converters/
│       ├── __init__.py
│       └── data_converter.py       # 데이터 변환기
├── data/                           # CSV 파일 저장 폴더
├── example_usage.py                # 사용 예시
├── requirements.txt                # 의존성 패키지
└── README.md
```

## 사용 방법

### 기본 사용법

```python
from src.cost_data_converter import CostDataConverter

# 변환기 초기화
converter = CostDataConverter()

# CSV 파일 변환
standard_data = converter.convert_file('data/cloudchecker_export.csv')

# 요약 정보 확인
summary = converter.get_summary()
print(f"총 비용: ${summary['total_cost']:.2f}")
print(f"레코드 수: {summary['total_records']}")

# 표준 CSV로 저장
converter.save_to_csv('data/standard_cost_data.csv')

# Excel로 저장
converter.save_to_excel('data/standard_cost_data.xlsx')
```

### 파일 미리보기 및 검증

```python
# CSV 파일 미리보기
preview = converter.preview_file('data/cloudchecker_export.csv', rows=10)
print(preview)

# 파일 유효성 검증
is_valid, message = converter.validate_file('data/cloudchecker_export.csv')
if is_valid:
    print("파일이 유효합니다!")
else:
    print(f"오류: {message}")
```

### 데이터 필터링

```python
# DataFrame으로 변환
df = converter.get_data_as_dataframe()

# JSON으로 변환
json_data = converter.get_data_as_json()

# 날짜 범위로 필터링
filtered = converter.filter_by_date_range('2025-11-01', '2025-11-30')

# 서비스별 필터링
ec2_data = converter.filter_by_service('EC2')

# 부서별 필터링
dept_data = converter.filter_by_department('Engineering')
```

### 데이터 분석 예시

```python
import pandas as pd

# DataFrame으로 변환
df = converter.get_data_as_dataframe()

# 서비스별 비용 집계
service_costs = df.groupby('service_name')['cost'].sum().sort_values(ascending=False)
print(service_costs)

# 부서별 비용 집계
dept_costs = df.groupby('department')['cost'].sum()
print(dept_costs)

# 날짜별 비용 추이
daily_costs = df.groupby(df['date'].dt.date)['cost'].sum()
print(daily_costs)

# 프로젝트별, 환경별 비용
project_env_costs = df.groupby(['project', 'environment'])['cost'].sum()
print(project_env_costs)
```

## 표준 데이터 모델

변환 후 데이터는 다음 구조를 따릅니다:

| 필드 | 타입 | 설명 |
|------|------|------|
| date | datetime | 사용 날짜 |
| account_id | str | AWS 계정 ID |
| account_name | str | 계정 이름 |
| service_name | str | AWS 서비스 이름 (EC2, S3 등) |
| resource_id | str | 리소스 ID |
| region | str | AWS 리전 |
| cost | float | 비용 (USD) |
| currency | str | 통화 |
| department | str | 부서 (태그) |
| project | str | 프로젝트 (태그) |
| environment | str | 환경 (dev/staging/prod) |
| cost_center | str | 코스트 센터 |
| usage_type | str | 사용 유형 |
| usage_amount | float | 사용량 |
| usage_unit | str | 사용량 단위 |

## 클라우드체커 CSV 컬럼 매핑

다음 컬럼명들이 자동으로 인식됩니다:

- **날짜**: Date, Usage Date, UsageDate
- **계정**: Account, Account ID, Account Name
- **서비스**: Service, Service Name, Product Name
- **비용**: Cost, Total Cost, Unblended Cost, Blended Cost
- **태그**: Department, Project, Environment, Cost Center

## 예시 실행

```powershell
# 예시 스크립트 실행
python example_usage.py
```

## 다음 단계

이 모듈을 활용하여 다음 기능을 구현할 수 있습니다:

1. **웹 대시보드**: Flask/FastAPI + React로 웹 UI 구축
2. **정산 규칙 엔진**: 조건별 비용 분배 로직
3. **리포트 생성**: PDF/Excel 형식의 정산 리포트 자동 생성
4. **알림 시스템**: 예산 초과 시 이메일/슬랙 알림
5. **데이터베이스 연동**: PostgreSQL/MongoDB에 저장하여 이력 관리

## 라이센스

MIT License
