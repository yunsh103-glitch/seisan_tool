"""
실제 클라우드체커 CSV 파일로 테스트
"""
import os
from src.cost_data_converter import CostDataConverter


def test_real_cloudchecker_csv():
    """실제 클라우드체커 CSV 파일 테스트"""
    
    # 실제 CSV 파일 경로
    csv_file = r"c:\Users\user\Downloads\ciel BillingDetailedGrouped 11-22-2025 14_49_45_2025-11-23-08-10-50.csv"
    
    print("=" * 80)
    print("실제 클라우드체커 CSV 파일 변환 테스트")
    print("=" * 80)
    
    # 파일 존재 확인
    if not os.path.exists(csv_file):
        print(f"❌ 파일을 찾을 수 없습니다: {csv_file}")
        return
    
    # 변환기 초기화
    print("\n[1단계] 변환기 초기화")
    converter = CostDataConverter()
    print("✓ 초기화 완료")
    
    # 파일 미리보기
    print("\n[2단계] 파일 미리보기 (처음 5행)")
    print("-" * 80)
    try:
        preview = converter.preview_file(csv_file, rows=5)
        print(preview)
        print(f"\n컬럼: {list(preview.columns)}")
    except Exception as e:
        print(f"❌ 미리보기 실패: {e}")
        return
    
    # 파일 검증
    print("\n[3단계] 파일 유효성 검증")
    print("-" * 80)
    is_valid, message = converter.validate_file(csv_file)
    print(f"검증 결과: {'✓ ' if is_valid else '❌ '}{message}")
    
    if not is_valid:
        print("\n파일이 유효하지 않습니다. 변환을 중단합니다.")
        return
    
    # 변환 수행
    print("\n[4단계] 표준 데이터로 변환")
    print("-" * 80)
    try:
        standard_data = converter.convert_file(csv_file)
        print(f"✓ 변환 완료: {len(standard_data)}개 레코드")
        
        # 첫 번째 레코드 출력
        if standard_data:
            print("\n첫 번째 레코드 예시:")
            first = standard_data[0]
            print(f"  날짜: {first.date}")
            print(f"  계정: {first.account_id}")
            print(f"  서비스: {first.service_name}")
            print(f"  설명: {first.description}")
            print(f"  환경: {first.environment}")
            print(f"  프로젝트: {first.project}")
            print(f"  리전: {first.region}")
            print(f"  비용: ${first.cost:.2f}")
    
    except Exception as e:
        print(f"❌ 변환 실패: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 요약 정보
    print("\n[5단계] 요약 정보")
    print("-" * 80)
    try:
        summary = converter.get_summary()
        print(f"총 레코드 수: {summary['total_records']:,}")
        print(f"총 비용: ${summary['total_cost']:,.2f}")
        print(f"날짜 범위: {summary['date_range']['start']} ~ {summary['date_range']['end']}")
        print(f"계정 수: {summary['unique_accounts']}")
        print(f"서비스 수: {summary['unique_services']}")
        
        print(f"\n서비스별 비용:")
        for service, cost in sorted(summary['cost_by_service'].items(), key=lambda x: x[1], reverse=True):
            print(f"  - {service:25s}: ${cost:>10,.2f}")
    
    except Exception as e:
        print(f"❌ 요약 정보 생성 실패: {e}")
        import traceback
        traceback.print_exc()
    
    # 표준 형식으로 저장
    print("\n[6단계] 표준 형식으로 저장")
    print("-" * 80)
    try:
        # data 폴더 생성
        os.makedirs('data', exist_ok=True)
        
        # CSV로 저장
        output_csv = 'data/ciel_standard_cost_data.csv'
        converter.save_to_csv(output_csv)
        print(f"✓ CSV 저장: {output_csv}")
        
        # Excel로 저장
        output_excel = 'data/ciel_standard_cost_data.xlsx'
        converter.save_to_excel(output_excel, sheet_name='비용데이터')
        print(f"✓ Excel 저장: {output_excel}")
    
    except Exception as e:
        print(f"❌ 저장 실패: {e}")
        import traceback
        traceback.print_exc()
    
    # 데이터 분석
    print("\n[7단계] 데이터 분석")
    print("-" * 80)
    try:
        df = converter.get_data_as_dataframe()
        
        # 환경별 비용
        print("\n환경별 비용 집계:")
        if df['environment'].notna().any():
            env_costs = df.groupby('environment')['cost'].sum().sort_values(ascending=False)
            for env, cost in env_costs.items():
                print(f"  {env:25s}: ${cost:>10,.2f}")
        else:
            print("  환경 정보 없음")
        
        # 프로젝트별 비용
        print("\n프로젝트별 비용 집계:")
        if df['project'].notna().any():
            project_costs = df.groupby('project')['cost'].sum().sort_values(ascending=False)
            for project, cost in project_costs.items():
                print(f"  {project:25s}: ${cost:>10,.2f}")
        else:
            print("  프로젝트 정보 없음")
        
        # 리전별 비용
        print("\n리전별 비용 집계:")
        if df['region'].notna().any():
            region_costs = df.groupby('region')['cost'].sum().sort_values(ascending=False)
            for region, cost in region_costs.items():
                print(f"  {region:25s}: ${cost:>10,.2f}")
        else:
            print("  리전 정보 없음")
        
        # 서비스 + 환경별 교차 분석
        print("\n서비스 x 환경 교차 분석:")
        if df['environment'].notna().any():
            cross_analysis = df.pivot_table(
                values='cost',
                index='service_name',
                columns='environment',
                aggfunc='sum',
                fill_value=0
            )
            print(cross_analysis)
    
    except Exception as e:
        print(f"❌ 분석 실패: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("✓ 테스트 완료!")
    print("=" * 80)
    print(f"\n생성된 파일:")
    print(f"  - data/ciel_standard_cost_data.csv")
    print(f"  - data/ciel_standard_cost_data.xlsx")


if __name__ == '__main__':
    test_real_cloudchecker_csv()
