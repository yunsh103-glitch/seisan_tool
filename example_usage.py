"""
사용 예시 스크립트
클라우드체커 CSV 파일을 표준 형식으로 변환하는 방법을 보여줍니다.
"""
from src.cost_data_converter import CostDataConverter


def main():
    # 변환기 초기화
    converter = CostDataConverter()
    
    # CSV 파일 경로 (실제 파일 경로로 변경하세요)
    input_csv = 'data/cloudchecker_export.csv'
    
    print("=" * 60)
    print("클라우드체커 CSV → 표준 데이터 변환 예시")
    print("=" * 60)
    
    # 1. 파일 미리보기
    print("\n[1단계] 파일 미리보기")
    try:
        preview = converter.preview_file(input_csv, rows=5)
        print(f"컬럼: {list(preview.columns)}")
        print(f"\n처음 5행:\n{preview}")
    except Exception as e:
        print(f"미리보기 실패: {e}")
        print("샘플 CSV 파일이 없습니다. data/ 폴더에 클라우드체커 CSV 파일을 넣어주세요.")
        return
    
    # 2. 파일 유효성 검증
    print("\n[2단계] 파일 유효성 검증")
    is_valid, message = converter.validate_file(input_csv)
    print(f"검증 결과: {message}")
    
    if not is_valid:
        return
    
    # 3. 변환 수행
    print("\n[3단계] 표준 데이터로 변환")
    standard_data = converter.convert_file(input_csv)
    print(f"변환 완료: {len(standard_data)}개 레코드")
    
    # 4. 요약 정보 확인
    print("\n[4단계] 요약 정보")
    summary = converter.get_summary()
    print(f"총 레코드 수: {summary['total_records']}")
    print(f"총 비용: ${summary['total_cost']:.2f}")
    print(f"날짜 범위: {summary['date_range']['start']} ~ {summary['date_range']['end']}")
    print(f"계정 수: {summary['unique_accounts']}")
    print(f"서비스 수: {summary['unique_services']}")
    print(f"\n서비스별 비용:")
    for service, cost in summary['cost_by_service'].items():
        print(f"  - {service}: ${cost:.2f}")
    
    # 5. 표준 CSV로 저장
    print("\n[5단계] 표준 형식으로 저장")
    output_csv = 'data/standard_cost_data.csv'
    converter.save_to_csv(output_csv)
    print(f"저장 완료: {output_csv}")
    
    # 6. Excel로도 저장
    output_excel = 'data/standard_cost_data.xlsx'
    converter.save_to_excel(output_excel)
    print(f"저장 완료: {output_excel}")
    
    # 7. 필터링 예시
    print("\n[6단계] 데이터 필터링 예시")
    
    # DataFrame으로 변환
    df = converter.get_data_as_dataframe()
    
    # 서비스별 그룹핑
    print("\n서비스별 비용 집계:")
    service_costs = df.groupby('service_name')['cost'].sum().sort_values(ascending=False)
    print(service_costs.head(10))
    
    # 부서별 그룹핑 (태그가 있는 경우)
    if df['department'].notna().any():
        print("\n부서별 비용 집계:")
        dept_costs = df.groupby('department')['cost'].sum().sort_values(ascending=False)
        print(dept_costs)
    
    # 날짜별 비용 추이
    print("\n날짜별 비용 추이:")
    daily_costs = df.groupby(df['date'].dt.date)['cost'].sum()
    print(daily_costs.head(10))
    
    print("\n" + "=" * 60)
    print("변환 완료!")
    print("=" * 60)


if __name__ == '__main__':
    main()
