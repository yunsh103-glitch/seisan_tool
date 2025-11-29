"""
환율 데이터 모델
"""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class ExchangeRate(BaseModel):
    """환율 정보 모델"""
    
    # 기본 정보
    base_currency: str = Field(default="USD", description="기준 통화")
    target_currency: str = Field(default="KRW", description="대상 통화")
    
    # 환율 정보
    rate: float = Field(description="환율 (1 USD = ? KRW)")
    rate_date: date = Field(description="환율 기준일")
    
    # 메타 정보
    source: str = Field(description="데이터 출처 (api, manual)")
    created_at: datetime = Field(default_factory=datetime.now, description="생성 시각")
    
    # 한국수출입은행 API 추가 정보
    currency_code: Optional[str] = Field(default=None, description="통화 코드")
    currency_name: Optional[str] = Field(default=None, description="통화명")
    
    class Config:
        json_schema_extra = {
            "example": {
                "base_currency": "USD",
                "target_currency": "KRW",
                "rate": 1320.50,
                "rate_date": "2025-11-24",
                "source": "api",
                "currency_code": "USD",
                "currency_name": "미국 달러"
            }
        }


class ConvertedCost(BaseModel):
    """환율 변환된 비용 정보"""
    
    original_cost: float = Field(description="원본 비용")
    original_currency: str = Field(description="원본 통화")
    
    converted_cost: float = Field(description="변환된 비용")
    converted_currency: str = Field(description="변환 통화")
    
    exchange_rate: float = Field(description="적용 환율")
    rate_date: date = Field(description="환율 기준일")
    
    class Config:
        json_schema_extra = {
            "example": {
                "original_cost": 100.00,
                "original_currency": "USD",
                "converted_cost": 132050.00,
                "converted_currency": "KRW",
                "exchange_rate": 1320.50,
                "rate_date": "2025-11-24"
            }
        }
