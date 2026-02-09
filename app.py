"""
AWS 비용 정산 웹 애플리케이션
"""
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from datetime import date, datetime
import pandas as pd
from pathlib import Path

from src.cost_data_converter import CostDataConverter
from src.converters.currency_converter_integration import CostDataConverterWithCurrency

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')  # 환경 변수에서 읽기
app.config['KOREA_EXIM_API_KEY'] = os.environ.get('KOREA_EXIM_API_KEY', 'K7Ns1BMF9j5ZZN9daJAMjMqlTbWTJlg6')  # 한국수출입은행 API 키

# 업로드 폴더 생성
Path(app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)

# 전역 변수로 변환기와 데이터 저장
converter = None
current_data = None
current_df = None

# 두 파일의 데이터를 각각 저장
ciel_data_list = None  # 씨엘모빌리티 파일 데이터
segi_data_list = None  # 세기모빌리티 파일 데이터
combined_data_list = None  # 합쳐진 데이터
combined_df = None  # 합쳐진 DataFrame


def calculate_msp_costs(non_custom_charge_usd):
    """
    MSP 비용 계산
    
    - cielmobility 환경에서 Custom Charge를 제외한 금액 기준
    - $20,000 미만: M2 = 20%, M1 = $1,000
    - $20,000 이상: M2 = 20%, M1 = 5%
    - 씨엘모빌리티 사용 MSP = M2 - M1
    """
    THRESHOLD = 20000.0
    M2_RATE = 0.20  # 20%
    M1_FIXED = 1000.0  # $1,000
    M1_RATE = 0.05  # 5%
    
    # M2: 항상 20%
    msp_invoice_amount = non_custom_charge_usd * M2_RATE
    
    # M1: 임계값에 따라 결정
    if non_custom_charge_usd < THRESHOLD:
        msp_segi_amount = M1_FIXED
    else:
        msp_segi_amount = non_custom_charge_usd * M1_RATE
    
    # 씨엘모빌리티 사용 MSP = M2 - M1
    msp_ciel_usage = msp_invoice_amount - msp_segi_amount
    
    return {
        'threshold': THRESHOLD,
        'is_over_threshold': non_custom_charge_usd >= THRESHOLD,
        'msp_invoice_amount': round(msp_invoice_amount, 2),  # M2: 세금계산서 발행 MSP
        'msp_segi_amount': round(msp_segi_amount, 2),  # M1: 세기모빌리티 MSP
        'msp_ciel_usage': round(msp_ciel_usage, 2)  # 씨엘모빌리티 사용 MSP
    }


@app.route('/')
def index():
    """메인 페이지"""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """CSV 파일 업로드 (다중 파일 지원)"""
    global converter, current_data, current_df, ciel_data_list, segi_data_list, combined_data_list, combined_df
    
    if 'files' not in request.files:
        return jsonify({'error': '파일이 없습니다'}), 400
    
    files = request.files.getlist('files')
    # 'data_type' 또는 'upload_type' 둘 다 지원 (프론트엔드에서 data_type을 사용함)
    upload_type = request.form.get('data_type') or request.form.get('upload_type', 'ciel')  # 'ciel' 또는 'segi'
    print(f"[DEBUG] upload_type: {upload_type}")
    
    if not files or len(files) == 0:
        return jsonify({'error': '파일이 선택되지 않았습니다'}), 400
    
    try:
        all_data = []
        uploaded_files = []
        duplicates_info = {'total': 0, 'removed': 0}
        
        # 여러 파일 처리
        for file in files:
            if file.filename == '':
                continue
                
            if not file.filename.endswith('.csv'):
                return jsonify({'error': f'{file.filename}: CSV 파일만 업로드 가능합니다'}), 400
            
            # 파일 저장
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # 데이터 변환기 초기화 (첫 번째 파일에서만)
            if converter is None:
                converter = CostDataConverterWithCurrency(auto_fetch=False)
            
            # 데이터 변환
            file_data = converter.convert_csv_file(filepath)
            all_data.extend(file_data)
            uploaded_files.append(filename)
        
        if len(all_data) == 0:
            return jsonify({'error': '유효한 데이터가 없습니다'}), 400
        
        # 중복 제거 비활성화 - CloudCheckr CSV는 같은 조건의 별개 레코드가 있을 수 있음
        # 같은 날짜, 서비스, 설명, 환경, 비용이라도 별개의 리소스/사용량일 수 있음
        print(f"[데이터 검사] 총 {len(all_data)}개 레코드")
        duplicates_info['total'] = len(all_data)
        duplicates_info['removed'] = 0
        
        # 중복 제거 없이 모든 데이터 사용
        unique_data = all_data
        
        print(f"[데이터 검사] 최종: {len(unique_data)}건 (중복 제거 비활성화됨)")
        
        # 환경값 확인 (data_converter에서 이미 정규화됨)
        env_values = set(item.environment for item in unique_data)
        orig_env_values = set(item.original_environment for item in unique_data if item.original_environment)
        print(f"[DEBUG] 환경값들: {env_values}")
        print(f"[DEBUG] 원본 환경값들: {orig_env_values}")
        
        # upload_type에 따라 데이터 저장
        if upload_type == 'segi':
            segi_data_list = unique_data
            print(f"[DEBUG] 세기모빌리티 데이터 저장: {len(unique_data)}건")
        else:
            ciel_data_list = unique_data
            print(f"[DEBUG] 씨엘모빌리티 데이터 저장: {len(unique_data)}건")
        
        # 두 파일이 모두 있으면 합치기
        if ciel_data_list and segi_data_list:
            # 씨엘 파일에서 smartmobility 환경 데이터를 제외
            # (세기 파일의 smartmobility 데이터만 사용하여 중복 방지)
            ciel_filtered = [item for item in ciel_data_list if item.environment != 'smartmobility']
            print(f"[DEBUG] 씨엘 데이터에서 smartmobility 제외: {len(ciel_data_list)} -> {len(ciel_filtered)}건")
            
            # 필터링된 씨엘 데이터 + 세기 데이터 합침
            all_combined = ciel_filtered + segi_data_list
            
            # 각 파일 내 중복만 제거 (원본 환경값 기준)
            seen = set()
            combined_unique = []
            for idx, item in enumerate(all_combined):
                # 원본 환경값 사용 (정규화 전 값)
                original_env = getattr(item, 'original_environment', item.environment) or ''
                # 출처 구분 (씨엘 필터링 데이터 vs 세기 데이터)
                source = 'ciel' if idx < len(ciel_filtered) else 'segi'
                key = (
                    str(item.date),
                    item.service_name,
                    item.description,
                    original_env,  # 원본 환경값 사용
                    float(item.cost),
                    source  # 출처를 키에 포함
                )
                if key not in seen:
                    seen.add(key)
                    combined_unique.append(item)
            
            combined_data_list = combined_unique
            print(f"[DEBUG] 합쳐진 데이터: {len(combined_data_list)}건")
            # 합쳐진 데이터를 사용
            current_data = combined_data_list
        else:
            # 하나의 파일만 업로드된 경우
            current_data = unique_data
        
        # DataFrame 생성 (환율 적용 전) - 합쳐진 데이터 기준
        current_df = converter.to_dataframe(current_data)
        combined_df = current_df  # API에서 사용할 수 있도록
        
        # 요약 정보 - 현재 업로드한 파일의 데이터만 기준으로 계산
        summary = converter.get_summary_stats(unique_data)
        
        # 성공 메시지에 중복 제거 정보 포함
        message = f'{len(uploaded_files)}개 파일, 총 {len(unique_data)}개 레코드 업로드 완료'
        if duplicates_info['removed'] > 0:
            message += f' (중복 {duplicates_info["removed"]}건 제거됨)'
        
        # 일별 비용 집계 (Custom Charge 제외) - 현재 업로드한 파일 기준
        daily_costs = {}
        for item in unique_data:
            service_name = (item.service_name or '').lower()
            # Custom Charge는 일별 비용에서 제외
            if 'custom charge' in service_name:
                continue
            date_str = str(item.date)[:10]  # YYYY-MM-DD
            if date_str not in daily_costs:
                daily_costs[date_str] = 0
            daily_costs[date_str] += float(item.cost)
        
        # 환경별 일별 비용 집계 (Custom Charge 제외) - 현재 업로드한 파일 기준
        daily_costs_by_env = {}
        environments = set()
        for item in unique_data:
            service_name = (item.service_name or '').lower()
            # Custom Charge는 일별 비용에서 제외
            if 'custom charge' in service_name:
                continue
            env = item.environment or 'Unknown'
            environments.add(env)
            date_str = str(item.date)[:10]
            
            if env not in daily_costs_by_env:
                daily_costs_by_env[env] = {}
            if date_str not in daily_costs_by_env[env]:
                daily_costs_by_env[env][date_str] = 0
            daily_costs_by_env[env][date_str] += float(item.cost)
        
        # 환경별 총 비용 계산 - 현재 업로드한 파일 기준
        # smartmobility가 포함된 데이터가 있는지 확인
        has_smartmobility = any('smartmobility' in (item.environment or '').lower() for item in unique_data)
        
        cielmobility_usd = 0
        smartmobility_usd = 0
        
        # MSP 계산용 변수 (cielmobility 환경에서)
        custom_charge_usd = 0  # Custom Charge 금액
        non_custom_charge_usd = 0  # Custom Charge 외 금액
        
        for item in unique_data:
            env = (item.environment or '').lower()
            cost = float(item.cost)
            service_name = (item.service_name or '').lower()
            
            if 'smartmobility' in env:
                smartmobility_usd += cost
            else:
                cielmobility_usd += cost
                # cielmobility 환경에서 Custom Charge 구분
                if 'custom charge' in service_name:
                    custom_charge_usd += cost
                else:
                    non_custom_charge_usd += cost
        
        # MSP 비용 계산 (cielmobility 환경 기준)
        msp_info = calculate_msp_costs(non_custom_charge_usd)
        
        return jsonify({
            'success': True,
            'message': message,
            'files': uploaded_files,
            'duplicates': duplicates_info,
            'summary': {
                'total_records': summary['total_records'],
                'total_cost_usd': float(summary['total_cost']),
                'cielmobility_usd': cielmobility_usd,
                'smartmobility_usd': smartmobility_usd,
                'has_smartmobility': has_smartmobility,
                'custom_charge_usd': custom_charge_usd,
                'non_custom_charge_usd': non_custom_charge_usd,
                'msp_info': msp_info,
                'date_range': {
                    'start': str(summary['date_range']['start']),
                    'end': str(summary['date_range']['end'])
                },
                'services': list(summary['cost_by_service'].keys()),
                'service_costs': {k: float(v) for k, v in summary['cost_by_service'].items()},
                'daily_costs': daily_costs,
                'daily_costs_by_env': daily_costs_by_env,
                'environments': sorted(list(environments))
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/exchange-rate/fetch', methods=['POST'])
def fetch_exchange_rate():
    """환율 API에서 자동 조회 (SMBS 또는 한국수출입은행)"""
    global converter
    
    if not converter:
        return jsonify({'error': '먼저 파일을 업로드하세요'}), 400
    
    try:
        data = request.get_json()
        api_source = data.get('source', 'smbs')  # 'smbs' 또는 'koreaexim'
        target_date = data.get('date', str(date.today()))
        
        print(f"[환율 조회] API 소스: {api_source}, 날짜: {target_date}")
        
        from datetime import datetime
        rate_date = datetime.strptime(target_date, '%Y-%m-%d').date()
        
        if api_source == 'smbs':
            # SMBS (서울외국환중개) API 사용
            from src.exchange.smbs_client import SMBSClient
            
            smbs_client = SMBSClient()
            exchange_rate = smbs_client.get_exchange_rate(rate_date, 'USD')
            
            if not exchange_rate:
                # 디버깅: 최신 환율이라도 가져오기 시도
                print(f"[DEBUG] 정확한 날짜 {rate_date}의 환율을 찾지 못했습니다. 최신 환율을 시도합니다...")
                exchange_rate = smbs_client.get_exchange_rate(None, 'USD')
                
                if exchange_rate:
                    return jsonify({
                        'success': True,
                        'rate': exchange_rate.rate,
                        'date': str(exchange_rate.rate_date),
                        'source': f'SMBS (서울외국환중개) - {rate_date} 대신 {exchange_rate.rate_date} 환율 사용',
                        'currency_name': exchange_rate.currency_name,
                        'warning': f'요청한 {rate_date}의 환율이 없어 최신 환율({exchange_rate.rate_date})을 사용했습니다.'
                    })
                
                return jsonify({'error': f'해당 날짜({rate_date})의 환율 정보를 찾을 수 없습니다. SMBS 사이트가 정상인지 확인해주세요.'}), 404
            
            # 환율 저장
            converter.currency_converter.rate_manager.save_rate(exchange_rate)
            
            return jsonify({
                'success': True,
                'rate': exchange_rate.rate,
                'date': str(exchange_rate.rate_date),
                'source': 'SMBS (서울외국환중개)',
                'currency_name': exchange_rate.currency_name
            })
        
        elif api_source == 'koreaexim':
            # 한국수출입은행 API 사용
            api_key = app.config.get('KOREA_EXIM_API_KEY', '')
            
            print(f"[환율 조회] API 키 설정 여부: {bool(api_key)}")
            
            if not api_key:
                return jsonify({'error': 'API 키가 설정되지 않았습니다'}), 400
            
            from src.exchange.api_client import KoreaEximAPI
            
            api_client = KoreaEximAPI(api_key)
            
            try:
                print(f"[환율 조회] API 요청 시작: {rate_date}")
                exchange_rate = api_client.get_exchange_rates(rate_date, 'USD')
                print(f"[환율 조회] API 응답: {exchange_rate}")
            except ConnectionError as e:
                print(f"[환율 조회] 연결 오류: {str(e)}")
                return jsonify({'error': f'API 서버 연결 실패: {str(e)}. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.'}), 503
            except Exception as e:
                print(f"[환율 조회] 예외 발생: {str(e)}")
                return jsonify({'error': f'API 오류: {str(e)}'}), 500
            
            if not exchange_rate:
                print(f"[환율 조회] 환율 정보 없음: {rate_date}")
                return jsonify({'error': f'해당 날짜({target_date})의 환율 정보를 찾을 수 없습니다. 주말이나 공휴일일 수 있습니다.'}), 404
            
            # 환율 저장
            converter.currency_converter.rate_manager.save_rate(exchange_rate)
            
            print(f"[환율 조회] 성공: {exchange_rate.rate} KRW/USD")
            
            return jsonify({
                'success': True,
                'rate': exchange_rate.rate,
                'date': str(exchange_rate.rate_date),
                'source': '한국수출입은행',
                'currency_name': exchange_rate.currency_name
            })
        
        else:
            return jsonify({'error': '지원하지 않는 API 소스입니다'}), 400
    
    except Exception as e:
        print(f"[환율 조회] 전체 예외: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'API 조회 실패: {str(e)}'}), 500


@app.route('/api/exchange-rate', methods=['POST'])
def set_exchange_rate():
    """환율 설정 (수동 또는 자동)"""
    global converter, current_data, current_df
    
    if not converter or not current_data:
        return jsonify({'error': '먼저 파일을 업로드하세요'}), 400
    
    try:
        data = request.get_json()
        rate = float(data.get('rate', 0))
        rate_date = data.get('date', str(date.today()))
        
        if rate <= 0:
            return jsonify({'error': '유효한 환율을 입력하세요'}), 400
        
        # 기존 데이터프레임 초기화 (새로운 환율로 재계산)
        global current_df
        
        # 환율 설정 (기존 환율 덮어쓰기)
        print(f"[DEBUG] 환율 설정: {rate} KRW, 날짜: {rate_date}")
        converter.add_manual_exchange_rate(
            rate=rate,
            target_date=datetime.strptime(rate_date, '%Y-%m-%d').date()
        )
        
        # KRW 환산 DataFrame 재생성
        print(f"[DEBUG] DataFrame 재생성 중...")
        current_df = converter.to_dataframe_with_krw(current_data)
        
        # 요약 정보 재계산
        print(f"[DEBUG] 요약 정보 재계산 중...")
        summary = converter.get_summary_stats_with_krw(current_data)
        
        print(f"[DEBUG] 총 비용 KRW: {summary.get('total_cost_krw', 0):,.0f}")
        print(f"[DEBUG] 환율: {rate}")
        
        return jsonify({
            'success': True,
            'message': f'환율 설정 완료: 1 USD = {rate:,.2f} KRW',
            'summary': {
                'total_cost_usd': float(summary['total_cost']),
                'total_cost_krw': float(summary.get('total_cost_krw', 0)),
                'exchange_rate': rate
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/data')
def get_data():
    """데이터 조회 (필터링 지원)"""
    global current_df
    
    if current_df is None:
        return jsonify({'error': '데이터가 없습니다'}), 400
    
    try:
        df = current_df.copy()
        
        # 필터링
        services = request.args.get('services')  # 다중 선택 (쉼표 구분)
        environment = request.args.get('environment')
        project = request.args.get('project')
        date_start = request.args.get('date_start')  # 기간 시작
        date_end = request.args.get('date_end')  # 기간 끝
        
        if services:
            service_list = [s.strip() for s in services.split(',')]
            df = df[df['service_name'].isin(service_list)]
        
        if environment:
            df = df[df['environment'] == environment]
        
        if project:
            df = df[df['project'] == project]
        
        # 날짜 필터링 (시작일과 종료일이 같으면 특정 날짜, 다르면 기간)
        if date_start or date_end:
            df['date_str'] = df['date'].astype(str).str[:10]
            if date_start:
                df = df[df['date_str'] >= date_start]
            if date_end:
                df = df[df['date_str'] <= date_end]
            df = df.drop(columns=['date_str'])
        
        # 페이지네이션
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        start = (page - 1) * per_page
        end = start + per_page
        
        # 정렬
        sort_by = request.args.get('sort_by', 'cost_krw')
        sort_order = request.args.get('sort_order', 'desc')
        
        if sort_by in df.columns:
            df = df.sort_values(sort_by, ascending=(sort_order == 'asc'))
        
        total_records = len(df)
        df_page = df.iloc[start:end]
        
        # JSON 변환
        records = df_page.to_dict('records')
        
        # datetime/date를 문자열로 변환 및 environment 기본값 설정
        for record in records:
            for key, value in record.items():
                if isinstance(value, (datetime, date)):
                    record[key] = str(value)
                elif pd.isna(value):
                    record[key] = None
            # environment가 비어있으면 cielmobility로 설정
            if not record.get('environment') or (isinstance(record.get('environment'), str) and record['environment'].strip() == ''):
                record['environment'] = 'cielmobility'
        
        return jsonify({
            'success': True,
            'data': records,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_records,
                'total_pages': (total_records + per_page - 1) // per_page
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/summary')
def get_summary():
    """요약 통계"""
    global current_df
    
    if current_df is None:
        return jsonify({'error': '데이터가 없습니다'}), 400
    
    try:
        df = current_df
        
        # 서비스별 집계
        service_summary = df.groupby('service_name').agg({
            'cost': 'sum',
            'cost_krw': 'sum' if 'cost_krw' in df.columns else 'sum'
        }).to_dict('index')
        
        # 환경별 집계 (environment가 빈 값이면 cielmobility로 처리)
        df_env = df.copy()
        df_env['environment'] = df_env['environment'].fillna('cielmobility')
        df_env['environment'] = df_env['environment'].replace('', 'cielmobility')
        
        env_summary = df_env.groupby('environment').agg({
            'cost': 'sum',
            'cost_krw': 'sum' if 'cost_krw' in df_env.columns else 'sum'
        }).to_dict('index')
        
        # MSP 계산 (cielmobility 환경 기준)
        custom_charge_usd = 0.0
        non_custom_charge_usd = 0.0
        
        for idx, row in df_env.iterrows():
            env = (row.get('environment') or '').lower()
            service = (row.get('service_name') or '').lower()
            cost = float(row.get('cost', 0))
            
            if 'smartmobility' not in env:  # cielmobility 환경
                if 'custom charge' in service:
                    custom_charge_usd += cost
                else:
                    non_custom_charge_usd += cost
        
        msp_info = calculate_msp_costs(non_custom_charge_usd)
        msp_info['custom_charge_usd'] = round(custom_charge_usd, 2)
        msp_info['non_custom_charge_usd'] = round(non_custom_charge_usd, 2)
        
        # 프로젝트별 집계
        project_summary = {}
        if 'project' in df.columns and df['project'].notna().any():
            project_summary = df.groupby('project').agg({
                'cost': 'sum',
                'cost_krw': 'sum' if 'cost_krw' in df.columns else 'sum'
            }).to_dict('index')
        
        return jsonify({
            'success': True,
            'summary': {
                'total': {
                    'cost_usd': float(df['cost'].sum()),
                    'cost_krw': float(df['cost_krw'].sum()) if 'cost_krw' in df.columns else 0,
                    'records': len(df)
                },
                'by_service': service_summary,
                'by_environment': env_summary,
                'by_project': project_summary,
                'msp_info': msp_info
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export')
def export_data():
    """데이터 다운로드 (Excel)"""
    global current_df
    
    if current_df is None:
        return jsonify({'error': '데이터가 없습니다'}), 400
    
    try:
        output_path = 'exports/cost_report.xlsx'
        Path('exports').mkdir(exist_ok=True)
        
        # raw_data 컬럼 제거
        df_export = current_df.copy()
        if 'raw_data' in df_export.columns:
            df_export = df_export.drop(columns=['raw_data'])
        
        df_export.to_excel(output_path, index=False, sheet_name='비용데이터')
        
        return send_file(
            output_path,
            as_attachment=True,
            download_name=f'cost_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 80)
    print("AWS 비용 정산 툴 웹 서버 시작")
    print("=" * 80)
    print("\n브라우저에서 다음 주소로 접속하세요:")
    print("  http://localhost:5000")
    print("\n종료하려면 Ctrl+C를 누르세요.")
    print("=" * 80)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
