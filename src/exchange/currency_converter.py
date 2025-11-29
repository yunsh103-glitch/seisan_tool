"""
환율 계산 엔진
"""
from datetime import date
from typing import Optional, List
from src.models.exchange_rate import ExchangeRate, ConvertedCost
from src.models.standard_data import StandardCostData
from src.exchange.api_client import KoreaEximAPI
from src.exchange.rate_manager import ExchangeRateManager


class CurrencyConverter:
    """통화 변환 엔진"""
    
    def __init__(
        self, 
        api_key: Optional[str] = None,
        db_path: str = "data/exchange_rates.db",
        auto_fetch: bool = True
    ):
        """
        Args:
            api_key: 한국수출입은행 API 키
            db_path: 환율 DB 경로
            auto_fetch: 환율이 없을 때 자동으로 API 조회 여부
        """
        self.api_client = KoreaEximAPI(api_key) if api_key else None
        self.rate_manager = ExchangeRateManager(db_path)
        self.auto_fetch = auto_fetch
    
    def get_exchange_rate(
        self,
        base_currency: str = "USD",
        target_currency: str = "KRW",
        target_date: Optional[date] = None
    ) -> Optional[ExchangeRate]:
        """
        환율 조회 (DB 우선, 없으면 API)
        
        Args:
            base_currency: 기준 통화
            target_currency: 대상 통화
            target_date: 조회 날짜
            
        Returns:
            ExchangeRate: 환율 정보
        """
        # 1. DB에서 조회
        rate = self.rate_manager.get_rate(base_currency, target_currency, target_date)
        
        # 2. DB에 없고 auto_fetch가 활성화되어 있으면 API 조회
        if not rate and self.auto_fetch and self.api_client:
            try:
                rate = self.api_client.get_exchange_rates(target_date, base_currency)
                if rate:
                    # DB에 저장
                    self.rate_manager.save_rate(rate)
            except Exception as e:
                print(f"API 조회 실패: {e}")
        
        return rate
    
    def convert_cost(
        self,
        amount: float,
        from_currency: str = "USD",
        to_currency: str = "KRW",
        target_date: Optional[date] = None
    ) -> ConvertedCost:
        """
        비용 변환
        
        Args:
            amount: 변환할 금액
            from_currency: 원본 통화
            to_currency: 대상 통화
            target_date: 환율 기준일
            
        Returns:
            ConvertedCost: 변환된 비용 정보
        """
        # 같은 통화면 그대로 반환
        if from_currency == to_currency:
            return ConvertedCost(
                original_cost=amount,
                original_currency=from_currency,
                converted_cost=amount,
                converted_currency=to_currency,
                exchange_rate=1.0,
                rate_date=target_date or date.today()
            )
        
        # 환율 조회
        rate = self.get_exchange_rate(from_currency, to_currency, target_date)
        
        if not rate:
            raise ValueError(
                f"{from_currency} → {to_currency} 환율 정보를 찾을 수 없습니다. "
                f"날짜: {target_date or '최신'}"
            )
        
        # 변환 계산
        converted_amount = amount * rate.rate
        
        return ConvertedCost(
            original_cost=amount,
            original_currency=from_currency,
            converted_cost=converted_amount,
            converted_currency=to_currency,
            exchange_rate=rate.rate,
            rate_date=rate.rate_date
        )
    
    def convert_cost_data(
        self,
        cost_data: StandardCostData,
        to_currency: str = "KRW"
    ) -> tuple[StandardCostData, ConvertedCost]:
        """
        StandardCostData의 비용을 변환
        
        Args:
            cost_data: 비용 데이터
            to_currency: 대상 통화
            
        Returns:
            tuple: (원본 데이터, 변환 정보)
        """
        # 비용 데이터의 날짜가 아닌 최신 환율 사용 (None = 가장 최근 환율)
        target_date = None
        
        converted = self.convert_cost(
            amount=cost_data.cost,
            from_currency=cost_data.currency,
            to_currency=to_currency,
            target_date=target_date
        )
        
        return cost_data, converted
    
    def convert_cost_data_list(
        self,
        cost_data_list: List[StandardCostData],
        to_currency: str = "KRW"
    ) -> List[tuple[StandardCostData, ConvertedCost]]:
        """
        여러 비용 데이터를 일괄 변환
        
        Args:
            cost_data_list: 비용 데이터 리스트
            to_currency: 대상 통화
            
        Returns:
            List[tuple]: (원본 데이터, 변환 정보) 리스트
        """
        results = []
        for cost_data in cost_data_list:
            try:
                result = self.convert_cost_data(cost_data, to_currency)
                results.append(result)
            except ValueError as e:
                print(f"변환 실패 ({cost_data.date}): {e}")
                # 실패한 경우에도 원본 데이터는 포함 (변환 정보는 None)
                results.append((cost_data, None))
        
        return results
    
    def add_manual_rate(
        self,
        rate_value: float,
        base_currency: str = "USD",
        target_currency: str = "KRW",
        target_date: Optional[date] = None
    ) -> ExchangeRate:
        """
        수동으로 환율 추가
        
        Args:
            rate_value: 환율 값
            base_currency: 기준 통화
            target_currency: 대상 통화
            target_date: 환율 기준일
            
        Returns:
            ExchangeRate: 저장된 환율 정보
        """
        if target_date is None:
            target_date = date.today()
        
        rate = ExchangeRate(
            base_currency=base_currency,
            target_currency=target_currency,
            rate=rate_value,
            rate_date=target_date,
            source="manual"
        )
        
        self.rate_manager.save_rate(rate)
        return rate
    
    def update_rates_from_api(
        self,
        target_date: Optional[date] = None,
        currencies: Optional[List[str]] = None
    ) -> int:
        """
        API에서 환율 정보를 가져와서 DB 업데이트
        
        Args:
            target_date: 조회 날짜
            currencies: 조회할 통화 리스트 (None이면 모두)
            
        Returns:
            int: 업데이트된 환율 개수
        """
        if not self.api_client:
            raise ValueError("API 클라이언트가 설정되지 않았습니다.")
        
        if target_date is None:
            target_date = date.today()
        
        # 특정 통화만 조회
        if currencies:
            count = 0
            for currency in currencies:
                try:
                    rate = self.api_client.get_exchange_rates(target_date, currency)
                    if rate:
                        self.rate_manager.save_rate(rate)
                        count += 1
                except Exception as e:
                    print(f"{currency} 조회 실패: {e}")
            return count
        
        # 모든 환율 조회
        else:
            try:
                rates = self.api_client.get_all_exchange_rates(target_date)
                return self.rate_manager.save_rates(rates)
            except Exception as e:
                print(f"환율 조회 실패: {e}")
                return 0
    
    def get_rate_summary(self) -> dict:
        """
        환율 데이터 요약 정보
        
        Returns:
            dict: 요약 정보
        """
        latest_usd_krw = self.rate_manager.get_rate("USD", "KRW")
        latest_date = self.rate_manager.get_latest_update_date("USD", "KRW")
        all_currencies = self.rate_manager.get_all_currencies()
        
        return {
            "latest_usd_krw_rate": latest_usd_krw.rate if latest_usd_krw else None,
            "latest_update_date": latest_date,
            "total_currencies": len(all_currencies),
            "available_currencies": all_currencies,
            "api_configured": self.api_client is not None and self.api_client.api_key is not None
        }
