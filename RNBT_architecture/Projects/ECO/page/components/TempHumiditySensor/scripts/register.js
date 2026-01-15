/**
 * TempHumiditySensor - Self-Contained 3D Component
 *
 * 온습도 센서 컴포넌트
 * - 현재 온도/습도 표시
 * - 온습도 히스토리 차트
 * - IPSILON_3D TemperatureSensor 참조 구현
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
    this._defaultAssetId = this.setter?.ecoAssetInfo?.assetId || this.id;

    this.datasetInfo = [
        { datasetName: 'sensor', render: ['renderSensorInfo'] },
        { datasetName: 'sensorHistory', render: ['renderChart'] }
    ];

    // ======================
    // DATA CONFIG (하드코딩 제거)
    // - API 응답의 fields 배열을 직접 사용하여 동적 렌더링
    // ======================
    this.baseInfoConfig = [
        { key: 'name', selector: '.sensor-name' },
        { key: 'zone', selector: '.sensor-zone' },
        { key: 'statusLabel', selector: '.sensor-status' },
        { key: 'status', selector: '.sensor-status', dataAttr: 'status' }
    ];

    // 동적 필드 컨테이너 selector
    this.fieldsContainerSelector = '.fields-container';

    this.chartConfig = {
        xKey: 'timestamps',
        series: [
            { yKey: 'temperatures', name: 'Temperature', color: '#3b82f6', yAxisIndex: 0 },
            { yKey: 'humidity', name: 'Humidity', color: '#22c55e', yAxisIndex: 1 }
        ],
        yAxis: [
            { name: '°C', position: 'left' },
            { name: '%', position: 'right' }
        ],
        optionBuilder: getDualAxisChartOption
    };

    // ======================
    // RENDER FUNCTIONS
    // ======================
    this.renderSensorInfo = renderSensorInfo.bind(this);
    this.renderChart = renderChart.bind(this);

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
        popup: 'popup-sensor'
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

    console.log('[TempHumiditySensor] Registered:', this._defaultAssetId);
}

// ======================
// RENDER FUNCTIONS
// ======================
function renderSensorInfo(data) {
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

function renderChart(data) {
    const { optionBuilder, ...chartConfig } = this.chartConfig;
    const option = optionBuilder(chartConfig, data);
    this.updateChart('.chart-container', option);
}

// ======================
// CHART OPTION BUILDER
// ======================
function getDualAxisChartOption(config, data) {
    const { xKey, series: seriesConfig, yAxis: yAxisConfig } = config;

    return {
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(26, 31, 46, 0.95)',
            borderColor: '#2a3142',
            textStyle: { color: '#e0e6ed', fontSize: 12 }
        },
        legend: {
            data: seriesConfig.map(s => s.name),
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
        yAxis: yAxisConfig.map((axis, index) => ({
            type: 'value',
            name: axis.name,
            position: axis.position,
            axisLine: { show: true, lineStyle: { color: '#333' } },
            axisLabel: { color: '#888', fontSize: 10 },
            splitLine: { lineStyle: { color: index === 0 ? '#333' : 'transparent' } }
        })),
        series: seriesConfig.map(({ yKey, name, color, yAxisIndex }) => ({
            name: name,
            type: 'line',
            yAxisIndex: yAxisIndex,
            data: data[yKey],
            smooth: true,
            symbol: 'none',
            lineStyle: { color: color, width: 2 },
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
        console.error('[TempHumiditySensor]', e);
        this.hidePopup();
    });
}

function hideDetail() {
    this.hidePopup();
}
