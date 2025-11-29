"""
서울외국환중개(SMBS) 환율 API 클라이언트
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
from typing import Optional
import re
from ..models.exchange_rate import ExchangeRate


class SMBSClient:
    """서울외국환중개 환율 조회 클라이언트"""
    
    BASE_URL = "http://www.smbs.biz/ExRate/StdExRate.jsp"
    
    def __init__(self):
        """SMBS 클라이언트 초기화"""
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def get_exchange_rate(self, target_date: Optional[date] = None, currency: str = "USD") -> Optional[ExchangeRate]:
        """
        특정 날짜의 환율 조회
        
        Args:
            target_date: 조회할 날짜 (None이면 최신 환율)
            currency: 통화 코드 (기본값: USD)
            
        Returns:
            ExchangeRate: 환율 정보 또는 None
        """
        if target_date is None:
            target_date = date.today()
        
        try:
            print(f"[SMBS] 환율 조회 시작: {target_date}, {currency}")
            
            # 페이지 요청
            response = self.session.get(self.BASE_URL, timeout=10)
            response.encoding = 'euc-kr'  # SMBS 사이트 인코딩
            
            if response.status_code != 200:
                print(f"[SMBS] HTTP 오류: {response.status_code}")
                return None
            
            print(f"[SMBS] 페이지 조회 성공")
            
            # HTML 파싱
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 모든 테이블 행에서 데이터 찾기
            all_rows = soup.find_all('tr')
            print(f"[SMBS] 총 {len(all_rows)}개 행 발견")
            
            best_match = None
            best_date = None
            found_count = 0
            
            for row in all_rows:
                cols = row.find_all('td')
                
                # 최소 3개 컬럼 (날짜, 통화, 환율)
                if len(cols) >= 3:
                    date_text = cols[0].get_text(strip=True)
                    currency_text = cols[1].get_text(strip=True)
                    rate_text = cols[2].get_text(strip=True)
                    
                    # 날짜 파싱 시도
                    row_date = None
                    for date_format in ['%Y.%m.%d', '%Y-%m-%d', '%Y/%m/%d']:
                        try:
                            row_date = datetime.strptime(date_text, date_format).date()
                            break
                        except ValueError:
                            continue
                    
                    if not row_date:
                        continue
                    
                    # 통화 확인 (USD 또는 미국 달러)
                    if not (currency.upper() in currency_text.upper() or '달러' in currency_text):
                        continue
                    
                    # 환율 파싱
                    rate = self._parse_rate(rate_text)
                    if not rate or rate <= 0:
                        continue
                    
                    found_count += 1
                    print(f"[SMBS] 발견: {row_date} - {rate}")
                    
                    # 정확한 날짜 매칭
                    if row_date == target_date:
                        print(f"[SMBS] 정확한 날짜 매칭: {row_date} - {rate}")
                        return ExchangeRate(
                            rate_date=row_date,
                            currency_code=currency.upper(),
                            currency_name=currency_text,
                            rate=rate,
                            source='SMBS'
                        )
                    
                    # 가장 가까운 과거 날짜 저장 (target_date보다 이전)
                    if row_date <= target_date:
                        if best_date is None or row_date > best_date:
                            best_date = row_date
                            best_match = ExchangeRate(
                                rate_date=row_date,
                                currency_code=currency.upper(),
                                currency_name=currency_text,
                                rate=rate,
                                source='SMBS'
                            )
            
            print(f"[SMBS] 총 {found_count}개 환율 데이터 발견")
            
            # 정확한 날짜를 못 찾았지만 가장 가까운 과거 날짜가 있으면 반환
            if best_match:
                print(f"[SMBS] 가장 가까운 날짜 사용: {best_match.rate_date} - {best_match.rate}")
                return best_match
            
            print(f"[SMBS] 과거 날짜 없음, 최신 환율 조회 시도")
            # 그래도 없으면 가장 최recent 환율 반환
            return self._get_latest_rate(soup, currency)
        
        except Exception as e:
            print(f"[SMBS] 환율 조회 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def _get_latest_rate(self, soup: BeautifulSoup, currency: str = "USD") -> Optional[ExchangeRate]:
        """
        가장 최근 환율 조회
        
        Args:
            soup: BeautifulSoup 객체
            currency: 통화 코드
            
        Returns:
            ExchangeRate: 환율 정보 또는 None
        """
        latest_date = None
        latest_rate = None
        latest_currency_name = None
        
        all_rows = soup.find_all('tr')
        
        for row in all_rows:
            cols = row.find_all('td')
            
            if len(cols) >= 3:
                date_text = cols[0].get_text(strip=True)
                currency_text = cols[1].get_text(strip=True)
                rate_text = cols[2].get_text(strip=True)
                
                # 날짜 파싱 시도
                row_date = None
                for date_format in ['%Y.%m.%d', '%Y-%m-%d', '%Y/%m/%d']:
                    try:
                        row_date = datetime.strptime(date_text, date_format).date()
                        break
                    except ValueError:
                        continue
                
                if not row_date:
                    continue
                
                # 통화 확인 (USD 또는 미국 달러)
                if not (currency.upper() in currency_text.upper() or '달러' in currency_text):
                    continue
                
                # 환율 파싱
                rate = self._parse_rate(rate_text)
                if not rate or rate <= 0:
                    continue
                
                # 가장 최근 날짜 찾기
                if latest_date is None or row_date > latest_date:
                    latest_date = row_date
                    latest_rate = rate
                    latest_currency_name = currency_text
        
        if latest_date and latest_rate:
            return ExchangeRate(
                rate_date=latest_date,
                currency_code=currency.upper(),
                currency_name=latest_currency_name,
                rate=latest_rate,
                source='SMBS'
            )
        
        return None
    
    def _parse_rate(self, rate_text: str) -> Optional[float]:
        """
        환율 텍스트를 숫자로 변환
        
        Args:
            rate_text: 환율 텍스트 (예: "1,473.50")
            
        Returns:
            float: 환율 또는 None
        """
        try:
            # 쉼표 제거 및 숫자 추출
            rate_str = re.sub(r'[^\d.]', '', rate_text)
            return float(rate_str)
        except (ValueError, TypeError):
            return None
    
    def get_exchange_rates_range(self, 
                                  start_date: date, 
                                  end_date: date, 
                                  currency: str = "USD") -> list[ExchangeRate]:
        """
        기간별 환율 조회
        
        Args:
            start_date: 시작 날짜
            end_date: 종료 날짜
            currency: 통화 코드
            
        Returns:
            list[ExchangeRate]: 환율 목록
        """
        try:
            response = self.session.get(self.BASE_URL, timeout=10)
            response.encoding = 'euc-kr'
            
            if response.status_code != 200:
                return []
            
            soup = BeautifulSoup(response.text, 'html.parser')
            rates = []
            
            tables = soup.find_all('table')
            
            for table in tables:
                rows = table.find_all('tr')
                
                for row in rows:
                    cols = row.find_all('td')
                    
                    if len(cols) >= 3:
                        date_text = cols[0].get_text(strip=True)
                        currency_text = cols[1].get_text(strip=True)
                        rate_text = cols[2].get_text(strip=True)
                        
                        # 날짜 파싱
                        try:
                            row_date = datetime.strptime(date_text, '%Y.%m.%d').date()
                        except ValueError:
                            continue
                        
                        # 날짜 범위 확인
                        if not (start_date <= row_date <= end_date):
                            continue
                        
                        # 통화 확인
                        if currency.upper() not in currency_text.upper():
                            continue
                        
                        # 환율 파싱
                        rate = self._parse_rate(rate_text)
                        
                        if rate:
                            rates.append(ExchangeRate(
                                rate_date=row_date,
                                currency_code=currency.upper(),
                                currency_name=currency_text,
                                rate=rate,
                                source='SMBS'
                            ))
            
            return sorted(rates, key=lambda x: x.rate_date)
        
        except Exception as e:
            print(f"기간별 환율 조회 실패: {str(e)}")
            return []
