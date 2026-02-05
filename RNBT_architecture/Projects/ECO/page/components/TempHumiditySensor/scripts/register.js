/**
 * TempHumiditySensor (온습도센서) - 3D Popup Component
 *
 * 온습도센서 컴포넌트 (기획서 v.0.8_260128 기준)
 * - 기본정보 테이블 (assetDetailUnified + mdl/g + vdr/g 체이닝)
 * - 실시간 측정값 2카드 (metricLatest, 5초 갱신)
 * - 온/습도 현황 트렌드 차트 (온도=바, 습도=라인)
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
  this._baseUrl = '10.23.128.125:4004';
  this._locale = 'ko';
  this._popupTemplateId = 'popup-sensor';
  this._metricRefreshIntervalId = null;

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
    // 상태 코드별 레이블/속성 매핑
    statusMap: {
      ACTIVE: { label: '정상운영', dataAttr: 'normal' },
      WARNING: { label: '주의', dataAttr: 'warning' },
      CRITICAL: { label: '위험', dataAttr: 'critical' },
      INACTIVE: { label: '비활성', dataAttr: 'inactive' },
      MAINTENANCE: { label: '유지보수', dataAttr: 'maintenance' },
      DEFAULT: { label: '알 수 없음', dataAttr: 'normal' },
    },

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
        metricCodes: ['SENSOR.TEMP', 'SENSOR.HUMIDITY'],
        statsKeys: ['avg'],
      },
    },

    // 갱신 주기
    refresh: {
      interval: 5000,
    },

    // ========================
    // UI 영역별 설정
    // ========================

    // 팝업 헤더 영역
    header: {
      fields: [
        { key: 'name', selector: '.sensor-name' },
        { key: 'locationLabel', selector: '.sensor-zone' },
        { key: 'statusType', selector: '.sensor-status', transform: this.statusTypeToLabel },
        { key: 'statusType', selector: '.sensor-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
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

    // 상태 카드 영역 (온습도 측정값)
    statusCards: {
      metrics: {
        temperature: {
          metricCode: 'SENSOR.TEMP',
          label: '온도',
          unit: '°C',
          color: '#3b82f6',
          scale: 1.0,
          targetValue: null,
        },
        humidity: {
          metricCode: 'SENSOR.HUMIDITY',
          label: '습도',
          unit: '%',
          color: '#22c55e',
          scale: 1.0,
          targetValue: null,
        },
      },
      selectors: {
        card: '.status-card',
        currentValue: '.status-current-value',
        targetValue: '.status-target-value',
        timestamp: '.section-timestamp',
      },
    },

    // 트렌드 차트 영역 (바+라인 복합)
    chart: {
      series: {
        temp:     { metricCode: 'SENSOR.TEMP',     label: '온도', unit: '°C', color: '#3b82f6', scale: 1.0 },
        humidity: { metricCode: 'SENSOR.HUMIDITY', label: '습도', unit: '%',  color: '#22c55e', scale: 1.0 },
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
    { datasetName: datasetNames.assetDetail, param: { ...baseParam }, render: ['renderBasicInfo'] },
    { datasetName: datasetNames.metricLatest, param: { ...baseParam }, render: ['renderStatusCards'] },
    { datasetName: datasetNames.metricHistory, param: { ...baseParam, ...api.trendParams }, render: ['renderTrendChart'] },
  ];

  // ======================
  // 5. 렌더링 함수 바인딩
  // ======================
  this.renderBasicInfo = renderBasicInfo.bind(this);
  this.renderStatusCards = renderStatusCards.bind(this);
  this.renderTrendChart = renderTrendChart.bind(this);
  this.renderInitialLabels = renderInitialLabels.bind(this);

  // ======================
  // 6. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this.refreshMetrics = refreshMetrics.bind(this);
  this.stopRefresh = stopRefresh.bind(this);

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

  console.log('[TempHumiditySensor] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();

  const { datasetNames, refresh } = this.config;

  // 1) assetDetailUnified + metricLatest 호출 (섹션별 독립 처리)
  // metricHistoryStats는 fetchTrendData에서 fetch API로 직접 호출하므로 제외
  fx.go(
    this.datasetInfo,
    fx.filter((d) => d.datasetName !== datasetNames.metricHistory),
    fx.each(({ datasetName, param, render }) =>
      fx.go(
        fetchData(this.page, datasetName, param),
        (response) => {
          const data = extractData(response, 'data');
          if (data === null) {
            console.warn(`[TempHumiditySensor] ${datasetName} - no data`);
            return;
          }
          fx.each((fn) => this[fn](response), render);
        }
      )
    )
  ).catch((e) => {
    console.error('[TempHumiditySensor] Data load error:', e);
  });

  // 2) 트렌드 차트 호출 (mhs/l)
  fetchTrendData.call(this);

  // 3) 5초 주기로 메트릭 갱신 시작
  this.stopRefresh();
  this._metricRefreshIntervalId = setInterval(() => this.refreshMetrics(), refresh.interval);
  console.log('[TempHumiditySensor] Metric refresh started (5s interval)');
}

function hideDetail() {
  this.stopRefresh();
  this.hidePopup();
}

function refreshMetrics() {
  const { datasetNames } = this.config;
  const metricInfo = fx.go(
    this.datasetInfo,
    fx.filter((d) => d.datasetName === datasetNames.metricLatest),
    (arr) => arr[0]
  );
  if (!metricInfo) return;

  fx.go(
    fetchData(this.page, datasetNames.metricLatest, metricInfo.param),
    (response) => {
      const data = extractData(response, 'data');
      if (data === null) return;
      this.renderStatusCards(response);
    }
  ).catch((e) => {
    console.warn('[TempHumiditySensor] Metric refresh failed:', e);
  });
}

function stopRefresh() {
  if (this._metricRefreshIntervalId) {
    clearInterval(this._metricRefreshIntervalId);
    this._metricRefreshIntervalId = null;
    console.log('[TempHumiditySensor] Metric refresh stopped');
  }
}

// ======================
// TREND DATA FETCH
// ======================

function fetchTrendData() {
  const { datasetNames, api } = this.config;
  const trendInfo = fx.go(
    this.datasetInfo,
    fx.filter((d) => d.datasetName === datasetNames.metricHistory),
    (arr) => arr[0]
  );
  if (!trendInfo) return;

  const { baseUrl, assetKey, interval, timeRange, metricCodes, statsKeys } = trendInfo.param;
  const now = new Date();
  const from = new Date(now.getTime() - timeRange);

  fetch(`http://${baseUrl}${api.trendHistory}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: {
        assetKey,
        interval,
        metricCodes,
        timeFrom: from.toISOString().replace('T', ' ').slice(0, 19),
        timeTo: now.toISOString().replace('T', ' ').slice(0, 19),
      },
      statsKeys,
      sort: [],
    }),
  })
    .then((resp) => resp.json())
    .then((result) => {
      if (!result || !result.success) {
        console.warn('[TempHumiditySensor] Trend data unavailable');
        return;
      }
      this.renderTrendChart({ response: { data: result.data } });
    })
    .catch((e) => {
      console.warn('[TempHumiditySensor] Trend fetch failed:', e);
    });
}

// ======================
// RENDER HELPERS
// ======================

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
// RENDER: 기본정보 테이블
// ======================

function renderBasicInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    console.warn('[TempHumiditySensor] renderBasicInfo: 자산 데이터가 없습니다.');
    return;
  }

  const asset = data.asset;
  const { header, infoTable } = this.config;

  // Header 영역
  fx.go(
    header.fields,
    fx.each((field) => renderField(this, asset, field))
  );

  // 기본정보 테이블
  fx.go(
    infoTable.fields,
    fx.each((field) => renderField(this, asset, field))
  );

  // 제조사명/모델 체이닝
  fetchModelVendorChain(this, asset, infoTable.chain);
}

// ======================
// RENDER: 실시간 측정값 (2카드)
// ======================

function renderStatusCards({ response }) {
  const { data } = response;
  const { statusCards } = this.config;
  const { metrics, selectors } = statusCards;
  const timestampEl = this.popupQuery(selectors.timestamp);

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[TempHumiditySensor] renderStatusCards: no data');
    return;
  }

  // 타임스탬프 표시
  if (timestampEl && data[0]?.eventedAt) {
    timestampEl.textContent = this.formatTimestamp(data[0].eventedAt);
  }

  // 메트릭 코드를 값으로 매핑
  const metricMap = fx.reduce(
    (acc, metric) => {
      const value = metric.valueType === 'NUMBER' ? metric.valueNumber : metric.valueString;
      acc[metric.metricCode] = value;
      return acc;
    },
    {},
    data
  );

  // 각 카드에 값 설정 (fx.each 사용)
  fx.go(
    Object.entries(metrics),
    fx.each(([key, config]) => {
      const card = this.popupQuery(`${selectors.card}[data-metric="${key}"]`);
      if (!card) return;

      const currentValueEl = card.querySelector(selectors.currentValue);
      const targetValueEl = card.querySelector(selectors.targetValue);

      // 현재값
      const rawValue = metricMap[config.metricCode];
      if (currentValueEl) {
        if (rawValue != null) {
          const displayValue = (rawValue * config.scale).toFixed(1);
          currentValueEl.textContent = displayValue;
        } else {
          currentValueEl.textContent = '-';
        }
      }

      // 적정값 (API 미확인 → "-")
      if (targetValueEl) {
        targetValueEl.textContent = config.targetValue ?? '-';
      }
    })
  );
}

// ======================
// RENDER: 트렌드 차트 (바+라인 복합)
// ======================

function renderTrendChart({ response }) {
  const { data } = response;
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[TempHumiditySensor] renderTrendChart: no data');
    return;
  }

  const { chart } = this.config;
  const { series, selectors } = chart;
  const tempConfig = series.temp;
  const humidConfig = series.humidity;

  // 데이터를 시간별로 그룹핑
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

  const tempValues = fx.go(
    hours,
    fx.map((h) => {
      const raw = timeMap[h][tempConfig.metricCode];
      return raw != null ? +(raw * tempConfig.scale).toFixed(1) : null;
    })
  );

  const humidValues = fx.go(
    hours,
    fx.map((h) => {
      const raw = timeMap[h][humidConfig.metricCode];
      return raw != null ? +(raw * humidConfig.scale).toFixed(1) : null;
    })
  );

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
      data: hours,
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
        data: tempValues,
        itemStyle: { color: hexToRgba(tempConfig.color, 0.7) },
        barWidth: '40%',
      },
      {
        name: humidConfig.label,
        type: 'line',
        yAxisIndex: 1,
        data: humidValues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: humidConfig.color, width: 2 },
        itemStyle: { color: humidConfig.color },
      },
    ],
  };

  this.updateChart(selectors.container, option);
}

// ======================
// RENDER: 초기 레이블
// ======================

function renderInitialLabels() {
  const { statusCards } = this.config;
  fx.go(
    Object.entries(statusCards.metrics),
    fx.each(([key, cfg]) => {
      const card = this.popupQuery(`${statusCards.selectors.card}[data-metric="${key}"]`);
      if (!card) return;
      const labelEl = card.querySelector('.status-card-label');
      if (labelEl) labelEl.textContent = cfg.label;
    })
  );
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
