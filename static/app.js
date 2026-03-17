// 전역 변수
let currentPage = 1;
let currentFilters = {};
let uploadedData = null;
let dailyCostsData = null; // 전체 일별 비용
let dailyCostsByEnvData = null; // 환경별 일별 비용
let allDataCache = null; // 전체 데이터 캐시 (필터용)

// 이중 업로드 시스템용 전역 변수
let cielData = null; // 씨엘모빌리티 데이터 (스마일샤크 → 씨엘모빌리티)
let segiData = null; // 세기모빌리티 데이터 (씨엘모빌리티 → 세기모빌리티)
let currentDataType = 'ciel'; // 현재 표시 중인 데이터 타입

// 프로그레스 바 함수
function showProgressModal(title, text, durationSeconds = 3) {
    const modal = document.getElementById('progressModal');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressTitle = document.getElementById('progressTitle');
    const progressText = document.getElementById('progressText');
    
    progressTitle.textContent = title;
    progressText.textContent = text;
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    modal.style.display = 'flex';
    
    // NProgress 시작
    NProgress.start();
    
    // 0% → 90%까지 빠르게, 90% → 99%까지 천천히 (실제 완료 대기)
    const updateInterval = 100;
    const fastPhaseSteps = (durationSeconds * 1000) / updateInterval; // 예상 시간 동안 90%까지
    const incrementFast = 90 / fastPhaseSteps;
    
    let progress = 0;
    let phase = 'fast'; // 'fast' → 'slow'
    
    const interval = setInterval(() => {
        if (phase === 'fast') {
            progress += incrementFast;
            if (progress >= 90) {
                progress = 90;
                phase = 'slow';
            }
        } else {
            // 90% 이후: 아주 천천히 증가 (99%까지만, 100%는 완료 시에만)
            progress += 0.1;
            if (progress >= 99) {
                progress = 99;
            }
        }
        
        const roundedProgress = Math.round(progress);
        progressBar.style.width = roundedProgress + '%';
        progressPercent.textContent = roundedProgress + '%';
        NProgress.set(progress / 100);
    }, updateInterval);
    
    return interval;
}

function hideProgressModal(interval) {
    if (interval) clearInterval(interval);
    
    const modal = document.getElementById('progressModal');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    
    // 완료 애니메이션
    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';
    NProgress.done();
    
    // 모달은 숨기지 않고 결과를 표시하기 위해 유지
}

function closeProgressModal() {
    const modal = document.getElementById('progressModal');
    const resultDiv = document.getElementById('progressResult');
    const closeBtn = document.getElementById('progressCloseBtn');
    
    modal.style.display = 'none';
    resultDiv.style.display = 'none';
    closeBtn.style.display = 'none';
}

function showProgressResult(isSuccess, message, details = '') {
    const resultDiv = document.getElementById('progressResult');
    const closeBtn = document.getElementById('progressCloseBtn');
    const progressText = document.getElementById('progressText');
    
    // 진행 텍스트 숨김
    progressText.style.display = 'none';
    
    // 결과 표시
    resultDiv.style.display = 'block';
    closeBtn.style.display = 'block';
    
    if (isSuccess) {
        resultDiv.style.background = '#e9ecef';
        resultDiv.style.border = '2px solid #495057';
        resultDiv.style.color = '#495057';
        resultDiv.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 10px;">✓</div>
            <div style="font-weight: 600; margin-bottom: 8px;">${message}</div>
            ${details ? `<div style="font-size: 0.9em; color: #495057;">${details}</div>` : ''}
        `;
    } else {
        resultDiv.style.background = '#f8d7da';
        resultDiv.style.border = '2px solid #dc3545';
        resultDiv.style.color = '#721c24';
        resultDiv.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 10px;">✗</div>
            <div style="font-weight: 600; margin-bottom: 8px;">${message}</div>
            ${details ? `<div style="font-size: 0.9em; color: #721c24;">${details}</div>` : ''}
        `;
    }
}

// 섹션으로 부드럽게 스크롤
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        // hidden 클래스 제거
        section.classList.remove('hidden');
        
        // 슬라이드 인 애니메이션 추가
        section.classList.add('slide-in');
        
        // 부드럽게 스크롤
        setTimeout(() => {
            section.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start'
            });
        }, 100);
        
        // 애니메이션 클래스 제거 (재사용 가능하도록)
        setTimeout(() => {
            section.classList.remove('slide-in');
        }, 600);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 오늘 날짜 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('apiDate').value = today;
    
    // 씨엘모빌리티 파일 업로드 이벤트
    const fileInputCiel = document.getElementById('fileInputCiel');
    const uploadAreaCiel = document.getElementById('uploadAreaCiel');
    
    if (fileInputCiel) {
        fileInputCiel.addEventListener('change', () => handleFileSelectForType('ciel'));
    }
    
    // 드래그 앤 드롭 (씨엘모빌리티)
    if (uploadAreaCiel) {
        uploadAreaCiel.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadAreaCiel.classList.add('dragover');
        });
        
        uploadAreaCiel.addEventListener('dragleave', () => {
            uploadAreaCiel.classList.remove('dragover');
        });
        
        uploadAreaCiel.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadAreaCiel.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInputCiel.files = files;
                handleFileSelectForType('ciel');
            }
        });
    }
    
    // 세기모빌리티 파일 업로드 이벤트
    const fileInputSegi = document.getElementById('fileInputSegi');
    const uploadAreaSegi = document.getElementById('uploadAreaSegi');
    
    if (fileInputSegi) {
        fileInputSegi.addEventListener('change', () => handleFileSelectForType('segi'));
    }
    
    // 드래그 앤 드롭 (세기모빌리티)
    if (uploadAreaSegi) {
        uploadAreaSegi.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadAreaSegi.classList.add('dragover');
        });
        
        uploadAreaSegi.addEventListener('dragleave', () => {
            uploadAreaSegi.classList.remove('dragover');
        });
        
        uploadAreaSegi.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadAreaSegi.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInputSegi.files = files;
                handleFileSelectForType('segi');
            }
        });
    }
    
    // 전역 키보드 이벤트 (엔터, 스페이스바로 확인 버튼 동작)
    document.addEventListener('keydown', function(e) {
        const progressModal = document.getElementById('progressModal');
        const closeBtn = document.getElementById('progressCloseBtn');
        
        // 프로그레스 모달이 열려있고 확인 버튼이 보이는 경우
        if (progressModal.style.display === 'flex' && closeBtn.style.display === 'block') {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeProgressModal();
            }
        }
    });
});

// 타입별 파일 업로드 처리
async function handleFileSelectForType(type) {
    const fileInputId = type === 'ciel' ? 'fileInputCiel' : 'fileInputSegi';
    const statusId = type === 'ciel' ? 'uploadStatusCiel' : 'uploadStatusSegi';
    const typeName = type === 'ciel' ? '씨엘모빌리티' : '세기모빌리티';
    
    const fileInput = document.getElementById(fileInputId);
    const files = fileInput.files;
    
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    
    // 여러 파일 추가
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    // 타입 정보 추가
    formData.append('data_type', type);
    
    // 프로그레스 바 표시
    const uploadDuration = Math.min(1 + files.length * 0.3, 2);
    const progressInterval = showProgressModal(
        `${typeName} 파일 업로드 중`,
        `${files.length}개 파일을 처리하고 있습니다...`,
        uploadDuration
    );
    
    showLoading(statusId, `${files.length}개 파일 업로드 중...`);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        // 프로그레스 바 완료
        hideProgressModal(progressInterval);
        
        if (result.success) {
            // 타입에 따라 데이터 저장
            if (type === 'ciel') {
                cielData = result;
            } else {
                segiData = result;
            }
            
            // 성공 메시지 생성
            let details = `${result.files.length}개 파일, ${result.summary.total_records}개 레코드`;
            if (result.duplicates && result.duplicates.removed > 0) {
                details += `<br>중복 ${result.duplicates.removed}건 제거됨`;
            }
            
            showProgressResult(true, `${typeName} 파일 업로드 완료`, details);
            
            // 업로드된 파일 목록 표시
            let fileListHtml = '<div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; text-align: left;">';
            fileListHtml += '<strong>📁 업로드된 파일:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px; list-style: none;">';
            result.files.forEach(filename => {
                fileListHtml += `<li style="word-break: break-all; margin-bottom: 4px;">• ${filename}</li>`;
            });
            fileListHtml += '</ul>';
            
            // 중복 제거 정보 표시
            if (result.duplicates && result.duplicates.removed > 0) {
                fileListHtml += `<div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-left: 3px solid #ffc107; font-size: 0.9em;">`;
                fileListHtml += `⚠️ <strong>중복 제거:</strong> 총 ${result.duplicates.total}건 중 ${result.duplicates.removed}건의 중복 데이터가 제거되었습니다.`;
                fileListHtml += `</div>`;
            }
            
            fileListHtml += '</div>';
            
            showSuccess(statusId, `✅ ${result.summary.total_records}개 레코드 로드됨` + fileListHtml);
            
            // 두 파일이 모두 업로드되었는지 확인
            if (cielData && segiData) {
                // 두 파일 모두 업로드됨 - 환율 섹션 표시 및 통합 요약
                displayCombinedSummary();
                
                setTimeout(() => {
                    scrollToSection('exchangeSection');
                }, 500);
            }
            // 하나만 업로드된 경우 - 2단계로 넘어가지 않고 대기
        } else {
            showProgressResult(false, `${typeName} 파일 업로드 실패`, result.error);
            showError(statusId, result.error);
        }
    } catch (error) {
        hideProgressModal(progressInterval);
        showProgressResult(false, '업로드 오류 발생', error.message);
        showError(statusId, '업로드 실패: ' + error.message);
    }
}

// 단일 데이터 요약 표시
function displaySingleSummary(type, summary) {
    const section = document.getElementById('summarySection');
    section.classList.remove('hidden');
    
    document.getElementById('exchangeRateInfo').textContent = '';
    
    const startDate = summary.date_range.start.split(' ')[0];
    const endDate = summary.date_range.end.split(' ')[0];
    const totalUSD = summary.total_cost_usd || 0;
    
    const grid = document.getElementById('summaryGrid');
    
    if (type === 'ciel') {
        window.summaryCielTotalUSD = totalUSD;
        window.summaryCielDateRange = { start: startDate, end: endDate };
        
        grid.innerHTML = `
            <div class="summary-card">
                <h3>기간</h3>
                <div class="value">${startDate} ~ ${endDate}</div>
            </div>
            <div class="summary-card" style="background: #F2F4FF;">
                <h3>📄 세금계산서 발행 금액(매입) (USD / KRW)</h3>
                <div class="value">
                    <span>$${totalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <span style="color: #6c757d; margin: 0 8px;">/</span>
                    <span id="cielKrwValue" style="color: #6c757d;">-</span>
                </div>
            </div>
        `;
    } else {
        window.summarySegiTotalUSD = totalUSD;
        window.summarySegiDateRange = { start: startDate, end: endDate };
        
        grid.innerHTML = `
            <div class="summary-card">
                <h3>기간</h3>
                <div class="value">${startDate} ~ ${endDate}</div>
            </div>
            <div class="summary-card" style="background: #FFEFEF;">
                <h3>📤 세기모빌리티 청구 금액(매출) (USD / KRW)</h3>
                <div class="value" style="color: #E57373;">
                    <span>$${totalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <span style="color: #6c757d; margin: 0 8px;">/</span>
                    <span id="segiKrwValue">-</span>
                </div>
            </div>
        `;
    }
    
    // 설명문 표시
    const disclaimer = document.getElementById('summaryDisclaimer');
    if (disclaimer) {
        disclaimer.style.display = 'block';
    }
    
    // 일별 비용 데이터 저장
    dailyCostsData = summary.daily_costs;
    dailyCostsByEnvData = summary.daily_costs_by_env;
    
    // 환경 필터 드롭다운 초기화
    initDailyTrendEnvFilter(summary.environments || []);
    
    // 일별 비용 추이 차트
    displayDailyTrendChart(summary.daily_costs);
    
    // 날짜 필터 설정
    const filterDateStart = document.getElementById('filterDateStart');
    const filterDateEnd = document.getElementById('filterDateEnd');
    if (filterDateStart && filterDateEnd) {
        filterDateStart.min = startDate;
        filterDateStart.max = endDate;
        filterDateEnd.min = startDate;
        filterDateEnd.max = endDate;
        filterDateStart.value = startDate;
        filterDateEnd.value = endDate;
    }
}

// 통합 요약 정보 표시 (두 파일 모두 업로드됨)
function displayCombinedSummary() {
    const section = document.getElementById('summarySection');
    section.classList.remove('hidden');
    
    document.getElementById('exchangeRateInfo').textContent = '';
    
    // 씨엘모빌리티 데이터
    const cielSummary = cielData.summary;
    const cielStartDate = cielSummary.date_range.start.split(' ')[0];
    const cielEndDate = cielSummary.date_range.end.split(' ')[0];
    const cielTotalUSD = cielSummary.total_cost_usd || 0;
    
    // 세기모빌리티 데이터
    const segiSummary = segiData.summary;
    const segiTotalUSD = segiSummary.total_cost_usd || 0;
    
    // MSP 정보 (씨엘모빌리티 데이터에서 M2, 세기모빌리티 데이터에서 M1)
    const cielMspInfo = cielSummary.msp_info || null;
    const segiMspInfo = segiSummary.msp_info || null;
    const customChargeUSD = cielSummary.custom_charge_usd || 0;
    const nonCustomChargeUSD = cielSummary.non_custom_charge_usd || 0;
    const segiNonCustomChargeUSD = segiSummary.non_custom_charge_usd || 0;
    
    console.log('Ciel MSP Info:', cielMspInfo);
    console.log('Segi MSP Info:', segiMspInfo);
    console.log('Custom Charge USD:', customChargeUSD);
    console.log('Ciel Non Custom Charge USD:', nonCustomChargeUSD);
    console.log('Segi Non Custom Charge USD:', segiNonCustomChargeUSD);
    
    // MSP 금액 - M1, M2 모두 씨엘 파일의 non_custom_charge(AWS 사용료) 기준으로 계산
    // M2: 씨엘모빌리티 파일의 AWS 사용료 * 20%
    const m2Amount = cielMspInfo ? cielMspInfo.msp_invoice_amount : 0;
    // M1: 씨엘모빌리티 파일의 AWS 사용료 기준으로 계산 ($20,000 미만=$1,000, 이상=5%)
    const m1Amount = cielMspInfo ? cielMspInfo.msp_segi_amount : 0;
    // 씨엘모빌리티 사용 MSP = M2 - M1
    const cielMspAmount = m2Amount - m1Amount;
    
    // 세기모빌리티 청구 금액 = 세기 파일 총액 + M1
    const segiChargeUSD = segiTotalUSD + m1Amount;
    
    // 씨엘모빌리티 사용 금액 = 씨엘 파일 총액 - 세기모빌리티 청구 금액
    const cielUsageUSD = cielTotalUSD - segiChargeUSD;
    
    // 전역 변수 저장
    window.summaryCielTotalUSD = cielTotalUSD;
    window.summarySegiTotalUSD = segiTotalUSD;
    window.summarySegiChargeUSD = segiChargeUSD;
    window.summaryCielUsageUSD = cielUsageUSD;
    window.summaryCielDateRange = { start: cielStartDate, end: cielEndDate };
    window.summaryCielMspInfo = cielMspInfo;
    window.summarySegiMspInfo = segiMspInfo;
    window.summaryNonCustomChargeUSD = nonCustomChargeUSD;
    window.summarySegiNonCustomChargeUSD = segiNonCustomChargeUSD;
    window.summaryM2Amount = m2Amount;
    window.summaryM1Amount = m1Amount;
    window.summaryCielMspAmount = cielMspAmount;
    
    // 제목에 기간 표시
    const summaryDateRange = document.getElementById('summaryDateRange');
    if (summaryDateRange) {
        summaryDateRange.textContent = `/ ${cielStartDate} ~ ${cielEndDate}`;
    }
    
    const grid = document.getElementById('summaryGrid');
    grid.innerHTML = `
        <div class="summary-card" style="background: #F2F4FF;">
            <h3>📄 세금계산서 발행 금액(매입) (USD / KRW)</h3>
            <div class="value">
                <span>$${cielTotalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span id="cielKrwValue" style="color: #6c757d;">-</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e0;">
                M2=$20,000미만=$2,000고정 / $20,000이상=사용료*20% <br> $${m2Amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / <span id="m2KrwValue">-</span>
            </div>
        </div>
        <div class="summary-card" style="background: #F2F4FF;">
            <h3>💰 AWS 사용료 (USD / KRW)</h3>
            <div class="value">
                <span>$${nonCustomChargeUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span id="nonCustomChargeKrwValue" style="color: #6c757d;">-</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e0;">MSP 계산 기준이 되는 금액</div>
        </div>
        <div class="summary-card" style="background: #FFEFEF;">
            <h3>📤 세기모빌리티 청구 금액(매출) (USD / KRW)</h3>
            <div class="value" style="color: #E57373;">
                <span>$${segiChargeUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span id="segiKrwValue">-</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #f5a5a5;">
                M1=$20,000미만=$1,000고정 / $20,000이상=사용료*5% <br> $${m1Amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / <span id="m1KrwValue">-</span>
            </div>
        </div>
        <div class="summary-card" style="background: #F8F9FA;">
            <h3>🏢 씨엘모빌리티 사용 금액 (USD / KRW)</h3>
            <div class="value">
                <span>$${cielUsageUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span id="cielUsageKrwValue" style="color: #6c757d;">-</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e0;">
                M2-M1 차액 <br> $${cielMspAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / <span id="cielMspKrwValue">-</span>
            </div>
        </div>
    `;
    
    // 설명문 표시
    const disclaimer = document.getElementById('summaryDisclaimer');
    if (disclaimer) {
        disclaimer.style.display = 'block';
    }
    
    // 일별 비용 데이터 저장 (두 파일의 환경별 데이터를 합침)
    // 씨엘모빌리티 데이터의 환경별 비용
    const cielDailyByEnv = cielSummary.daily_costs_by_env || {};
    // 세기모빌리티 데이터의 환경별 비용
    const segiDailyByEnv = segiSummary.daily_costs_by_env || {};
    
    // 두 데이터를 합침
    const combinedDailyByEnv = { ...cielDailyByEnv };
    for (const env in segiDailyByEnv) {
        if (combinedDailyByEnv[env]) {
            // 같은 환경이 있으면 날짜별로 합산
            for (const date in segiDailyByEnv[env]) {
                combinedDailyByEnv[env][date] = (combinedDailyByEnv[env][date] || 0) + segiDailyByEnv[env][date];
            }
        } else {
            combinedDailyByEnv[env] = { ...segiDailyByEnv[env] };
        }
    }
    
    // 전체 일별 비용도 합침
    const cielDailyCosts = cielSummary.daily_costs || {};
    const segiDailyCosts = segiSummary.daily_costs || {};
    const combinedDailyCosts = { ...cielDailyCosts };
    for (const date in segiDailyCosts) {
        combinedDailyCosts[date] = (combinedDailyCosts[date] || 0) + segiDailyCosts[date];
    }
    
    dailyCostsData = combinedDailyCosts;
    dailyCostsByEnvData = combinedDailyByEnv;
    
    console.log('[DEBUG] Combined daily costs by env:', combinedDailyByEnv);
    console.log('[DEBUG] Environments:', Object.keys(combinedDailyByEnv));
    
    // 환경 필터 드롭다운 초기화 (두 데이터의 환경을 합침)
    const cielEnvs = cielSummary.environments || [];
    const segiEnvs = segiSummary.environments || [];
    const allEnvs = [...new Set([...cielEnvs, ...segiEnvs])].sort();
    initDailyTrendEnvFilter(allEnvs);
    
    // 일별 비용 추이 차트 (환경별로 표시)
    if (Object.keys(combinedDailyByEnv).length > 0) {
        displayDailyTrendChartByEnv(combinedDailyByEnv);
    } else {
        displayDailyTrendChart(combinedDailyCosts);
    }
    
    // 날짜 필터 설정
    const filterDateStart = document.getElementById('filterDateStart');
    const filterDateEnd = document.getElementById('filterDateEnd');
    if (filterDateStart && filterDateEnd) {
        filterDateStart.min = cielStartDate;
        filterDateStart.max = cielEndDate;
        filterDateEnd.min = cielStartDate;
        filterDateEnd.max = cielEndDate;
        filterDateStart.value = cielStartDate;
        filterDateEnd.value = cielEndDate;
    }
}

// 파일 업로드 처리 (기존 호환용)
async function handleFileSelect() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    
    // 여러 파일 추가
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    // 프로그레스 바 표시 (파일 개수에 따라 1~2초)
    const uploadDuration = Math.min(1 + files.length * 0.3, 2);
    const progressInterval = showProgressModal(
        '파일 업로드 중',
        `${files.length}개 파일을 처리하고 있습니다...`,
        uploadDuration
    );
    
    showLoading('uploadStatus', `${files.length}개 파일 업로드 중...`);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        // 프로그레스 바 완료
        hideProgressModal(progressInterval);
        
        if (result.success) {
            uploadedData = result;
            
            // 성공 메시지 생성
            let details = `${result.files.length}개 파일, ${result.summary.total_records}개 레코드`;
            if (result.duplicates && result.duplicates.removed > 0) {
                details += `<br>중복 ${result.duplicates.removed}건 제거됨`;
            }
            
            showProgressResult(true, '파일 업로드 완료', details);
            
            // 업로드된 파일 목록 표시
            let fileListHtml = '<div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">';
            fileListHtml += '<strong>📁 업로드된 파일:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px; list-style: none;">';
            result.files.forEach(filename => {
                fileListHtml += `<li style="word-break: break-all; margin-bottom: 4px;">• ${filename}</li>`;
            });
            fileListHtml += '</ul>';
            
            // 중복 제거 정보 표시
            if (result.duplicates && result.duplicates.removed > 0) {
                fileListHtml += `<div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-left: 3px solid #ffc107; font-size: 0.9em;">`;
                fileListHtml += `⚠️ <strong>중복 제거:</strong> 총 ${result.duplicates.total}건 중 ${result.duplicates.removed}건의 중복 데이터가 제거되었습니다.`;
                fileListHtml += `</div>`;
            }
            
            fileListHtml += '</div>';
            
            showSuccess('uploadStatus', result.message + fileListHtml);
            
            // 환율 섹션으로 슬라이딩 전환
            setTimeout(() => {
                scrollToSection('exchangeSection');
            }, 500);
            
            // 초기 요약 정보 표시 (USD만)
            displayInitialSummary(result.summary);
        } else {
            showProgressResult(false, '파일 업로드 실패', result.error);
            showError('uploadStatus', result.error);
        }
    } catch (error) {
        hideProgressModal(progressInterval);
        showProgressResult(false, '업로드 오류 발생', error.message);
        showError('uploadStatus', '업로드 실패: ' + error.message);
    }
}

// 초기 요약 정보 표시
function displayInitialSummary(summary) {
    const section = document.getElementById('summarySection');
    section.classList.remove('hidden');
    
    // 환율 정보 초기화 (아직 환율 미적용)
    document.getElementById('exchangeRateInfo').textContent = '';
    
    // 전역 변수에 날짜 범위 저장
    window.summaryDateRange = summary.date_range;
    window.summaryTotalUSD = summary.total_cost_usd;
    window.summaryCielmobilityUSD = summary.cielmobility_usd || 0;
    window.summarySmartmobilityUSD = summary.smartmobility_usd || 0;
    window.summaryHasSmartmobility = summary.has_smartmobility || false;
    
    // 날짜에서 시간 제거 (yyyy-mm-dd 형식만)
    const startDate = summary.date_range.start.split(' ')[0];
    const endDate = summary.date_range.end.split(' ')[0];
    
    const cielmobilityUSD = summary.cielmobility_usd || 0;
    const smartmobilityUSD = summary.smartmobility_usd || 0;
    const hasSmartmobility = summary.has_smartmobility || false;
    
    const grid = document.getElementById('summaryGrid');
    
    // 환경에 따라 다른 카드 표시
    if (hasSmartmobility) {
        // smartmobility 환경이 있는 경우: 세기모빌리티 청구 비용 표시
        grid.innerHTML = `
            <div class="summary-card">
                <h3>기간</h3>
                <div class="value">${startDate}<br>~<br>${endDate}</div>
            </div>
            <div class="summary-card">
                <h3>세기모빌리티 청구 비용 (USD)</h3>
                <div class="value">$${smartmobilityUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            <div class="summary-card" id="smartmobilityKrwCard" style="display: none;">
                <h3>세기모빌리티 청구 비용 (KRW)</h3>
                <div class="value" id="smartmobilityKrwValue">-</div>
            </div>
        `;
    } else {
        // environment가 없는 경우: 씨엘모빌리티 총 비용 표시
        grid.innerHTML = `
            <div class="summary-card">
                <h3>기간</h3>
                <div class="value">${startDate}<br>~<br>${endDate}</div>
            </div>
            <div class="summary-card">
                <h3>씨엘모빌리티 총 비용 (USD)</h3>
                <div class="value">$${cielmobilityUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            <div class="summary-card" id="cielmobilityKrwCard" style="display: none;">
                <h3>씨엘모빌리티 총 비용 (KRW)</h3>
                <div class="value" id="cielmobilityKrwValue">-</div>
            </div>
        `;
    }
    
    // 일별 비용 데이터 저장 (전역)
    dailyCostsData = summary.daily_costs;
    dailyCostsByEnvData = summary.daily_costs_by_env;
    
    // 환경 필터 드롭다운 초기화
    initDailyTrendEnvFilter(summary.environments || []);
    
    // 일별 비용 추이 차트
    displayDailyTrendChart(summary.daily_costs);
    
    // 날짜 필터 입력창에 min/max 설정 및 기본 달력 월 설정
    const filterDateStart = document.getElementById('filterDateStart');
    const filterDateEnd = document.getElementById('filterDateEnd');
    if (filterDateStart && filterDateEnd) {
        filterDateStart.min = startDate;
        filterDateStart.max = endDate;
        filterDateEnd.min = startDate;
        filterDateEnd.max = endDate;
        // 기본값을 시작일로 설정하여 달력이 해당 월에서 시작되도록 함
        filterDateStart.value = startDate;
        filterDateEnd.value = endDate;
    }
    
    // 요약 섹션으로 슬라이딩 (약간의 지연 후)
    setTimeout(() => {
        scrollToSection('summarySection');
    }, 300);
}

// 한국수출입은행에서 환율 자동 조회
async function fetchExchangeRateAPI() {
    const apiDate = document.getElementById('apiDate').value;
    
    if (!apiDate) {
        alert('조회할 날짜를 선택하세요');
        return;
    }
    
    console.log('[환율 조회] 요청 날짜:', apiDate);
    
    // 프로그레스 바 표시 (네트워크 호출 3초)
    const progressInterval = showProgressModal(
        '환율 조회 및 적용 중',
        `${apiDate} 환율 정보를 가져와서 데이터에 적용하고 있습니다...`,
        3
    );
    
    try {
        const response = await fetch('/api/exchange-rate/fetch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: 'koreaexim',
                date: apiDate
            })
        });
        
        const result = await response.json();
        console.log('[환율 조회] 응답:', result);
        
        if (result.success) {
            // 수동 입력 필드에 자동으로 채우기
            document.getElementById('exchangeRate').value = result.rate;
            
            // 프로그레스 바 텍스트 업데이트
            document.getElementById('progressText').textContent = '환율을 데이터에 적용하는 중...';
            
            // 자동으로 환율 적용
            const applyResult = await applyExchangeRate(result.rate);
            
            // 프로그레스 바 완료
            hideProgressModal(progressInterval);
            
            if (applyResult) {
                showProgressResult(
                    true, 
                    '환율 조회 및 적용 완료',
                    `조회된 환율: 1 USD = ${result.rate.toLocaleString()} KRW<br>환율이 모든 데이터에 적용되었습니다.`
                );
                
                // HTML 저장 버튼 표시
                showSaveHtmlButton();
                
                // 요약 섹션으로 스크롤 (모달 닫힌 후)
                setTimeout(() => {
                    scrollToSection('summarySection');
                }, 100);
            } else {
                showProgressResult(false, '환율 적용 실패', '데이터에 환율을 적용하는 중 오류가 발생했습니다.');
            }
        } else {
            hideProgressModal(progressInterval);
            console.error('[환율 조회] 실패:', result.error);
            
            // 간결한 오류 메시지 (자세한 내용은 콘솔에만)
            let simpleError = 'API 서버 연결 실패';
            if (result.error.includes('날짜') || result.error.includes('공휴일')) {
                simpleError = '해당 날짜의 환율 정보 없음';
            }
            
            showProgressResult(false, '환율 조회 실패', simpleError);
        }
    } catch (error) {
        hideProgressModal(progressInterval);
        console.error('[환율 조회] 예외 발생:', error);
        showProgressResult(false, 'API 조회 실패', 'API 서버 연결 실패');
    }
}

// 환율 적용 함수 (내부 사용)
async function applyExchangeRate(rate) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const response = await fetch('/api/exchange-rate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rate: rate,
                date: today
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 요약 정보 업데이트
            updateSummaryWithKRW(result.summary);
            
            // 비용 요약 섹션으로 슬라이딩
            setTimeout(() => {
                scrollToSection('summarySection');
            }, 500);
            
            // 데이터 테이블 표시
            loadData();
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('환율 적용 실패:', error);
        return false;
    }
}

// 환율 설정
async function setExchangeRate() {
    const rate = parseFloat(document.getElementById('exchangeRate').value);
    
    if (!rate || rate <= 0) {
        alert('유효한 환율을 입력하세요');
        return;
    }
    
    // 프로그레스 바 표시 (로컬 계산 1.5초)
    const progressInterval = showProgressModal(
        '환율 적용 중',
        `1 USD = ${rate.toLocaleString()} KRW 환율을 데이터에 적용하고 있습니다...`,
        1.5
    );
    
    const result = await applyExchangeRate(rate);
    
    // 프로그레스 바 완료
    hideProgressModal(progressInterval);
    
    if (result) {
        showProgressResult(
            true,
            '환율 적용 완료',
            `1 USD = ${rate.toLocaleString()} KRW<br>환율이 모든 데이터에 적용되었습니다.`
        );
        
        // HTML 저장 버튼 표시
        showSaveHtmlButton();
        
        // 요약 섹션으로 스크롤
        setTimeout(() => {
            scrollToSection('summarySection');
        }, 100);
    } else {
        showProgressResult(false, '환율 설정 실패', '데이터에 환율을 적용하는 중 오류가 발생했습니다.');
    }
}

// KRW 포함 요약 정보 업데이트
function updateSummaryWithKRW(summary) {
    // 환율 정보를 타이틀 옆에 표시
    const exchangeRateInfo = document.getElementById('exchangeRateInfo');
    exchangeRateInfo.textContent = `/ (환율 ${summary.exchange_rate.toLocaleString(undefined, {minimumFractionDigits: 2})}원 적용)`;
    
    const rate = summary.exchange_rate;
    
    // 새 이중 업로드 시스템 (cielData, segiData 사용)
    if (cielData || segiData) {
        // 씨엘모빌리티 KRW 값 업데이트
        const cielKrwValue = document.getElementById('cielKrwValue');
        if (cielKrwValue && window.summaryCielTotalUSD) {
            const cielKRW = window.summaryCielTotalUSD * rate;
            cielKrwValue.textContent = `₩${cielKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            cielKrwValue.style.color = '#212529';
        }
        
        // 세기모빌리티 KRW 값 업데이트 (세기 파일 총액 + M1)
        const segiKrwValue = document.getElementById('segiKrwValue');
        if (segiKrwValue && window.summarySegiChargeUSD !== undefined) {
            const segiKRW = window.summarySegiChargeUSD * rate;
            segiKrwValue.textContent = `₩${segiKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            segiKrwValue.style.color = '#E57373';
        }
        
        // 씨엘모빌리티 사용 금액 KRW 값 업데이트 (차액)
        const cielUsageKrwValue = document.getElementById('cielUsageKrwValue');
        if (cielUsageKrwValue && window.summaryCielUsageUSD !== undefined) {
            const cielUsageKRW = window.summaryCielUsageUSD * rate;
            cielUsageKrwValue.textContent = `₩${cielUsageKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            cielUsageKrwValue.style.color = '#212529';
        }
        
        // MSP 금액 KRW 값 업데이트
        if (window.summaryCielMspInfo || window.summarySegiMspInfo) {
            // M2 (세금계산서 발행 MSP) - 씨엘모빌리티 데이터 기준
            const m2KrwValue = document.getElementById('m2KrwValue');
            if (m2KrwValue && window.summaryM2Amount !== undefined) {
                const m2KRW = window.summaryM2Amount * rate;
                m2KrwValue.textContent = `₩${m2KRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            }
            
            // M1 (세기모빌리티 MSP) - 세기모빌리티 데이터 기준
            const m1KrwValue = document.getElementById('m1KrwValue');
            if (m1KrwValue && window.summaryM1Amount !== undefined) {
                const m1KRW = window.summaryM1Amount * rate;
                m1KrwValue.textContent = `₩${m1KRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            }
            
            // 씨엘모빌리티 사용 MSP (M2 - M1)
            const cielMspKrwValue = document.getElementById('cielMspKrwValue');
            if (cielMspKrwValue && window.summaryCielMspAmount !== undefined) {
                const cielMspKRW = window.summaryCielMspAmount * rate;
                cielMspKrwValue.textContent = `₩${cielMspKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            }
        }
        
        // MSP외 사용요금 (Custom Charge 외 금액) KRW 값 업데이트
        const nonCustomChargeKrwValue = document.getElementById('nonCustomChargeKrwValue');
        if (nonCustomChargeKrwValue && window.summaryNonCustomChargeUSD !== undefined) {
            const nonCustomChargeKRW = window.summaryNonCustomChargeUSD * rate;
            nonCustomChargeKrwValue.textContent = `₩${nonCustomChargeKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            nonCustomChargeKrwValue.style.color = '#212529';
        }
    } else {
        // 기존 단일 업로드 시스템 (하위 호환)
        const cielmobilityKRW = (window.summaryCielmobilityUSD || 0) * rate;
        const smartmobilityKRW = (window.summarySmartmobilityUSD || 0) * rate;
        const hasSmartmobility = window.summaryHasSmartmobility || false;
        
        if (hasSmartmobility) {
            const smartmobilityKrwValue = document.getElementById('smartmobilityKrwValue');
            if (smartmobilityKrwValue) {
                smartmobilityKrwValue.textContent = `₩${smartmobilityKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
                smartmobilityKrwValue.style.color = '#212529';
            }
        } else {
            const cielmobilityKrwValue = document.getElementById('cielmobilityKrwValue');
            if (cielmobilityKrwValue) {
                cielmobilityKrwValue.textContent = `₩${cielmobilityKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
                cielmobilityKrwValue.style.color = '#212529';
            }
        }
    }
    
    // 일별 비용 추이 차트에 환율 적용 (툴팁에서 KRW 표시용)
    dailyTrendExchangeRate = summary.exchange_rate;
}

// 일별 비용 추이 라인 차트
let dailyTrendChart = null;
let dailyTrendExchangeRate = null; // 환율 저장용

// 일별 비용 추이 환경 필터 초기화
function initDailyTrendEnvFilter(environments) {
    const select = document.getElementById('dailyTrendEnvFilter');
    if (!select) return;
    
    // 기존 옵션 제거 (첫 번째 '전체 환경' 제외)
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // 환경 옵션 추가
    environments.forEach(env => {
        const option = document.createElement('option');
        option.value = env;
        option.textContent = env;
        select.appendChild(option);
    });
}

// 일별 비용 추이 차트 업데이트 (환경 필터 변경 시)
function updateDailyTrendChart() {
    const select = document.getElementById('dailyTrendEnvFilter');
    const selectedEnv = select ? select.value : '';
    
    if (selectedEnv && dailyCostsByEnvData && dailyCostsByEnvData[selectedEnv]) {
        // 특정 환경 선택 - 단일 환경 데이터로 표시
        displaySingleEnvChart(dailyCostsByEnvData[selectedEnv], selectedEnv);
    } else {
        // 전체 환경 - 모든 환경을 한 차트에 표시
        if (dailyCostsByEnvData && Object.keys(dailyCostsByEnvData).length > 0) {
            displayDailyTrendChartByEnv(dailyCostsByEnvData);
        } else {
            displaySingleEnvChart(dailyCostsData, '전체');
        }
    }
}

// 단일 환경 차트 표시
function displaySingleEnvChart(dailyCosts, envName) {
    const section = document.getElementById('dailyTrendSection');
    
    if (!dailyCosts || Object.keys(dailyCosts).length === 0) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    
    // 기존 차트 제거
    if (dailyTrendChart) {
        dailyTrendChart.destroy();
    }
    
    // 날짜순 정렬
    const sortedDates = Object.keys(dailyCosts).sort();
    const costs = sortedDates.map(date => dailyCosts[date]);
    
    // 날짜 포맷 (MM-DD)
    const labels = sortedDates.map(date => {
        const parts = date.split('-');
        return `${parts[1]}-${parts[2]}`;
    });
    
    // 환경별 색상
    const envColors = {
        'cielmobility': { border: '#4299e1', background: 'rgba(66, 153, 225, 0.1)' },
        'smartmobility': { border: '#E57373', background: 'rgba(229, 115, 115, 0.1)' }
    };
    const colors = envColors[envName] || { border: '#4299e1', background: 'rgba(66, 153, 225, 0.1)' };
    
    dailyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: envName,
                data: costs,
                borderColor: colors.border,
                backgroundColor: colors.background,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            let labelText = `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            if (dailyTrendExchangeRate) {
                                const krwValue = value * dailyTrendExchangeRate;
                                labelText += ` (₩${krwValue.toLocaleString(undefined, {maximumFractionDigits: 0})})`;
                            }
                            return labelText;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function displayDailyTrendChart(dailyCosts, exchangeRate = null) {
    const section = document.getElementById('dailyTrendSection');
    
    // dailyCostsByEnvData가 있으면 환경별로 표시
    if (dailyCostsByEnvData && Object.keys(dailyCostsByEnvData).length > 0) {
        displayDailyTrendChartByEnv(dailyCostsByEnvData, exchangeRate);
        return;
    }
    
    if (!dailyCosts || Object.keys(dailyCosts).length === 0) {
        section.classList.add('hidden');
        return;
    }
    
    // 환율 저장 (나중에 업데이트될 수 있음)
    if (exchangeRate) {
        dailyTrendExchangeRate = exchangeRate;
    }
    
    section.classList.remove('hidden');
    
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    
    // 기존 차트 제거
    if (dailyTrendChart) {
        dailyTrendChart.destroy();
    }
    
    // 날짜순 정렬
    const sortedDates = Object.keys(dailyCosts).sort();
    const costs = sortedDates.map(date => dailyCosts[date]);
    
    // 전일 대비 증감 계산
    const changes = costs.map((cost, i) => {
        if (i === 0) return 0;
        return cost - costs[i - 1];
    });
    
    // 날짜 포맷 (MM-DD)
    const labels = sortedDates.map(date => {
        const parts = date.split('-');
        return `${parts[1]}-${parts[2]}`;
    });
    
    dailyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '일별 비용 (USD)',
                    data: costs,
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            let labels = [`USD: $${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`];
                            
                            // 환율이 설정된 경우 KRW도 표시
                            if (dailyTrendExchangeRate) {
                                const krwValue = value * dailyTrendExchangeRate;
                                labels.push(`KRW: ₩${krwValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
                            }
                            
                            return labels;
                        },
                        afterLabel: function(context) {
                            const idx = context.dataIndex;
                            if (idx === 0) return '';
                            const change = changes[idx];
                            const sign = change >= 0 ? '+' : '';
                            const arrow = change > 0 ? '▲' : (change < 0 ? '▼' : '');
                            
                            let result = `전일대비: ${sign}$${change.toFixed(2)} ${arrow}`;
                            
                            // 환율이 설정된 경우 KRW 증감도 표시
                            if (dailyTrendExchangeRate) {
                                const changeKrw = change * dailyTrendExchangeRate;
                                const signKrw = changeKrw >= 0 ? '+' : '';
                                result += `\n         ${signKrw}₩${Math.abs(changeKrw).toLocaleString(undefined, {maximumFractionDigits: 0})}`;
                            }
                            
                            return result;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 환경별 일별 비용 추이 차트 표시 (모든 환경을 한 차트에)
function displayDailyTrendChartByEnv(dailyCostsByEnv, exchangeRate = null) {
    const section = document.getElementById('dailyTrendSection');
    
    if (!dailyCostsByEnv || Object.keys(dailyCostsByEnv).length === 0) {
        section.classList.add('hidden');
        return;
    }
    
    // 환율 저장
    if (exchangeRate) {
        dailyTrendExchangeRate = exchangeRate;
    }
    
    section.classList.remove('hidden');
    
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    
    // 기존 차트 제거
    if (dailyTrendChart) {
        dailyTrendChart.destroy();
    }
    
    // 모든 환경의 날짜를 수집하여 정렬
    const allDates = new Set();
    Object.values(dailyCostsByEnv).forEach(envData => {
        Object.keys(envData).forEach(date => allDates.add(date));
    });
    const sortedDates = Array.from(allDates).sort();
    
    // 날짜 포맷 (MM-DD)
    const labels = sortedDates.map(date => {
        const parts = date.split('-');
        return `${parts[1]}-${parts[2]}`;
    });
    
    // 환경별 색상 정의
    const envColors = {
        'cielmobility': { border: '#4299e1', background: 'rgba(66, 153, 225, 0.1)' },
        'smartmobility': { border: '#E57373', background: 'rgba(229, 115, 115, 0.1)' },
        'Unknown': { border: '#9CA3AF', background: 'rgba(156, 163, 175, 0.1)' }
    };
    
    // 환경별 데이터셋 생성
    const datasets = [];
    const environments = Object.keys(dailyCostsByEnv).sort();
    
    environments.forEach((env, index) => {
        const envData = dailyCostsByEnv[env];
        const costs = sortedDates.map(date => envData[date] || 0);
        
        // 색상 결정
        let colors = envColors[env];
        if (!colors) {
            // 기본 색상 팔레트
            const defaultColors = [
                { border: '#48BB78', background: 'rgba(72, 187, 120, 0.1)' },
                { border: '#ED8936', background: 'rgba(237, 137, 54, 0.1)' },
                { border: '#9F7AEA', background: 'rgba(159, 122, 234, 0.1)' }
            ];
            colors = defaultColors[index % defaultColors.length];
        }
        
        datasets.push({
            label: env,
            data: costs,
            borderColor: colors.border,
            backgroundColor: colors.background,
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    });
    
    dailyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const envName = context.dataset.label;
                            let labelText = `${envName}: $${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            
                            // 환율이 설정된 경우 KRW도 표시
                            if (dailyTrendExchangeRate) {
                                const krwValue = value * dailyTrendExchangeRate;
                                labelText += ` (₩${krwValue.toLocaleString(undefined, {maximumFractionDigits: 0})})`;
                            }
                            
                            return labelText;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 데이터 로드
async function loadData(page = 1) {
    currentPage = page;
    
    const params = new URLSearchParams({
        page: 1,
        per_page: 10000,  // 전체 데이터를 한 번에 가져오기
        ...currentFilters
    });
    
    try {
        const response = await fetch('/api/data?' + params);
        const result = await response.json();
        
        if (result.success) {
            displayDataTable(result.data);
            // 페이지네이션 숨김 (전체 데이터를 한 번에 표시하므로)
            document.getElementById('pagination').innerHTML = '';
            
            // 필터 옵션 업데이트
            updateFilters(result.data);
            
            // 필터 적용 시 합계 표시
            updateFilterSummary(result.data);
            
            // 데이터 섹션 표시
            document.getElementById('dataSection').classList.remove('hidden');
            
            // 첫 페이지 로드 시에만 스크롤 (페이지네이션 클릭 시 제외)
            if (page === 1 && !document.querySelector('#dataTable table')) {
                setTimeout(() => {
                    scrollToSection('dataSection');
                }, 500);
            }
        }
    } catch (error) {
        console.error('데이터 로드 실패:', error);
    }
}

// 필터 적용 결과 합계 표시
function updateFilterSummary(data) {
    const filterSummary = document.getElementById('filterSummary');
    const filterTotalUSD = document.getElementById('filterTotalUSD');
    const filterTotalKRW = document.getElementById('filterTotalKRW');
    
    if (data.length > 0) {
        // 선택된 환경 가져오기
        const selectedEnv = getSelectedEnvironment();
        
        // 비용 합계 계산 (비용이 0보다 큰 데이터만)
        let totalUSD = 0;
        let totalKRW = 0;
        
        data.forEach(row => {
            const cost = parseFloat(row.cost) || 0;
            const costKrw = parseFloat(row.cost_krw) || 0;
            
            if (cost > 0) {
                totalUSD += cost;
                totalKRW += costKrw;
            }
        });
        
        // 환경에 따른 표시 로직
        // - 전체 환경 ('') : 세금계산서 발행 금액 (cielData 총합)
        // - cielmobility : 씨엘모빌리티 사용 금액 (cielData - segiData)
        // - smartmobility : 세기모빌리티 청구 금액 (segiData 총합)
        
        let displayUSD = totalUSD;
        let displayKRW = totalKRW;
        let labelPrefix = '';
        
        if (selectedEnv === '') {
            // 전체 환경 → 세금계산서 발행 금액
            if (window.summaryCielTotalUSD !== undefined) {
                displayUSD = window.summaryCielTotalUSD;
                // KRW 환산
                const rate = parseFloat(document.getElementById('exchangeRate').value) || 0;
                displayKRW = displayUSD * rate;
                labelPrefix = '📄 세금계산서 발행 금액: ';
            }
        } else if (selectedEnv.toLowerCase() === 'cielmobility') {
            // cielmobility → 씨엘모빌리티 사용 금액 (씨엘 파일 총액 - 세기모빌리티 청구 금액)
            // custom charge 포함하여 계산
            if (window.summaryCielUsageUSD !== undefined) {
                displayUSD = window.summaryCielUsageUSD;
                const rate = parseFloat(document.getElementById('exchangeRate').value) || 0;
                displayKRW = displayUSD * rate;
                labelPrefix = '🏢 씨엘모빌리티 사용 금액: ';
            }
        } else if (selectedEnv.toLowerCase() === 'smartmobility') {
            // smartmobility → 세기모빌리티 청구 금액 (세기 파일 총액 + M1)
            if (window.summarySegiChargeUSD !== undefined) {
                displayUSD = window.summarySegiChargeUSD;
                const rate = parseFloat(document.getElementById('exchangeRate').value) || 0;
                displayKRW = displayUSD * rate;
                labelPrefix = '📤 세기모빌리티 청구 금액: ';
            }
        }
        
        filterTotalUSD.textContent = `${labelPrefix}💵 $${displayUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        filterTotalKRW.textContent = `💰 ₩${displayKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
        filterSummary.style.display = 'block';
    } else {
        filterSummary.style.display = 'none';
    }
}

// 환경별 색상 매핑
const environmentColors = {
    'smartmobility': '#667eea',
    'cielmobility': '#8B77D3',
    'production': '#48bb78',
    'staging': '#ed8936',
    'development': '#4299e1',
    'test': '#9f7aea',
    'default': '#718096'
};

// 정렬 상태 저장
let sortStates = {}; // { 'service-0': { field: 'date', order: 'asc' } }

// 기본 정렬 설정
const defaultSortSettings = {
    'date': 'asc',
    'description': 'asc',
    'environment': 'asc',
    'usd': 'desc',
    'krw': 'desc'
};

function getEnvironmentColor(env) {
    return environmentColors[env.toLowerCase()] || environmentColors['default'];
}

// 데이터 정렬 함수
function sortServiceData(serviceId, field) {
    const currentState = sortStates[serviceId] || { field: null, order: null };
    
    // 같은 필드 클릭 시 방향 전환, 다른 필드 클릭 시 기본 정렬 방향 사용
    let newOrder;
    if (currentState.field === field) {
        newOrder = currentState.order === 'asc' ? 'desc' : 'asc';
    } else {
        newOrder = defaultSortSettings[field] || 'asc';
    }
    
    sortStates[serviceId] = { field, order: newOrder };
    
    // 테이블 tbody 가져오기
    const tbody = document.querySelector(`#${serviceId} tbody`);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // 정렬
    rows.sort((a, b) => {
        let aVal, bVal;
        
        if (field === 'date') {
            aVal = a.cells[0].textContent;
            bVal = b.cells[0].textContent;
        } else if (field === 'description') {
            aVal = a.cells[1].textContent;
            bVal = b.cells[1].textContent;
        } else if (field === 'environment') {
            aVal = a.cells[2].textContent;
            bVal = b.cells[2].textContent;
        } else if (field === 'usd') {
            aVal = parseFloat(a.cells[3].textContent.replace(/[$,]/g, '')) || 0;
            bVal = parseFloat(b.cells[3].textContent.replace(/[$,]/g, '')) || 0;
        } else if (field === 'krw') {
            aVal = parseFloat(a.cells[4].textContent.replace(/[₩,]/g, '')) || 0;
            bVal = parseFloat(b.cells[4].textContent.replace(/[₩,]/g, '')) || 0;
        }
        
        if (aVal < bVal) return newOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return newOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    // 정렬된 행으로 다시 구성
    rows.forEach(row => tbody.appendChild(row));
    
    // 정렬 아이콘 업데이트
    updateSortIcons(serviceId, field, newOrder);
}

// 초기 정렬 적용 (날짜 오름차순)
function applyInitialSort(serviceId) {
    sortStates[serviceId] = { field: 'date', order: 'asc' };
    
    const tbody = document.querySelector(`#${serviceId} tbody`);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        const aVal = a.cells[0].textContent;
        const bVal = b.cells[0].textContent;
        return aVal < bVal ? -1 : (aVal > bVal ? 1 : 0);
    });
    
    rows.forEach(row => tbody.appendChild(row));
    updateSortIcons(serviceId, 'date', 'asc');
}

// 정렬 아이콘 업데이트
function updateSortIcons(serviceId, activeField, order) {
    const headers = document.querySelectorAll(`#${serviceId} th[data-sort]`);
    headers.forEach(th => {
        const field = th.getAttribute('data-sort');
        const icon = th.querySelector('.sort-icon');
        
        if (field === activeField) {
            icon.textContent = order === 'asc' ? '▲' : '▼';
            icon.style.opacity = '1';
        } else {
            icon.textContent = '▲';
            icon.style.opacity = '0.3';
        }
    });
}

// 데이터 테이블 표시 (서비스별 그룹화 + 토글)
function displayDataTable(data) {
    const container = document.getElementById('dataTable');
    
    // Custom Charge 가상 데이터 처리를 위한 변수들 먼저 확인
    const selectedEnv = getSelectedEnvironment();
    const selectedServices = getSelectedServices();
    const isServiceFiltered = selectedServices.length > 0;
    const isCustomChargeSelected = selectedServices.some(s => s.toLowerCase().includes('custom charge'));
    const isSmartmobilityEnv = selectedEnv.toLowerCase() === 'smartmobility';
    const hasM1Amount = window.summaryM1Amount !== undefined && window.summaryM1Amount > 0;
    
    // Custom Charge만 선택된 경우 빈 데이터여도 가상 데이터 표시
    if (data.length === 0) {
        if (isSmartmobilityEnv && hasM1Amount && isCustomChargeSelected) {
            // Custom Charge 가상 데이터로 계속 진행
        } else {
            container.innerHTML = '<p style="text-align: center; padding: 40px;">데이터가 없습니다</p>';
            return;
        }
    }
    
    // 서비스별로 그룹화
    const groupedByService = {};
    data.forEach(row => {
        const service = row.service_name || '기타';
        if (!groupedByService[service]) {
            groupedByService[service] = [];
        }
        groupedByService[service].push(row);
    });
    
    // smartmobility 환경 필터 시 Custom Charge(M1)가 없으면 가상으로 추가
    // 서비스 필터가 없거나, Custom Charge가 선택된 경우에만 추가
    // (isServiceFiltered, isCustomChargeSelected는 위에서 이미 선언됨)
    
    if (isSmartmobilityEnv && 
        window.summaryM1Amount !== undefined && window.summaryM1Amount > 0 &&
        (!isServiceFiltered || isCustomChargeSelected)) {  // 서비스 필터 없거나 Custom Charge 선택됨
        const hasCustomCharge = Object.keys(groupedByService).some(s => s.toLowerCase().includes('custom charge'));
        if (!hasCustomCharge) {
            // Custom Charge 가상 데이터 추가
            const rate = parseFloat(document.getElementById('exchangeRate').value) || 0;
            groupedByService['Custom Charge'] = [{
                service_name: 'Custom Charge',
                description: 'MSP Fee (M1)',
                cost: window.summaryM1Amount,
                cost_krw: window.summaryM1Amount * rate,
                environment: 'smartmobility',
                date: window.summaryCielDateRange ? window.summaryCielDateRange.start : ''
            }];
        }
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
    
    // USD 비용 내림차순 정렬 (비용 0인 서비스 제외)
    const sortedServices = Object.keys(groupedByService)
        .filter(service => {
            const total = groupedByService[service].reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
            return total > 0;
        })
        .sort((a, b) => {
            const totalA = groupedByService[a].reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
            const totalB = groupedByService[b].reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
            return totalB - totalA;
        });
    
    sortedServices.forEach((service, index) => {
        const rows = groupedByService[service];
        const rowsWithCost = rows.filter(r => (parseFloat(r.cost) || 0) > 0);
        let totalUSD = rows.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        let totalKRW = rows.reduce((sum, r) => sum + (parseFloat(r.cost_krw) || 0), 0);
        
        // cielmobility 환경 필터 시 Custom Charge는 M2-M1로 계산
        // smartmobility 환경 필터 시 Custom Charge는 M1로 계산
        const isCustomCharge = service.toLowerCase().includes('custom charge');
        if (isCustomCharge) {
            if (selectedEnv.toLowerCase() === 'cielmobility' && window.summaryCielMspAmount !== undefined) {
                // cielmobility: M2-M1
                totalUSD = window.summaryCielMspAmount;
                const rate = parseFloat(document.getElementById('exchangeRate').value) || 0;
                totalKRW = totalUSD * rate;
            } else if (selectedEnv.toLowerCase() === 'smartmobility' && window.summaryM1Amount !== undefined) {
                // smartmobility: M1
                totalUSD = window.summaryM1Amount;
                const rate = parseFloat(document.getElementById('exchangeRate').value) || 0;
                totalKRW = totalUSD * rate;
            }
        }
        
        const serviceId = `service-${index}`;
        
        html += `
            <div style="border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div class="service-header" onclick="toggleService('${serviceId}')" style="
                    background: #DEE2E6; color: #495057; cursor: pointer;
                    padding: 12px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span id="toggle-icon-${index}" style="font-size: 1.2em;">▶</span>
                        <strong style="font-size: 1.05em;">${service}</strong>
                        <span style="opacity: 0.8; font-size: 0.9em;">(${rowsWithCost.length}건)</span>
                    </div>
                    <div style="display: flex; gap: 20px; font-size: 0.95em;">
                        <span>💵 $${totalUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        <span>💰 ₩${totalKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                </div>
                <div id="${serviceId}" class="service-details" style="display: none;">
                    <table style="width: 100%; margin: 0; border-radius: 0;">
                        <thead>
                            <tr>
                                <th data-sort="date" onclick="event.stopPropagation(); sortServiceData('${serviceId}', 'date')" style="width: 100px; cursor: pointer; user-select: none;">
                                    날짜 <span class="sort-icon" style="opacity: 0.3;">▲</span>
                                </th>
                                <th data-sort="description" onclick="event.stopPropagation(); sortServiceData('${serviceId}', 'description')" style="cursor: pointer; user-select: none;">
                                    설명 <span class="sort-icon" style="opacity: 0.3;">▲</span>
                                </th>
                                <th data-sort="environment" onclick="event.stopPropagation(); sortServiceData('${serviceId}', 'environment')" style="width: 120px; cursor: pointer; user-select: none;">
                                    환경 <span class="sort-icon" style="opacity: 0.3;">▲</span>
                                </th>
                                <th data-sort="usd" onclick="event.stopPropagation(); sortServiceData('${serviceId}', 'usd')" style="width: 110px; text-align: right; cursor: pointer; user-select: none;">
                                    USD <span class="sort-icon" style="opacity: 0.3;">▲</span>
                                </th>
                                <th data-sort="krw" onclick="event.stopPropagation(); sortServiceData('${serviceId}', 'krw')" style="width: 130px; text-align: right; cursor: pointer; user-select: none;">
                                    KRW <span class="sort-icon" style="opacity: 0.3;">▲</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        rows.forEach(row => {
            const cost = parseFloat(row.cost) || 0;
            
            // 비용이 0인 행은 숨김
            if (cost === 0) return;
            
            const costUSD = '$' + cost.toLocaleString(undefined, {minimumFractionDigits: 2});
            const costKRW = row.cost_krw ? '₩' + parseFloat(row.cost_krw).toLocaleString(undefined, {maximumFractionDigits: 0}) : '-';
            const description = row.description || '-';
            const dateOnly = row.date ? row.date.split(' ')[0] : '-'; // 날짜만 추출 (시간 제거)
            const envValue = row.environment || 'cielmobility';
            const envColor = getEnvironmentColor(envValue);
            
            html += `
                <tr>
                    <td>${dateOnly}</td>
                    <td style="font-size: 0.9em;" title="${description}">${description}</td>
                    <td>
                        <span style="
                            background: ${envColor};
                            color: white;
                            padding: 4px 12px;
                            border-radius: 12px;
                            font-size: 0.85em;
                            display: inline-block;
                        ">${envValue}</span>
                    </td>
                    <td style="text-align: right;">${costUSD}</td>
                    <td style="text-align: right;"><strong>${costKRW}</strong></td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
    
    // 모든 서비스에 초기 정렬 적용 (날짜 오름차순)
    Object.keys(groupedByService).forEach((service, index) => {
        const serviceId = `service-${index}`;
        // DOM이 렌더링된 후 정렬 적용
        setTimeout(() => applyInitialSort(serviceId), 0);
    });
}

// 서비스 토글 함수
function toggleService(serviceId) {
    const details = document.getElementById(serviceId);
    // service-0 또는 date-0 형식 모두 지원
    let iconId;
    if (serviceId.startsWith('date-')) {
        iconId = 'toggle-icon-' + serviceId.replace('date-', '');
    } else {
        iconId = serviceId.replace('service-', 'toggle-icon-');
    }
    const icon = document.getElementById(iconId);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        if (icon) icon.textContent = '▼';
    } else {
        details.style.display = 'none';
        if (icon) icon.textContent = '▶';
    }
}

// 페이지네이션 표시
function displayPagination(pagination) {
    const container = document.getElementById('pagination');
    
    let html = '';
    
    // 이전 버튼
    html += `<button ${pagination.page === 1 ? 'disabled' : ''} onclick="loadData(${pagination.page - 1})">◀ 이전</button>`;
    
    // 페이지 번호
    for (let i = 1; i <= Math.min(pagination.total_pages, 10); i++) {
        html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="loadData(${i})">${i}</button>`;
    }
    
    // 다음 버튼
    html += `<button ${pagination.page === pagination.total_pages ? 'disabled' : ''} onclick="loadData(${pagination.page + 1})">다음 ▶</button>`;
    
    container.innerHTML = html;
}

// 필터 업데이트
function updateFilters(data) {
    // 전체 데이터 캐시 저장 (환경별 서비스 필터링용)
    allDataCache = data;
    
    const services = [...new Set(data.map(r => r.service_name).filter(s => s))].sort();
    const environments = [...new Set(data.map(r => r.environment).filter(e => e))].sort();
    
    const serviceCheckboxList = document.getElementById('serviceCheckboxList');
    const environmentRadioList = document.getElementById('environmentRadioList');
    
    // 서비스 체크박스 필터
    if (serviceCheckboxList && serviceCheckboxList.children.length === 0) {
        services.forEach(service => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = service;
            checkbox.className = 'service-checkbox';
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(service));
            serviceCheckboxList.appendChild(label);
        });
    }
    
    // 환경 라디오 버튼 필터
    if (environmentRadioList && environmentRadioList.children.length === 0) {
        // 전체 환경 옵션
        const allLabel = document.createElement('label');
        const allRadio = document.createElement('input');
        allRadio.type = 'radio';
        allRadio.name = 'environment';
        allRadio.value = '';
        allRadio.className = 'environment-radio';
        allRadio.checked = true;
        allRadio.onclick = function() { selectEnvironment('', '전체 환경'); };
        allLabel.appendChild(allRadio);
        allLabel.appendChild(document.createTextNode('전체 환경'));
        environmentRadioList.appendChild(allLabel);
        
        // 개별 환경 옵션
        environments.forEach(env => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'environment';
            radio.value = env;
            radio.className = 'environment-radio';
            radio.onclick = function() { selectEnvironment(env, env); };
            label.appendChild(radio);
            label.appendChild(document.createTextNode(env));
            environmentRadioList.appendChild(label);
        });
    }
}

// 서비스 드롭다운 토글
function toggleServiceDropdown() {
    document.getElementById('serviceDropdownContent').classList.toggle('show');
    document.getElementById('environmentDropdownContent').classList.remove('show');
}

// 환경 드롭다운 토글
function toggleEnvironmentDropdown() {
    document.getElementById('environmentDropdownContent').classList.toggle('show');
    document.getElementById('serviceDropdownContent').classList.remove('show');
}

// 환경 선택
function selectEnvironment(value, text) {
    document.getElementById('environmentDropdownText').textContent = text;
    document.getElementById('environmentDropdownContent').classList.remove('show');
    
    // 선택된 환경에 따라 서비스 목록 필터링
    updateServiceListByEnvironment(value);
}

// 환경에 따른 서비스 목록 업데이트
function updateServiceListByEnvironment(selectedEnv) {
    if (!allDataCache) return;
    
    const serviceCheckboxList = document.getElementById('serviceCheckboxList');
    if (!serviceCheckboxList) return;
    
    // 현재 선택된 서비스들 저장
    const currentlySelected = getSelectedServices();
    
    // 환경에 해당하는 데이터 필터링
    let filteredData = allDataCache;
    if (selectedEnv) {
        filteredData = allDataCache.filter(r => r.environment === selectedEnv);
    }
    
    // 해당 환경의 서비스 목록 추출 (비용이 0보다 큰 것만)
    const servicesWithCost = {};
    filteredData.forEach(r => {
        if (r.service_name && r.cost > 0) {
            servicesWithCost[r.service_name] = true;
        }
    });
    
    // smartmobility 환경일 때 Custom Charge 추가 (가상 데이터이므로 수동 추가)
    if (selectedEnv && selectedEnv.toLowerCase() === 'smartmobility' && 
        window.summaryM1Amount !== undefined && window.summaryM1Amount > 0) {
        servicesWithCost['Custom Charge'] = true;
    }
    
    const services = Object.keys(servicesWithCost).sort();
    
    // 서비스 체크박스 다시 생성
    serviceCheckboxList.innerHTML = '';
    services.forEach(service => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = service;
        checkbox.className = 'service-checkbox';
        // 이전에 선택되어 있었고, 현재 환경에도 있는 서비스는 선택 유지
        if (currentlySelected.includes(service)) {
            checkbox.checked = true;
        }
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(service));
        serviceCheckboxList.appendChild(label);
    });
    
    // 드롭다운 텍스트 업데이트
    updateServiceDropdownText();
}

// 선택된 환경 가져오기
function getSelectedEnvironment() {
    const checked = document.querySelector('.environment-radio:checked');
    return checked ? checked.value : '';
}

// 드롭다운 외부 클릭 시 닫기
document.addEventListener('click', function(e) {
    const serviceDropdown = document.getElementById('serviceDropdown');
    const envDropdown = document.getElementById('environmentDropdown');
    
    if (serviceDropdown && !serviceDropdown.contains(e.target)) {
        document.getElementById('serviceDropdownContent').classList.remove('show');
    }
    if (envDropdown && !envDropdown.contains(e.target)) {
        document.getElementById('environmentDropdownContent').classList.remove('show');
    }
});

// 전체 서비스 선택
function selectAllServices() {
    document.querySelectorAll('.service-checkbox').forEach(cb => cb.checked = true);
    updateServiceDropdownText();
}

// 전체 서비스 해제
function deselectAllServices() {
    document.querySelectorAll('.service-checkbox').forEach(cb => cb.checked = false);
    updateServiceDropdownText();
}

// 선택된 서비스 텍스트 업데이트
function updateServiceDropdownText() {
    const checkboxes = document.querySelectorAll('.service-checkbox:checked');
    const text = document.getElementById('serviceDropdownText');
    
    if (checkboxes.length === 0) {
        text.textContent = '전체 서비스';
    } else if (checkboxes.length === 1) {
        text.textContent = checkboxes[0].value;
    } else {
        text.textContent = `${checkboxes.length}개 서비스 선택`;
    }
}

// 선택된 서비스 목록 가져오기
function getSelectedServices() {
    const checkboxes = document.querySelectorAll('.service-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// 필터 적용
function applyFilters() {
    currentFilters = {};
    
    // 다중 선택된 서비스 가져오기 (체크박스 방식)
    const selectedServices = getSelectedServices();
    
    const environment = getSelectedEnvironment();
    const startDate = document.getElementById('filterDateStart').value;
    const endDate = document.getElementById('filterDateEnd').value;
    const isDailyChecked = document.getElementById('dailyDataCheckbox').checked;
    
    if (selectedServices.length > 0) currentFilters.services = selectedServices.join(',');
    if (environment) currentFilters.environment = environment;
    
    // 날짜 필터 유효성 검사: 종료일은 시작일과 같거나 이후여야 함
    if (startDate && endDate && endDate < startDate) {
        alert('종료 일자는 시작 일자와 같거나 이후여야 합니다.');
        document.getElementById('filterDateEnd').value = startDate;
        return;
    }
    
    // 날짜 필터 (시작일과 종료일이 같으면 특정 날짜, 다르면 기간)
    if (startDate) currentFilters.date_start = startDate;
    if (endDate) currentFilters.date_end = endDate;
    
    // 드롭다운 닫기
    document.getElementById('serviceDropdownContent').classList.remove('show');
    document.getElementById('environmentDropdownContent').classList.remove('show');
    
    // 선택 텍스트 업데이트
    updateServiceDropdownText();
    
    // 일별 데이터 체크박스 상태에 따라 분기
    if (isDailyChecked) {
        // 일별 데이터 모드: 날짜 필수
        if (!startDate || !endDate) {
            alert('일별 데이터를 보려면 시작일과 종료일을 모두 선택하세요.');
            return;
        }
        loadDailyData();
    } else {
        loadData(1);
    }
}

// 필터 초기화
function clearDateFilter() {
    // 서비스 체크박스 해제
    deselectAllServices();
    
    // 환경 필터 초기화 (전체 환경 선택)
    const allEnvRadio = document.querySelector('.environment-radio[value=""]');
    if (allEnvRadio) allEnvRadio.checked = true;
    document.getElementById('environmentDropdownText').textContent = '전체 환경';
    
    // 날짜 필터 초기화 (데이터 범위의 시작/종료일로 설정)
    if (window.summaryDateRange) {
        const startDate = window.summaryDateRange.start.split(' ')[0];
        const endDate = window.summaryDateRange.end.split(' ')[0];
        document.getElementById('filterDateStart').value = startDate;
        document.getElementById('filterDateEnd').value = endDate;
    } else {
        document.getElementById('filterDateStart').value = '';
        document.getElementById('filterDateEnd').value = '';
    }
    
    // 일별 데이터 체크박스 해제
    document.getElementById('dailyDataCheckbox').checked = false;
    
    applyFilters();
}

// 일별 데이터 필터 (날짜별 + 서비스별 합계)
let isDailyMode = false;

function applyDailyFilter() {
    const startDate = document.getElementById('filterDateStart').value;
    const endDate = document.getElementById('filterDateEnd').value;
    
    // 날짜 필터 유효성 검사
    if (!startDate || !endDate) {
        alert('일별 데이터를 보려면 시작일과 종료일을 모두 선택하세요.');
        return;
    }
    
    if (endDate < startDate) {
        alert('종료 일자는 시작 일자와 같거나 이후여야 합니다.');
        return;
    }
    
    isDailyMode = true;
    
    // 기존 필터 적용 후 일별 모드로 데이터 표시
    currentFilters = {};
    
    const selectedServices = getSelectedServices();
    const environment = getSelectedEnvironment();
    
    if (selectedServices.length > 0) currentFilters.services = selectedServices.join(',');
    if (environment) currentFilters.environment = environment;
    if (startDate) currentFilters.date_start = startDate;
    if (endDate) currentFilters.date_end = endDate;
    
    // 드롭다운 닫기
    document.getElementById('serviceDropdownContent').classList.remove('show');
    document.getElementById('environmentDropdownContent').classList.remove('show');
    
    updateServiceDropdownText();
    
    loadDailyData();
}

// 일별 데이터 로드
async function loadDailyData() {
    const params = new URLSearchParams({
        page: 1,
        per_page: 10000,
        ...currentFilters
    });
    
    try {
        const response = await fetch('/api/data?' + params);
        const result = await response.json();
        
        if (result.success) {
            displayDailyDataTable(result.data);
            document.getElementById('pagination').innerHTML = '';
            updateFilterSummary(result.data);
            document.getElementById('dataSection').classList.remove('hidden');
        }
    } catch (error) {
        console.error('일별 데이터 로드 실패:', error);
    }
}

// 일별 데이터 테이블 표시 (날짜별 > 서비스별 그룹화)
function displayDailyDataTable(data) {
    const container = document.getElementById('dataTable');
    
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px;">데이터가 없습니다</p>';
        return;
    }
    
    // 주요 서비스 목록 (나머지는 '기타'로 묶음)
    const mainServices = ['RDS', 'EC2', 'FSx', 'VPC', 'Elastic Load Balancing', 'Custom Charge'];
    
    // 서비스 이름 변환 함수
    function normalizeServiceName(name) {
        if (name === 'Elastic Load Balancing') return 'ELB';
        if (mainServices.includes(name)) return name;
        return '기타';
    }
    
    // 날짜별로 그룹화 (서비스 정규화 포함)
    const groupedByDate = {};
    data.forEach(row => {
        const dateOnly = row.date ? row.date.split(' ')[0] : 'Unknown';
        if (!groupedByDate[dateOnly]) {
            groupedByDate[dateOnly] = {};
        }
        
        const rawService = row.service_name || '기타';
        const service = normalizeServiceName(rawService);
        
        if (!groupedByDate[dateOnly][service]) {
            groupedByDate[dateOnly][service] = { cost: 0, cost_krw: 0 };
        }
        
        groupedByDate[dateOnly][service].cost += parseFloat(row.cost) || 0;
        groupedByDate[dateOnly][service].cost_krw += parseFloat(row.cost_krw) || 0;
    });
    
    // 날짜 정렬 (오름차순)
    const sortedDates = Object.keys(groupedByDate).sort();
    
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
    
    sortedDates.forEach((dateStr, index) => {
        const services = groupedByDate[dateStr];
        const dateId = `date-${index}`;
        
        // 해당 날짜의 총합 계산
        let dateTotalUSD = 0;
        let dateTotalKRW = 0;
        
        Object.values(services).forEach(s => {
            dateTotalUSD += s.cost;
            dateTotalKRW += s.cost_krw;
        });
        
        // 비용이 0인 날짜는 표시 안함
        if (dateTotalUSD === 0) return;
        
        // 서비스 개수
        const serviceCount = Object.keys(services).filter(s => services[s].cost > 0).length;
        
        html += `
            <div style="border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div class="service-header" onclick="toggleService('${dateId}')" style="
                    background: #DEE2E6; color: #495057; cursor: pointer;
                    padding: 12px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span id="toggle-icon-${index}" style="font-size: 1.2em;">▶</span>
                        <strong style="font-size: 1.05em;">📅 ${dateStr}</strong>
                        <span style="opacity: 0.9; font-size: 0.9em;">(${serviceCount}개 서비스)</span>
                    </div>
                    <div style="display: flex; gap: 20px; font-size: 0.95em;">
                        <span>💵 $${dateTotalUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        <span>💰 ₩${dateTotalKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                </div>
                <div id="${dateId}" class="service-details" style="display: none;">
                    <table style="width: 100%; margin: 0; border-radius: 0;">
                        <thead>
                            <tr>
                                <th style="width: 50%;">서비스</th>
                                <th style="width: 25%; text-align: right;">USD</th>
                                <th style="width: 25%; text-align: right;">KRW</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // 서비스별 정렬 (비용 내림차순)
        const sortedServices = Object.entries(services)
            .filter(([name, s]) => s.cost > 0)
            .sort((a, b) => b[1].cost - a[1].cost);
        
        sortedServices.forEach(([serviceName, s]) => {
            html += `
                <tr>
                    <td>${serviceName}</td>
                    <td style="text-align: right;">$${s.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style="text-align: right;"><strong>₩${s.cost_krw.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong></td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Excel 다운로드
function exportData() {
    window.location.href = '/api/export';
}

// 로딩 표시
function showLoading(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className = 'alert alert-info';
    el.innerHTML = `<div class="spinner"></div><p style="margin-top: 15px;">${message}</p>`;
    el.classList.remove('hidden');
}

// 성공 메시지
function showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className = 'alert alert-success';
    el.innerHTML = `<strong>✓ 성공!</strong> ${message}`;
    el.classList.remove('hidden');
}

// 에러 메시지
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className = 'alert alert-error';
    el.innerHTML = `<strong>✗ 오류!</strong> ${message}`;
    el.classList.remove('hidden');
}

// HTML 저장 버튼 표시
function showSaveHtmlButton() {
    const btn = document.getElementById('saveHtmlBtn');
    if (btn) {
        btn.style.display = 'inline-block';
    }
}

// HTML로 저장
function saveAsHtml() {
    // 날짜 범위 추출
    const dateRange = document.getElementById('summaryDateRange')?.textContent || '';
    const exchangeRateInfo = document.getElementById('exchangeRateInfo')?.textContent || '';
    
    // 요약 그리드 복사
    const summaryGrid = document.getElementById('summaryGrid');
    let summaryHtml = summaryGrid ? summaryGrid.outerHTML : '';
    // (USD / KRW) 텍스트 제거
    summaryHtml = summaryHtml.replace(/\s*\(USD\s*\/\s*KRW\)/gi, '');
    
    // 차트 데이터 추출 (interactive 차트를 위해)
    let chartData = null;
    let chartConfig = null;
    if (dailyTrendChart) {
        chartData = dailyTrendChart.data;
        chartConfig = {
            options: dailyTrendChart.options,
            type: dailyTrendChart.config.type
        };
    }
    
    // 상세 데이터 복사
    const dataTable = document.getElementById('dataTable');
    const dataTableHtml = dataTable ? dataTable.innerHTML : '';
    
    // 필터 정보 추출
    const envText = document.getElementById('environmentDropdownText')?.textContent || '전체 환경';
    const serviceText = document.getElementById('serviceDropdownText')?.textContent || '전체 서비스';
    const filterDateStart = document.getElementById('filterDateStart')?.value || '';
    const filterDateEnd = document.getElementById('filterDateEnd')?.value || '';
    const filterTotalUSD = document.getElementById('filterTotalUSD')?.textContent || '';
    const filterTotalKRW = document.getElementById('filterTotalKRW')?.textContent || '';
    
    // 필터 정보 문자열 생성
    let filterInfo = `${envText} / ${serviceText}`;
    if (filterDateStart && filterDateEnd) {
        filterInfo += ` / ${filterDateStart} ~ ${filterDateEnd}`;
    }
    if (filterTotalUSD && filterTotalKRW) {
        filterInfo += ` / ${filterTotalUSD.replace('💵 ', '')} / ${filterTotalKRW.replace('💰 ', '')}`;
    }
    
    // HTML 문서 생성
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS 비용 정산 - ${dateRange}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #F5F6FA;
            min-height: 100vh;
            padding: 15px;
            font-size: 13px;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 15px 45px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: #cbd5e0;
            color: #2d3748;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 1.5em;
            margin-bottom: 8px;
        }
        .header p {
            font-size: 0.95em;
            opacity: 0.9;
        }
        .content {
            padding: 20px;
        }
        .section {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .section-title {
            font-size: 1.15em;
            color: #2c3e50;
            margin-bottom: 12px;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 8px;
            position: relative;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
        }
        .summary-card {
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .summary-card h3 {
            font-size: 0.85em;
            margin-bottom: 8px;
            color: #2d3748;
        }
        .summary-card .value {
            font-size: 1em;
            font-weight: bold;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
        }
        .chart-section {
            margin-top: 20px;
        }
        .chart-section .chart-container {
            position: relative;
            height: 300px;
            margin: 0 auto;
        }
        .chart-section canvas {
            max-width: 100%;
        }
        .data-section table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9em;
        }
        .data-section th, .data-section td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .data-section th {
            background: #f1f5f9;
            font-weight: 600;
            color: #475569;
        }
        .data-section tr:hover {
            background: #f8fafc;
        }
        .service-header {
            background: #DEE2E6;
            color: #495057;
            padding: 12px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .footer {
            text-align: center;
            padding: 15px;
            color: #6c757d;
            font-size: 0.85em;
            border-top: 1px solid #e9ecef;
        }
        .tooltip-container {
            position: relative;
            display: inline-flex;
            align-items: center;
        }
        .tooltip-container:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
        }
        .tooltip-text {
            visibility: hidden;
            opacity: 0;
            position: absolute;
            right: 0;
            top: 100%;
            margin-top: 8px;
            width: 320px;
            background: #333;
            color: #fff;
            padding: 12px 15px;
            border-radius: 8px;
            font-size: 0.7em;
            font-weight: normal;
            line-height: 1.5;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: opacity 0.2s, visibility 0.2s;
        }
        /* 맨 위로 가기 버튼 */
        .scroll-to-top {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            background: #4a5568;
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            z-index: 9999;
        }
        .scroll-to-top:hover {
            background: #2d3748;
            transform: translateY(-3px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        .scroll-to-top svg {
            width: 24px;
            height: 24px;
            fill: white;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
        // 차트 데이터 및 설정
        const chartData = ${chartData ? JSON.stringify(chartData) : 'null'};
        const chartConfig = ${chartConfig ? JSON.stringify(chartConfig) : 'null'};
        
        // 페이지 로드 후 차트 그리기
        window.addEventListener('DOMContentLoaded', function() {
            if (chartData && chartConfig) {
                const ctx = document.getElementById('dailyTrendChart');
                if (ctx) {
                    // Y축 틱 콜백 함수 복원
                    if (chartConfig.options && chartConfig.options.scales && chartConfig.options.scales.y) {
                        chartConfig.options.scales.y.ticks = {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        };
                    }
                    
                    new Chart(ctx, {
                        type: chartConfig.type,
                        data: chartData,
                        options: chartConfig.options
                    });
                }
            }
        });
        
        // 맨 위로 가기 버튼 기능
        window.addEventListener('scroll', function() {
            const scrollBtn = document.getElementById('scrollToTop');
            if (window.scrollY > 300) {
                scrollBtn.style.display = 'flex';
            } else {
                scrollBtn.style.display = 'none';
            }
        });
        
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        
        // 서비스 토글 함수
        function toggleService(serviceId) {
            const details = document.getElementById(serviceId);
            // service-0 또는 date-0 형식 모두 지원
            let iconId;
            if (serviceId.startsWith('date-')) {
                iconId = 'toggle-icon-' + serviceId.replace('date-', '');
            } else {
                iconId = serviceId.replace('service-', 'toggle-icon-');
            }
            const icon = document.getElementById(iconId);
            
            if (details.style.display === 'none') {
                details.style.display = 'block';
                if (icon) icon.textContent = '▼';
            } else {
                details.style.display = 'none';
                if (icon) icon.textContent = '▶';
            }
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>☁️ AWS 비용 정산 보고서</h1>
            <p>클라우드체커 CSV 파일 기반 비용 분석</p>
        </div>
        <div class="content">
            <div class="section">
                <h2 class="section-title" style="display: flex; align-items: center; flex-wrap: wrap;">
                    📊 비용 요약
                    <span style="font-size: 11.7px; font-weight: normal; color: #495057; margin-left: 15px;">${dateRange}</span>
                    <span style="font-size: 11.7px; font-weight: normal; color: #6c757d; margin-left: 10px;">${exchangeRateInfo}</span>
                </h2>
                ${summaryHtml}
                <div style="font-size: 0.85em; color: #6c757d; margin-top: 12px; padding-top: 8px; text-align: right;">
                    ＊클라우드체커 csv파일 기준으로 작성되어, 일부 소수점 값이 상이할 수 있음
                </div>
            </div>
            ${chartData ? `
            <div class="section chart-section">
                <h2 class="section-title">📊 일별 비용 추이</h2>
                <div class="chart-container">
                    <canvas id="dailyTrendChart"></canvas>
                </div>
            </div>
            ` : ''}
            ${dataTableHtml ? `
            <div class="section data-section">
                <h2 class="section-title">📋 상세 데이터</h2>
                <div style="background: #f8f9fa; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; font-size: 0.9em; color: #495057; border: 1px solid #e2e8f0;">
                    📊 ${filterInfo}
                </div>
                ${dataTableHtml}
            </div>
            ` : ''}
        </div>
        <div class="footer">
            생성일: ${new Date().toLocaleString('ko-KR')} | AWS 비용 정산 툴
        </div>
    </div>
    <!-- 맨 위로 가기 버튼 -->
    <button id="scrollToTop" class="scroll-to-top" onclick="scrollToTop()" title="맨 위로">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
        </svg>
    </button>
</body>
</html>`;
    
    // 파일 다운로드
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // 파일명 생성 (날짜 범위에서 추출 + 저장 시간)
    let fileName = 'AWS_비용정산';
    const dateMatch = dateRange.match(/\d{4}-\d{2}-\d{2}/g);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    if (dateMatch && dateMatch.length >= 2) {
        fileName = `AWS_비용정산_${dateMatch[0]}_${dateMatch[1]}_${dateStr}_${timeStr}`;
    } else if (dateMatch && dateMatch.length === 1) {
        fileName = `AWS_비용정산_${dateMatch[0]}_${dateStr}_${timeStr}`;
    } else {
        fileName = `AWS_비용정산_${dateStr}_${timeStr}`;
    }
    
    a.href = url;
    a.download = `${fileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
