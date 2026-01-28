/**
 * TempHumiditySensor - 3D Component with Popup
 *
 * 온습도 센서 컴포넌트
 * - 실시간 온도/습도 표시 (metricLatest API)
 * - 자산 속성 정보 (assetDetailUnified API)
 * - 온습도 히스토리 차트 (추후)
 *
 * 데이터 소스:
 * - assetDetailUnified: 자산 기본 정보 (Header) + 정적 속성 (Properties)
 * - metricLatest: 실시간 측정값 (Metrics)
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

// ======================
// METRIC CONFIG (metricConfig.json 인라인)
// ======================
const METRIC_CONFIG = {
  'SENSOR.TEMP': {
    label: '온도',
    description: '센서 온도',
    valueType: 'NUMBER',
    unit: '°C',
    scale: 1.0,
    interface: 'PERF_SENSOR',
  },
  'SENSOR.HUMIDITY': {
    label: '습도',
    description: '상대습도',
    valueType: 'NUMBER',
    unit: '%RH',
    scale: 1.0,
    interface: 'PERF_SENSOR',
  },
  'SENSOR.MEASURED_AT': {
    label: '측정시각',
    description: '측정시각(필요 시)',
    valueType: 'STRING/NUMBER',
    unit: 'timestamp',
    scale: 1.0,
    interface: 'PERF_SENSOR.STIME',
  },
};

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. 데이터 정의 (동적 assetKey 지원)
  // ======================
  this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;

  // 데이터셋 정의: 2개 API 병렬 호출
  this.datasetInfo = [
    { datasetName: 'assetDetailUnified', render: ['renderAssetInfo', 'renderProperties'] },
    { datasetName: 'metricLatest', render: ['renderMetrics'] },
    // { datasetName: 'sensorHistory', render: ['renderChart'] },  // 차트 (추후 활성화)
  ];

  // ======================
  // 2. 변환 함수 바인딩
  // ======================
  this.statusTypeToLabel = statusTypeToLabel.bind(this);
  this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this);
  this.formatDate = formatDate.bind(this);
  this.formatTimestamp = formatTimestamp.bind(this);

  // ======================
  // 3. Data Config
  // ======================
  // 헤더 영역 고정 필드 (assetDetailUnified.asset)
  this.baseInfoConfig = [
    { key: 'name', selector: '.sensor-name' },
    { key: 'locationLabel', selector: '.sensor-zone' },
    { key: 'statusType', selector: '.sensor-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.sensor-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  // 컨테이너 selector
  this.metricsContainerSelector = '.metrics-container';
  this.propertiesContainerSelector = '.properties-container';
  this.propertiesSectionSelector = '.properties-section';
  this.timestampSelector = '.section-timestamp';

  // Metric Config 참조
  this.metricConfig = METRIC_CONFIG;

  // chartConfig: 차트 렌더링 설정 (추후 활성화)
  this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
      temperature: { label: '온도', unit: '°C', color: '#3b82f6', yAxisIndex: 0 },
      humidity: { label: '습도', unit: '%', color: '#22c55e', yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
  };

  // ======================
  // 4. 렌더링 함수 바인딩
  // ======================
  this.renderAssetInfo = renderAssetInfo.bind(this);
  this.renderProperties = renderProperties.bind(this);
  this.renderMetrics = renderMetrics.bind(this);
  this.renderChart = renderChart.bind(this, this.chartConfig);
  this.renderError = renderError.bind(this);

  // ======================
  // 5. Refresh Config
  // ======================
  this.refreshInterval = 5000; // 5초
  this._refreshIntervalId = null;

  // ======================
  // 6. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this.refreshMetrics = refreshMetrics.bind(this);
  this.stopRefresh = stopRefresh.bind(this);

  // ======================
  // 7. 이벤트 발행
  // ======================
  this.customEvents = {
    click: '@assetClicked',
  };

  bind3DEvents(this, this.customEvents);

  // ======================
  // 8. Template Config
  // ======================
  this.templateConfig = {
    popup: 'popup-sensor',
  };

  // ======================
  // 9. Popup (template 기반)
  // ======================
  this.popupCreatedConfig = {
    chartSelector: '.chart-container',
    events: {
      click: {
        '.close-btn': () => this.hideDetail(),
      },
    },
  };

  const { htmlCode, cssCode } = this.properties.publishCode || {};
  this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
  this.getPopupStyles = () => cssCode || '';
  this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig);

  applyShadowPopupMixin(this, {
    getHTML: this.getPopupHTML,
    getStyles: this.getPopupStyles,
    onCreated: this.onPopupCreated,
  });

  applyEChartsMixin(this);

  console.log('[TempHumiditySensor] Registered:', this._defaultAssetKey);
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
        fetchData(this.page, datasetName, { assetKey: this._defaultAssetKey, locale: 'ko' }),
        (response) => {
          if (!response || !response.response) {
            this.renderError('데이터를 불러올 수 없습니다.');
            return;
          }
          // metricLatest는 data가 배열 (빈 배열일 수 있음)
          // assetDetailUnified는 data가 객체
          const data = response.response.data;
          if (data === null || data === undefined) {
            this.renderError('자산 정보가 존재하지 않습니다.');
            return;
          }
          fx.each((fn) => this[fn](response), render);
        }
      )
    )
  ).catch((e) => {
    console.error('[TempHumiditySensor]', e);
    this.renderError('데이터 로드 중 오류가 발생했습니다.');
  });

  // 5초 주기로 메트릭 갱신 시작
  this.stopRefresh(); // 기존 interval 정리
  this._refreshIntervalId = setInterval(() => this.refreshMetrics(), this.refreshInterval);
  console.log('[TempHumiditySensor] Metric refresh started (5s interval)');
}

function hideDetail() {
  this.stopRefresh();
  this.hidePopup();
}

/**
 * 메트릭 데이터만 갱신 (5초 주기)
 */
function refreshMetrics() {
  fx.go(
    fetchData(this.page, 'metricLatest', { assetKey: this._defaultAssetKey }),
    (response) => {
      if (!response || !response.response) return;
      const data = response.response.data;
      if (data === null || data === undefined) return;
      this.renderMetrics(response);
    }
  ).catch((e) => {
    console.warn('[TempHumiditySensor] Metric refresh failed:', e);
  });
}

/**
 * 메트릭 갱신 중지
 */
function stopRefresh() {
  if (this._refreshIntervalId) {
    clearInterval(this._refreshIntervalId);
    this._refreshIntervalId = null;
    console.log('[TempHumiditySensor] Metric refresh stopped');
  }
}

// ======================
// RENDER FUNCTIONS
// ======================

/**
 * 자산 기본 정보 렌더링 (Header)
 * 데이터: assetDetailUnified.asset
 */
function renderAssetInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    renderError.call(this, '자산 데이터가 없습니다.');
    return;
  }

  const asset = data.asset;

  fx.go(
    this.baseInfoConfig,
    fx.each(({ key, selector, dataAttr, transform }) => {
      const el = this.popupQuery(selector);
      if (!el) return;
      let value = asset[key];
      if (transform) value = transform(value);
      if (dataAttr) {
        el.dataset[dataAttr] = value;
      } else {
        el.textContent = value;
      }
    })
  );
}

/**
 * 실시간 메트릭 렌더링 (Metrics Section)
 * 데이터: metricLatest + metricConfig
 */
function renderMetrics({ response }) {
  const { data } = response; // data는 배열
  const container = this.popupQuery(this.metricsContainerSelector);
  const timestampEl = this.popupQuery(this.timestampSelector);

  if (!container) return;

  // 메트릭 데이터가 없는 경우
  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="empty-state">측정 데이터가 없습니다</div>';
    return;
  }

  // 타임스탬프 표시 (첫 번째 메트릭의 eventedAt 사용)
  if (timestampEl && data[0]?.eventedAt) {
    timestampEl.textContent = this.formatTimestamp(data[0].eventedAt);
  }

  // metricConfig 기반으로 렌더링
  container.innerHTML = data
    .map((metric) => {
      const config = this.metricConfig[metric.metricCode];
      if (!config) return ''; // config 없으면 스킵

      const value = metric.valueType === 'NUMBER' ? metric.valueNumber : metric.valueString;
      const displayValue = config.scale ? (value * config.scale).toFixed(1) : value;

      return `
        <div class="metric-card">
          <div class="metric-label">${config.label}</div>
          <div class="metric-value">${displayValue}<span class="metric-unit">${config.unit}</span></div>
        </div>
      `;
    })
    .join('');
}

/**
 * 정적 속성 렌더링 (Properties Section)
 * 데이터: assetDetailUnified.properties
 */
function renderProperties({ response }) {
  const { data } = response;
  const container = this.popupQuery(this.propertiesContainerSelector);

  if (!container) return;

  // properties가 없거나 빈 배열인 경우 empty-state 표시
  if (!data?.properties || data.properties.length === 0) {
    container.innerHTML = '<div class="empty-state">속성 정보가 없습니다</div>';
    return;
  }

  // displayOrder로 정렬
  const sortedProperties = [...data.properties].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  container.innerHTML = sortedProperties
    .map(({ label, value, helpText }) => {
      return `
        <div class="property-card" title="${helpText || ''}">
          <div class="property-label">${label}</div>
          <div class="property-value">${value ?? '-'}</div>
        </div>
      `;
    })
    .join('');
}

/**
 * 에러 상태 렌더링
 */
function renderError(message) {
  const nameEl = this.popupQuery('.sensor-name');
  const zoneEl = this.popupQuery('.sensor-zone');
  const statusEl = this.popupQuery('.sensor-status');

  if (nameEl) nameEl.textContent = '데이터 없음';
  if (zoneEl) zoneEl.textContent = message;
  if (statusEl) {
    statusEl.textContent = 'Error';
    statusEl.dataset.status = 'critical';
  }

  const metricsContainer = this.popupQuery(this.metricsContainerSelector);
  if (metricsContainer) {
    metricsContainer.innerHTML = `<div class="error-state">${message}</div>`;
  }

  console.warn('[TempHumiditySensor] renderError:', message);
}

/**
 * 차트 렌더링 (추후 활성화)
 */
function renderChart(config, { response }) {
  const { data } = response;
  if (!data) {
    console.warn('[TempHumiditySensor] renderChart: data is null');
    return;
  }
  if (!data[config.xKey]) {
    console.warn('[TempHumiditySensor] renderChart: chart data is incomplete');
    return;
  }
  const { optionBuilder, ...chartConfig } = config;
  const option = optionBuilder(chartConfig, data);
  this.updateChart('.chart-container', option);
}

// ======================
// TRANSFORM FUNCTIONS
// ======================

function statusTypeToLabel(statusType) {
  const labels = {
    ACTIVE: 'Normal',
    WARNING: 'Warning',
    CRITICAL: 'Critical',
    INACTIVE: 'Inactive',
    MAINTENANCE: 'Maintenance',
  };
  return labels[statusType] || statusType;
}

function statusTypeToDataAttr(statusType) {
  const map = {
    ACTIVE: 'normal',
    WARNING: 'warning',
    CRITICAL: 'critical',
    INACTIVE: 'inactive',
    MAINTENANCE: 'maintenance',
  };
  return map[statusType] || 'normal';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

// ======================
// CHART OPTION BUILDER
// ======================

function getDualAxisChartOption(config, data) {
  const { xKey, styleMap } = config;

  const seriesData = Object.entries(styleMap).map(([key, style]) => ({
    key,
    name: style.label,
    unit: style.unit,
    color: style.color,
    yAxisIndex: style.yAxisIndex,
  }));

  const yAxisUnits = [...new Set(seriesData.map((s) => s.unit))];
  const yAxes = yAxisUnits.map((unit, idx) => ({
    type: 'value',
    name: unit,
    position: idx === 0 ? 'left' : 'right',
    axisLine: { show: true, lineStyle: { color: '#333' } },
    axisLabel: { color: '#888', fontSize: 10 },
    splitLine: { lineStyle: { color: idx === 0 ? '#333' : 'transparent' } },
  }));

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.95)',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    legend: {
      data: seriesData.map((s) => s.name),
      top: 8,
      textStyle: { color: '#8892a0', fontSize: 11 },
    },
    grid: {
      left: 50,
      right: 50,
      top: 40,
      bottom: 24,
    },
    xAxis: {
      type: 'category',
      data: data[xKey],
      axisLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: yAxes,
    series: seriesData.map(({ key, name, color, yAxisIndex = 0 }) => ({
      name,
      type: 'line',
      yAxisIndex,
      data: data[key],
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: hexToRgba(color, 0.2) },
            { offset: 1, color: hexToRgba(color, 0) },
          ],
        },
      },
    })),
  };
}

// ======================
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
}
