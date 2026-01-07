/**
 * AWS 비용 정산 툴 - GitHub Pages 정적 버전
 * 서버 없이 브라우저에서 직접 CSV 파일을 처리합니다.
 */

// 전역 변수
let cielData = null;
let segiData = null;
let allData = [];
let currentPage = 1;
const rowsPerPage = 20;
let currentExchangeRate = null;
let dailyChart = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    setupFileUpload('ciel');
    setupFileUpload('segi');
});

// 파일 업로드 설정
function setupFileUpload(type) {
    const fileInput = document.getElementById(type === 'ciel' ? 'fileInputCiel' : 'fileInputSegi');
    const uploadArea = document.getElementById(type === 'ciel' ? 'uploadAreaCiel' : 'uploadAreaSegi');
    
    fileInput.addEventListener('change', () => handleFileSelect(type));
    
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
            handleFileSelect(type);
        }
    });
}

// 파일 선택 처리
async function handleFileSelect(type) {
    const fileInput = document.getElementById(type === 'ciel' ? 'fileInputCiel' : 'fileInputSegi');
    const statusDiv = document.getElementById(type === 'ciel' ? 'uploadStatusCiel' : 'uploadStatusSegi');
    const typeName = type === 'ciel' ? '씨엘모빌리티' : '세기모빌리티';
    
    const files = fileInput.files;
    if (!files || files.length === 0) return;
    
    statusDiv.classList.remove('hidden');
    statusDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>파일 처리 중...</p></div>';
    
    try {
        const allRows = [];
        
        for (const file of files) {
            const text = await readFileAsText(file);
            const result = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true
            });
            
            if (result.data && result.data.length > 0) {
                allRows.push(...result.data);
            }
        }
        
        // 데이터 처리
        const processedData = processCSVData(allRows);
        
        if (type === 'ciel') {
            cielData = processedData;
        } else {
            segiData = processedData;
        }
        
        statusDiv.innerHTML = `
            <div class="alert alert-success">
                ✅ ${files.length}개 파일, ${processedData.records.length}개 레코드 로드됨
            </div>
        `;
        
        // 두 파일 모두 업로드되면 환율 섹션 표시
        if (cielData && segiData) {
            document.getElementById('exchangeSection').classList.remove('hidden');
            document.getElementById('exchangeSection').scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        statusDiv.innerHTML = `
            <div class="alert" style="background: #f8d7da; border-left-color: #dc3545; color: #721c24;">
                ❌ 오류: ${error.message}
            </div>
        `;
        console.error('File processing error:', error);
    }
}

// 파일을 텍스트로 읽기
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('파일 읽기 실패'));
        reader.readAsText(file, 'UTF-8');
    });
}

// CSV 데이터 처리
function processCSVData(rows) {
    const records = [];
    const environments = new Set();
    const services = new Set();
    const dailyCosts = {};
    let totalCostUSD = 0;
    let customChargeUSD = 0;
    let minDate = null;
    let maxDate = null;
    
    for (const row of rows) {
        // 컬럼명 매핑 (클라우드체커 CSV 형식)
        const environment = row['Environment Name'] || row['environment_name'] || row['Environment'] || '';
        const service = row['Service Family'] || row['service_family'] || row['Service'] || '';
        const region = row['Region'] || row['region'] || '';
        const cost = parseFloat(row['Cost'] || row['cost'] || row['Total Cost'] || 0);
        const date = row['Date'] || row['date'] || row['Usage Date'] || '';
        
        if (isNaN(cost)) continue;
        
        // Custom Charge 계산
        if (service.toLowerCase().includes('custom charge')) {
            customChargeUSD += cost;
        }
        
        totalCostUSD += cost;
        environments.add(environment);
        services.add(service);
        
        // 날짜 파싱
        if (date) {
            const dateStr = date.split(' ')[0];
            if (!dailyCosts[dateStr]) {
                dailyCosts[dateStr] = 0;
            }
            dailyCosts[dateStr] += cost;
            
            const d = new Date(dateStr);
            if (!minDate || d < minDate) minDate = d;
            if (!maxDate || d > maxDate) maxDate = d;
        }
        
        records.push({
            environment,
            service,
            region,
            cost,
            date: date.split(' ')[0]
        });
    }
    
    const nonCustomChargeUSD = totalCostUSD - customChargeUSD;
    
    return {
        records,
        environments: Array.from(environments).filter(e => e),
        services: Array.from(services).filter(s => s),
        totalCostUSD,
        customChargeUSD,
        nonCustomChargeUSD,
        dailyCosts,
        dateRange: {
            start: minDate ? minDate.toISOString().split('T')[0] : '',
            end: maxDate ? maxDate.toISOString().split('T')[0] : ''
        }
    };
}

// 환율 적용
function applyExchangeRate() {
    const rateInput = document.getElementById('exchangeRate');
    const rate = parseFloat(rateInput.value);
    
    if (isNaN(rate) || rate <= 0) {
        alert('올바른 환율을 입력해주세요.');
        return;
    }
    
    currentExchangeRate = rate;
    
    // 요약 섹션 표시
    displaySummary();
    
    // 일별 추이 차트
    displayDailyChart();
    
    // 데이터 테이블
    displayDataTable();
    
    // 스크롤
    document.getElementById('summarySection').scrollIntoView({ behavior: 'smooth' });
}

// 요약 표시
function displaySummary() {
    const summarySection = document.getElementById('summarySection');
    const summaryGrid = document.getElementById('summaryGrid');
    const exchangeRateInfo = document.getElementById('exchangeRateInfo');
    const summaryDateRange = document.getElementById('summaryDateRange');
    
    summarySection.classList.remove('hidden');
    
    const cielTotalUSD = cielData.totalCostUSD;
    const segiTotalUSD = segiData.totalCostUSD;
    const cielUsageUSD = cielTotalUSD - segiTotalUSD;
    const nonCustomChargeUSD = cielData.nonCustomChargeUSD;
    
    // MSP 계산
    const THRESHOLD = 20000;
    const m2Amount = nonCustomChargeUSD * 0.20;
    const m1Amount = nonCustomChargeUSD < THRESHOLD ? 1000 : nonCustomChargeUSD * 0.05;
    const cielMspAmount = m2Amount - m1Amount;
    
    // KRW 변환
    const cielKRW = cielTotalUSD * currentExchangeRate;
    const segiKRW = segiTotalUSD * currentExchangeRate;
    const cielUsageKRW = cielUsageUSD * currentExchangeRate;
    const nonCustomKRW = nonCustomChargeUSD * currentExchangeRate;
    const m2KRW = m2Amount * currentExchangeRate;
    const m1KRW = m1Amount * currentExchangeRate;
    const cielMspKRW = cielMspAmount * currentExchangeRate;
    
    exchangeRateInfo.textContent = `(환율: ₩${currentExchangeRate.toLocaleString()}/USD)`;
    summaryDateRange.textContent = `/ ${cielData.dateRange.start} ~ ${cielData.dateRange.end}`;
    
    summaryGrid.innerHTML = `
        <div class="summary-card" style="background: #F2F4FF;">
            <h3>📄 세금계산서 발행 금액(매입) (USD / KRW)</h3>
            <div class="value">
                <span>$${cielTotalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span style="color: #6c757d;">₩${Math.round(cielKRW).toLocaleString()}</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e0;">
                (M2=AWS 사용료*20%, $${m2Amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / ₩${Math.round(m2KRW).toLocaleString()})
            </div>
        </div>
        <div class="summary-card" style="background: #F2F4FF;">
            <h3>💰 AWS 사용료 (USD / KRW)</h3>
            <div class="value">
                <span>$${nonCustomChargeUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span style="color: #6c757d;">₩${Math.round(nonCustomKRW).toLocaleString()}</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e0;">MSP 계산 기준이 되는 금액</div>
        </div>
        <div class="summary-card" style="background: #FFEFEF;">
            <h3>📤 세기모빌리티 청구 금액(매출) (USD / KRW)</h3>
            <div class="value" style="color: #E57373;">
                <span>$${segiTotalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span>₩${Math.round(segiKRW).toLocaleString()}</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #f5a5a5;">
                (M1=${nonCustomChargeUSD < THRESHOLD ? '$1,000' : 'AWS 사용료*5%'}, $${m1Amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / ₩${Math.round(m1KRW).toLocaleString()})
            </div>
        </div>
        <div class="summary-card" style="background: #F8F9FA;">
            <h3>🏢 씨엘모빌리티 사용 금액 (USD / KRW)</h3>
            <div class="value">
                <span>$${cielUsageUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <span style="color: #6c757d; margin: 0 8px;">/</span>
                <span style="color: #6c757d;">₩${Math.round(cielUsageKRW).toLocaleString()}</span>
            </div>
            <div style="font-size: 0.85em; color: #6c757d; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e0;">
                (M2-M1, $${cielMspAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / ₩${Math.round(cielMspKRW).toLocaleString()})
            </div>
        </div>
    `;
}

// 일별 차트 표시
function displayDailyChart() {
    const section = document.getElementById('dailyTrendSection');
    section.classList.remove('hidden');
    
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    
    // 두 데이터의 일별 비용 병합
    const allDates = new Set([
        ...Object.keys(cielData.dailyCosts || {}),
        ...Object.keys(segiData.dailyCosts || {})
    ]);
    
    const sortedDates = Array.from(allDates).sort();
    const cielValues = sortedDates.map(d => cielData.dailyCosts[d] || 0);
    const segiValues = sortedDates.map(d => segiData.dailyCosts[d] || 0);
    
    if (dailyChart) {
        dailyChart.destroy();
    }
    
    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                {
                    label: '씨엘모빌리티 (매입)',
                    data: cielValues,
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: '세기모빌리티 (매출)',
                    data: segiValues,
                    borderColor: '#E57373',
                    backgroundColor: 'rgba(229, 115, 115, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

// 데이터 테이블 표시
function displayDataTable() {
    const section = document.getElementById('dataSection');
    section.classList.remove('hidden');
    
    // 필터 옵션 업데이트
    updateFilterOptions();
    
    // 모든 데이터 병합
    allData = [
        ...cielData.records.map(r => ({ ...r, source: 'ciel' })),
        ...segiData.records.map(r => ({ ...r, source: 'segi' }))
    ];
    
    renderTable();
}

// 필터 옵션 업데이트
function updateFilterOptions() {
    const envFilter = document.getElementById('filterEnvironment');
    const serviceFilter = document.getElementById('filterService');
    
    const allEnvironments = new Set([...cielData.environments, ...segiData.environments]);
    const allServices = new Set([...cielData.services, ...segiData.services]);
    
    envFilter.innerHTML = '<option value="">전체 환경</option>';
    allEnvironments.forEach(env => {
        if (env) envFilter.innerHTML += `<option value="${env}">${env}</option>`;
    });
    
    serviceFilter.innerHTML = '<option value="">전체 서비스</option>';
    allServices.forEach(svc => {
        if (svc) serviceFilter.innerHTML += `<option value="${svc}">${svc}</option>`;
    });
}

// 필터 적용
function applyFilters() {
    currentPage = 1;
    renderTable();
}

// 테이블 렌더링
function renderTable() {
    const envFilter = document.getElementById('filterEnvironment').value;
    const serviceFilter = document.getElementById('filterService').value;
    
    let filtered = allData;
    
    if (envFilter) {
        filtered = filtered.filter(r => r.environment === envFilter);
    }
    if (serviceFilter) {
        filtered = filtered.filter(r => r.service === serviceFilter);
    }
    
    // 페이지네이션
    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const startIdx = (currentPage - 1) * rowsPerPage;
    const pageData = filtered.slice(startIdx, startIdx + rowsPerPage);
    
    // 테이블 생성
    const tableDiv = document.getElementById('dataTable');
    
    if (filtered.length === 0) {
        tableDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: #6c757d;">데이터가 없습니다.</p>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>소스</th>
                    <th>날짜</th>
                    <th>환경</th>
                    <th>서비스</th>
                    <th>리전</th>
                    <th style="text-align: right;">비용 (USD)</th>
                    <th style="text-align: right;">비용 (KRW)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const row of pageData) {
        const krwCost = row.cost * (currentExchangeRate || 1);
        const sourceBadge = row.source === 'ciel' 
            ? '<span style="background: #4299e1; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">매입</span>'
            : '<span style="background: #E57373; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">매출</span>';
        
        html += `
            <tr>
                <td>${sourceBadge}</td>
                <td>${row.date}</td>
                <td>${row.environment}</td>
                <td>${row.service}</td>
                <td>${row.region}</td>
                <td style="text-align: right;">$${row.cost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="text-align: right;">₩${Math.round(krwCost).toLocaleString()}</td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
    
    // 페이지네이션
    renderPagination(totalPages);
}

// 페이지네이션 렌더링
function renderPagination(totalPages) {
    const paginationDiv = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // 이전 버튼
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>이전</button>`;
    
    // 페이지 번호
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        html += `<button onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<button disabled>...</button>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="goToPage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<button disabled>...</button>`;
        html += `<button onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // 다음 버튼
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>다음</button>`;
    
    paginationDiv.innerHTML = html;
}

// 페이지 이동
function goToPage(page) {
    currentPage = page;
    renderTable();
}
