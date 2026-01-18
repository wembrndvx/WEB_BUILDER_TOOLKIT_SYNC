/*
 * UPS - 3D Popup Component
 *
 * applyShadowPopupMixin을 사용한 팝업 컴포넌트
 *
 * 핵심 구조:
 * 1. datasetInfo - 데이터 정의
 * 2. Data Config - API 필드 매핑
 * 3. 렌더링 함수 바인딩
 * 4. Public Methods - Page에서 호출
 * 5. customEvents - 이벤트 발행
 * 6. Template Data - HTML/CSS (publishCode에서 로드)
 * 7. Popup - template 기반 Shadow DOM 팝업
 */

const { bind3DEvents, fetchData } = Wkit;
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

// ======================
// TEMPLATE HELPER
// ======================
function extractTemplate(htmlCode, templateId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlCode, 'text/html');
    const template = doc.querySelector(`template#${templateId}`);
    return template?.innerHTML || '';
}

initComponent.call(this);

function initComponent() {
    // ======================
    // 1. 데이터 정의 (동적 assetId 지원)
    // ======================
    this._defaultAssetId = this.setter?.ecoAssetInfo?.assetId || this.id;

    this.datasetInfo = [
        { datasetName: 'ups', render: ['renderUPSInfo'] },
        { datasetName: 'upsHistory', render: ['renderChart'] }
    ];

    // ======================
    // 2. Data Config (하드코딩 제거)
    // - API 응답의 fields 배열을 직접 사용하여 동적 렌더링
    // ======================
    this.baseInfoConfig = [
        { key: 'name', selector: '.ups-name' },
        { key: 'statusLabel', selector: '.ups-status' },
        { key: 'status', selector: '.ups-status', dataAttr: 'status' }
    ];

    // 동적 필드 컨테이너 selector
    this.fieldsContainerSelector = '.fields-container';

    this.chartConfig = {
        xKey: 'timestamps',
        series: [
            { yKey: 'load', name: 'Load', color: '#3b82f6', smooth: true, areaStyle: true },
            { yKey: 'battery', name: 'Battery', color: '#22c55e', smooth: true }
        ],
        optionBuilder: getMultiLineChartOption
    };

    // ======================
    // 3. 렌더링 함수 바인딩
    // ======================
    this.renderUPSInfo = renderUPSInfo.bind(this);
    this.renderChart = renderChart.bind(this, this.chartConfig);

    // ======================
    // 4. Public Methods
    // ======================
    this.showDetail = showDetail.bind(this);
    this.hideDetail = hideDetail.bind(this);

    // ======================
    // 5. 이벤트 발행
    // ======================
    this.customEvents = {
        click: '@assetClicked'
    };

    bind3DEvents(this, this.customEvents);

    // ======================
    // 6. Template Config
    // ======================
    this.templateConfig = {
        popup: 'popup-ups',
    };

    // ======================
    // 7. Popup (template 기반)
    // ======================
    this.popupCreatedConfig = {
        chartSelector: '.chart-container',
        events: {
            click: {
                '.close-btn': () => this.hideDetail()
            }
        }
    };

    const { htmlCode, cssCode } = this.properties.publishCode || {};
    this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
    this.getPopupStyles = () => cssCode || '';
    this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig);

    applyShadowPopupMixin(this, {
        getHTML: this.getPopupHTML,
        getStyles: this.getPopupStyles,
        onCreated: this.onPopupCreated
    });

    applyEChartsMixin(this);

    console.log('[UPS] Registered:', this._defaultAssetId);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail(assetId) {
    const targetId = assetId || this._defaultAssetId;
    this.showPopup();
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
        console.error('[UPS]', e);
        this.hidePopup();
    });
}

function renderUPSInfo(data) {
    // 기본 정보 렌더링 (name, status)
    fx.go(
        this.baseInfoConfig,
        fx.each(({ key, selector, dataAttr }) => {
            const el = this.popupQuery(selector);
            if (!el) return;
            const value = data[key];
            el.textContent = value;
            dataAttr && (el.dataset[dataAttr] = value);
        })
    );

    // 동적 필드 렌더링 (API fields 배열 사용)
    const container = this.popupQuery(this.fieldsContainerSelector);
    if (!container || !data.fields) return;

    const sortedFields = [...data.fields].sort((a, b) => (a.order || 0) - (b.order || 0));
    container.innerHTML = sortedFields.map(({ label, value, unit, valueLabel }) => {
        const displayValue = valueLabel ? valueLabel : (unit ? `${value}${unit}` : value);
        return `<div class="value-card">
            <div class="value-label">${label}</div>
            <div class="value-data">${displayValue ?? '-'}</div>
        </div>`;
    }).join('');
}

function renderChart(config, data) {
    const { optionBuilder, ...chartConfig } = config;
    const option = optionBuilder(chartConfig, data);
    this.updateChart('.chart-container', option);
}

function hideDetail() {
    this.hidePopup();
}

// ======================
// CHART OPTION BUILDER
// ======================

function getMultiLineChartOption(config, data) {
    const { xKey, series: seriesConfig } = config;

    return {
        grid: { left: 45, right: 16, top: 30, bottom: 24 },
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
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLine: { show: false },
            axisLabel: { color: '#888', fontSize: 10, formatter: '{value}%' },
            splitLine: { lineStyle: { color: '#333' } }
        },
        series: seriesConfig.map(({ yKey, name, color, smooth, areaStyle }) => ({
            name,
            type: 'line',
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

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ======================
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
    chartSelector && this.createChart(chartSelector);
    events && this.bindPopupEvents(events);
}
