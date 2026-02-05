/**
 * UPS (Uninterruptible Power Supply) - 3D Popup Component
 *
 * UPS 컴포넌트 (기획서 v.0.8_260128 기준)
 * - ① 기본정보 테이블 (assetDetailUnified + mdl/g + vdr/g 체이닝)
 * - ② UPS 전력현황 4카드 (metricLatest, 5초 갱신)
 * - ③ UPS 입/출력 추이 3탭 트렌드 차트 (전류/전압/주파수)
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
// RESPONSE HELPER
// ======================
function extractData(response, path = 'data') {
  if (!response?.response) return null;
  const data = response.response[path];
  return data !== null && data !== undefined ? data : null;
}

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. 내부 상태
  // ======================
  this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;
  this._baseUrl = '10.23.128.140:8811';
  this._locale = 'ko';
  this._popupTemplateId = 'popup-ups';
  this._trendData = null;
  this._activeTab = 'voltage';
  this._metricRefreshIntervalId = null;

  // ======================
  // 2. 변환 함수 바인딩 (config.fields.transform에서 사용)
  // ======================
  this.statusTypeToLabel = statusTypeToLabel.bind(this);       // 'ACTIVE' → '정상'
  this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this); // 'ACTIVE' → 'normal' (CSS 선택자용)
  this.formatDate = formatDate.bind(this);                     // ISO → 'YYYY-MM-DD'
  this.formatTimestamp = formatTimestamp.bind(this);           // ISO → 'HH:mm:ss'

  // ======================
  // 3. Config 통합 (this.config로 모든 설정 접근)
  // ======================
  this.config = {
    // 데이터셋 이름
    datasetNames: {
      assetDetail: 'assetDetailUnified',
      metricLatest: 'metricLatest',
      metricHistory: 'metricHistoryStats',
      modelDetail: 'modelDetail',
      vendorDetail: 'vendorDetail',
    },

    // 갱신 주기
    refresh: {
      interval: 5000,
    },

    // API 엔드포인트 및 파라미터
    api: {
      trendHistory: '/api/v1/mhs/l',
      trendParams: {
        interval: '1h',
        timeRange: 24 * 60 * 60 * 1000,
        metricCodes: [
          'UPS.INPUT_A_AVG', 'UPS.OUTPUT_A_AVG',
          'UPS.INPUT_V_AVG', 'UPS.OUTPUT_V_AVG',
          'UPS.INPUT_F_AVG', 'UPS.OUTPUT_F_AVG',
        ],
        statsKeys: ['avg'],
      },
    },

    // 상태 매핑
    statusMap: {
      labels: {
        ACTIVE: '정상운영',
        WARNING: '주의',
        CRITICAL: '위험',
        INACTIVE: '비활성',
        MAINTENANCE: '유지보수',
      },
      dataAttrs: {
        ACTIVE: 'normal',
        WARNING: 'warning',
        CRITICAL: 'critical',
        INACTIVE: 'inactive',
        MAINTENANCE: 'maintenance',
      },
      defaultDataAttr: 'normal',
    },

    // ========================
    // UI 영역별 설정
    // ========================

    // 팝업 헤더 영역
    header: {
      fields: [
        { key: 'name', selector: '.ups-name' },
        { key: 'locationLabel', selector: '.ups-zone' },
        { key: 'statusType', selector: '.ups-status', transform: this.statusTypeToLabel },
        { key: 'statusType', selector: '.ups-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
      ],
    },

    // 기본정보 테이블 영역
    infoTable: {
      fields: [
        { key: 'name', selector: '.info-name' },
        { key: 'assetType', selector: '.info-type' },
        { key: 'usageLabel', selector: '.info-usage', fallback: '-' },
        { key: 'locationLabel', selector: '.info-location' },
        { key: 'statusType', selector: '.info-status', transform: this.statusTypeToLabel },
        { key: 'installDate', selector: '.info-install-date', transform: this.formatDate },
      ],
      chain: {
        model: '.info-model',
        vendor: '.info-vendor',
      },
    },

    // 전력현황 영역 (4카드)
    powerStatus: {
      metrics: {
        batterySoc:   { label: '배터리 사용률',   unit: '%', metricCode: 'UPS.BATT_PCT', scale: 1.0 },
        batteryTime:  { label: '배터리 잔여시간', unit: 'h', metricCode: null,          scale: 1.0 },  // API 미지원
        loadRate:     { label: '부하율',         unit: '%', metricCode: 'UPS.LOAD_PCT', scale: 1.0 },
        batteryVolt:  { label: '배터리 출력전압', unit: 'V', metricCode: 'UPS.BATT_V',   scale: 0.1 },
      },
      selectors: {
        card: '.power-card',
        label: '.power-card-label',
        value: '.power-card-value',
        unit: '.power-card-unit',
        timestamp: '.section-timestamp',
      },
    },

    // 트렌드 차트 영역 (3탭)
    chart: {
      tabs: {
        current:   { label: '입/출력 전류',   unit: 'A',  inputCode: 'UPS.INPUT_A_AVG',  outputCode: 'UPS.OUTPUT_A_AVG' },
        voltage:   { label: '입/출력 전압',   unit: 'V',  inputCode: 'UPS.INPUT_V_AVG',  outputCode: 'UPS.OUTPUT_V_AVG' },
        frequency: { label: '입/출력 주파수', unit: 'Hz', inputCode: 'UPS.INPUT_F_AVG',  outputCode: 'UPS.OUTPUT_F_AVG' },
      },
      series: {
        input:  { label: '입력', color: '#f59e0b' },
        output: { label: '출력', color: '#22c55e' },
      },
      selectors: {
        container: '.chart-container',
        tabBtn: '.tab-btn',
        legendInput: '.legend-input .legend-label',
        legendOutput: '.legend-output .legend-label',
      },
    },
  };

  // ======================
  // 4. 데이터셋 정의
  // ======================
  const { datasetNames, api } = this.config;
  const baseParam = { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey, locale: this._locale };

  this.datasetInfo = [
    { datasetName: datasetNames.assetDetail, param: { ...baseParam }, render: ['renderBasicInfo'] },
    { datasetName: datasetNames.metricLatest, param: { ...baseParam }, render: ['renderPowerStatus'] },
    { datasetName: datasetNames.metricHistory, param: { ...baseParam, ...api.trendParams }, render: ['renderTrendChart'] },
  ];

  // ======================
  // 5. 렌더링 함수 바인딩
  // ======================
  this.renderBasicInfo = renderBasicInfo.bind(this);
  this.renderPowerStatus = renderPowerStatus.bind(this);
  this.renderTrendChart = renderTrendChart.bind(this);

  // ======================
  // 6. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this.refreshMetrics = refreshMetrics.bind(this);
  this.stopRefresh = stopRefresh.bind(this);
  this._switchTab = switchTab.bind(this);

  // ======================
  // 7. 3D 이벤트 바인딩 (라이브러리 강제 네이밍)
  // ======================
  this.customEvents = {
    click: '@assetClicked',
  };

  bind3DEvents(this, this.customEvents);

  // ======================
  // 8. Popup (template 기반)
  // ======================
  const popupCreatedConfig = {
    chartSelector: this.config.chart.selectors.container,
    events: {
      click: {
        '.close-btn': () => this.hideDetail(),
        '.tab-btn': (e) => this._switchTab(e.target.dataset.tab),
      },
    },
  };

  const { htmlCode, cssCode } = this.properties.publishCode || {};
  this.getPopupHTML = () => extractTemplate(htmlCode || '', this._popupTemplateId);
  this.getPopupStyles = () => cssCode || '';
  this.onPopupCreated = onPopupCreated.bind(this, popupCreatedConfig);

  applyShadowPopupMixin(this, {
    getHTML: this.getPopupHTML,
    getStyles: this.getPopupStyles,
    onCreated: this.onPopupCreated,
  });

  applyEChartsMixin(this);

  console.log('[UPS] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();

  const { datasetNames, refresh } = this.config;

  // 1) assetDetailUnified + metricLatest 호출 (섹션별 독립 처리)
  fx.go(
    this.datasetInfo,
    fx.filter(d => d.datasetName !== datasetNames.metricHistory),
    fx.each(({ datasetName, param, render }) =>
      fetchData(this.page, datasetName, param)
        .then(response => {
          const data = extractData(response);
          if (!data) return;
          fx.each(fn => this[fn](response), render);
        })
        .catch(e => console.warn(`[UPS] ${datasetName} fetch failed:`, e))
    )
  );

  // 2) 트렌드 차트 호출 (mhs/l)
  fetchTrendData.call(this);

  // 3) 5초 주기로 메트릭 갱신 시작
  this.stopRefresh();
  this._metricRefreshIntervalId = setInterval(() => this.refreshMetrics(), refresh.interval);
}

function hideDetail() {
  this.stopRefresh();
  this.hidePopup();
}

function refreshMetrics() {
  const { datasetNames } = this.config;
  const metricInfo = this.datasetInfo.find(d => d.datasetName === datasetNames.metricLatest);
  if (!metricInfo) return;

  const { datasetName, param, render } = metricInfo;

  fetchData(this.page, datasetName, param)
    .then(response => {
      const data = extractData(response);
      if (!data) return;
      fx.each(fn => this[fn](response), render);
    })
    .catch(e => console.warn(`[UPS] ${datasetName} fetch failed:`, e));
}

function stopRefresh() {
  if (this._metricRefreshIntervalId) {
    clearInterval(this._metricRefreshIntervalId);
    this._metricRefreshIntervalId = null;
    console.log('[UPS] Metric refresh stopped');
  }
}

function switchTab(tabName) {
  const { chart } = this.config;
  if (!tabName || !chart.tabs[tabName]) return;
  this._activeTab = tabName;

  const buttons = this.popupQueryAll(chart.selectors.tabBtn);
  if (buttons) {
    buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
  }

  // 이미 로드된 데이터로 차트 갱신
  if (this._trendData) {
    this.renderTrendChart({ response: { data: this._trendData } });
  }
}

// ======================
// TREND DATA FETCH
// ======================

function fetchTrendData() {
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find(d => d.datasetName === datasetNames.metricHistory);
  if (!trendInfo) return;

  const { datasetName, param, render } = trendInfo;
  const { baseUrl, assetKey, interval, metricCodes, statsKeys } = param;

  // timeFrom, timeTo 동적 계산
  const now = new Date();
  const from = new Date(now.getTime() - this.config.api.trendParams.timeRange);
  const timeFrom = from.toISOString().replace('T', ' ').slice(0, 19);
  const timeTo = now.toISOString().replace('T', ' ').slice(0, 19);

  fetch(`http://${baseUrl}${this.config.api.trendHistory}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: { assetKey, interval, metricCodes, timeFrom, timeTo },
      statsKeys,
      sort: [],
    }),
  })
    .then(response => response.json())
    .then(result => {
      if (!result?.success || !result.data) {
        console.warn(`[UPS] ${datasetName}: no data`);
        return;
      }
      // 캐싱 후 렌더링
      this._trendData = result.data;
      fx.each(fn => this[fn]({ response: { data: result.data } }), render);
    })
    .catch(e => console.warn(`[UPS] ${datasetName} fetch failed:`, e));
}

// ======================
// RENDER: 기본정보 테이블
// ======================

function renderBasicInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    console.warn('[UPS] renderBasicInfo: no asset data');
    return;
  }

  const asset = data.asset;
  const { header, infoTable, datasetNames } = this.config;

  // Header 영역
  fx.go(
    header.fields,
    fx.each(field => renderField(this, asset, field))
  );

  // 기본정보 테이블
  fx.go(
    infoTable.fields,
    fx.each(field => renderField(this, asset, field))
  );

  // 제조사명/모델 체이닝
  if (asset.assetModelKey) {
    fetchModelVendorChain.call(this, asset.assetModelKey, infoTable.chain, datasetNames);
  }
}

function renderField(ctx, data, { key, selector, dataAttr, transform, fallback }) {
  const el = ctx.popupQuery(selector);
  if (!el) return;

  let value = data[key] ?? fallback ?? '-';
  if (transform) value = transform(value);

  if (dataAttr) {
    el.dataset[dataAttr] = value;
  } else {
    el.textContent = value;
  }
}

function fetchModelVendorChain(assetModelKey, chain, datasetNames) {
  const setCell = (selector, value) => {
    const el = this.popupQuery(selector);
    if (el) el.textContent = value ?? '-';
  };

  fetchData(this.page, datasetNames.modelDetail, { baseUrl: this._baseUrl, assetModelKey })
    .then(resp => {
      const model = extractData(resp);
      if (!model) return;

      setCell(chain.model, model.name);

      if (model.assetVendorKey) {
        return fetchData(this.page, datasetNames.vendorDetail, { baseUrl: this._baseUrl, assetVendorKey: model.assetVendorKey });
      }
    })
    .then(resp => {
      if (!resp) return;
      const vendor = extractData(resp);
      if (vendor) setCell(chain.vendor, vendor.name);
    })
    .catch(() => {});
}

// ======================
// RENDER: UPS 전력현황 (4카드)
// ======================

function renderPowerStatus({ response }) {
  const { data } = response;
  const { powerStatus } = this.config;
  const { metrics, selectors } = powerStatus;

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[UPS] renderPowerStatus: no data');
    return;
  }

  // 타임스탬프 표시
  const timestampEl = this.popupQuery(selectors.timestamp);
  if (timestampEl && data[0]?.eventedAt) {
    timestampEl.textContent = this.formatTimestamp(data[0].eventedAt);
  }

  // 메트릭 코드 → 값 매핑
  const metricMap = fx.reduce(
    (acc, m) => (acc[m.metricCode] = m.valueType === 'NUMBER' ? m.valueNumber : m.valueString, acc),
    {},
    data
  );

  // 카드 업데이트
  fx.go(
    Object.entries(metrics),
    fx.each(([key, cfg]) => updatePowerCard(this, selectors, metricMap, key, cfg))
  );
}

function updatePowerCard(ctx, selectors, metricMap, key, cfg) {
  const card = ctx.popupQuery(`${selectors.card}[data-metric="${key}"]`);
  const valueEl = card?.querySelector(selectors.value);
  if (!valueEl) return;

  if (!cfg.metricCode) {
    valueEl.textContent = '-';
    return;
  }

  const rawValue = metricMap[cfg.metricCode];
  valueEl.textContent = rawValue != null ? (rawValue * cfg.scale).toFixed(1) : '-';
}

// ======================
// RENDER: 트렌드 차트 (탭별 듀얼 라인)
// ======================

function renderTrendChart({ response }) {
  const { data } = response;
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[UPS] renderTrendChart: no data');
    return;
  }

  const { chart } = this.config;
  const { tabs, series, selectors } = chart;
  const tabConfig = tabs[this._activeTab];
  if (!tabConfig) return;

  // 시간별 그룹핑 + 시리즈 데이터 추출
  const timeMap = fx.reduce(
    (acc, row) => {
      const hour = new Date(row.time).getHours() + '시';
      if (!acc[hour]) acc[hour] = {};
      acc[hour][row.metricCode] = row.statsBody?.avg ?? null;
      return acc;
    },
    {},
    data
  );

  const hours = Object.keys(timeMap);
  const extractValues = (code) => fx.map(h => {
    const raw = timeMap[h][code];
    return raw != null ? +(raw).toFixed(2) : null;
  }, hours);

  const inputValues = extractValues(tabConfig.inputCode);
  const outputValues = extractValues(tabConfig.outputCode);

  const { input: inputSeries, output: outputSeries } = series;

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.95)',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    legend: {
      data: [inputSeries.label, outputSeries.label],
      top: 8,
      textStyle: { color: '#8892a0', fontSize: 11 },
    },
    grid: { left: 50, right: 20, top: 40, bottom: 24 },
    xAxis: {
      type: 'category',
      data: hours,
      axisLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: tabConfig.unit,
      axisLine: { show: true, lineStyle: { color: '#666' } },
      axisLabel: { color: '#888', fontSize: 10 },
      splitLine: { lineStyle: { color: '#333' } },
    },
    series: [
      {
        name: inputSeries.label,
        type: 'line',
        data: inputValues,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: inputSeries.color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(inputSeries.color, 0.2) },
              { offset: 1, color: hexToRgba(inputSeries.color, 0) },
            ],
          },
        },
      },
      {
        name: outputSeries.label,
        type: 'line',
        data: outputValues,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: outputSeries.color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(outputSeries.color, 0.2) },
              { offset: 1, color: hexToRgba(outputSeries.color, 0) },
            ],
          },
        },
      },
    ],
  };

  this.updateChart(selectors.container, option);
}

// ======================
// TRANSFORM FUNCTIONS
// ======================

function statusTypeToLabel(statusType) {
  const { labels } = this.config.statusMap;
  return labels[statusType] || statusType;
}

function statusTypeToDataAttr(statusType) {
  const { dataAttrs, defaultDataAttr } = this.config.statusMap;
  return dataAttrs[statusType] || defaultDataAttr;
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
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
  renderInitialLabels.call(this);
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
}

function renderInitialLabels() {
  const { powerStatus, chart } = this.config;

  // 전력현황 카드 라벨/유닛
  fx.go(
    Object.entries(powerStatus.metrics),
    fx.each(([key, cfg]) => {
      const card = this.popupQuery(`${powerStatus.selectors.card}[data-metric="${key}"]`);
      if (!card) return;
      const labelEl = card.querySelector(powerStatus.selectors.label);
      const unitEl = card.querySelector(powerStatus.selectors.unit);
      if (labelEl) labelEl.textContent = cfg.label;
      if (unitEl) unitEl.textContent = cfg.unit;
    })
  );

  // 탭 버튼 라벨
  fx.go(
    Object.entries(chart.tabs),
    fx.each(([key, cfg]) => {
      const btn = this.popupQuery(`${chart.selectors.tabBtn}[data-tab="${key}"]`);
      if (btn) btn.textContent = cfg.label;
    })
  );

  // 범례 라벨
  const inputLegend = this.popupQuery(chart.selectors.legendInput);
  const outputLegend = this.popupQuery(chart.selectors.legendOutput);
  if (inputLegend) inputLegend.textContent = chart.series.input.label;
  if (outputLegend) outputLegend.textContent = chart.series.output.label;
}
