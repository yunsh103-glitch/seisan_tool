"""
한국수출입은행 환율 API 클라이언트
"""
import requests
from datetime import datetime, date
from typing import Optional, List, Dict
from src.models.exchange_rate import ExchangeRate
import logging

logger = logging.getLogger(__name__)


class KoreaEximAPI:
    """한국수출입은행 환율 API 클라이언트"""
    
    BASE_URL = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: 한국수출입은행 API 키 (https://www.koreaexim.go.kr/ir/HPHKIR020M01 에서 발급)
        """
        self.api_key = api_key
    
    def get_exchange_rates(
        self, 
        search_date: Optional[date] = None,
        currency_code: str = "USD"
    ) -> Optional[ExchangeRate]:
        """
        특정 날짜의 환율 조회
        
        Args:
            search_date: 조회할 날짜 (None이면 오늘)
            currency_code: 통화 코드 (USD, EUR, JPY 등)
            
        Returns:
            ExchangeRate: 환율 정보 또는 None
        """
        if not self.api_key:
            raise ValueError("API 키가 설정되지 않았습니다. KoreaEximAPI(api_key='your_key')로 초기화하세요.")
        
        # 날짜 포맷팅
        if search_date is None:
            search_date = date.today()
        
        date_str = search_date.strftime("%Y%m%d")
        
        # API 요청
        params = {
            "authkey": self.api_key,
            "searchdate": date_str,
            "data": "AP01"  # 환율 데이터
        }
        
        logger.info(f"환율 API 요청: {date_str}, 통화: {currency_code}")
        logger.debug(f"API URL: {self.BASE_URL}?authkey=***&searchdate={date_str}&data=AP01")
        
        try:
            response = requests.get(self.BASE_URL, params=params, timeout=10)
            logger.info(f"API 응답 상태 코드: {response.status_code}")
            response.raise_for_status()
            
            data = response.json()
            logger.debug(f"API 응답 데이터 타입: {type(data)}, 길이: {len(data) if isinstance(data, list) else 'N/A'}")
            
            # 오류 응답 체크
            if isinstance(data, dict) and "error" in data:
                raise ValueError(f"API 오류: {data.get('error', 'Unknown error')}")
            
            # 해당 통화 찾기
            for item in data:
                if item.get("cur_unit") == currency_code:
                    # 환율 파싱 (쉼표 제거)
                    rate_str = item.get("deal_bas_r", "0").replace(",", "")
                    rate = float(rate_str)
                    
                    return ExchangeRate(
                        base_currency=currency_code,
                        target_currency="KRW",
                        rate=rate,
                        rate_date=search_date,
                        source="api",
                        currency_code=item.get("cur_unit"),
                        currency_name=item.get("cur_nm")
                    )
            
            # 해당 통화를 찾지 못함
            return None
        
        except requests.Timeout as e:
            logger.error(f"API 타임아웃: {str(e)}")
            raise ConnectionError(f"API 서버 응답 시간 초과: {str(e)}")
        except requests.ConnectionError as e:
            logger.error(f"API 연결 오류: {str(e)}")
            raise ConnectionError(f"API 서버 연결 실패: {str(e)}")
        except requests.HTTPError as e:
            logger.error(f"API HTTP 오류: {str(e)}, 응답: {response.text if 'response' in locals() else 'N/A'}")
            raise ConnectionError(f"API 서버 오류 (HTTP {response.status_code}): {str(e)}")
        except requests.RequestException as e:
            logger.error(f"API 요청 실패: {str(e)}")
            raise ConnectionError(f"API 요청 실패: {str(e)}")
        except (ValueError, KeyError) as e:
            logger.error(f"API 응답 파싱 실패: {str(e)}")
            raise ValueError(f"API 응답 파싱 실패: {str(e)}")
    
    def get_all_exchange_rates(self, search_date: Optional[date] = None) -> List[ExchangeRate]:
        """
        특정 날짜의 모든 환율 조회
        
        Args:
            search_date: 조회할 날짜 (None이면 오늘)
            
        Returns:
            List[ExchangeRate]: 환율 정보 리스트
        """
        if not self.api_key:
            raise ValueError("API 키가 설정되지 않았습니다.")
        
        if search_date is None:
            search_date = date.today()
        
        date_str = search_date.strftime("%Y%m%d")
        
        params = {
            "authkey": self.api_key,
            "searchdate": date_str,
            "data": "AP01"
        }
        
        try:
            response = requests.get(self.BASE_URL, params=params, timeout=30, verify=False)
            response.raise_for_status()
            
            data = response.json()
            
            if isinstance(data, dict) and "error" in data:
                raise ValueError(f"API 오류: {data.get('error', 'Unknown error')}")
            
            rates = []
            for item in data:
                try:
                    rate_str = item.get("deal_bas_r", "0").replace(",", "")
                    rate = float(rate_str)
                    
                    rates.append(ExchangeRate(
                        base_currency=item.get("cur_unit"),
                        target_currency="KRW",
                        rate=rate,
                        rate_date=search_date,
                        source="api",
                        currency_code=item.get("cur_unit"),
                        currency_name=item.get("cur_nm")
                    ))
                except (ValueError, KeyError):
                    continue
            
            return rates
        
        except requests.RequestException as e:
            raise ConnectionError(f"API 요청 실패: {str(e)}")
    
    def test_connection(self) -> bool:
        """
        API 연결 테스트
        
        Returns:
            bool: 연결 성공 여부
        """
        try:
            self.get_exchange_rates()
            return True
        except Exception:
            return False
