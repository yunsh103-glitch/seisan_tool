"""
환율 기능 테스트
"""
from datetime import date, timedelta
from src.exchange.currency_converter import CurrencyConverter


def test_exchange_rate_features():
    """환율 기능 종합 테스트"""
    
    print("=" * 80)
    print("환율 계산 엔진 테스트")
    print("=" * 80)
    
    # API 키 설정 (실제 사용 시 발급받은 키 사용)
    # https://www.koreaexim.go.kr/ir/HPHKIR020M01 에서 발급
    api_key = None  # 여기에 실제 API 키 입력
    
    # 변환기 초기화
    print("\n[1단계] 환율 변환기 초기화")
    converter = CurrencyConverter(api_key=api_key, auto_fetch=False)
    print("✓ 초기화 완료")
    
    # 수동 환율 입력
    print("\n[2단계] 수동 환율 입력 테스트")
    print("-" * 80)
    
    today = date.today()
    manual_rate = converter.add_manual_rate(
        rate_value=1320.50,
        base_currency="USD",
        target_currency="KRW",
        target_date=today
    )
    print(f"✓ 수동 환율 추가: 1 USD = {manual_rate.rate:,.2f} KRW ({manual_rate.rate_date})")
    
    # 과거 날짜 환율 추가
    yesterday = today - timedelta(days=1)
    converter.add_manual_rate(1315.20, target_date=yesterday)
    print(f"✓ 과거 환율 추가: 1 USD = 1,315.20 KRW ({yesterday})")
    
    # 환율 조회
    print("\n[3단계] 환율 조회 테스트")
    print("-" * 80)
    
    rate_today = converter.get_exchange_rate(target_date=today)
    if rate_today:
        print(f"오늘 환율: 1 USD = {rate_today.rate:,.2f} KRW")
        print(f"  출처: {rate_today.source}")
        print(f"  기준일: {rate_today.rate_date}")
    
    rate_yesterday = converter.get_exchange_rate(target_date=yesterday)
    if rate_yesterday:
        print(f"\n어제 환율: 1 USD = {rate_yesterday.rate:,.2f} KRW")
    
    # 비용 변환
    print("\n[4단계] 비용 변환 테스트")
    print("-" * 80)
    
    test_amounts = [100.00, 244.91, 1000.00]
    
    for amount in test_amounts:
        try:
            converted = converter.convert_cost(
                amount=amount,
                from_currency="USD",
                to_currency="KRW",
                target_date=today
            )
            
            print(f"\n${amount:,.2f} USD")
            print(f"  → ₩{converted.converted_cost:,.0f} KRW")
            print(f"  환율: {converted.exchange_rate:,.2f}")
            print(f"  기준일: {converted.rate_date}")
        
        except ValueError as e:
            print(f"변환 실패: {e}")
    
    # 환율 요약 정보
    print("\n[5단계] 환율 데이터 요약")
    print("-" * 80)
    
    summary = converter.get_rate_summary()
    print(f"최신 USD/KRW 환율: {summary['latest_usd_krw_rate']:,.2f}" if summary['latest_usd_krw_rate'] else "환율 정보 없음")
    print(f"최종 업데이트: {summary['latest_update_date']}")
    print(f"저장된 통화 수: {summary['total_currencies']}")
    print(f"API 설정 여부: {'예' if summary['api_configured'] else '아니오'}")
    
    # API 테스트 (API 키가 있는 경우)
    if api_key:
        print("\n[6단계] 한국수출입은행 API 테스트")
        print("-" * 80)
        
        try:
            print("API에서 환율 조회 중...")
            count = converter.update_rates_from_api(target_date=today, currencies=["USD"])
            print(f"✓ {count}개 환율 업데이트 완료")
            
            # 업데이트된 환율 확인
            updated_rate = converter.get_exchange_rate(target_date=today)
            if updated_rate and updated_rate.source == "api":
                print(f"\nAPI 조회 환율: 1 USD = {updated_rate.rate:,.2f} KRW")
                print(f"  통화명: {updated_rate.currency_name}")
        
        except Exception as e:
            print(f"❌ API 테스트 실패: {e}")
    else:
        print("\n[6단계] API 테스트 건너뛰기")
        print("-" * 80)
        print("⚠️  API 키가 설정되지 않았습니다.")
        print("   한국수출입은행에서 API 키를 발급받으세요:")
        print("   https://www.koreaexim.go.kr/ir/HPHKIR020M01")
    
    print("\n" + "=" * 80)
    print("✓ 환율 기능 테스트 완료!")
    print("=" * 80)


if __name__ == '__main__':
    test_exchange_rate_features()
