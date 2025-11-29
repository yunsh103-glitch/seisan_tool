// 전역 변수
let currentPage = 1;
let currentFilters = {};
let uploadedData = null;
let dailyCostsData = null; // 전체 일별 비용
let dailyCostsByEnvData = null; // 환경별 일별 비용

// 프로그레스 바 함수
function showProgressModal(title, text) {
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
    
    // 애니메이션으로 진행률 증가
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 90) progress = 90;
        const roundedProgress = Math.round(progress);
        progressBar.style.width = roundedProgress + '%';
        progressPercent.textContent = roundedProgress + '%';
        NProgress.set(progress / 100);
    }, 300);
    
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
        resultDiv.style.color = '#212529';
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
    
    // 파일 업로드 이벤트
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    fileInput.addEventListener('change', handleFileSelect);
    
    // 드래그 앤 드롭
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect();
        }
    });
    
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

// 파일 업로드 처리
async function handleFileSelect() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    
    // 여러 파일 추가
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    // 프로그레스 바 표시
    const progressInterval = showProgressModal(
        '파일 업로드 중',
        `${files.length}개 파일을 처리하고 있습니다...`
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
            fileListHtml += '<strong>📁 업로드된 파일:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px;">';
            result.files.forEach(filename => {
                fileListHtml += `<li>${filename}</li>`;
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
    
    // 날짜에서 시간 제거 (yyyy-mm-dd 형식만)
    const startDate = summary.date_range.start.split(' ')[0];
    const endDate = summary.date_range.end.split(' ')[0];
    
    const grid = document.getElementById('summaryGrid');
    grid.innerHTML = `
        <div class="summary-card">
            <h3>기간</h3>
            <div class="value">${startDate}<br>~<br>${endDate}</div>
        </div>
        <div class="summary-card">
            <h3>총 비용 (USD)</h3>
            <div class="value">$${summary.total_cost_usd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
        <div class="summary-card" id="krwSummaryCard" style="display: none;">
            <h3>총 비용 (KRW)</h3>
            <div class="value" id="krwTotalValue">-</div>
        </div>
    `;
    
    // 서비스별 차트
    displayServiceChart(summary.service_costs);
    
    // 일별 비용 데이터 저장 (전역)
    dailyCostsData = summary.daily_costs;
    dailyCostsByEnvData = summary.daily_costs_by_env;
    
    // 환경 필터 드롭다운 초기화
    initDailyTrendEnvFilter(summary.environments || []);
    
    // 일별 비용 추이 차트
    displayDailyTrendChart(summary.daily_costs);
    
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
    
    // 프로그레스 바 표시
    const progressInterval = showProgressModal(
        '환율 조회 및 적용 중',
        `${apiDate} 환율 정보를 가져와서 데이터에 적용하고 있습니다...`
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
            
            // 차트 섹션으로 슬라이딩
            setTimeout(() => {
                scrollToSection('chartSection');
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
    
    // 프로그레스 바 표시
    const progressInterval = showProgressModal(
        '환율 적용 중',
        `1 USD = ${rate.toLocaleString()} KRW 환율을 데이터에 적용하고 있습니다...`
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
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    exchangeRateInfo.textContent = `(${month}/${day} 기준, ${summary.exchange_rate.toLocaleString(undefined, {minimumFractionDigits: 2})}원)`;
    
    // KRW 카드 표시 및 값 업데이트
    const krwCard = document.getElementById('krwSummaryCard');
    const krwValue = document.getElementById('krwTotalValue');
    
    if (krwCard && krwValue) {
        krwCard.style.display = 'flex';
        krwValue.textContent = `₩${summary.total_cost_krw.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
    }
    
    // 일별 비용 추이 차트에 환율 적용 (툴팁에서 KRW 표시용)
    dailyTrendExchangeRate = summary.exchange_rate;
}

// 서비스별 차트 표시 (100% 누적 가로 막대형)
function displayServiceChart(serviceCosts) {
    const section = document.getElementById('chartSection');
    section.classList.remove('hidden');
    
    const ctx = document.getElementById('serviceChart').getContext('2d');
    
    // 비용이 0보다 큰 서비스만 필터링하고, 큰 순서로 정렬
    const sortedEntries = Object.entries(serviceCosts)
        .filter(([name, cost]) => cost > 0)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedEntries.length === 0) {
        section.innerHTML = '<p style="text-align: center; padding: 20px; color: #6c757d;">비용이 발생한 서비스가 없습니다</p>';
        return;
    }
    
    const labels = sortedEntries.map(e => e[0]);
    const data = sortedEntries.map(e => e[1]);
    const total = data.reduce((sum, val) => sum + val, 0);
    
    // 색상 팔레트
    const colors = [
        'rgba(66, 153, 225, 0.8)',  // #4299e1 파란색
        'rgba(160, 174, 192, 0.8)', // #a0aec0 회색
        'rgba(159, 122, 234, 0.8)', // #9f7aea 보라색
        'rgba(237, 137, 54, 0.8)',  // #ed8936 주황색
        'rgba(72, 187, 120, 0.8)',  // #48bb78 녹색
        'rgba(203, 213, 224, 0.8)', // #cbd5e0 밝은 회색
        'rgba(73, 80, 87, 0.8)',    // #495057 진한 회색
        'rgba(108, 117, 125, 0.8)'  // #6c757d 중간 회색
    ];
    
    const borderColors = [
        'rgba(66, 153, 225, 1)',
        'rgba(160, 174, 192, 1)',
        'rgba(159, 122, 234, 1)',
        'rgba(237, 137, 54, 1)',
        'rgba(72, 187, 120, 1)',
        'rgba(203, 213, 224, 1)',
        'rgba(73, 80, 87, 1)',
        'rgba(108, 117, 125, 1)'
    ];
    
    // 각 서비스를 개별 데이터셋으로 생성 (누적 효과)
    const datasets = labels.map((label, i) => ({
        label: label,
        data: [data[i]],
        backgroundColor: colors[i % colors.length],
        borderColor: borderColors[i % borderColors.length],
        borderWidth: 1
    }));
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['서비스별 비용'],
            datasets: datasets
        },
        options: {
            indexAxis: 'y', // 가로 막대형
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    max: total,
                    display: false
                },
                y: {
                    stacked: true,
                    display: false
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 11
                        },
                        padding: 10,
                        generateLabels: function(chart) {
                            const datasets = chart.data.datasets;
                            return datasets.map((dataset, i) => {
                                const value = data[i];
                                const percentage = ((value / total) * 100).toFixed(1);
                                return {
                                    text: `${dataset.label}: ${percentage}%`,
                                    fillStyle: dataset.backgroundColor,
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.x || 0;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: $${value.toLocaleString(undefined, {minimumFractionDigits: 2})} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
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
        // 특정 환경 선택
        displayDailyTrendChart(dailyCostsByEnvData[selectedEnv]);
    } else {
        // 전체 환경
        displayDailyTrendChart(dailyCostsData);
    }
}

function displayDailyTrendChart(dailyCosts, exchangeRate = null) {
    const section = document.getElementById('dailyTrendSection');
    
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
    
    // 필터가 적용되었는지 확인
    const hasFilter = Object.keys(currentFilters).length > 0;
    
    if (hasFilter && data.length > 0) {
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
        
        filterTotalUSD.textContent = `💵 $${totalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        filterTotalKRW.textContent = `💰 ₩${totalKRW.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
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
    
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px;">데이터가 없습니다</p>';
        return;
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
        const totalUSD = rows.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        const totalKRW = rows.reduce((sum, r) => sum + (parseFloat(r.cost_krw) || 0), 0);
        
        const serviceId = `service-${index}`;
        
        html += `
            <div style="border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div class="service-header" onclick="toggleService('${serviceId}')" style="
                    background: #DEE2E6; color: #212529; cursor: pointer;
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
            const envColor = getEnvironmentColor(row.environment || 'default');
            
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
                        ">${row.environment || '-'}</span>
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
    const iconId = serviceId.replace('service-', 'toggle-icon-');
    const icon = document.getElementById(iconId);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        icon.textContent = '▼';
    } else {
        details.style.display = 'none';
        icon.textContent = '▶';
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
    
    loadData(1);
}

// 필터 초기화
function clearDateFilter() {
    // 서비스 체크박스 해제
    deselectAllServices();
    
    // 환경 필터 초기화 (전체 환경 선택)
    const allEnvRadio = document.querySelector('.environment-radio[value=""]');
    if (allEnvRadio) allEnvRadio.checked = true;
    document.getElementById('environmentDropdownText').textContent = '전체 환경';
    
    // 날짜 필터 초기화
    document.getElementById('filterDateStart').value = '';
    document.getElementById('filterDateEnd').value = '';
    
    applyFilters();
}

// Excel 다운로드
function exportData() {
    window.location.href = '/api/export';
}

// 로딩 표시
function showLoading(elementId, message) {
    const el = document.getElementById(elementId);
    el.className = 'alert alert-info';
    el.innerHTML = `<div class="spinner"></div><p style="margin-top: 15px;">${message}</p>`;
    el.classList.remove('hidden');
}

// 성공 메시지
function showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    el.className = 'alert alert-success';
    el.innerHTML = `<strong>✓ 성공!</strong> ${message}`;
}

// 에러 메시지
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.className = 'alert alert-error';
    el.innerHTML = `<strong>✗ 오류!</strong> ${message}`;
}
