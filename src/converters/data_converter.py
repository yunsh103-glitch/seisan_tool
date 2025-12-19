"""
데이터 변환기 - 클라우드체커 형식을 표준 형식으로 변환
"""
import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime

from src.models.standard_data import StandardCostData
from src.parsers.cloudchecker_parser import CloudCheckerParser


class DataConverter:
    """클라우드체커 데이터를 표준 형식으로 변환하는 클래스"""
    
    def __init__(self):
        self.parser = CloudCheckerParser()
    
    def convert_row_to_standard(self, row: pd.Series) -> Optional[StandardCostData]:
        """
        DataFrame의 한 행을 표준 데이터 모델로 변환
        
        Args:
            row: 데이터프레임 행
            
        Returns:
            StandardCostData: 변환된 표준 데이터 또는 None (변환 실패시)
        """
        try:
            # 날짜 파싱 - 날짜가 유효하지 않으면 이 행은 건너뜀 (집계 섹션 등)
            date_value = None
            if 'date' in row.index:
                date_value = self.parser.parse_date(row['date'])
            
            if not date_value:
                # 날짜가 없거나 파싱 실패하면 이 행은 건너뜀 (집계 섹션일 가능성)
                return None
            
            # 비용 정리
            cost = 0.0
            if 'cost' in row.index:
                cost = self.parser.clean_cost_value(row['cost'])
            
            # 태그 추출
            tags = self.parser.extract_tags_from_columns(row)
            
            # environment 정규화 (파서에서 이미 처리되지만 이중 확인)
            environment = tags.get('environment')
            if not environment or (isinstance(environment, str) and environment.strip() == ''):
                environment = 'cielmobility'
            elif environment in ['dev-smartmobility', 'prd-smartmobility']:
                environment = 'smartmobility'
            
            # Description에서 리전 정보 추출
            region = row.get('region') if not pd.isna(row.get('region')) else None
            if not region and 'description' in row.index:
                region = self.parser.extract_region_from_description(row['description'])
            
            # 표준 데이터 생성
            standard_data = StandardCostData(
                date=date_value,
                account_id=str(row.get('account_id', 'unknown')),
                account_name=row.get('account_name') if not pd.isna(row.get('account_name')) else None,
                service_name=str(row.get('service_name', 'Unknown')),
                description=row.get('description') if not pd.isna(row.get('description')) else None,
                resource_id=row.get('resource_id') if not pd.isna(row.get('resource_id')) else None,
                region=region,
                cost=cost,
                currency='USD',
                department=tags.get('department'),
                project=tags.get('project'),
                environment=environment,
                cost_center=tags.get('cost_center'),
                usage_type=row.get('usage_type') if not pd.isna(row.get('usage_type')) else None,
                usage_amount=float(row.get('usage_amount', 0)) if not pd.isna(row.get('usage_amount')) else None,
                usage_unit=row.get('usage_unit') if not pd.isna(row.get('usage_unit')) else None,
                raw_data=row.to_dict()  # 원본 데이터 보관
            )
            
            return standard_data
        
        except Exception as e:
            print(f"행 변환 실패: {str(e)}")
            print(f"문제 행: {row.to_dict()}")
            return None
    
    def convert_dataframe(self, df: pd.DataFrame) -> List[StandardCostData]:
        """
        전체 DataFrame을 표준 데이터 리스트로 변환
        
        Args:
            df: 원본 데이터프레임
            
        Returns:
            List[StandardCostData]: 변환된 표준 데이터 리스트
        """
        # 컬럼 정규화
        normalized_df = self.parser.normalize_columns(df)
        
        # 각 행을 표준 데이터로 변환
        standard_data_list = []
        
        for idx, row in normalized_df.iterrows():
            standard_data = self.convert_row_to_standard(row)
            if standard_data:
                standard_data_list.append(standard_data)
        
        return standard_data_list
    
    def convert_csv_file(self, file_path: str) -> List[StandardCostData]:
        """
        CSV 파일을 직접 읽어서 표준 데이터로 변환
        
        Args:
            file_path: CSV 파일 경로
            
        Returns:
            List[StandardCostData]: 변환된 표준 데이터 리스트
        """
        # CSV 파일 읽기
        df = self.parser.parse_csv(file_path)
        
        # 필수 컬럼 검증
        is_valid, missing_columns = self.parser.validate_required_columns(df)
        if not is_valid:
            raise ValueError(f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}")
        
        # 변환
        return self.convert_dataframe(df)
    
    def to_dataframe(self, standard_data_list: List[StandardCostData]) -> pd.DataFrame:
        """
        표준 데이터 리스트를 DataFrame으로 변환
        
        Args:
            standard_data_list: 표준 데이터 리스트
            
        Returns:
            pd.DataFrame: 변환된 데이터프레임
        """
        data_dicts = [data.model_dump(exclude={'raw_data'}) for data in standard_data_list]
        return pd.DataFrame(data_dicts)
    
    def to_json(self, standard_data_list: List[StandardCostData]) -> List[Dict]:
        """
        표준 데이터 리스트를 JSON 형식으로 변환
        
        Args:
            standard_data_list: 표준 데이터 리스트
            
        Returns:
            List[Dict]: JSON 형식 데이터
        """
        return [data.model_dump(exclude={'raw_data'}) for data in standard_data_list]
    
    def export_to_csv(
        self, 
        standard_data_list: List[StandardCostData], 
        output_path: str,
        include_raw_data: bool = False
    ):
        """
        표준 데이터를 CSV 파일로 저장
        
        Args:
            standard_data_list: 표준 데이터 리스트
            output_path: 저장할 파일 경로
            include_raw_data: 원본 데이터 포함 여부
        """
        exclude_fields = set() if include_raw_data else {'raw_data'}
        data_dicts = [data.model_dump(exclude=exclude_fields) for data in standard_data_list]
        df = pd.DataFrame(data_dicts)
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    def export_to_excel(
        self,
        standard_data_list: List[StandardCostData],
        output_path: str,
        sheet_name: str = '비용데이터'
    ):
        """
        표준 데이터를 Excel 파일로 저장
        
        Args:
            standard_data_list: 표준 데이터 리스트
            output_path: 저장할 파일 경로
            sheet_name: 시트 이름
        """
        df = self.to_dataframe(standard_data_list)
        df.to_excel(output_path, sheet_name=sheet_name, index=False, engine='openpyxl')
    
    def get_summary_stats(self, standard_data_list: List[StandardCostData]) -> Dict:
        """
        변환된 데이터의 요약 통계
        
        Args:
            standard_data_list: 표준 데이터 리스트
            
        Returns:
            Dict: 요약 통계 정보
        """
        if not standard_data_list:
            return {
                'total_records': 0,
                'total_cost': 0,
                'date_range': None,
                'unique_accounts': 0,
                'unique_services': 0,
            }
        
        df = self.to_dataframe(standard_data_list)
        
        return {
            'total_records': len(standard_data_list),
            'total_cost': df['cost'].sum(),
            'date_range': {
                'start': df['date'].min(),
                'end': df['date'].max()
            },
            'unique_accounts': df['account_id'].nunique(),
            'unique_services': df['service_name'].nunique(),
            'services': df['service_name'].value_counts().to_dict(),
            'cost_by_service': df.groupby('service_name')['cost'].sum().to_dict(),
        }
