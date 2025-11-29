"""
환율 테이블 관리 모듈 (SQLite 기반)
"""
import sqlite3
from datetime import date, datetime
from typing import Optional, List
from pathlib import Path
from src.models.exchange_rate import ExchangeRate


class ExchangeRateManager:
    """환율 정보 저장 및 조회 관리"""
    
    def __init__(self, db_path: str = "data/exchange_rates.db"):
        """
        Args:
            db_path: SQLite 데이터베이스 파일 경로
        """
        self.db_path = db_path
        
        # 데이터베이스 폴더 생성
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # 테이블 초기화
        self._init_db()
    
    def _init_db(self):
        """데이터베이스 테이블 생성"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS exchange_rates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    base_currency TEXT NOT NULL,
                    target_currency TEXT NOT NULL,
                    rate REAL NOT NULL,
                    date DATE NOT NULL,
                    source TEXT NOT NULL,
                    currency_code TEXT,
                    currency_name TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(base_currency, target_currency, date)
                )
            """)
            
            # 인덱스 생성
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_currency_date 
                ON exchange_rates(base_currency, target_currency, date)
            """)
            
            conn.commit()
    
    def save_rate(self, rate: ExchangeRate) -> int:
        """
        환율 정보 저장 (중복 시 업데이트)
        
        Args:
            rate: 환율 정보
            
        Returns:
            int: 저장된 레코드 ID
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO exchange_rates 
                (base_currency, target_currency, rate, date, source, currency_code, currency_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rate.base_currency,
                rate.target_currency,
                rate.rate,
                rate.rate_date.isoformat(),
                rate.source,
                rate.currency_code,
                rate.currency_name,
                rate.created_at.isoformat()
            ))
            
            conn.commit()
            return cursor.lastrowid
    
    def save_rates(self, rates: List[ExchangeRate]) -> int:
        """
        여러 환율 정보 일괄 저장
        
        Args:
            rates: 환율 정보 리스트
            
        Returns:
            int: 저장된 레코드 수
        """
        count = 0
        for rate in rates:
            self.save_rate(rate)
            count += 1
        return count
    
    def get_rate(
        self, 
        base_currency: str = "USD",
        target_currency: str = "KRW",
        target_date: Optional[date] = None
    ) -> Optional[ExchangeRate]:
        """
        특정 날짜의 환율 조회
        
        Args:
            base_currency: 기준 통화
            target_currency: 대상 통화
            target_date: 조회 날짜 (None이면 가장 최근)
            
        Returns:
            ExchangeRate: 환율 정보 또는 None
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            if target_date:
                # 먼저 정확한 날짜로 조회
                cursor.execute("""
                    SELECT base_currency, target_currency, rate, date, source, 
                           currency_code, currency_name, created_at
                    FROM exchange_rates
                    WHERE base_currency = ? AND target_currency = ? AND date = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (base_currency, target_currency, target_date.isoformat()))
                
                row = cursor.fetchone()
                
                # 정확한 날짜가 없으면 가장 가까운 과거 날짜의 환율 사용
                if not row:
                    cursor.execute("""
                        SELECT base_currency, target_currency, rate, date, source, 
                               currency_code, currency_name, created_at
                        FROM exchange_rates
                        WHERE base_currency = ? AND target_currency = ? AND date <= ?
                        ORDER BY date DESC, created_at DESC
                        LIMIT 1
                    """, (base_currency, target_currency, target_date.isoformat()))
                    row = cursor.fetchone()
            else:
                cursor.execute("""
                    SELECT base_currency, target_currency, rate, date, source, 
                           currency_code, currency_name, created_at
                    FROM exchange_rates
                    WHERE base_currency = ? AND target_currency = ?
                    ORDER BY date DESC, created_at DESC
                    LIMIT 1
                """, (base_currency, target_currency))
                row = cursor.fetchone()
            
            if row:
                return ExchangeRate(
                    base_currency=row[0],
                    target_currency=row[1],
                    rate=row[2],
                    rate_date=datetime.fromisoformat(row[3]).date(),
                    source=row[4],
                    currency_code=row[5],
                    currency_name=row[6],
                    created_at=datetime.fromisoformat(row[7])
                )
            
            return None
    
    def get_rates_by_date_range(
        self,
        start_date: date,
        end_date: date,
        base_currency: str = "USD",
        target_currency: str = "KRW"
    ) -> List[ExchangeRate]:
        """
        날짜 범위로 환율 조회
        
        Args:
            start_date: 시작 날짜
            end_date: 종료 날짜
            base_currency: 기준 통화
            target_currency: 대상 통화
            
        Returns:
            List[ExchangeRate]: 환율 정보 리스트
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT base_currency, target_currency, rate, date, source, 
                       currency_code, currency_name, created_at
                FROM exchange_rates
                WHERE base_currency = ? AND target_currency = ? 
                  AND date BETWEEN ? AND ?
                ORDER BY date ASC
            """, (base_currency, target_currency, start_date.isoformat(), end_date.isoformat()))
            
            rates = []
            for row in cursor.fetchall():
                rates.append(ExchangeRate(
                    base_currency=row[0],
                    target_currency=row[1],
                    rate=row[2],
                    rate_date=datetime.fromisoformat(row[3]).date(),
                    source=row[4],
                    currency_code=row[5],
                    currency_name=row[6],
                    created_at=datetime.fromisoformat(row[7])
                ))
            
            return rates
    
    def delete_rate(
        self,
        base_currency: str,
        target_currency: str,
        target_date: date
    ) -> bool:
        """
        특정 날짜의 환율 삭제
        
        Args:
            base_currency: 기준 통화
            target_currency: 대상 통화
            target_date: 삭제할 날짜
            
        Returns:
            bool: 삭제 성공 여부
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                DELETE FROM exchange_rates
                WHERE base_currency = ? AND target_currency = ? AND date = ?
            """, (base_currency, target_currency, target_date.isoformat()))
            
            conn.commit()
            return cursor.rowcount > 0
    
    def get_all_currencies(self) -> List[str]:
        """
        저장된 모든 통화 코드 조회
        
        Returns:
            List[str]: 통화 코드 리스트
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT DISTINCT base_currency FROM exchange_rates
                UNION
                SELECT DISTINCT target_currency FROM exchange_rates
            """)
            
            return [row[0] for row in cursor.fetchall()]
    
    def get_latest_update_date(
        self,
        base_currency: str = "USD",
        target_currency: str = "KRW"
    ) -> Optional[date]:
        """
        가장 최근 업데이트 날짜 조회
        
        Args:
            base_currency: 기준 통화
            target_currency: 대상 통화
            
        Returns:
            date: 최근 업데이트 날짜 또는 None
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT MAX(date) FROM exchange_rates
                WHERE base_currency = ? AND target_currency = ?
            """, (base_currency, target_currency))
            
            row = cursor.fetchone()
            if row and row[0]:
                return datetime.fromisoformat(row[0]).date()
            
            return None
