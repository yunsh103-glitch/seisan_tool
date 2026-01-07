"""
표준 데이터 모델 정의
클라우드체커 CSV를 변환할 표준 형식
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class StandardCostData(BaseModel):
    """표준 비용 데이터 모델"""
    
    # 기본 정보
    date: datetime = Field(description="사용 날짜")
    account_id: Optional[str] = Field(default="unknown", description="AWS 계정 ID")
    account_name: Optional[str] = Field(default=None, description="계정 이름")
    
    # 서비스 정보
    service_name: str = Field(description="AWS 서비스 이름 (예: EC2, S3)")
    description: Optional[str] = Field(default=None, description="서비스 상세 설명")
    resource_id: Optional[str] = Field(default=None, description="리소스 ID")
    region: Optional[str] = Field(default=None, description="리전")
    
    # 비용 정보
    cost: float = Field(description="비용 (USD)")
    currency: str = Field(default="USD", description="통화")
    
    # 태그 정보 (정산용)
    department: Optional[str] = Field(default=None, description="부서")
    project: Optional[str] = Field(default=None, description="프로젝트")
    environment: str = Field(default="cielmobility", description="환경 (dev/staging/prod)")
    original_environment: Optional[str] = Field(default=None, description="정규화 전 원본 환경값")
    cost_center: Optional[str] = Field(default=None, description="코스트 센터")
    
    # 추가 메타데이터
    usage_type: Optional[str] = Field(default=None, description="사용 유형")
    usage_amount: Optional[float] = Field(default=None, description="사용량")
    usage_unit: Optional[str] = Field(default=None, description="사용량 단위")
    
    # 원본 데이터 참조
    raw_data: Optional[dict] = Field(default=None, description="원본 데이터 (디버깅용)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "date": "2025-11-19T00:00:00",
                "account_id": "ciel",
                "account_name": "Ciel Account",
                "service_name": "EC2",
                "description": "On Demand RHEL c6i.2xlarge Instance Hour",
                "resource_id": None,
                "region": "ap-northeast-2",
                "cost": 23.96,
                "currency": "USD",
                "department": None,
                "project": "smartmobility",
                "environment": "prd-smartmobility",
                "cost_center": None,
                "usage_type": "On Demand RHEL c6i.2xlarge Instance Hour",
                "usage_amount": None,
                "usage_unit": "Hour"
            }
        }
