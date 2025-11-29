"""
비용 데이터 변환기에 환율 기능 통합
"""
import pandas as pd
from typing import List, Optional
from datetime import date

from src.models.standard_data import StandardCostData
from src.converters.data_converter import DataConverter
from src.exchange.currency_converter import CurrencyConverter


class CostDataConverterWithCurrency(DataConverter):
    """환율 변환 기능이 통합된 비용 데이터 변환기"""
    
    def __init__(self, api_key: Optional[str] = None, auto_fetch: bool = True):
        """
        Args:
            api_key: 한국수출입은행 API 키
            auto_fetch: 환율 자동 조회 여부
        """
        super().__init__()
        self.currency_converter = CurrencyConverter(api_key=api_key, auto_fetch=auto_fetch)
    
    def to_dataframe_with_krw(
        self, 
        standard_data_list: List[StandardCostData]
    ) -> pd.DataFrame:
        """
        표준 데이터를 DataFrame으로 변환 (KRW 컬럼 추가)
        
        Args:
            standard_data_list: 표준 데이터 리스트
            
        Returns:
            pd.DataFrame: KRW 환산 금액이 포함된 데이터프레임
        """
        # 기본 DataFrame 생성
        df = self.to_dataframe(standard_data_list)
        
        # KRW 변환 결과 추가
        converted_results = self.currency_converter.convert_cost_data_list(
            standard_data_list, 
            to_currency="KRW"
        )
        
        krw_costs = []
        exchange_rates = []
        exchange_dates = []
        
        for _, converted in converted_results:
            if converted:
                krw_costs.append(converted.converted_cost)
                exchange_rates.append(converted.exchange_rate)
                exchange_dates.append(converted.rate_date)
            else:
                krw_costs.append(None)
                exchange_rates.append(None)
                exchange_dates.append(None)
        
        df['cost_krw'] = krw_costs
        df['exchange_rate'] = exchange_rates
        df['exchange_date'] = exchange_dates
        
        return df
    
    def export_to_csv_with_krw(
        self,
        standard_data_list: List[StandardCostData],
        output_path: str,
        include_raw_data: bool = False
    ):
        """
        KRW 환산 금액을 포함하여 CSV로 저장
        
        Args:
            standard_data_list: 표준 데이터 리스트
            output_path: 저장할 파일 경로
            include_raw_data: 원본 데이터 포함 여부
        """
        df = self.to_dataframe_with_krw(standard_data_list)
        
        if not include_raw_data and 'raw_data' in df.columns:
            df = df.drop(columns=['raw_data'])
        
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    def export_to_excel_with_krw(
        self,
        standard_data_list: List[StandardCostData],
        output_path: str,
        sheet_name: str = '비용데이터'
    ):
        """
        KRW 환산 금액을 포함하여 Excel로 저장
        
        Args:
            standard_data_list: 표준 데이터 리스트
            output_path: 저장할 파일 경로
            sheet_name: 시트 이름
        """
        df = self.to_dataframe_with_krw(standard_data_list)
        
        # raw_data 컬럼 제거
        if 'raw_data' in df.columns:
            df = df.drop(columns=['raw_data'])
        
        df.to_excel(output_path, sheet_name=sheet_name, index=False, engine='openpyxl')
    
    def get_summary_stats_with_krw(
        self, 
        standard_data_list: List[StandardCostData]
    ) -> dict:
        """
        KRW 환산 금액을 포함한 요약 통계
        
        Args:
            standard_data_list: 표준 데이터 리스트
            
        Returns:
            dict: 요약 통계 정보
        """
        # 기본 요약 정보
        summary = self.get_summary_stats(standard_data_list)
        
        # KRW 변환
        df = self.to_dataframe_with_krw(standard_data_list)
        
        if 'cost_krw' in df.columns and df['cost_krw'].notna().any():
            summary['total_cost_krw'] = df['cost_krw'].sum()
            summary['cost_by_service_krw'] = df.groupby('service_name')['cost_krw'].sum().to_dict()
            
            # 환율 정보
            if 'exchange_rate' in df.columns:
                avg_rate = df['exchange_rate'].mean()
                summary['average_exchange_rate'] = avg_rate
        
        return summary
    
    def add_manual_exchange_rate(
        self,
        rate: float,
        target_date: Optional[date] = None
    ):
        """
        수동으로 환율 추가
        
        Args:
            rate: 환율 값
            target_date: 환율 기준일
        """
        return self.currency_converter.add_manual_rate(
            rate_value=rate,
            target_date=target_date
        )
    
    def update_exchange_rates(self, target_date: Optional[date] = None) -> int:
        """
        API에서 환율 업데이트
        
        Args:
            target_date: 조회 날짜
            
        Returns:
            int: 업데이트된 환율 개수
        """
        return self.currency_converter.update_rates_from_api(
            target_date=target_date,
            currencies=["USD"]  # USD만 업데이트
        )
