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
app.config['SECRET_KEY'] = 'your-secret-key-here'  # 실제 운영시 변경 필요
app.config['KOREA_EXIM_API_KEY'] = 'K7Ns1BMF9j5ZZN9daJAMjMqlTbWTJlg6'  # 한국수출입은행 API 키

# 업로드 폴더 생성
Path(app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)

# 전역 변수로 변환기와 데이터 저장
converter = None
current_data = None
current_df = None


@app.route('/')
def index():
    """메인 페이지"""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """CSV 파일 업로드 (다중 파일 지원)"""
    global converter, current_data, current_df
    
    if 'files' not in request.files:
        return jsonify({'error': '파일이 없습니다'}), 400
    
    files = request.files.getlist('files')
    
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
        
        # 중복 제거: 날짜, 서비스, 설명, 환경, 비용이 모두 같은 경우
        print(f"[중복 검사] 총 {len(all_data)}개 레코드 검사 시작")
        duplicates_info['total'] = len(all_data)
        
        seen = set()
        unique_data = []
        
        for item in all_data:
            # 고유 키 생성: 날짜, 서비스, 설명, 환경, 비용
            key = (
                str(item.date),
                item.service_name,
                item.description,
                item.environment,
                float(item.cost)
            )
            
            if key not in seen:
                seen.add(key)
                unique_data.append(item)
            else:
                duplicates_info['removed'] += 1
        
        print(f"[중복 검사] 중복 제거: {duplicates_info['removed']}건, 최종: {len(unique_data)}건")
        
        # 환경값 정규화: dev-smartmobility, prd-smartmobility -> smartmobility
        for item in unique_data:
            if item.environment in ['dev-smartmobility', 'prd-smartmobility']:
                item.environment = 'smartmobility'
        
        # 전체 데이터 저장 (중복 제거된 데이터)
        current_data = unique_data
        
        # DataFrame 생성 (환율 적용 전)
        current_df = converter.to_dataframe(current_data)
        
        # 요약 정보
        summary = converter.get_summary_stats(current_data)
        
        # 성공 메시지에 중복 제거 정보 포함
        message = f'{len(uploaded_files)}개 파일, 총 {len(current_data)}개 레코드 업로드 완료'
        if duplicates_info['removed'] > 0:
            message += f' (중복 {duplicates_info["removed"]}건 제거됨)'
        
        # 일별 비용 집계
        daily_costs = {}
        for item in current_data:
            date_str = str(item.date)[:10]  # YYYY-MM-DD
            if date_str not in daily_costs:
                daily_costs[date_str] = 0
            daily_costs[date_str] += float(item.cost)
        
        # 환경별 일별 비용 집계
        daily_costs_by_env = {}
        environments = set()
        for item in current_data:
            env = item.environment or 'Unknown'
            environments.add(env)
            date_str = str(item.date)[:10]
            
            if env not in daily_costs_by_env:
                daily_costs_by_env[env] = {}
            if date_str not in daily_costs_by_env[env]:
                daily_costs_by_env[env][date_str] = 0
            daily_costs_by_env[env][date_str] += float(item.cost)
        
        return jsonify({
            'success': True,
            'message': message,
            'files': uploaded_files,
            'duplicates': duplicates_info,
            'summary': {
                'total_records': summary['total_records'],
                'total_cost_usd': float(summary['total_cost']),
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
        
        # datetime/date를 문자열로 변환
        for record in records:
            for key, value in record.items():
                if isinstance(value, (datetime, date)):
                    record[key] = str(value)
                elif pd.isna(value):
                    record[key] = None
        
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
        
        # 환경별 집계
        env_summary = df.groupby('environment').agg({
            'cost': 'sum',
            'cost_krw': 'sum' if 'cost_krw' in df.columns else 'sum'
        }).to_dict('index')
        
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
                'by_project': project_summary
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
