/**
 * CRAC (Computer Room Air Conditioning) - 3D Popup Component
 *
 * 항온항습기 컴포넌트
 * - 급기/환기 온도, 습도 실시간 표시
 * - 온습도 히스토리 차트 (듀얼 Y축: 온도/습도)
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

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

initComponent.call(this);

function initComponent() {
    // ======================
    // DATA DEFINITION (동적 assetId 지원)
    // ======================
    this._defaultAssetId = this.setter?.assetInfo?.assetId || this.id;

    this.datasetInfo = [
        { datasetName: 'crac', render: ['renderCRACInfo'] },
        { datasetName: 'cracHistory', render: ['renderChart'] }
    ];

    // ======================
    // DATA CONFIG (하드코딩 제거)
    // - API 응답의 fields 배열을 직접 사용하여 동적 렌더링
    // ======================
    this.baseInfoConfig = [
        { key: 'name', selector: '.crac-name' },
        { key: 'zone', selector: '.crac-zone' },
        { key: 'statusLabel', selector: '.crac-status' },
        { key: 'status', selector: '.crac-status', dataAttr: 'status' }
    ];

    // 동적 필드 컨테이너 selector
    this.fieldsContainerSelector = '.fields-container';

    // chartConfig: API fields를 활용한 동적 렌더링
    // - xKey, valuesKey: API 응답 구조에 맞게 수정 필요
    // - series 정보는 API response의 fields 배열에서 가져옴
    // - 색상, yAxisIndex 등 스타일 정보만 로컬에서 정의
    this.chartConfig = {
        xKey: 'timestamps',           // ← API 응답의 x축 데이터 키
        valuesKey: 'values',          // ← API 응답의 시계열 데이터 객체 키
        styleMap: {
            supplyTemp: { color: '#3b82f6', yAxisIndex: 0 },
            returnTemp: { color: '#ef4444', yAxisIndex: 0 },
            humidity: { color: '#22c55e', yAxisIndex: 1 }
        },
        optionBuilder: getDualAxisChartOption
    };

    // ======================
    // RENDER FUNCTIONS
    // ======================
    this.renderCRACInfo = renderCRACInfo.bind(this);
    this.renderChart = renderChart.bind(this, this.chartConfig);

    // ======================
    // PUBLIC METHODS
    // ======================
    this.showDetail = showDetail.bind(this);
    this.hideDetail = hideDetail.bind(this);

    // ======================
    // CUSTOM EVENTS
    // ======================
    this.customEvents = {
        click: '@assetClicked'
    };

    bind3DEvents(this, this.customEvents);

    // ======================
    // TEMPLATE CONFIG
    // ======================
    this.templateConfig = {
        popup: 'popup-crac'
    };

    this.popupCreatedConfig = {
        chartSelector: '.chart-container',
        events: {
            click: {
                '.close-btn': () => this.hideDetail()
            }
        }
    };

    // ======================
    // POPUP SETUP
    // ======================
    const { htmlCode, cssCode } = this.properties.publishCode || {};
    const ctx = this;

    this.getPopupHTML = () => extractTemplate(htmlCode || '', ctx.templateConfig.popup);
    this.getPopupStyles = () => cssCode || '';
    this.onPopupCreated = function() {
        const { chartSelector, events } = ctx.popupCreatedConfig;
        if (chartSelector) ctx.createChart(chartSelector);
        if (events) ctx.bindPopupEvents(events);
    };

    applyShadowPopupMixin(this, {
        getHTML: this.getPopupHTML,
        getStyles: this.getPopupStyles,
        onCreated: this.onPopupCreated
    });

    applyEChartsMixin(this);

    console.log('[CRAC] Registered:', this._defaultAssetId);
}

// ======================
// RENDER FUNCTIONS
// ======================
function renderCRACInfo({ response }) {
    const { data } = response;
    if (!data) return;

    // 기본 정보 렌더링 (name, zone, status)
    fx.go(
        this.baseInfoConfig,
        fx.each(({ key, selector, dataAttr }) => {
            const el = this.popupQuery(selector);
            if (el) {
                el.textContent = data[key];
                if (dataAttr) el.dataset[dataAttr] = data[key];
            }
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

function renderChart(config, { response }) {
    const { data } = response;
    if (!data) return;
    const { optionBuilder, ...chartConfig } = config;
    const option = optionBuilder(chartConfig, data);
    this.updateChart('.chart-container', option);
}

// ======================
// CHART OPTION BUILDER
// ======================
function getDualAxisChartOption(config, data) {
    const { xKey, valuesKey, styleMap } = config;
    const { fields } = data;
    const values = data[valuesKey];

    // API fields를 기반으로 series 생성
    const seriesData = fields.map(field => {
        const style = styleMap[field.key] || {};
        return {
            key: field.key,
            name: field.label,
            unit: field.unit,
            ...style
        };
    });

    // yAxis 설정: fields의 unit 정보 활용
    const yAxisUnits = [...new Set(seriesData.map(s => s.unit))];
    const yAxes = yAxisUnits.map((unit, idx) => ({
        type: 'value',
        name: unit,
        position: idx === 0 ? 'left' : 'right',
        axisLine: { show: true, lineStyle: { color: '#333' } },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: idx === 0 ? '#333' : 'transparent' } }
    }));

    return {
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(26, 31, 46, 0.95)',
            borderColor: '#2a3142',
            textStyle: { color: '#e0e6ed', fontSize: 12 }
        },
        legend: {
            data: seriesData.map(s => s.name),
            top: 8,
            textStyle: { color: '#8892a0', fontSize: 11 }
        },
        grid: {
            left: 50,
            right: 50,
            top: 40,
            bottom: 24
        },
        xAxis: {
            type: 'category',
            data: data[xKey],
            axisLine: { lineStyle: { color: '#333' } },
            axisLabel: { color: '#888', fontSize: 10 }
        },
        yAxis: yAxes,
        series: seriesData.map(({ key, name, color, yAxisIndex = 0 }) => ({
            name,
            type: 'line',
            yAxisIndex,
            data: values[key],
            smooth: true,
            symbol: 'none',
            lineStyle: { color, width: 2 },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: hexToRgba(color, 0.2) },
                        { offset: 1, color: hexToRgba(color, 0) }
                    ]
                }
            }
        }))
    };
}

// ======================
// PUBLIC METHODS
// ======================
function showDetail() {
    this.showPopup();

    fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, render }) =>
            fx.go(
                fetchData(this.page, datasetName, { assetId: this._defaultAssetId }),
                response => response && fx.each(fn => this[fn](response), render)
            )
        )
    ).catch(e => {
        console.error('[CRAC]', e);
        this.hidePopup();
    });
}

function hideDetail() {
    this.hidePopup();
}
