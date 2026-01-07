"""FSx 데이터 디버깅 - 두 파일 병합 과정 확인"""
import sys
sys.path.insert(0, '.')

from src.parsers.cloudchecker_parser import CloudCheckerParser
from src.converters.data_converter import DataConverter

# 파일 경로
segi_file = "DATA_billing/ciel BillingDetailedGrouped 11-26-2025 14_48_25_2025-11-27-06-05-12_스마트모빌리티.csv"
ciel_file = "DATA_billing/ciel BillingDetailedGrouped 11-26-2025 14_48_25_2025-11-27-06-07-33_씨엘모빌리티.csv"

print("=" * 60)
print("두 파일 병합 과정 디버깅")
print("=" * 60)

# 파싱
parser = CloudCheckerParser()
converter = DataConverter()

print("\n1. 세기 파일 파싱...")
segi_raw = parser.parse_csv(segi_file)
segi_data = converter.convert_dataframe(segi_raw)
print(f"   세기 데이터: {len(segi_data)}건")

# 세기 파일 FSx 확인
segi_fsx = [d for d in segi_data if 'fsx' in (d.service_name or '').lower()]
print(f"   세기 FSx: {len(segi_fsx)}건")
for d in segi_fsx[:5]:
    print(f"     - env: {d.environment}, original_env: {d.original_environment}, cost: ${d.cost:.2f}")

print("\n2. 씨엘 파일 파싱...")
ciel_raw = parser.parse_csv(ciel_file)
ciel_data = converter.convert_dataframe(ciel_raw)
print(f"   씨엘 데이터: {len(ciel_data)}건")

# 씨엘 파일 FSx 확인
ciel_fsx = [d for d in ciel_data if 'fsx' in (d.service_name or '').lower()]
print(f"   씨엘 FSx: {len(ciel_fsx)}건")
for d in ciel_fsx[:5]:
    print(f"     - env: {d.environment}, original_env: {d.original_environment}, cost: ${d.cost:.2f}")

print("\n3. 씨엘 데이터에서 smartmobility 제외...")
ciel_filtered = [item for item in ciel_data if item.environment != 'smartmobility']
print(f"   필터링 전: {len(ciel_data)}건")
print(f"   필터링 후: {len(ciel_filtered)}건")
print(f"   제외됨: {len(ciel_data) - len(ciel_filtered)}건")

# 필터링 후 FSx 확인
ciel_filtered_fsx = [d for d in ciel_filtered if 'fsx' in (d.service_name or '').lower()]
print(f"   필터링 후 씨엘 FSx: {len(ciel_filtered_fsx)}건")

print("\n4. 합치기...")
all_combined = ciel_filtered + segi_data
combined_fsx = [d for d in all_combined if 'fsx' in (d.service_name or '').lower()]
print(f"   합친 후 FSx: {len(combined_fsx)}건")

# 원본 환경별 분포
from collections import Counter
orig_env_counts = Counter()
orig_env_costs = {}
for d in combined_fsx:
    orig_env = d.original_environment or 'empty'
    orig_env_counts[orig_env] += 1
    orig_env_costs[orig_env] = orig_env_costs.get(orig_env, 0) + d.cost

print("\n   원본 환경별 FSx 분포:")
for env, count in orig_env_counts.items():
    print(f"     {env}: {count}건, ${orig_env_costs[env]:.2f}")

print(f"\n   FSx 총합계: ${sum(d.cost for d in combined_fsx):.2f}")

print("\n5. 중복 제거...")
seen = set()
combined_unique = []
for idx, item in enumerate(all_combined):
    original_env = getattr(item, 'original_environment', item.environment) or ''
    source = 'ciel' if idx < len(ciel_filtered) else 'segi'
    key = (
        str(item.date),
        item.service_name,
        item.description,
        original_env,
        float(item.cost),
        source
    )
    if key not in seen:
        seen.add(key)
        combined_unique.append(item)

unique_fsx = [d for d in combined_unique if 'fsx' in (d.service_name or '').lower()]
print(f"   중복 제거 후 FSx: {len(unique_fsx)}건")
print(f"   FSx 총합계: ${sum(d.cost for d in unique_fsx):.2f}")

# 원본 환경별 분포
orig_env_counts2 = Counter()
orig_env_costs2 = {}
for d in unique_fsx:
    orig_env = d.original_environment or 'empty'
    orig_env_counts2[orig_env] += 1
    orig_env_costs2[orig_env] = orig_env_costs2.get(orig_env, 0) + d.cost

print("\n   원본 환경별 FSx 분포:")
for env, count in orig_env_counts2.items():
    print(f"     {env}: {count}건, ${orig_env_costs2[env]:.2f}")
