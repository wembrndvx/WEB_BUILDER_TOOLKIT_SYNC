/**
 * PDU (Power Distribution Unit) - 3D Popup Component
 *
 * 분전반 컴포넌트 (기획서 v.0.8_260128 기준)
 * - ① 기본정보 테이블 (assetDetailUnified + mdl/g + vdr/g 체이닝)
 * - ② 실시간 전력추이현황 4탭 트렌드 차트 (전압/전류/전력사용량/입력주파수)
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
  this._popupTemplateId = 'popup-pdu';
  this._trendData = null;
  this._trendDataComparison = null;  // { today: [], yesterday: [] }
  this._activeTab = 'voltage';

  // ======================
  // 2. 변환 함수 바인딩
  // ======================
  this.statusTypeToLabel = statusTypeToLabel.bind(this);
  this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this);
  this.formatDate = formatDate.bind(this);

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
        metricCodes: ['DIST.V_LN_AVG', 'DIST.CURRENT_AVG_A', 'DIST.ACTIVE_POWER_TOTAL_KW', 'DIST.FREQUENCY_HZ', 'DIST.ACTIVE_ENERGY_SUM_KWH'],
        statsKeys: ['avg'],
      },
    },

    // ========================
    // UI 영역별 설정
    // ========================

    // 팝업 헤더 영역
    header: {
      fields: [
        { key: 'name', selector: '.pdu-name' },
        { key: 'locationLabel', selector: '.pdu-zone' },
        { key: 'statusType', selector: '.pdu-status', transform: this.statusTypeToLabel },
        { key: 'statusType', selector: '.pdu-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
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

    // 트렌드 차트 영역 (5탭)
    chart: {
      tabs: {
        voltage:   { metricCode: 'DIST.V_LN_AVG',              label: '평균 전압',       unit: 'V',   color: '#3b82f6', scale: 1.0 },
        current:   { metricCode: 'DIST.CURRENT_AVG_A',         label: '평균 전류',       unit: 'A',   color: '#f59e0b', scale: 1.0 },
        power: {
          metricCode: 'DIST.ACTIVE_POWER_TOTAL_KW',
          label: '전력사용량',
          unit: 'kW',
          scale: 1.0,
          comparison: true,  // 금일/전일 비교
          series: {
            today:     { label: '금일', color: '#3b82f6' },
            yesterday: { label: '전일', color: '#94a3b8' },
          },
        },
        frequency: { metricCode: 'DIST.FREQUENCY_HZ',          label: '주파수',          unit: 'Hz',  color: '#22c55e', scale: 1.0 },
        energy:    { metricCode: 'DIST.ACTIVE_ENERGY_SUM_KWH', label: '누적 전력사용량', unit: 'kWh', color: '#ef4444', scale: 1.0 },
      },
      selectors: {
        container: '.chart-container',
        tabBtn: '.tab-btn',
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
    { datasetName: datasetNames.metricHistory, param: { ...baseParam, ...api.trendParams, apiEndpoint: api.trendHistory }, render: ['renderTrendChart'] },
  ];

  // ======================
  // 5. 렌더링 함수 바인딩
  // ======================
  this.renderBasicInfo = renderBasicInfo.bind(this);
  this.renderTrendChart = renderTrendChart.bind(this);
  this.renderInitialLabels = renderInitialLabels.bind(this);

  // ======================
  // 6. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this._switchTab = switchTab.bind(this);

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

  console.log('[PDU] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();

  const { datasetNames } = this.config;

  // 1) assetDetailUnified 호출 (섹션별 독립 처리)
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
  const { chart } = this.config;
  if (!tabName || !chart.tabs[tabName]) return;
  this._activeTab = tabName;

  const buttons = this.popupQueryAll(chart.selectors.tabBtn);
  if (buttons) {
    fx.go(
      buttons,
      fx.each((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName))
    );
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
  const { datasetNames, chart } = this.config;
  const trendInfo = fx.go(
    this.datasetInfo,
    fx.filter((d) => d.datasetName === datasetNames.metricHistory),
    (arr) => arr[0]
  );
  if (!trendInfo) return;

  const { baseUrl, assetKey, interval, metricCodes, statsKeys, apiEndpoint } = trendInfo.param;

  // comparison 탭이 있는지 확인
  const hasComparison = fx.go(
    Object.values(chart.tabs),
    fx.some((tab) => tab.comparison)
  );

  if (hasComparison) {
    // 금일/전일 비교가 필요한 경우 2회 fetch
    fetchComparisonTrendData.call(this, { baseUrl, assetKey, interval, metricCodes, statsKeys, apiEndpoint });
  } else {
    // 기존 로직: 단일 timeRange 사용
    const { timeRange } = trendInfo.param;
    const now = new Date();
    const from = new Date(now.getTime() - timeRange);

    fetchSingleTrendData.call(this, {
      baseUrl, assetKey, interval, metricCodes, statsKeys, apiEndpoint,
      timeFrom: from.toISOString().replace('T', ' ').slice(0, 19),
      timeTo: now.toISOString().replace('T', ' ').slice(0, 19),
    });
  }
}

function fetchSingleTrendData({ baseUrl, assetKey, interval, metricCodes, statsKeys, apiEndpoint, timeFrom, timeTo }) {
  fetch(`http://${baseUrl}${apiEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: { assetKey, interval, metricCodes, timeFrom, timeTo },
      statsKeys,
      sort: [],
    }),
  })
    .then((resp) => resp.json())
    .then((result) => {
      if (!result || !result.success) {
        console.warn('[PDU] Trend data unavailable');
        return;
      }
      this._trendData = result.data;
      this._trendDataComparison = null;  // 비교 데이터 초기화
      this.renderTrendChart({ response: { data: result.data } });
    })
    .catch((e) => {
      console.warn('[PDU] Trend fetch failed:', e);
    });
}

function fetchComparisonTrendData({ baseUrl, assetKey, interval, metricCodes, statsKeys, apiEndpoint }) {
  // 금일: 오늘 00:00 ~ 현재
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayFrom = todayStart.toISOString().replace('T', ' ').slice(0, 19);
  const todayTo = now.toISOString().replace('T', ' ').slice(0, 19);

  // 전일: 어제 00:00 ~ 어제 23:59:59
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStart);
  yesterdayEnd.setTime(yesterdayEnd.getTime() - 1000);  // 오늘 00:00 - 1초 = 어제 23:59:59

  const yesterdayFrom = yesterdayStart.toISOString().replace('T', ' ').slice(0, 19);
  const yesterdayTo = yesterdayEnd.toISOString().replace('T', ' ').slice(0, 19);

  const fetchPayload = (from, to) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: { assetKey, interval, metricCodes, timeFrom: from, timeTo: to },
      statsKeys,
      sort: [],
    }),
  });

  // 금일 + 전일 병렬 fetch
  Promise.all([
    fetch(`http://${baseUrl}${apiEndpoint}`, fetchPayload(todayFrom, todayTo)).then((r) => r.json()),
    fetch(`http://${baseUrl}${apiEndpoint}`, fetchPayload(yesterdayFrom, yesterdayTo)).then((r) => r.json()),
  ])
    .then(([todayResult, yesterdayResult]) => {
      this._trendData = todayResult?.success ? todayResult.data : [];
      this._trendDataComparison = {
        today: todayResult?.success ? todayResult.data : [],
        yesterday: yesterdayResult?.success ? yesterdayResult.data : [],
      };
      this.renderTrendChart({ response: { data: this._trendData } });
    })
    .catch((e) => {
      console.warn('[PDU] Comparison trend fetch failed:', e);
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
    console.warn('[PDU] renderBasicInfo: 자산 데이터가 없습니다.');
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
// RENDER: 트렌드 차트 (탭별 단일 라인 / 금일-전일 비교)
// ======================

function renderTrendChart({ response }) {
  const { data } = response;
  const { chart } = this.config;
  const { tabs, selectors } = chart;
  const tabConfig = tabs[this._activeTab];
  if (!tabConfig) return;

  // comparison 탭이고 비교 데이터가 있는 경우
  if (tabConfig.comparison && this._trendDataComparison) {
    renderComparisonChart.call(this, tabConfig, selectors);
    return;
  }

  // 단일 시리즈 렌더링
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[PDU] renderTrendChart: no data');
    return;
  }

  // data를 시간별로 그룹핑
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
  const values = fx.go(
    hours,
    fx.map((h) => {
      const raw = timeMap[h][tabConfig.metricCode];
      return raw != null ? +(raw * tabConfig.scale).toFixed(2) : null;
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
      axisLine: { show: true, lineStyle: { color: tabConfig.color || '#3b82f6' } },
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

  this.updateChart(selectors.container, option);
}

// ======================
// RENDER: 금일/전일 비교 차트
// ======================

function renderComparisonChart(tabConfig, selectors) {
  const { today, yesterday } = this._trendDataComparison;
  const { series } = tabConfig;

  // 0시~23시 고정 X축 (시간만 표시, 날짜 제외)
  const hours = fx.go(
    fx.range(24),
    fx.map((h) => h + '시')
  );

  // 데이터를 시간(hour)별로 그룹핑하는 헬퍼
  const groupByHour = (data) =>
    fx.reduce(
      (acc, row) => {
        const hour = new Date(row.time).getHours() + '시';
        if (row.metricCode === tabConfig.metricCode) {
          acc[hour] = row.statsBody?.avg ?? null;
        }
        return acc;
      },
      {},
      data || []
    );

  const todayMap = groupByHour(today);
  const yesterdayMap = groupByHour(yesterday);

  const todayValues = fx.go(
    hours,
    fx.map((h) => {
      const raw = todayMap[h];
      return raw != null ? +(raw * tabConfig.scale).toFixed(2) : null;
    })
  );

  const yesterdayValues = fx.go(
    hours,
    fx.map((h) => {
      const raw = yesterdayMap[h];
      return raw != null ? +(raw * tabConfig.scale).toFixed(2) : null;
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
      data: [series.today.label, series.yesterday.label],
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
      axisLine: { show: true, lineStyle: { color: series.today.color } },
      axisLabel: { color: '#888', fontSize: 10 },
      splitLine: { lineStyle: { color: '#333' } },
    },
    series: [
      {
        name: series.today.label,
        type: 'line',
        data: todayValues,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: series.today.color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(series.today.color, 0.3) },
              { offset: 1, color: hexToRgba(series.today.color, 0) },
            ],
          },
        },
      },
      {
        name: series.yesterday.label,
        type: 'line',
        data: yesterdayValues,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: series.yesterday.color, width: 2, type: 'dashed' },
      },
    ],
  };

  this.updateChart(selectors.container, option);
}

// ======================
// RENDER: 초기 레이블
// ======================

function renderInitialLabels() {
  const { chart } = this.config;
  fx.go(
    Object.entries(chart.tabs),
    fx.each(([tabKey, cfg]) => {
      const btn = this.popupQuery(`${chart.selectors.tabBtn}[data-tab="${tabKey}"]`);
      if (btn) btn.textContent = cfg.label;
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

// ======================
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
  this.renderInitialLabels();
}
