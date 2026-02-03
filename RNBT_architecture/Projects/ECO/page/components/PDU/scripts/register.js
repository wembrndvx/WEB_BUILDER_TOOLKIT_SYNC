/**
 * PDU (Power Distribution Unit) - 3D Popup Component
 *
 * 분전반 컴포넌트 (기획서 v.0.8_260128 기준)
 * - ① 기본정보 테이블 (assetDetailUnified + mdl/g + vdr/g 체이닝)
 * - ② 실시간 전력추이현황 4탭 트렌드 차트 (전압/전류/전력사용량/입력주파수)
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
// TAB CONFIG (탭별 메트릭 매핑)
// ======================
const TAB_CONFIG = {
  voltage:   { metricCode: 'DIST.V_LN_AVG',              label: '평균 전압',     unit: 'V',   color: '#3b82f6', scale: 1.0 },
  current:   { metricCode: 'DIST.CURRENT_AVG_A',          label: '평균 전류',     unit: 'A',   color: '#f59e0b', scale: 1.0 },
  power:     { metricCode: 'DIST.ACTIVE_POWER_TOTAL_KW',  label: '합계 전력',     unit: 'kW',  color: '#8b5cf6', scale: 1.0 },
  frequency: { metricCode: 'DIST.FREQUENCY_HZ',           label: '주파수',        unit: 'Hz',  color: '#22c55e', scale: 1.0 },
  energy:    { metricCode: 'DIST.ACTIVE_ENERGY_SUM_KWH',  label: '누적 전력사용량', unit: 'kWh', color: '#ef4444', scale: 1.0 },
};

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. 데이터 정의
  // ======================
  this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;
  this._baseUrl = BASE_URL;
  this._trendData = null;
  this._activeTab = 'voltage';

  this.datasetInfo = [
    { datasetName: 'assetDetailUnified', param: { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey, locale: 'ko' }, render: ['renderBasicInfo'] },
    {
      datasetName: 'metricHistoryStats',
      param: {
        baseUrl: this._baseUrl,
        assetKey: this._defaultAssetKey,
        interval: '1h',
        timeRange: 24 * 60 * 60 * 1000, // 24시간 (ms)
        metricCodes: ['DIST.V_LN_AVG', 'DIST.CURRENT_AVG_A', 'DIST.ACTIVE_POWER_TOTAL_KW', 'DIST.FREQUENCY_HZ', 'DIST.ACTIVE_ENERGY_SUM_KWH'],
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

  // ======================
  // 3. Data Config
  // ======================
  this.baseInfoConfig = [
    { key: 'name', selector: '.pdu-name' },
    { key: 'locationLabel', selector: '.pdu-zone' },
    { key: 'statusType', selector: '.pdu-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.pdu-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  // ======================
  // 4. 렌더링 함수 바인딩
  // ======================
  this.renderBasicInfo = renderBasicInfo.bind(this);
  this.renderTrendChart = renderTrendChart.bind(this);
  this.renderError = renderError.bind(this);

  // ======================
  // 5. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this._switchTab = switchTab.bind(this);

  // ======================
  // 6. 이벤트 발행
  // ======================
  this.customEvents = {
    click: '@assetClicked',
  };

  bind3DEvents(this, this.customEvents);

  // ======================
  // 7. Template Config
  // ======================
  this.templateConfig = {
    popup: 'popup-pdu',
  };

  // ======================
  // 8. Popup (template 기반)
  // ======================
  this.popupCreatedConfig = {
    chartSelector: '.chart-container',
    events: {
      click: {
        '.close-btn': () => this.hideDetail(),
        '.tab-btn': (e) => this._switchTab(e.target.dataset.tab),
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

  console.log('[PDU] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();

  // 1) assetDetailUnified 호출 (섹션별 독립 처리)
  fx.go(
    this.datasetInfo,
    fx.each(({ datasetName, param, render }) =>
      fx.go(
        fetchData(this.page, datasetName, param),
        (response) => {
          if (!response || !response.response) {
            console.warn(`[PDU] ${datasetName} fetch failed - no response`);
            return;
          }
          const data = response.response.data;
          if (data === null || data === undefined) {
            console.warn(`[PDU] ${datasetName} - no data`);
            return;
          }
          fx.each((fn) => this[fn](response), render);
        }
      )
    )
  ).catch((e) => {
    console.error('[PDU] Data load error:', e);
  });

  // 2) 트렌드 차트 호출 (mhs/l)
  fetchTrendData.call(this);
}

function hideDetail() {
  this.hidePopup();
}

function switchTab(tabName) {
  if (!tabName || !TAB_CONFIG[tabName]) return;
  this._activeTab = tabName;

  const buttons = this.popupQueryAll('.tab-btn');
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

async function fetchTrendData() {
  const trendInfo = this.datasetInfo.find(d => d.datasetName === 'metricHistoryStats');
  if (!trendInfo) return;

  const { baseUrl, assetKey, interval, timeRange, metricCodes, statsKeys } = trendInfo.param;
  const now = new Date();
  const from = new Date(now.getTime() - timeRange);

  try {
    const response = await fetch(`http://${baseUrl}/api/v1/mhs/l`, {
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
    });

    const result = await response.json();
    if (!result || !result.success) {
      console.warn('[PDU] Trend data unavailable');
      return;
    }
    // 데이터를 저장해두고 현재 활성 탭으로 렌더링
    this._trendData = result.data;
    this.renderTrendChart({ response: { data: result.data } });
  } catch (e) {
    console.warn('[PDU] Trend fetch failed:', e);
  }
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
// RENDER: 트렌드 차트 (탭별 단일 라인)
// ======================

function renderTrendChart({ response }) {
  const { data } = response;
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[PDU] renderTrendChart: no data');
    return;
  }

  const tabConfig = TAB_CONFIG[this._activeTab];
  if (!tabConfig) return;

  // data를 시간별로 그룹핑
  const timeMap = {};
  data.forEach((row) => {
    const hour = new Date(row.time).getHours() + '시';
    if (!timeMap[hour]) timeMap[hour] = {};
    timeMap[hour][row.metricCode] = row.statsBody?.avg ?? null;
  });

  const hours = Object.keys(timeMap);
  const values = hours.map((h) => {
    const raw = timeMap[h][tabConfig.metricCode];
    return raw != null ? +(raw * tabConfig.scale).toFixed(2) : null;
  });

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.95)',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    legend: {
      data: [tabConfig.label],
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
      axisLine: { show: true, lineStyle: { color: tabConfig.color } },
      axisLabel: { color: '#888', fontSize: 10 },
      splitLine: { lineStyle: { color: '#333' } },
    },
    series: [
      {
        name: tabConfig.label,
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: tabConfig.color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(tabConfig.color, 0.3) },
              { offset: 1, color: hexToRgba(tabConfig.color, 0) },
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
  const nameEl = this.popupQuery('.pdu-name');
  const zoneEl = this.popupQuery('.pdu-zone');
  const statusEl = this.popupQuery('.pdu-status');

  if (nameEl) nameEl.textContent = '데이터 없음';
  if (zoneEl) zoneEl.textContent = message;
  if (statusEl) {
    statusEl.textContent = 'Error';
    statusEl.dataset.status = 'critical';
  }

  console.warn('[PDU] renderError:', message);
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

// ======================
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
}
