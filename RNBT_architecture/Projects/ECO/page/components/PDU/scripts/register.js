/*
 * PDU - 3D Popup Component (Tabbed UI)
 *
 * applyShadowPopupMixin을 사용한 탭 팝업 컴포넌트
 *
 * 핵심 구조:
 * 1. datasetInfo - 데이터 정의 (pdu, history)
 * 2. Data Config - API 필드 매핑
 * 3. Chart Config - ECharts 옵션 빌더
 * 4. 렌더링 함수 바인딩
 * 5. Public Methods - Page에서 호출
 * 6. customEvents - 이벤트 발행
 * 7. Template Data - HTML/CSS (publishCode에서 로드)
 * 8. Popup - template 기반 탭 Shadow DOM 팝업
 */

const { bind3DEvents, fetchData } = Wkit;
const { applyShadowPopupMixin, applyEChartsMixin, applyTabulatorMixin } = PopupMixin;

// ======================
// TEMPLATE HELPER
// ======================
function extractTemplate(htmlCode, templateId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlCode, 'text/html');
    const template = doc.querySelector(`template#${templateId}`);
    return template?.innerHTML || '';
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

initComponent.call(this);

function initComponent() {
    // ======================
    // 1. 데이터 정의 (동적 assetId 지원)
    // ======================
    this._defaultAssetId = this.setter?.ecoAssetInfo?.assetId || this.id;

    this.datasetInfo = [
        { datasetName: 'pdu', render: ['renderPDUInfo'] },
        { datasetName: 'pduCircuits', render: ['renderCircuitTable'] },
        { datasetName: 'pduHistory', render: ['renderPowerChart'] }
    ];

    // ======================
    // 2. Data Config (하드코딩 제거)
    // - API 응답의 fields 배열을 직접 사용하여 동적 렌더링
    // ======================
    this.baseInfoConfig = [
        { key: 'name', selector: '.pdu-name' },
        { key: 'zone', selector: '.pdu-zone' },
        { key: 'statusLabel', selector: '.pdu-status' },
        { key: 'status', selector: '.pdu-status', dataAttr: 'status' }
    ];

    // 동적 필드 컨테이너 selector (Summary Bar)
    this.fieldsContainerSelector = '.summary-bar';

    // ======================
    // 3. Table Config - Tabulator 옵션 빌더
    // ======================
    this.tableConfig = {
        selector: '.table-container',
        columns: [
            { title: 'ID', field: 'id', widthGrow: 0.5, hozAlign: 'right' },
            { title: 'Name', field: 'name', widthGrow: 2 },
            { title: 'Current', field: 'current', widthGrow: 1, hozAlign: 'right', formatter: (cell) => `${cell.getValue()}A` },
            { title: 'Power', field: 'power', widthGrow: 1, hozAlign: 'right', formatter: (cell) => `${cell.getValue()}kW` },
            {
                title: 'Status', field: 'status', widthGrow: 1,
                formatter: (cell) => {
                    const value = cell.getValue();
                    const colors = { active: '#22c55e', inactive: '#8892a0' };
                    return `<span style="color: ${colors[value] || '#8892a0'}">${value}</span>`;
                }
            },
            {
                title: 'Breaker', field: 'breaker', widthGrow: 0.8,
                formatter: (cell) => {
                    const value = cell.getValue();
                    const color = value === 'on' ? '#22c55e' : '#ef4444';
                    return `<span style="color: ${color}">${value.toUpperCase()}</span>`;
                }
            }
        ],
        optionBuilder: getTableOption
    };

    // ======================
    // 4. Chart Config - ECharts 옵션 빌더
    // ======================
    this.chartConfig = {
        xKey: 'timestamps',
        series: [
            { yKey: 'power', name: 'Power (kW)', color: '#3b82f6', smooth: true, areaStyle: true },
            { yKey: 'current', name: 'Current (A)', color: '#f59e0b', smooth: true, yAxisIndex: 1 }
        ],
        optionBuilder: getDualAxisChartOption
    };

    // ======================
    // 5. 렌더링 함수 바인딩
    // ======================
    this.renderPDUInfo = renderPDUInfo.bind(this);
    this.renderCircuitTable = renderCircuitTable.bind(this, this.tableConfig);
    this.renderPowerChart = renderPowerChart.bind(this, this.chartConfig);

    // ======================
    // 6. Public Methods
    // ======================
    this.showDetail = showDetail.bind(this);
    this.hideDetail = hideDetail.bind(this);
    this._switchTab = switchTab.bind(this);

    // ======================
    // 7. 이벤트 발행
    // ======================
    this.customEvents = {
        click: '@assetClicked'
    };

    bind3DEvents(this, this.customEvents);

    // ======================
    // 8. Template Config
    // ======================
    this.templateConfig = {
        popup: 'popup-pdu',
    };

    this.popupCreatedConfig = {
        chartSelector: '.chart-container',
        tableSelector: '.table-container',
        events: {
            click: {
                '.close-btn': () => this.hideDetail(),
                '.tab-btn': (e) => this._switchTab(e.target.dataset.tab)
            }
        }
    };

    // ======================
    // 9. Popup Setup
    // ======================
    const { htmlCode, cssCode } = this.properties.publishCode || {};

    this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
    this.getPopupStyles = () => cssCode || '';
    this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig, this.tableConfig);

    applyShadowPopupMixin(this, {
        getHTML: this.getPopupHTML,
        getStyles: this.getPopupStyles,
        onCreated: this.onPopupCreated
    });

    applyEChartsMixin(this);
    applyTabulatorMixin(this);

    console.log('[PDU] Registered:', this._defaultAssetId);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail(assetId) {
    const targetId = assetId || this._defaultAssetId;
    this.showPopup();
    this._switchTab('circuits');

    fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, render }) =>
            fx.go(
                fetchData(this.page, datasetName, { assetId: targetId }),
                result => result?.response?.data,
                data => data && render.forEach(fn => this[fn](data))
            )
        )
    ).catch(e => {
        console.error('[PDU]', e);
        this.hidePopup();
    });
}

function hideDetail() {
    this.hidePopup();
}

function switchTab(tabName) {
    const buttons = this.popupQueryAll('.tab-btn');
    const panels = this.popupQueryAll('.tab-panel');

    fx.go(buttons, fx.each(btn => btn.classList.toggle('active', btn.dataset.tab === tabName)));
    fx.go(panels, fx.each(panel => panel.classList.toggle('active', panel.dataset.panel === tabName)));

    // 탭 전환 시 차트/테이블 리사이즈 (초기화 완료된 경우만)
    if (tabName === 'power') {
        const chart = this.getChart('.chart-container');
        if (chart) setTimeout(() => chart.resize(), 10);
    } else if (tabName === 'circuits') {
        // Tabulator 초기화 완료 확인
        if (this.isTableReady('.table-container')) {
            const table = this.getTable('.table-container');
            setTimeout(() => table.redraw(true), 10);
        }
    }
}

// ======================
// POPUP CREATED
// ======================

function onPopupCreated(popupConfig, tableConfig) {
    const { chartSelector, tableSelector, events } = popupConfig;
    if (chartSelector) this.createChart(chartSelector);
    if (tableSelector) {
        const tableOptions = tableConfig.optionBuilder(tableConfig.columns);
        this.createTable(tableSelector, tableOptions);
    }
    if (events) this.bindPopupEvents(events);
}

// ======================
// RENDER FUNCTIONS
// ======================

function renderPDUInfo(data) {
    // 기본 정보 렌더링 (name, zone, status)
    fx.go(
        this.baseInfoConfig,
        fx.each(({ key, selector, dataAttr }) => {
            const el = this.popupQuery(selector);
            if (!el) return;
            const value = data[key];
            el.textContent = value;
            if (dataAttr) el.dataset[dataAttr] = value;
        })
    );

    // 동적 필드 렌더링 (API fields 배열 사용 - Summary Bar)
    const container = this.popupQuery(this.fieldsContainerSelector);
    if (!container || !data.fields) return;

    const sortedFields = [...data.fields].sort((a, b) => (a.order || 0) - (b.order || 0));
    container.innerHTML = sortedFields.map(({ label, value, unit, valueLabel }) => {
        const displayValue = valueLabel ? valueLabel : (unit ? `${value}${unit}` : value);
        return `<div class="summary-item">
            <span class="summary-label">${label}</span>
            <span class="summary-value">${displayValue ?? '-'}</span>
        </div>`;
    }).join('');
}

function renderCircuitTable(config, data) {
    const circuits = data.circuits || data;
    this.updateTable(config.selector, circuits);
}

function renderPowerChart(config, data) {
    const option = config.optionBuilder(config, data);
    this.updateChart('.chart-container', option);
}

// ======================
// TABLE OPTION BUILDER
// ======================

function getTableOption(columns) {
    return {
        layout: 'fitColumns',
        responsiveLayout: 'collapse',
        placeholder: 'No circuits found',
        initialSort: [{ column: 'power', dir: 'desc' }],
        columns
    };
}

// ======================
// CHART OPTION BUILDER
// ======================

function getDualAxisChartOption(config, data) {
    const { xKey, series: seriesConfig } = config;

    return {
        grid: { left: 50, right: 50, top: 35, bottom: 24 },
        legend: {
            data: seriesConfig.map(s => s.name),
            top: 0,
            textStyle: { color: '#8892a0', fontSize: 11 }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#1a1f2e',
            borderColor: '#2a3142',
            textStyle: { color: '#e0e6ed', fontSize: 12 }
        },
        xAxis: {
            type: 'category',
            data: data[xKey],
            axisLine: { lineStyle: { color: '#333' } },
            axisLabel: { color: '#888', fontSize: 10 }
        },
        yAxis: [
            {
                type: 'value',
                name: 'kW',
                position: 'left',
                axisLine: { show: true, lineStyle: { color: '#3b82f6' } },
                axisLabel: { color: '#888', fontSize: 10 },
                splitLine: { lineStyle: { color: '#333' } }
            },
            {
                type: 'value',
                name: 'A',
                position: 'right',
                axisLine: { show: true, lineStyle: { color: '#f59e0b' } },
                axisLabel: { color: '#888', fontSize: 10 },
                splitLine: { show: false }
            }
        ],
        series: seriesConfig.map(({ yKey, name, color, smooth, areaStyle, yAxisIndex = 0 }) => ({
            name,
            type: 'line',
            yAxisIndex,
            data: data[yKey],
            smooth,
            symbol: 'none',
            lineStyle: { color, width: 2 },
            areaStyle: areaStyle ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: hexToRgba(color, 0.3) },
                        { offset: 1, color: hexToRgba(color, 0) }
                    ]
                }
            } : null
        }))
    };
}
