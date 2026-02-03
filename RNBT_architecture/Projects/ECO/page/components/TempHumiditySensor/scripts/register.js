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

const BASE_URL = '10.23.128.125:4004';

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
// STATUS CONFIG (실시간 측정값 카드)
// ======================
const STATUS_CONFIG = {
  temperature: {
    metricCode: 'SENSOR.TEMP',
    label: '온도',
    unit: '°C',
    color: '#3b82f6',
    scale: 1.0,
    targetValue: null,  // 적정값 API 미확인 → "-" 표시
  },
  humidity: {
    metricCode: 'SENSOR.HUMIDITY',
    label: '습도',
    unit: '%',
    color: '#22c55e',
    scale: 1.0,
    targetValue: null,
  },
};

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. 데이터 정의
  // ======================
  this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;
  this._baseUrl = BASE_URL;

  this.datasetInfo = [
    { datasetName: 'assetDetailUnified', param: { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey, locale: 'ko' }, render: ['renderBasicInfo'] },
    { datasetName: 'metricLatest', param: { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey }, render: ['renderStatusCards'] },
    {
      datasetName: 'metricHistoryStats',
      param: {
        baseUrl: this._baseUrl,
        assetKey: this._defaultAssetKey,
        interval: '1h',
        timeRange: 24 * 60 * 60 * 1000, // 24시간 (ms)
        metricCodes: ['SENSOR.TEMP', 'SENSOR.HUMIDITY'],
        statsKeys: ['avg'],
      },
      render: ['renderTrendChart'],
    },
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
  this.baseInfoConfig = [
    { key: 'name', selector: '.sensor-name' },
    { key: 'locationLabel', selector: '.sensor-zone' },
    { key: 'statusType', selector: '.sensor-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.sensor-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  // ======================
  // 4. 렌더링 함수 바인딩
  // ======================
  this.renderBasicInfo = renderBasicInfo.bind(this);
  this.renderStatusCards = renderStatusCards.bind(this);
  this.renderTrendChart = renderTrendChart.bind(this);
  this.renderError = renderError.bind(this);

  // ======================
  // 5. Refresh Config (5초 갱신)
  // ======================
  this.refreshInterval = 5000;
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

  // 1) assetDetailUnified + metricLatest 호출
  fx.go(
    this.datasetInfo,
    fx.each(({ datasetName, param, render }) =>
      fx.go(
        fetchData(this.page, datasetName, param),
        (response) => {
          if (!response || !response.response) {
            this.renderError('데이터를 불러올 수 없습니다.');
            return;
          }
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

  // 2) 트렌드 차트 호출 (mhs/l)
  fetchTrendData.call(this);

  // 3) 5초 주기로 메트릭 갱신 시작
  this.stopRefresh();
  this._refreshIntervalId = setInterval(() => this.refreshMetrics(), this.refreshInterval);
  console.log('[TempHumiditySensor] Metric refresh started (5s interval)');
}

function hideDetail() {
  this.stopRefresh();
  this.hidePopup();
}

function refreshMetrics() {
  const metricInfo = this.datasetInfo.find(d => d.datasetName === 'metricLatest');
  fx.go(
    fetchData(this.page, 'metricLatest', metricInfo.param),
    (response) => {
      if (!response || !response.response) return;
      const data = response.response.data;
      if (data === null || data === undefined) return;
      this.renderStatusCards(response);
    }
  ).catch((e) => {
    console.warn('[TempHumiditySensor] Metric refresh failed:', e);
  });
}

function stopRefresh() {
  if (this._refreshIntervalId) {
    clearInterval(this._refreshIntervalId);
    this._refreshIntervalId = null;
    console.log('[TempHumiditySensor] Metric refresh stopped');
  }
}

// ======================
// TREND DATA FETCH
// ======================

function fetchTrendData() {
  const trendInfo = this.datasetInfo.find(d => d.datasetName === 'metricHistoryStats');
  if (!trendInfo) return;

  const { interval, timeRange, metricCodes, statsKeys } = trendInfo.param;
  const now = new Date();
  const from = new Date(now.getTime() - timeRange);

  fx.go(
    fetchData(this.page, 'metricHistoryStats', {
      baseUrl: this._baseUrl,
      assetKey: this._defaultAssetKey,
      interval,
      metricCodes,
      timeFrom: from.toISOString().replace('T', ' ').slice(0, 19),
      timeTo: now.toISOString().replace('T', ' ').slice(0, 19),
      statsKeys,
    }),
    (response) => {
      if (!response || !response.response) {
        console.warn('[TempHumiditySensor] Trend data unavailable');
        return;
      }
      this.renderTrendChart(response);
    }
  ).catch((e) => {
    console.warn('[TempHumiditySensor] Trend fetch failed:', e);
  });
}

// ======================
// RENDER: 기본정보 테이블
// ======================

function renderBasicInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    renderError.call(this, '자산 데이터가 없습니다.');
    return;
  }

  const asset = data.asset;

  // Header 영역
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

  // 기본정보 테이블
  const setCell = (selector, value) => {
    const el = this.popupQuery(selector);
    if (el) el.textContent = value ?? '-';
  };

  setCell('.info-name', asset.name);
  setCell('.info-type', asset.assetType);
  setCell('.info-usage', asset.usageLabel || '-');
  setCell('.info-location', asset.locationLabel);
  setCell('.info-status', this.statusTypeToLabel(asset.statusType));
  setCell('.info-install-date', this.formatDate(asset.installDate));

  // 제조사명/모델 체이닝: assetModelKey → mdl/g → vdr/g
  if (asset.assetModelKey) {
    fx.go(
      fetchData(this.page, 'modelDetail', { baseUrl: this._baseUrl, assetModelKey: asset.assetModelKey }),
      (modelResp) => {
        if (!modelResp?.response?.data) return;
        const model = modelResp.response.data;
        setCell('.info-model', model.name);

        if (model.assetVendorKey) {
          fx.go(
            fetchData(this.page, 'vendorDetail', { baseUrl: this._baseUrl, assetVendorKey: model.assetVendorKey }),
            (vendorResp) => {
              if (!vendorResp?.response?.data) return;
              setCell('.info-vendor', vendorResp.response.data.name);
            }
          ).catch(() => {});
        }
      }
    ).catch(() => {});
  }
}

// ======================
// RENDER: 실시간 측정값 (2카드)
// ======================

function renderStatusCards({ response }) {
  const { data } = response;
  const timestampEl = this.popupQuery('.section-timestamp');

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[TempHumiditySensor] renderStatusCards: no data');
    return;
  }

  // 타임스탬프 표시
  if (timestampEl && data[0]?.eventedAt) {
    timestampEl.textContent = this.formatTimestamp(data[0].eventedAt);
  }

  // 메트릭 코드를 값으로 매핑
  const metricMap = {};
  data.forEach((metric) => {
    const value = metric.valueType === 'NUMBER' ? metric.valueNumber : metric.valueString;
    metricMap[metric.metricCode] = value;
  });

  // 각 카드에 값 설정
  Object.entries(STATUS_CONFIG).forEach(([key, config]) => {
    const card = this.popupQuery(`.status-card[data-metric="${key}"]`);
    if (!card) return;

    const currentValueEl = card.querySelector('.status-current-value');
    const targetValueEl = card.querySelector('.status-target-value');

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
  });
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

  // 데이터를 시간별로 그룹핑
  const timeMap = {};
  data.forEach((row) => {
    const hour = new Date(row.time).getHours() + '시';
    if (!timeMap[hour]) timeMap[hour] = {};
    timeMap[hour][row.metricCode] = row.statsBody?.avg ?? null;
  });

  const hours = Object.keys(timeMap);
  const tempConfig = STATUS_CONFIG.temperature;
  const humidConfig = STATUS_CONFIG.humidity;

  const tempValues = hours.map((h) => {
    const raw = timeMap[h][tempConfig.metricCode];
    return raw != null ? +(raw * tempConfig.scale).toFixed(1) : null;
  });

  const humidValues = hours.map((h) => {
    const raw = timeMap[h][humidConfig.metricCode];
    return raw != null ? +(raw * humidConfig.scale).toFixed(1) : null;
  });

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

  this.updateChart('.chart-container', option);
}

// ======================
// RENDER: 에러
// ======================

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

  console.warn('[TempHumiditySensor] renderError:', message);
}

// ======================
// TRANSFORM FUNCTIONS
// ======================

function statusTypeToLabel(statusType) {
  const labels = {
    ACTIVE: '정상운영',
    WARNING: '주의',
    CRITICAL: '위험',
    INACTIVE: '비활성',
    MAINTENANCE: '유지보수',
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
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
}
