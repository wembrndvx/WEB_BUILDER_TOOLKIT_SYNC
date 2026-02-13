/**
 * CRAC (Computer Room Air Conditioning) - 3D Popup Component
 *
 * 항온항습기 컴포넌트 (기획서 v.0.8_260128 기준)
 * - ① 기본정보 테이블 (assetDetailUnified + mdl/g + vdr/g 체이닝)
 * - 상태정보 카드 (현재/설정 온습도)
 * - ② 상태 인디케이터 (6개 BOOL: 팬, 냉방, 난방, 가습, 제습, 누수)
 * - ③ 온/습도 현황 트렌드 차트 (mhs/l → bar+line dual-axis)
 */

const { bind3DEvents, fetchData } = Wkit;
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;
const { applyHeatmapMixin } = HeatmapMixin;

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
  this._baseUrl = wemb.configManager.assetApiUrl.replace(/^https?:\/\//, '');
  this._locale = 'ko';
  this._popupTemplateId = 'popup-crac';

  // ======================
  // 2. 변환 함수 바인딩
  // ======================
  this.statusTypeToLabel = statusTypeToLabel.bind(this);
  this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this);
  this.formatDate = formatDate.bind(this);
  this.formatTimestamp = formatTimestamp.bind(this);

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

    // API 엔드포인트 및 파라미터
    api: {
      trendHistory: '/api/v1/mhs/l',
      trendParams: {
        interval: '1h',
        timeRange: 24 * 60 * 60 * 1000,
        metricCodes: ['CRAC.RETURN_TEMP', 'CRAC.RETURN_HUMIDITY'],
        statsKeys: [],
        timeField: 'time',
      },
      statsKeyMap: {
        'CRAC.RETURN_TEMP': 'avg',
        'CRAC.RETURN_HUMIDITY': 'avg',
      },
    },

    // 상태 코드별 레이블/속성 매핑
    statusMap: {
      ACTIVE: { label: '정상운영', dataAttr: 'normal' },
      WARNING: { label: '주의', dataAttr: 'warning' },
      CRITICAL: { label: '위험', dataAttr: 'critical' },
      INACTIVE: { label: '비활성', dataAttr: 'inactive' },
      MAINTENANCE: { label: '유지보수', dataAttr: 'maintenance' },
      DEFAULT: { label: '알 수 없음', dataAttr: 'normal' },
    },

    // ========================
    // UI 영역별 설정
    // ========================

    // 팝업 헤더 영역
    header: {
      fields: [
        { key: 'name', selector: '.crac-name' },
        { key: 'locationLabel', selector: '.crac-zone' },
        { key: 'statusType', selector: '.crac-status', transform: this.statusTypeToLabel },
        { key: 'statusType', selector: '.crac-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
      ],
    },

    // 기본정보 테이블 영역
    infoTable: {
      fields: [
        { key: 'name', selector: '.info-name' },
        { key: 'assetType', selector: '.info-type' },
        { key: 'assetModelName', selector: '.info-model', fallback: '-' },
        { key: 'usageCode', selector: '.info-usage', fallback: '-' },
        { key: 'locationLabel', selector: '.info-location' },
        { key: 'statusType', selector: '.info-status', transform: this.statusTypeToLabel },
        { key: 'installDate', selector: '.info-install-date', transform: this.formatDate },
      ],
      chain: {
        vendor: '.info-vendor',
      },
    },

    // 상태정보 카드 영역 (온습도 현재값/설정값)
    statusCards: {
      metrics: {
        currentTemp:  { metricCode: 'CRAC.RETURN_TEMP',     label: '현재온도', unit: '°C', scale: 1.0 },
        setTemp:      { metricCode: 'CRAC.TEMP_SET',        label: '설정온도', unit: '°C', scale: 1.0 },
        currentHumid: { metricCode: 'CRAC.RETURN_HUMIDITY', label: '현재습도', unit: '%',  scale: 1.0 },
        setHumid:     { metricCode: 'CRAC.HUMIDITY_SET',    label: '설정습도', unit: '%',  scale: 1.0 },
      },
      selectors: {
        card: '.status-card',
        label: '.status-card-label',
        unit: '.status-card-unit',
        value: '.status-card-value',
        timestamp: '.section-timestamp',
      },
    },

    // 상태 인디케이터 영역 (6개 BOOL dot)
    indicators: {
      metrics: {
        'CRAC.FAN_STATUS':        { label: '팬상태',       isLeak: false },
        'CRAC.COOL_STATUS':       { label: '냉방동작상태', isLeak: false },
        'CRAC.HEAT_STATUS':       { label: '난방동작상태', isLeak: false },
        'CRAC.HUMIDIFY_STATUS':   { label: '가습상태',     isLeak: false },
        'CRAC.DEHUMIDIFY_STATUS': { label: '제습상태',     isLeak: false },
        'CRAC.LEAK_STATUS':       { label: '누수상태',     isLeak: true },
      },
      selectors: {
        indicator: '.indicator',
        dot: '.indicator-dot',
      },
    },

    // 트렌드 차트 영역 (바+라인 복합)
    chart: {
      series: {
        temp:     { metricCode: 'CRAC.RETURN_TEMP',     label: '온도', unit: '°C',  color: '#3b82f6', scale: 1.0 },
        humidity: { metricCode: 'CRAC.RETURN_HUMIDITY', label: '습도', unit: '%',   color: '#22c55e', scale: 1.0 },
      },
      selectors: {
        container: '.chart-container',
      },
    },
  };

  // ======================
  // 4. 데이터셋 정의
  // ======================
  const { datasetNames, api } = this.config;
  const baseParam = { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey, locale: this._locale };

  this.datasetInfo = [
    { datasetName: datasetNames.assetDetail, param: { ...baseParam }, render: ['renderBasicInfo'], refreshInterval: 0 },
    { datasetName: datasetNames.metricLatest, param: { ...baseParam }, render: ['renderStatusCards', 'renderIndicators'], refreshInterval: 5000 },
    { datasetName: datasetNames.metricHistory, param: { ...baseParam, ...api.trendParams, apiEndpoint: api.trendHistory }, render: ['renderTrendChart'], refreshInterval: 5000 },
  ];

  // ======================
  // 5. 렌더링 함수 바인딩
  // ======================
  this.renderBasicInfo = renderBasicInfo.bind(this);
  this.renderStatusCards = renderStatusCards.bind(this);
  this.renderIndicators = renderIndicators.bind(this);
  this.renderTrendChart = renderTrendChart.bind(this);
  this.renderInitialLabels = renderInitialLabels.bind(this);

  // ======================
  // 6. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this.stopRefresh = stopRefresh.bind(this);

  // Runtime Parameter Update API
  this.updateTrendParams = updateTrendParams.bind(this);
  this.updateCracSeriesMetric = updateCracSeriesMetric.bind(this);
  this.updateGlobalParams = updateGlobalParams.bind(this);
  this.updateRefreshInterval = updateRefreshInterval.bind(this);

  // Category E: 현황카드 API
  this.updateCracStatusMetric = updateCracStatusMetric.bind(this);
  this.addCracStatusMetric = addCracStatusMetric.bind(this);
  this.removeCracStatusMetric = removeCracStatusMetric.bind(this);

  // ======================
  // 7. 3D 이벤트 바인딩
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
        '.heatmap-btn': () => this.toggleHeatmap(),
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

  // 3D Heatmap Surface Mixin
  applyHeatmapMixin(this, {
    surfaceSize: { width: 20, depth: 20 },
    temperatureMetrics: ['SENSOR.TEMP', 'CRAC.RETURN_TEMP'],
  });

  // destroyPopup 체인 확장 - interval 정리
  const _origDestroyPopup = this.destroyPopup;
  const _ctx = this;
  this.destroyPopup = function() {
    _ctx.stopRefresh();
    _origDestroyPopup.call(_ctx);
  };

  console.log('[CRAC] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();

  // 모든 datasetInfo를 fetchData로 호출
  fx.go(
    this.datasetInfo,
    fx.each(d => fetchDatasetAndRender.call(this, d))
  );

  // refreshInterval > 0인 데이터셋에 대해 주기적 갱신 시작
  this.stopRefresh();
  fx.go(
    this.datasetInfo,
    fx.filter(d => d.refreshInterval > 0),
    fx.each(d => {
      d._intervalId = setInterval(() => fetchDatasetAndRender.call(this, d), d.refreshInterval);
    })
  );
}

function hideDetail() {
  this.stopRefresh();
  this.hidePopup();
}

function stopRefresh() {
  const datasetInfo = this.datasetInfo ?? [];
  fx.go(
    datasetInfo,
    fx.filter(d => d._intervalId),
    fx.each(d => {
      clearInterval(d._intervalId);
      d._intervalId = null;
    })
  );
}

// ======================
// DATASET FETCH HELPER
// ======================

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s;
}

function fetchDatasetAndRender(d) {
  const { datasetNames } = this.config;
  const { datasetName, param, render } = d;

  // metricHistory는 매번 timeFrom/timeTo 갱신
  if (datasetName === datasetNames.metricHistory) {
    const now = new Date();
    const from = new Date(now.getTime() - param.timeRange);
    param.timeFrom = formatLocalDate(from);
    param.timeTo = formatLocalDate(now);
  }

  fetchData(this.page, datasetName, param)
    .then(response => {
      const data = extractData(response);
      if (!data) return;
      fx.each(fn => this[fn](response), render);
    })
    .catch(e => console.warn(`[CRAC] ${datasetName} fetch failed:`, e));
}

// ======================
// RENDER: 기본정보 테이블
// ======================

function renderBasicInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    console.warn('[CRAC] renderBasicInfo: no asset data');
    return;
  }

  const asset = data.asset;
  const { header, infoTable } = this.config;

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
  fetchModelVendorChain(this, asset, infoTable.chain);

  // properties 동적 렌더링 (기본정보 테이블에 행 추가)
  renderPropertiesRows(this, data.properties);
}

function renderPropertiesRows(ctx, properties) {
  if (!properties || properties.length === 0) return;

  const tbody = ctx.popupQuery('.info-table tbody');
  if (!tbody) return;

  tbody.querySelectorAll('tr[data-property]').forEach(tr => tr.remove());

  [...properties]
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .forEach(({ fieldKey, label, value, helpText }) => {
      const tr = document.createElement('tr');
      tr.dataset.property = fieldKey;
      if (helpText) tr.title = helpText;
      tr.innerHTML = `<th>${label}</th><td>${value ?? '-'}</td>`;
      tbody.appendChild(tr);
    });
}

function renderField(ctx, data, field) {
  const el = ctx.popupQuery(field.selector);
  if (!el) return;
  let value = data[field.key] ?? field.fallback ?? '-';
  if (field.transform) value = field.transform(value);
  if (field.dataAttr) {
    el.dataset[field.dataAttr] = value;
  } else {
    el.textContent = value;
  }
}

function fetchModelVendorChain(ctx, asset, chainConfig) {
  const { datasetNames } = ctx.config;
  const setCell = (selector, value) => {
    const el = ctx.popupQuery(selector);
    if (el) el.textContent = value ?? '-';
  };

  if (!asset.assetModelKey) return;

  fx.go(
    fetchData(ctx.page, datasetNames.modelDetail, { baseUrl: ctx._baseUrl, assetModelKey: asset.assetModelKey }),
    (modelResp) => {
      const model = extractData(modelResp, 'data');
      if (!model) return;
      setCell(chainConfig.model, model.name);

      if (model.assetVendorKey) {
        fx.go(
          fetchData(ctx.page, datasetNames.vendorDetail, { baseUrl: ctx._baseUrl, assetVendorKey: model.assetVendorKey }),
          (vendorResp) => {
            const vendor = extractData(vendorResp, 'data');
            if (vendor) setCell(chainConfig.vendor, vendor.name);
          }
        ).catch(() => {});
      }
    }
  ).catch(() => {});
}

// ======================
// RENDER: 상태정보 카드 (온습도 현재값/설정값)
// ======================

function renderStatusCards({ response }) {
  const { data } = response;
  const { statusCards } = this.config;
  const { metrics, selectors } = statusCards;

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[CRAC] renderStatusCards: no data');
    return;
  }

  // 타임스탬프 표시
  const timestampEl = this.popupQuery(selectors.timestamp);
  if (timestampEl && data[0]?.eventedAt) {
    timestampEl.textContent = this.formatTimestamp(data[0].eventedAt);
  }

  // 메트릭 코드 → 값 매핑
  const metricMap = fx.reduce(
    (acc, m) => (acc[m.metricCode] = m, acc),
    {},
    data
  );

  // 각 카드에 값 설정 (data-metric 키 기반)
  fx.go(
    Object.entries(metrics),
    fx.each(([key, cfg]) => {
      const card = this.popupQuery(`${selectors.card}[data-metric="${key}"]`);
      if (!card) return;

      const valueEl = card.querySelector(selectors.value);
      if (!valueEl) return;

      const metric = metricMap[cfg.metricCode];
      if (!metric) {
        valueEl.textContent = '-';
        return;
      }

      const value = metric.valueNumber;
      valueEl.textContent = cfg.scale ? (value * cfg.scale).toFixed(1) : value;
    })
  );
}

// ======================
// RENDER: 상태 인디케이터 (6개 BOOL dot)
// ======================

function renderIndicators({ response }) {
  const { data } = response;
  if (!data || !Array.isArray(data)) return;

  const { indicators } = this.config;
  const { metrics, selectors } = indicators;

  // 메트릭 코드 → 값 매핑
  const metricMap = fx.reduce(
    (acc, m) => (acc[m.metricCode] = m, acc),
    {},
    data
  );

  const indicatorEls = this.popupQueryAll(selectors.indicator);
  if (!indicatorEls) return;

  fx.go(
    Array.from(indicatorEls),
    fx.each(el => {
      const code = el.dataset.metric;
      const dot = el.querySelector(selectors.dot);
      if (!dot || !code) return;

      const metric = metricMap[code];
      if (!metric) {
        dot.dataset.state = 'unknown';
        return;
      }

      // 누수(LEAK)는 true=에러, 나머지는 true=정상
      const cfg = metrics[code];
      const isLeak = cfg?.isLeak ?? false;
      const isOn = metric.valueBool;

      if (isLeak) {
        dot.dataset.state = isOn ? 'error' : 'ok';
      } else {
        dot.dataset.state = isOn ? 'on' : 'off';
      }
    })
  );
}

// ======================
// RENDER: 트렌드 차트 (bar: 온도, line: 습도)
// ======================

function renderTrendChart({ response }) {
  const { data } = response;
  const { chart } = this.config;
  const { series, selectors } = chart;
  const tempConfig = series.temp;
  const humidConfig = series.humidity;

  // 단일 시리즈 렌더링 (데이터 없어도 빈 차트 표시)
  const safeData = Array.isArray(data) ? data : [];
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find((d) => d.datasetName === datasetNames.metricHistory);
  const { timeField } = trendInfo?.param || {};
  const timeKey = timeField || 'time';

  // 차트에 표시할 metricCode로 필터링
  const chartMetricCodes = [tempConfig.metricCode, humidConfig.metricCode];
  const chartData = safeData.filter(row => chartMetricCodes.includes(row.metricCode));

  // 필터링된 데이터를 시간별로 그룹핑
  const timeMap = fx.reduce(
    (acc, row) => {
      const time = row[timeKey];
      if (!acc[time]) acc[time] = {};
      const statsKey = this.config.api.statsKeyMap[row.metricCode];
      acc[time][row.metricCode] = statsKey ? (row.statsBody?.[statsKey] ?? null) : null;
      return acc;
    },
    {},
    chartData
  );

  const times = Object.keys(timeMap);

  const extractValues = (code, scale) => fx.map(t => {
    const raw = timeMap[t]?.[code];
    return raw != null ? +(raw * scale).toFixed(1) : null;
  }, times);

  const tempData = extractValues(tempConfig.metricCode, tempConfig.scale);
  const humidityData = extractValues(humidConfig.metricCode, humidConfig.scale);

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.95)',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    legend: {
      data: [tempConfig.label, humidConfig.label],
      top: 8,
      textStyle: { color: '#8892a0', fontSize: 11 },
    },
    grid: { left: 50, right: 50, top: 40, bottom: 24 },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        name: tempConfig.unit,
        position: 'left',
        axisLine: { show: true, lineStyle: { color: tempConfig.color } },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: '#333' } },
      },
      {
        type: 'value',
        name: humidConfig.unit,
        position: 'right',
        axisLine: { show: true, lineStyle: { color: humidConfig.color } },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: tempConfig.label,
        type: 'bar',
        yAxisIndex: 0,
        data: tempData,
        barWidth: '40%',
        itemStyle: { color: hexToRgba(tempConfig.color, 0.7), borderRadius: [2, 2, 0, 0] },
      },
      {
        name: humidConfig.label,
        type: 'line',
        yAxisIndex: 1,
        data: humidityData,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: humidConfig.color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(humidConfig.color, 0.2) },
              { offset: 1, color: hexToRgba(humidConfig.color, 0) },
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
  const { statusMap } = this.config;
  const entry = statusMap[statusType] || statusMap.DEFAULT;
  return entry.label;
}

function statusTypeToDataAttr(statusType) {
  const { statusMap } = this.config;
  const entry = statusMap[statusType] || statusMap.DEFAULT;
  return entry.dataAttr;
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
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
  this.renderInitialLabels();
}

function renderInitialLabels() {
  const { statusCards, indicators } = this.config;

  // ── 상태카드 reconciliation ──
  const { metrics, selectors } = statusCards;
  const container = this.popupQuery('.status-cards');

  // 1. config에 있지만 DOM에 없는 카드 → 생성
  fx.go(
    Object.entries(metrics),
    fx.each(([key, cfg]) => {
      let card = this.popupQuery(`${selectors.card}[data-metric="${key}"]`);
      if (!card && container) {
        card = createCracCardElement(key);
        container.appendChild(card);
      }
      if (!card) return;
      const labelEl = card.querySelector(selectors.label);
      const unitEl = card.querySelector(selectors.unit);
      if (labelEl) labelEl.textContent = cfg.label;
      if (unitEl) unitEl.textContent = cfg.unit;
    })
  );

  // 2. DOM에 있지만 config에 없는 카드 → 제거
  if (container) {
    container.querySelectorAll(selectors.card).forEach(card => {
      if (!metrics[card.dataset.metric]) card.remove();
    });
  }

  // ── 인디케이터 라벨 ──
  fx.go(
    Object.entries(indicators.metrics),
    fx.each(([code, cfg]) => {
      const indicator = this.popupQuery(`${indicators.selectors.indicator}[data-metric="${code}"]`);
      if (!indicator) return;
      const labelEl = indicator.querySelector('.indicator-label');
      if (labelEl) labelEl.textContent = cfg.label;
    })
  );
}

// ======================================
// RUNTIME PARAMETER UPDATE API
// ======================================

function updateTrendParams(options) {
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const { timeRange, interval, apiEndpoint, timeField } = options;
  if (timeRange !== undefined)   trendInfo.param.timeRange = timeRange;
  if (interval !== undefined)    trendInfo.param.interval = interval;
  if (apiEndpoint !== undefined) trendInfo.param.apiEndpoint = apiEndpoint;
  if (timeField !== undefined)   trendInfo.param.timeField = timeField;
}

function updateCracSeriesMetric(seriesName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const seriesConfig = chart.series[seriesName];
  if (!seriesConfig) return;

  const { metricCode, statsKey, scale, label } = options;

  // metricCode 변경 시 statsKey 필수 검증
  if (metricCode !== undefined && statsKey === undefined) {
    console.warn(`[updateCracSeriesMetric] metricCode 변경 시 statsKey 필수 (series: ${seriesName})`);
    return;
  }

  // chart.series 업데이트 + statsKeyMap 업데이트
  if (metricCode !== undefined) {
    seriesConfig.metricCode = metricCode;
    this.config.api.statsKeyMap[metricCode] = statsKey;
  }

  // UI 필드 업데이트
  if (scale !== undefined) seriesConfig.scale = scale;
  if (label !== undefined) seriesConfig.label = label;

  // param.metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);
}

function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { series } = this.config.chart;
  Object.values(series).forEach(s => {
    if (s.metricCode && !codes.includes(s.metricCode)) codes.push(s.metricCode);
  });
}

function updateGlobalParams(options) {
  const { assetKey, baseUrl, locale } = options;

  if (assetKey !== undefined) this._defaultAssetKey = assetKey;
  if (baseUrl !== undefined)  this._baseUrl = baseUrl;
  if (locale !== undefined)   this._locale = locale;

  this.datasetInfo.forEach(d => {
    if (assetKey !== undefined) d.param.assetKey = assetKey;
    if (baseUrl !== undefined)  d.param.baseUrl = baseUrl;
    if (locale !== undefined)   d.param.locale = locale;
  });
}

function updateRefreshInterval(datasetName, interval) {
  const target = this.datasetInfo.find(d => d.datasetName === datasetName);
  if (!target) return;
  target.refreshInterval = interval;
}

// ======================================
// CATEGORY E: 현황카드 API
// ======================================

function updateCracStatusMetric(key, options) {
  const metric = this.config.statusCards.metrics[key];
  if (!metric) {
    console.warn(`[updateCracStatusMetric] 존재하지 않는 키: ${key}`);
    return;
  }

  const { metricCode, label, unit, scale } = options;
  if (metricCode !== undefined) metric.metricCode = metricCode;
  if (label !== undefined)      metric.label = label;
  if (unit !== undefined)       metric.unit = unit;
  if (scale !== undefined)      metric.scale = scale;
}

function addCracStatusMetric(key, options) {
  const { metrics } = this.config.statusCards;
  if (metrics[key]) {
    console.warn(`[addCracStatusMetric] 이미 존재하는 키: ${key}`);
    return;
  }

  const { label, unit, metricCode = null, scale = 0.1 } = options;
  if (!label || !unit) {
    console.warn(`[addCracStatusMetric] label과 unit은 필수`);
    return;
  }

  metrics[key] = { metricCode, label, unit, scale };
}

function removeCracStatusMetric(key) {
  const { metrics } = this.config.statusCards;
  if (!metrics[key]) {
    console.warn(`[removeCracStatusMetric] 존재하지 않는 키: ${key}`);
    return;
  }

  delete metrics[key];
}

function createCracCardElement(key) {
  const card = document.createElement('div');
  card.className = 'status-card';
  card.dataset.metric = key;
  card.innerHTML = `
    <div class="status-card-label"></div>
    <div class="status-card-values">
      <span class="status-card-value">-</span>
      <span class="status-card-unit"></span>
    </div>
  `;
  return card;
}
