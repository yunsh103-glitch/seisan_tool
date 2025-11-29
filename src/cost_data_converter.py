"""
메인 변환 모듈
클라우드체커 CSV -> 표준 데이터 변환의 진입점
"""
from typing import List, Optional
import os

from src.models.standard_data import StandardCostData
from src.converters.data_converter import DataConverter
from src.parsers.cloudchecker_parser import CloudCheckerParser


class CostDataConverter:
    """
    비용 데이터 변환 메인 클래스
    
    사용 예시:
        converter = CostDataConverter()
        
        # CSV 파일 변환
        standard_data = converter.convert_file('cloudchecker_export.csv')
        
        # 요약 정보 확인
        summary = converter.get_summary()
        print(f"총 비용: ${summary['total_cost']:.2f}")
        
        # 표준 CSV로 저장
        converter.save_to_csv('standard_cost_data.csv')
    """
    
    def __init__(self):
        self.parser = CloudCheckerParser()
        self.converter = DataConverter()
        self.standard_data: Optional[List[StandardCostData]] = None
        self.source_file: Optional[str] = None
    
    def preview_file(self, file_path: str, rows: int = 10):
        """
        CSV 파일 미리보기
        
        Args:
            file_path: CSV 파일 경로
            rows: 표시할 행 수
            
        Returns:
            pd.DataFrame: 미리보기 데이터
        """
        return self.parser.get_preview(file_path, rows)
    
    def validate_file(self, file_path: str) -> tuple[bool, str]:
        """
        파일 유효성 검증
        
        Args:
            file_path: CSV 파일 경로
            
        Returns:
            tuple: (유효성 여부, 메시지)
        """
        # 파일 존재 확인
        if not os.path.exists(file_path):
            return False, f"파일을 찾을 수 없습니다: {file_path}"
        
        # 파일 확장자 확인
        if not file_path.lower().endswith('.csv'):
            return False, "CSV 파일만 지원됩니다"
        
        try:
            # CSV 파싱 시도
            df = self.parser.parse_csv(file_path)
            
            # 필수 컬럼 확인
            is_valid, missing_columns = self.parser.validate_required_columns(df)
            if not is_valid:
                return False, f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}"
            
            return True, "파일이 유효합니다"
        
        except Exception as e:
            return False, f"파일 검증 실패: {str(e)}"
    
    def convert_file(self, file_path: str) -> List[StandardCostData]:
        """
        CSV 파일을 표준 데이터로 변환
        
        Args:
            file_path: CSV 파일 경로
            
        Returns:
            List[StandardCostData]: 변환된 표준 데이터
        """
        # 유효성 검증
        is_valid, message = self.validate_file(file_path)
        if not is_valid:
            raise ValueError(message)
        
        # 변환 수행
        self.standard_data = self.converter.convert_csv_file(file_path)
        self.source_file = file_path
        
        return self.standard_data
    
    def get_summary(self) -> dict:
        """
        변환된 데이터의 요약 정보
        
        Returns:
            dict: 요약 통계
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다. 먼저 convert_file()을 실행하세요.")
        
        summary = self.converter.get_summary_stats(self.standard_data)
        summary['source_file'] = self.source_file
        
        return summary
    
    def save_to_csv(self, output_path: str, include_raw_data: bool = False):
        """
        표준 데이터를 CSV로 저장
        
        Args:
            output_path: 저장할 파일 경로
            include_raw_data: 원본 데이터 포함 여부
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다. 먼저 convert_file()을 실행하세요.")
        
        self.converter.export_to_csv(
            self.standard_data,
            output_path,
            include_raw_data=include_raw_data
        )
    
    def save_to_excel(self, output_path: str, sheet_name: str = '비용데이터'):
        """
        표준 데이터를 Excel로 저장
        
        Args:
            output_path: 저장할 파일 경로
            sheet_name: 시트 이름
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다. 먼저 convert_file()을 실행하세요.")
        
        self.converter.export_to_excel(
            self.standard_data,
            output_path,
            sheet_name=sheet_name
        )
    
    def get_data_as_dataframe(self):
        """
        표준 데이터를 DataFrame으로 반환
        
        Returns:
            pd.DataFrame: 데이터프레임
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다. 먼저 convert_file()을 실행하세요.")
        
        return self.converter.to_dataframe(self.standard_data)
    
    def get_data_as_json(self) -> list:
        """
        표준 데이터를 JSON으로 반환
        
        Returns:
            list: JSON 형식 데이터
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다. 먼저 convert_file()을 실행하세요.")
        
        return self.converter.to_json(self.standard_data)
    
    def filter_by_date_range(self, start_date: str, end_date: str):
        """
        날짜 범위로 데이터 필터링
        
        Args:
            start_date: 시작 날짜 (YYYY-MM-DD)
            end_date: 종료 날짜 (YYYY-MM-DD)
            
        Returns:
            List[StandardCostData]: 필터링된 데이터
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다.")
        
        from datetime import datetime
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        
        filtered = [
            data for data in self.standard_data
            if start <= data.date <= end
        ]
        
        return filtered
    
    def filter_by_service(self, service_name: str):
        """
        서비스명으로 데이터 필터링
        
        Args:
            service_name: AWS 서비스 이름
            
        Returns:
            List[StandardCostData]: 필터링된 데이터
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다.")
        
        filtered = [
            data for data in self.standard_data
            if data.service_name.lower() == service_name.lower()
        ]
        
        return filtered
    
    def filter_by_department(self, department: str):
        """
        부서별로 데이터 필터링
        
        Args:
            department: 부서명
            
        Returns:
            List[StandardCostData]: 필터링된 데이터
        """
        if not self.standard_data:
            raise ValueError("변환된 데이터가 없습니다.")
        
        filtered = [
            data for data in self.standard_data
            if data.department and data.department.lower() == department.lower()
        ]
        
        return filtered
