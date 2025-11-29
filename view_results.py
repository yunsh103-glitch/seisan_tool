"""
생성된 데이터 확인 및 분석 스크립트
"""
import pandas as pd

# Excel 파일 읽기
print("=" * 80)
print("클라우드체커 비용 데이터 분석")
print("=" * 80)

# KRW 환산 데이터 로드 (CSV 사용)
df = pd.read_csv('data/ciel_cost_with_krw.csv')

print(f"\n📊 전체 레코드 수: {len(df):,}개")
print(f"📅 데이터 기간: {df['date'].min()} ~ {df['date'].max()}")

# 기본 정보
print(f"\n💰 총 비용:")
print(f"   USD: ${df['cost'].sum():,.2f}")
print(f"   KRW: ₩{df['cost_krw'].sum():,.0f}")
print(f"   환율: {df['exchange_rate'].iloc[0]:,.2f}")

# 서비스별 집계
print(f"\n📌 서비스별 비용 (KRW):")
service_summary = df.groupby('service_name').agg({
    'cost': 'sum',
    'cost_krw': 'sum'
}).sort_values('cost_krw', ascending=False)

for service, row in service_summary.iterrows():
    print(f"   {service:25s}: ${row['cost']:>10,.2f} → ₩{row['cost_krw']:>12,.0f}")

# 환경별 집계
print(f"\n🏢 환경별 비용 (KRW):")
env_summary = df.groupby('environment').agg({
    'cost': 'sum',
    'cost_krw': 'sum'
}).sort_values('cost_krw', ascending=False)

for env, row in env_summary.iterrows():
    print(f"   {env:25s}: ${row['cost']:>10,.2f} → ₩{row['cost_krw']:>12,.0f}")

# 프로젝트별 집계
print(f"\n📂 프로젝트별 비용 (KRW):")
project_summary = df.groupby('project').agg({
    'cost': 'sum',
    'cost_krw': 'sum'
}).sort_values('cost_krw', ascending=False)

for project, row in project_summary.iterrows():
    print(f"   {project:25s}: ${row['cost']:>10,.2f} → ₩{row['cost_krw']:>12,.0f}")

# 상위 10개 비용 항목
print(f"\n💸 비용 상위 10개 항목:")
top_10 = df.nlargest(10, 'cost_krw')[['service_name', 'description', 'environment', 'cost', 'cost_krw']]

for idx, row in top_10.iterrows():
    desc = row['description'][:50] + '...' if len(str(row['description'])) > 50 else row['description']
    print(f"\n   {row['service_name']:20s} ({row['environment']})")
    print(f"   {desc}")
    print(f"   ${row['cost']:,.2f} → ₩{row['cost_krw']:,.0f}")

# 전체 데이터 미리보기
print(f"\n\n📋 데이터 미리보기 (처음 5행):")
print("-" * 80)
display_cols = ['date', 'service_name', 'environment', 'cost', 'cost_krw']
print(df[display_cols].head().to_string())

print("\n" + "=" * 80)
print("✓ 분석 완료!")
print("=" * 80)
print("\n💡 Tip: Excel 파일을 열어서 더 자세히 확인하세요!")
print("   파일: data\\ciel_cost_with_krw.xlsx")
