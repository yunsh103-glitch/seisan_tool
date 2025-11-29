"""
클라우드체커 CSV 파일 파서
"""
import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime
import re


class CloudCheckerParser:
    """클라우드체커 CSV 파일을 파싱하는 클래스"""
    
    # 클라우드체커 CSV의 컬럼 매핑 (실제 CSV 형식 기반)
    COLUMN_MAPPING = {
        # 날짜 관련
        'Date': 'date',
        'Usage Date': 'date',
        'UsageDate': 'date',
        
        # 계정 정보 (선택적)
        'Account': 'account_id',
        'Account ID': 'account_id',
        'AccountId': 'account_id',
        'Account Name': 'account_name',
        'AccountName': 'account_name',
        
        # 서비스 정보
        'Service': 'service_name',
        'Service Name': 'service_name',
        'Product Name': 'service_name',
        'ProductName': 'service_name',
        
        # 설명 (클라우드체커의 Description 컬럼)
        'Description': 'description',
        'Service Description': 'description',
        
        # 리소스 정보
        'Resource': 'resource_id',
        'Resource ID': 'resource_id',
        'ResourceId': 'resource_id',
        
        # 리전
        'Region': 'region',
        'AWS Region': 'region',
        
        # 비용
        'Cost': 'cost',
        'Total Cost': 'cost',
        'Unblended Cost': 'cost',
        'UnblendedCost': 'cost',
        'Blended Cost': 'cost',
        
        # 사용량
        'Usage Type': 'usage_type',
        'UsageType': 'usage_type',
        'Usage Amount': 'usage_amount',
        'UsageAmount': 'usage_amount',
        'Usage Quantity': 'usage_amount',
        'Unit': 'usage_unit',
        
        # 환경/태그 (클라우드체커의 Environment 컬럼)
        'Environment': 'environment',
        'Department': 'department',
        'Project': 'project',
        'Cost Center': 'cost_center',
        'CostCenter': 'cost_center',
    }
    
    def __init__(self, encoding: str = 'utf-8-sig', skip_footer_lines: int = 0):
        """
        Args:
            encoding: CSV 파일 인코딩 (기본값: utf-8-sig - BOM 처리)
            skip_footer_lines: 하단에서 건너뛸 줄 수
        """
        self.encoding = encoding
        self.skip_footer_lines = skip_footer_lines
    
    def parse_csv(self, file_path: str) -> pd.DataFrame:
        """
        CSV 파일을 읽어서 DataFrame으로 반환
        
        Args:
            file_path: CSV 파일 경로
            
        Returns:
            pd.DataFrame: 파싱된 데이터프레임
        """
        try:
            # CSV 파일을 텍스트로 먼저 읽어서 데이터 섹션만 추출
            with open(file_path, 'r', encoding=self.encoding) as f:
                lines = f.readlines()
            
            # 빈 줄이나 집계 섹션 시작 지점 찾기
            data_lines = []
            header_found = False
            
            for i, line in enumerate(lines):
                line_stripped = line.strip()
                
                # 빈 줄이거나 집계 섹션이면 중단
                if not line_stripped or any(keyword in line_stripped for keyword in 
                    ['Total,', 'Cost by Group,', 'Report for', 'Daily Max', 'Daily Min']):
                    break
                
                # 헤더 또는 데이터 라인
                data_lines.append(line)
                if not header_found and 'Date' in line:
                    header_found = True
            
            # 임시 파일에 데이터 섹션만 저장
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8') as tmp:
                tmp.writelines(data_lines)
                tmp_path = tmp.name
            
            try:
                # 정리된 CSV 읽기
                df = pd.read_csv(tmp_path, encoding='utf-8')
            finally:
                # 임시 파일 삭제
                import os
                os.unlink(tmp_path)
            
            # 컬럼명 정리 (공백 제거)
            df.columns = df.columns.str.strip()
            
            # 빈 행 제거
            df = df.dropna(how='all')
            
            # 마지막 컬럼이 비어있으면 제거 (trailing comma로 인한 빈 컬럼)
            if df.columns[-1] == '' or 'Unnamed' in str(df.columns[-1]):
                df = df.iloc[:, :-1]
            
            return df
        
        except Exception as e:
            raise ValueError(f"CSV 파일 읽기 실패: {str(e)}")
    
    def _remove_summary_sections(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        CSV 하단의 집계 섹션 제거
        
        Args:
            df: 원본 데이터프레임
            
        Returns:
            pd.DataFrame: 정리된 데이터프레임
        """
        # Date 컬럼이 없는 행부터 제거 (집계 섹션 시작점)
        if 'Date' in df.columns:
            # Date가 비어있거나 'Total', 'Cost by Group' 같은 텍스트가 있는 행 찾기
            valid_rows = df['Date'].notna()
            
            # 날짜 형식이 아닌 행 제거 (집계 섹션)
            for idx, val in df['Date'].items():
                if pd.notna(val):
                    val_str = str(val).strip()
                    # 집계 키워드 체크
                    if any(keyword in val_str for keyword in ['Total', 'Cost by Group', 'Report for', 'Daily']):
                        valid_rows[idx] = False
            
            df = df[valid_rows]
        
        return df
    
    def normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        컬럼명을 표준 형식으로 정규화
        
        Args:
            df: 원본 데이터프레임
            
        Returns:
            pd.DataFrame: 정규화된 데이터프레임
        """
        normalized_df = df.copy()
        
        # 컬럼명 매핑
        rename_dict = {}
        for col in normalized_df.columns:
            if col in self.COLUMN_MAPPING:
                rename_dict[col] = self.COLUMN_MAPPING[col]
        
        normalized_df.rename(columns=rename_dict, inplace=True)
        
        return normalized_df
    
    def parse_date(self, date_value) -> Optional[datetime]:
        """
        다양한 날짜 형식을 파싱
        
        Args:
            date_value: 날짜 값
            
        Returns:
            datetime: 파싱된 날짜 또는 None
        """
        if pd.isna(date_value):
            return None
        
        # 문자열로 변환
        date_str = str(date_value).strip()
        
        # 여러 날짜 형식 시도
        date_formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%m/%d/%Y',
            '%d/%m/%Y',
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        # pandas to_datetime으로 시도
        try:
            return pd.to_datetime(date_value)
        except:
            return None
    
    def clean_cost_value(self, cost_value) -> float:
        """
        비용 값 정리 (문자열에서 숫자 추출)
        
        Args:
            cost_value: 비용 값
            
        Returns:
            float: 정리된 비용
        """
        if pd.isna(cost_value):
            return 0.0
        
        # 문자열로 변환
        cost_str = str(cost_value).strip()
        
        # 통화 기호, 쉼표 제거
        cost_str = re.sub(r'[^\d.-]', '', cost_str)
        
        try:
            return float(cost_str)
        except ValueError:
            return 0.0
    
    def extract_region_from_description(self, description: str) -> Optional[str]:
        """
        Description 필드에서 리전 정보 추출
        
        Args:
            description: 서비스 설명
            
        Returns:
            str: 추출된 리전 또는 None
        """
        if not description or pd.isna(description):
            return None
        
        # 리전 패턴 매칭
        region_patterns = {
            'Asia Pacific (Seoul)': 'ap-northeast-2',
            'Asia Pacific (Tokyo)': 'ap-northeast-1',
            'Asia Pacific (Sydney)': 'ap-southeast-2',
            'US East (Northern Virginia)': 'us-east-1',
            'US East (Ohio)': 'us-east-2',
            'US East (Houston)': 'us-east-3',
            'US West (Oregon)': 'us-west-2',
            'US West (Northern California)': 'us-west-1',
            'EU (Germany)': 'eu-central-1',
            'EU (Ireland)': 'eu-west-1',
        }
        
        description_str = str(description)
        for pattern, region_code in region_patterns.items():
            if pattern in description_str:
                return region_code
        
        return None
    
    def extract_tags_from_columns(self, row: pd.Series) -> Dict[str, Optional[str]]:
        """
        행에서 태그 정보 추출
        
        Args:
            row: 데이터프레임 행
            
        Returns:
            dict: 태그 정보
        """
        tags = {}
        
        # 태그 컬럼들 검색
        tag_fields = ['department', 'project', 'environment', 'cost_center']
        
        for field in tag_fields:
            # 정확히 일치하는 컬럼
            if field in row.index:
                tags[field] = row[field] if not pd.isna(row[field]) else None
            # tag: 접두사가 있는 컬럼
            elif f'tag:{field}' in row.index:
                tags[field] = row[f'tag:{field}'] if not pd.isna(row[f'tag:{field}']) else None
            # user: 접두사가 있는 컬럼
            elif f'user:{field}' in row.index:
                tags[field] = row[f'user:{field}'] if not pd.isna(row[f'user:{field}']) else None
        
        # Environment 기본값 설정 (없으면 cielmobility)
        if not tags.get('environment'):
            tags['environment'] = 'cielmobility'
        
        # Environment에서 프로젝트명 추출 (예: prd-smartmobility -> smartmobility)
        if tags.get('environment'):
            env = tags['environment']
            # prd-, dev-, stg- 같은 접두사 제거하여 프로젝트명 추출
            if '-' in env:
                parts = env.split('-', 1)
                if len(parts) == 2 and not tags.get('project'):
                    tags['project'] = parts[1]
        
        return tags
    
    def get_preview(self, file_path: str, rows: int = 5) -> pd.DataFrame:
        """
        CSV 파일 미리보기
        
        Args:
            file_path: CSV 파일 경로
            rows: 표시할 행 수
            
        Returns:
            pd.DataFrame: 미리보기 데이터
        """
        df = self.parse_csv(file_path)
        return df.head(rows)
    
    def validate_required_columns(self, df: pd.DataFrame) -> tuple[bool, List[str]]:
        """
        필수 컬럼 존재 여부 확인
        
        Args:
            df: 데이터프레임
            
        Returns:
            tuple: (유효성 여부, 누락된 컬럼 목록)
        """
        normalized_df = self.normalize_columns(df)
        
        # 필수 컬럼 (클라우드체커 기준: Date, Service, Cost)
        required_columns = ['date', 'service_name', 'cost']
        
        missing_columns = []
        for col in required_columns:
            if col not in normalized_df.columns:
                missing_columns.append(col)
        
        return len(missing_columns) == 0, missing_columns
    
    def validate_data_integrity(self, df: pd.DataFrame) -> tuple[bool, List[str]]:
        """
        데이터 정합성 검증
        
        Args:
            df: 데이터프레임
            
        Returns:
            tuple: (유효성 여부, 오류 메시지 목록)
        """
        errors = []
        
        # 1. 빈 DataFrame 체크
        if df.empty:
            errors.append("데이터가 비어있습니다")
            return False, errors
        
        # 2. 날짜 형식 검증
        if 'date' in df.columns:
            invalid_dates = 0
            for idx, val in df['date'].items():
                if pd.notna(val) and not self.parse_date(val):
                    invalid_dates += 1
            if invalid_dates > 0:
                errors.append(f"잘못된 날짜 형식이 {invalid_dates}개 있습니다")
        
        # 3. 비용 필드 검증
        if 'cost' in df.columns:
            invalid_costs = df['cost'].isna().sum()
            if invalid_costs > 0:
                errors.append(f"비용 값이 없는 행이 {invalid_costs}개 있습니다")
            
            # 음수 비용 체크
            negative_costs = (df['cost'] < 0).sum()
            if negative_costs > 0:
                errors.append(f"음수 비용이 {negative_costs}개 있습니다")
        
        # 4. 서비스명 검증
        if 'service_name' in df.columns:
            empty_services = df['service_name'].isna().sum()
            if empty_services > 0:
                errors.append(f"서비스명이 없는 행이 {empty_services}개 있습니다")
        
        return len(errors) == 0, errors
