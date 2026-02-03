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
// METRIC CONFIG (metricConfig.json 인라인)
// ======================
const METRIC_CONFIG = {
  'CRAC.UNIT_STATUS': { label: '가동상태', valueType: 'BOOL', unit: '', scale: 1.0 },
  'CRAC.FAN_STATUS': { label: '팬상태', valueType: 'BOOL', unit: '', scale: 1.0 },
  'CRAC.COOL_STATUS': { label: '냉방동작상태', valueType: 'BOOL', unit: '', scale: 1.0 },
  'CRAC.HEAT_STATUS': { label: '난방동작상태', valueType: 'BOOL', unit: '', scale: 1.0 },
  'CRAC.HUMIDIFY_STATUS': { label: '가습상태', valueType: 'BOOL', unit: '', scale: 1.0 },
  'CRAC.DEHUMIDIFY_STATUS': { label: '제습상태', valueType: 'BOOL', unit: '', scale: 1.0 },
  'CRAC.LEAK_STATUS': { label: '누수상태', valueType: 'BOOL', unit: '', scale: 1.0 },
  'CRAC.RETURN_TEMP': { label: '인입온도', valueType: 'NUMBER', unit: '°C', scale: 0.1 },
  'CRAC.RETURN_HUMIDITY': { label: '인입습도', valueType: 'NUMBER', unit: '%RH', scale: 0.1 },
  'CRAC.TEMP_SET': { label: '온도설정값', valueType: 'NUMBER', unit: '°C', scale: 0.1 },
  'CRAC.HUMIDITY_SET': { label: '습도설정값', valueType: 'NUMBER', unit: '%RH', scale: 0.1 },
  'CRAC.SUPPLY_TEMP': { label: '공급온도', valueType: 'NUMBER', unit: '°C', scale: 0.1 },
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
    { datasetName: 'metricLatest', param: { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey }, render: ['renderStatusCards', 'renderIndicators'] },
    {
      datasetName: 'metricHistoryStats',
      param: {
        baseUrl: this._baseUrl,
        assetKey: this._defaultAssetKey,
        interval: '1h',
        timeRange: 24 * 60 * 60 * 1000, // 24시간 (ms)
        metricCodes: ['CRAC.RETURN_TEMP', 'CRAC.RETURN_HUMIDITY'],
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
    { key: 'name', selector: '.crac-name' },
    { key: 'locationLabel', selector: '.crac-zone' },
    { key: 'statusType', selector: '.crac-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.crac-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  this.timestampSelector = '.section-timestamp';
  this.metricConfig = METRIC_CONFIG;

  // ======================
  // 4. 렌더링 함수 바인딩
  // ======================
  this.renderBasicInfo = renderBasicInfo.bind(this);
  this.renderStatusCards = renderStatusCards.bind(this);
  this.renderIndicators = renderIndicators.bind(this);
  this.renderTrendChart = renderTrendChart.bind(this);
  this.renderError = renderError.bind(this);

  // ======================
  // 5. Refresh Config
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
    popup: 'popup-crac',
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

  console.log('[CRAC] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();

  // 1) assetDetailUnified + metricLatest 병렬 호출
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
    console.error('[CRAC]', e);
    this.renderError('데이터 로드 중 오류가 발생했습니다.');
  });

  // 2) 트렌드 차트 호출 (mhs/l)
  fetchTrendData.call(this);

  // 3) 5초 주기로 메트릭 갱신 시작
  this.stopRefresh();
  this._refreshIntervalId = setInterval(() => this.refreshMetrics(), this.refreshInterval);
  console.log('[CRAC] Metric refresh started (5s interval)');
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
      this.renderIndicators(response);
    }
  ).catch((e) => {
    console.warn('[CRAC] Metric refresh failed:', e);
  });
}

function stopRefresh() {
  if (this._refreshIntervalId) {
    clearInterval(this._refreshIntervalId);
    this._refreshIntervalId = null;
    console.log('[CRAC] Metric refresh stopped');
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
        console.warn('[CRAC] Trend data unavailable');
        return;
      }
      this.renderTrendChart(response);
    }
  ).catch((e) => {
    console.warn('[CRAC] Trend fetch failed:', e);
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
// RENDER: 상태정보 카드 (온습도 현재값/설정값)
// ======================

function renderStatusCards({ response }) {
  const { data } = response;
  const timestampEl = this.popupQuery(this.timestampSelector);

  if (!data || !Array.isArray(data) || data.length === 0) return;

  if (timestampEl && data[0]?.eventedAt) {
    timestampEl.textContent = this.formatTimestamp(data[0].eventedAt);
  }

  const metricMap = {};
  data.forEach((m) => { metricMap[m.metricCode] = m; });

  const setValue = (selector, metricCode) => {
    const el = this.popupQuery(selector);
    if (!el) return;
    const metric = metricMap[metricCode];
    if (!metric) { el.textContent = '-'; return; }
    const config = this.metricConfig[metricCode];
    if (!config) { el.textContent = '-'; return; }
    const value = metric.valueNumber;
    el.textContent = config.scale ? (value * config.scale).toFixed(1) : value;
  };

  setValue('.current-temp', 'CRAC.RETURN_TEMP');
  setValue('.set-temp', 'CRAC.TEMP_SET');
  setValue('.current-humidity', 'CRAC.RETURN_HUMIDITY');
  setValue('.set-humidity', 'CRAC.HUMIDITY_SET');
}

// ======================
// RENDER: 상태 인디케이터 (6개 BOOL dot)
// ======================

function renderIndicators({ response }) {
  const { data } = response;
  if (!data || !Array.isArray(data)) return;

  const metricMap = {};
  data.forEach((m) => { metricMap[m.metricCode] = m; });

  const indicators = this.popupQueryAll('.indicator');
  if (!indicators) return;

  indicators.forEach((el) => {
    const code = el.dataset.metric;
    const dot = el.querySelector('.indicator-dot');
    if (!dot || !code) return;

    const metric = metricMap[code];
    if (!metric) {
      dot.dataset.state = 'unknown';
      return;
    }

    // 누수(LEAK)는 true=에러, 나머지는 true=정상
    const isLeak = code === 'CRAC.LEAK_STATUS';
    const isOn = metric.valueBool;

    if (isLeak) {
      dot.dataset.state = isOn ? 'error' : 'ok';
    } else {
      dot.dataset.state = isOn ? 'on' : 'off';
    }
  });
}

// ======================
// RENDER: 트렌드 차트 (bar: 온도, line: 습도)
// ======================

function renderTrendChart({ response }) {
  const { data } = response;
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[CRAC] renderTrendChart: no data');
    return;
  }

  // data를 시간별로 그룹핑
  const timeMap = {};
  data.forEach((row) => {
    const hour = new Date(row.time).getHours() + '시';
    if (!timeMap[hour]) timeMap[hour] = {};
    timeMap[hour][row.metricCode] = row.statsBody?.avg ?? null;
  });

  const hours = Object.keys(timeMap);
  const tempData = hours.map((h) => timeMap[h]['CRAC.RETURN_TEMP'] != null ? +(timeMap[h]['CRAC.RETURN_TEMP'] * 0.1).toFixed(1) : null);
  const humidityData = hours.map((h) => timeMap[h]['CRAC.RETURN_HUMIDITY'] != null ? +(timeMap[h]['CRAC.RETURN_HUMIDITY'] * 0.1).toFixed(1) : null);

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.95)',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    legend: {
      data: ['온도', '습도'],
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
        name: '°C',
        position: 'left',
        axisLine: { show: true, lineStyle: { color: '#3b82f6' } },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: '#333' } },
      },
      {
        type: 'value',
        name: '%',
        position: 'right',
        axisLine: { show: true, lineStyle: { color: '#22c55e' } },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '온도',
        type: 'bar',
        yAxisIndex: 0,
        data: tempData,
        barWidth: '40%',
        itemStyle: { color: hexToRgba('#3b82f6', 0.7), borderRadius: [2, 2, 0, 0] },
      },
      {
        name: '습도',
        type: 'line',
        yAxisIndex: 1,
        data: humidityData,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#22c55e', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba('#22c55e', 0.2) },
              { offset: 1, color: hexToRgba('#22c55e', 0) },
            ],
          },
        },
      },
    ],
  };

  this.updateChart('.chart-container', option);
}

// ======================
// RENDER: 에러
// ======================

function renderError(message) {
  const nameEl = this.popupQuery('.crac-name');
  const zoneEl = this.popupQuery('.crac-zone');
  const statusEl = this.popupQuery('.crac-status');

  if (nameEl) nameEl.textContent = '데이터 없음';
  if (zoneEl) zoneEl.textContent = message;
  if (statusEl) {
    statusEl.textContent = 'Error';
    statusEl.dataset.status = 'critical';
  }

  console.warn('[CRAC] renderError:', message);
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
