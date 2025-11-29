"""
실제 클라우드체커 데이터에 환율 적용 테스트
"""
import os
from src.cost_data_converter import CostDataConverter
from src.converters.currency_converter_integration import CostDataConverterWithCurrency


def test_cost_data_with_currency():
    """클라우드체커 데이터에 환율 적용 테스트"""
    
    # 실제 CSV 파일 경로
    csv_file = r"c:\Users\user\Downloads\ciel BillingDetailedGrouped 11-22-2025 14_49_45_2025-11-23-08-10-50.csv"
    
    print("=" * 80)
    print("클라우드체커 비용 데이터 + 환율 변환 테스트")
    print("=" * 80)
    
    if not os.path.exists(csv_file):
        print(f"❌ 파일을 찾을 수 없습니다: {csv_file}")
        return
    
    # API 키 설정 (선택사항)
    api_key = None  # 실제 API 키 입력 가능
    
    # 환율 기능이 통합된 변환기 초기화
    print("\n[1단계] 환율 통합 변환기 초기화")
    converter = CostDataConverterWithCurrency(api_key=api_key, auto_fetch=False)
    print("✓ 초기화 완료")
    
    # 수동 환율 설정 (2025-11-19 기준)
    print("\n[2단계] 수동 환율 설정")
    from datetime import date
    converter.add_manual_exchange_rate(rate=1320.50, target_date=date(2025, 11, 19))
    print("✓ 환율 설정: 1 USD = 1,320.50 KRW (2025-11-19)")
    
    # CSV 파일 변환
    print("\n[3단계] CSV 파일 변환")
    print("-" * 80)
    standard_data = converter.convert_csv_file(csv_file)
    print(f"✓ {len(standard_data)}개 레코드 변환 완료")
    
    # 요약 정보 (KRW 포함)
    print("\n[4단계] 요약 정보 (USD + KRW)")
    print("-" * 80)
    summary = converter.get_summary_stats_with_krw(standard_data)
    
    print(f"총 레코드 수: {summary['total_records']:,}")
    print(f"\n총 비용:")
    print(f"  USD: ${summary['total_cost']:,.2f}")
    if 'total_cost_krw' in summary:
        print(f"  KRW: ₩{summary['total_cost_krw']:,.0f}")
    
    if 'average_exchange_rate' in summary:
        print(f"\n평균 환율: {summary['average_exchange_rate']:,.2f}")
    
    print(f"\n서비스별 비용 (KRW):")
    if 'cost_by_service_krw' in summary:
        for service, cost_krw in sorted(summary['cost_by_service_krw'].items(), 
                                        key=lambda x: x[1], reverse=True):
            cost_usd = summary['cost_by_service'][service]
            print(f"  - {service:25s}: ${cost_usd:>10,.2f} → ₩{cost_krw:>12,.0f}")
    
    # KRW 환산이 포함된 DataFrame 확인
    print("\n[5단계] 데이터프레임 미리보기 (KRW 포함)")
    print("-" * 80)
    df = converter.to_dataframe_with_krw(standard_data)
    print("\n컬럼:", list(df.columns))
    print("\n처음 3행:")
    print(df[['date', 'service_name', 'environment', 'cost', 'cost_krw', 'exchange_rate']].head(3))
    
    # 환경별 집계 (KRW)
    print("\n[6단계] 환경별 비용 집계 (KRW)")
    print("-" * 80)
    env_summary = df.groupby('environment').agg({
        'cost': 'sum',
        'cost_krw': 'sum'
    }).sort_values('cost_krw', ascending=False)
    
    print(env_summary)
    
    # 서비스 x 환경 교차 분석 (KRW)
    print("\n[7단계] 서비스 x 환경 교차 분석 (KRW)")
    print("-" * 80)
    cross_analysis = df.pivot_table(
        values='cost_krw',
        index='service_name',
        columns='environment',
        aggfunc='sum',
        fill_value=0
    )
    print(cross_analysis)
    
    # KRW 포함 파일 저장
    print("\n[8단계] KRW 환산 데이터 저장")
    print("-" * 80)
    os.makedirs('data', exist_ok=True)
    
    csv_output = 'data/ciel_cost_with_krw.csv'
    converter.export_to_csv_with_krw(standard_data, csv_output)
    print(f"✓ CSV 저장: {csv_output}")
    
    excel_output = 'data/ciel_cost_with_krw.xlsx'
    converter.export_to_excel_with_krw(standard_data, excel_output)
    print(f"✓ Excel 저장: {excel_output}")
    
    print("\n" + "=" * 80)
    print("✓ 테스트 완료!")
    print("=" * 80)
    
    print(f"\n💰 비용 요약:")
    print(f"   총 비용 (USD): ${summary['total_cost']:,.2f}")
    if 'total_cost_krw' in summary:
        print(f"   총 비용 (KRW): ₩{summary['total_cost_krw']:,.0f}")
    
    print(f"\n📁 생성된 파일:")
    print(f"   - {csv_output}")
    print(f"   - {excel_output}")


if __name__ == '__main__':
    test_cost_data_with_currency()
