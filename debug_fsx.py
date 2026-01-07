"""FSx 데이터 디버그 스크립트"""
import os
import sys

# 프로젝트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.converters.currency_converter_integration import CostDataConverterWithCurrency

# 세기 파일 경로
segi_file = r"c:\Users\user\OneDrive - Ciel inc\바탕 화면\YSH\＃세기모빌리티(SKR)_공동사업계약\＃비용\＃클라우드체커\ciel BillingDetailedGrouped 251201-251231_세기.csv"

print("=" * 60)
print("세기 파일 FSx 데이터 분석")
print("=" * 60)

# 데이터 로드
converter = CostDataConverterWithCurrency(auto_fetch=False)
data = converter.convert_csv_file(segi_file)

print(f"총 레코드: {len(data)}")

# FSx 데이터 필터링
fsx_data = [d for d in data if d.service_name == 'FSx']
print(f"FSx 레코드: {len(fsx_data)}")

# 환경값 분포
env_stats = {}
for d in fsx_data:
    env = d.environment
    if env not in env_stats:
        env_stats[env] = {'count': 0, 'total': 0}
    env_stats[env]['count'] += 1
    env_stats[env]['total'] += d.cost

print("\n환경별 FSx 분포:")
for env, stats in sorted(env_stats.items()):
    print(f"  {env}: {stats['count']}건, ${stats['total']:.2f}")

# FSx 총합
fsx_total = sum(d.cost for d in fsx_data)
print(f"\nFSx 총 합계: ${fsx_total:.2f}")

# original_environment 확인
if hasattr(fsx_data[0], 'original_environment'):
    orig_env_stats = {}
    for d in fsx_data:
        orig_env = getattr(d, 'original_environment', 'N/A')
        if orig_env not in orig_env_stats:
            orig_env_stats[orig_env] = {'count': 0, 'total': 0}
        orig_env_stats[orig_env]['count'] += 1
        orig_env_stats[orig_env]['total'] += d.cost
    
    print("\n원본 환경값별 FSx 분포:")
    for env, stats in sorted(orig_env_stats.items()):
        print(f"  {env}: {stats['count']}건, ${stats['total']:.2f}")
