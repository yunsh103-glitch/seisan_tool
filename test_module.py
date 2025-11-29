"""
간단한 테스트 스크립트
실제 CSV 파일 없이 모듈 동작을 확인합니다.
"""
import pandas as pd
from datetime import datetime
from src.cost_data_converter import CostDataConverter
import os


def create_sample_csv():
    """샘플 클라우드체커 CSV 파일 생성"""
    
    # 샘플 데이터 생성
    sample_data = {
        'Date': ['2025-11-01', '2025-11-01', '2025-11-02', '2025-11-02', '2025-11-03'],
        'Account ID': ['123456789012', '123456789012', '123456789012', '987654321098', '987654321098'],
        'Account Name': ['Production', 'Production', 'Production', 'Development', 'Development'],
        'Service Name': ['EC2', 'S3', 'EC2', 'RDS', 'Lambda'],
        'Region': ['ap-northeast-2', 'ap-northeast-2', 'us-east-1', 'ap-northeast-2', 'ap-northeast-1'],
        'Resource ID': ['i-1234567890abc', 'bucket-prod-data', 'i-0987654321xyz', 'db-prod-mysql', 'function-api'],
        'Total Cost': [45.67, 12.34, 38.92, 156.78, 2.45],
        'Usage Type': ['BoxUsage:t3.medium', 'Storage', 'BoxUsage:t3.large', 'InstanceUsage:db.t3.medium', 'Request'],
        'Usage Amount': [720, 1024, 480, 720, 100000],
        'Unit': ['Hrs', 'GB-Month', 'Hrs', 'Hrs', 'Requests'],
        'Department': ['Engineering', 'Engineering', 'Engineering', 'Data', 'Engineering'],
        'Project': ['WebApp', 'WebApp', 'API', 'Analytics', 'Serverless'],
        'Environment': ['production', 'production', 'production', 'production', 'production'],
        'Cost Center': ['CC-001', 'CC-001', 'CC-002', 'CC-003', 'CC-002'],
    }
    
    df = pd.DataFrame(sample_data)
    
    # data 폴더 생성
    os.makedirs('data', exist_ok=True)
    
    # CSV 파일로 저장
    csv_path = 'data/sample_cloudchecker.csv'
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    
    print(f"샘플 CSV 파일 생성: {csv_path}")
    return csv_path


def test_converter():
    """변환기 테스트"""
    
    print("=" * 60)
    print("클라우드체커 CSV 변환 모듈 테스트")
    print("=" * 60)
    
    # 1. 샘플 CSV 생성
    print("\n[1단계] 샘플 CSV 파일 생성")
    csv_path = create_sample_csv()
    
    # 2. 변환기 초기화
    print("\n[2단계] 변환기 초기화")
    converter = CostDataConverter()
    print("✓ 변환기 초기화 완료")
    
    # 3. 파일 미리보기
    print("\n[3단계] 파일 미리보기")
    preview = converter.preview_file(csv_path, rows=3)
    print(preview)
    
    # 4. 파일 검증
    print("\n[4단계] 파일 유효성 검증")
    is_valid, message = converter.validate_file(csv_path)
    print(f"검증 결과: {message}")
    
    if not is_valid:
        print("❌ 파일이 유효하지 않습니다.")
        return
    
    # 5. 변환 수행
    print("\n[5단계] 표준 데이터로 변환")
    standard_data = converter.convert_file(csv_path)
    print(f"✓ 변환 완료: {len(standard_data)}개 레코드")
    
    # 첫 번째 레코드 출력
    if standard_data:
        first_record = standard_data[0]
        print(f"\n첫 번째 레코드 예시:")
        print(f"  날짜: {first_record.date}")
        print(f"  계정: {first_record.account_name} ({first_record.account_id})")
        print(f"  서비스: {first_record.service_name}")
        print(f"  리전: {first_record.region}")
        print(f"  비용: ${first_record.cost:.2f}")
        print(f"  부서: {first_record.department}")
        print(f"  프로젝트: {first_record.project}")
    
    # 6. 요약 정보
    print("\n[6단계] 요약 정보")
    summary = converter.get_summary()
    print(f"총 레코드 수: {summary['total_records']}")
    print(f"총 비용: ${summary['total_cost']:.2f}")
    print(f"날짜 범위: {summary['date_range']['start']} ~ {summary['date_range']['end']}")
    print(f"계정 수: {summary['unique_accounts']}")
    print(f"서비스 수: {summary['unique_services']}")
    
    print(f"\n서비스별 비용:")
    for service, cost in summary['cost_by_service'].items():
        print(f"  - {service}: ${cost:.2f}")
    
    # 7. 표준 형식으로 저장
    print("\n[7단계] 표준 형식으로 저장")
    output_csv = 'data/standard_sample.csv'
    converter.save_to_csv(output_csv)
    print(f"✓ CSV 저장: {output_csv}")
    
    output_excel = 'data/standard_sample.xlsx'
    converter.save_to_excel(output_excel)
    print(f"✓ Excel 저장: {output_excel}")
    
    # 8. DataFrame 분석
    print("\n[8단계] 데이터 분석")
    df = converter.get_data_as_dataframe()
    
    print("\n서비스별 비용 집계:")
    service_costs = df.groupby('service_name')['cost'].sum().sort_values(ascending=False)
    for service, cost in service_costs.items():
        print(f"  {service}: ${cost:.2f}")
    
    print("\n부서별 비용 집계:")
    dept_costs = df.groupby('department')['cost'].sum().sort_values(ascending=False)
    for dept, cost in dept_costs.items():
        print(f"  {dept}: ${cost:.2f}")
    
    print("\n프로젝트별 비용 집계:")
    project_costs = df.groupby('project')['cost'].sum().sort_values(ascending=False)
    for project, cost in project_costs.items():
        print(f"  {project}: ${cost:.2f}")
    
    # 9. 필터링 테스트
    print("\n[9단계] 필터링 테스트")
    
    ec2_data = converter.filter_by_service('EC2')
    print(f"\nEC2 서비스 필터링: {len(ec2_data)}개 레코드")
    print(f"EC2 총 비용: ${sum(d.cost for d in ec2_data):.2f}")
    
    eng_data = converter.filter_by_department('Engineering')
    print(f"\nEngineering 부서 필터링: {len(eng_data)}개 레코드")
    print(f"Engineering 총 비용: ${sum(d.cost for d in eng_data):.2f}")
    
    print("\n" + "=" * 60)
    print("✓ 모든 테스트 완료!")
    print("=" * 60)
    
    print(f"\n생성된 파일:")
    print(f"  - {csv_path}")
    print(f"  - {output_csv}")
    print(f"  - {output_excel}")


if __name__ == '__main__':
    test_converter()
