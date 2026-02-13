/**
 * SWBD (Switchboard) - 3D Popup Component
 *
 * 수배전반 컴포넌트 (기획서 v.0.8_260128 기준)
 * - ① 기본정보 테이블 (assetDetailUnified + vdr/g 체이닝)
 * - ② 고압반 운전 상태 추이 4탭 트렌드 차트 (전압/전류/주파수/유효전력)
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
  this._baseUrl = wemb.configManager.assetApiUrl.replace(/^https?:\/\//, '');
  this._locale = 'ko';
  this._popupTemplateId = 'popup-swbd';
  this._trendData = null;
  this._trendDataComparison = null; // { today: [], yesterday: [] }
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
      vendorDetail: 'vendorDetail',
    },

    // API 엔드포인트 및 파라미터
    api: {
      trendHistory: '/api/v1/mhs/l',
      trendParams: {
        interval: '1h',
        timeRange: 24 * 60 * 60 * 1000,
        metricCodes: [
          'SWBD.VOLTAGE_V',
          'SWBD.CURRENT_A',
          'SWBD.FREQUENCY_HZ',
          'SWBD.ACTIVE_POWER_KW',
        ],
        statsKeys: [],
        timeField: 'time',
      },
      statsKeyMap: {
        'SWBD.VOLTAGE_V': 'avg',
        'SWBD.CURRENT_A': 'avg',
        'SWBD.FREQUENCY_HZ': 'avg',
        'SWBD.ACTIVE_POWER_KW': 'avg',
      },
    },

    // ========================
    // UI 영역별 설정
    // ========================

    // 팝업 헤더 영역
    header: {
      fields: [
        { key: 'name', selector: '.swbd-name' },
        { key: 'locationLabel', selector: '.swbd-zone' },
        { key: 'statusType', selector: '.swbd-status', transform: this.statusTypeToLabel },
        {
          key: 'statusType',
          selector: '.swbd-status',
          dataAttr: 'status',
          transform: this.statusTypeToDataAttr,
        },
      ],
    },

    // 기본정보 테이블 영역
    infoTable: {
      fields: [
        { key: 'name', selector: '.info-name' },
        { key: 'assetType', selector: '.info-type' },
        { key: 'usageCode', selector: '.info-usage', fallback: '-' },
        { key: 'assetModelName', selector: '.info-model', fallback: '-' },
        { key: 'locationLabel', selector: '.info-location' },
        { key: 'statusType', selector: '.info-status', transform: this.statusTypeToLabel },
        { key: 'installDate', selector: '.info-install-date', transform: this.formatDate },
      ],
      chain: {
        vendor: '.info-vendor',
      },
    },

    // 트렌드 차트 영역 (4탭)
    chart: {
      tabs: {
        voltage: {
          metricCode: 'SWBD.VOLTAGE_V',
          label: '전압',
          unit: 'V',
          color: '#3b82f6',
          scale: 1.0,
        },
        current: {
          metricCode: 'SWBD.CURRENT_A',
          label: '전류',
          unit: 'A',
          color: '#f59e0b',
          scale: 1.0,
        },
        frequency: {
          metricCode: 'SWBD.FREQUENCY_HZ',
          label: '주파수',
          unit: 'Hz',
          color: '#22c55e',
          scale: 1.0,
        },
        power: {
          metricCode: 'SWBD.ACTIVE_POWER_KW',
          label: '유효전력',
          unit: 'kW',
          scale: 1.0,
          comparison: true, // 금일/전일 비교
          series: {
            today: { label: '금일', color: '#3b82f6' },
            yesterday: { label: '전일', color: '#94a3b8' },
          },
        },
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
  const baseParam = {
    baseUrl: this._baseUrl,
    assetKey: this._defaultAssetKey,
    locale: this._locale,
  };

  this.datasetInfo = [
    {
      datasetName: datasetNames.assetDetail,
      param: { ...baseParam },
      render: ['renderBasicInfo'],
      refreshInterval: 0,
    },
    {
      datasetName: datasetNames.metricHistory,
      param: { ...baseParam, ...api.trendParams, apiEndpoint: api.trendHistory },
      render: ['renderTrendChart'],
      refreshInterval: 5000,
    },
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
  this.stopRefresh = stopRefresh.bind(this);
  this._switchTab = switchTab.bind(this);

  // Runtime Parameter Update API
  this.updateTrendParams = updateTrendParams.bind(this);
  this.updateSwbdTabMetric = updateSwbdTabMetric.bind(this);
  this.updateGlobalParams = updateGlobalParams.bind(this);
  this.updateRefreshInterval = updateRefreshInterval.bind(this);

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

  // destroyPopup 체인 확장 - interval 정리
  const _origDestroyPopup = this.destroyPopup;
  const _ctx = this;
  this.destroyPopup = function() {
    _ctx.stopRefresh();
    _origDestroyPopup.call(_ctx);
  };

  console.log('[SWBD] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();

  // 탭 상태 초기화 (이전 세션의 탭 상태가 잔존하지 않도록)
  this._activeTab = 'voltage';
  const tabBtns = this.popupQueryAll(this.config.chart.selectors.tabBtn);
  if (tabBtns) {
    tabBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === 'voltage'));
  }

  // 전체 데이터셋 fetch
  fx.go(
    this.datasetInfo,
    fx.each((d) => fetchDatasetAndRender.call(this, d))
  );

  // 기존 interval 정리 후 재설정
  this.stopRefresh();
  fx.go(
    this.datasetInfo,
    fx.filter((d) => d.refreshInterval > 0),
    fx.each((d) => {
      d._intervalId = setInterval(() => fetchDatasetAndRender.call(this, d), d.refreshInterval);
    })
  );
}

function hideDetail() {
  this.stopRefresh();
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
// DATA FETCH
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
  const { datasetNames, chart } = this.config;
  const { datasetName, param, render } = d;

  if (datasetName === datasetNames.metricHistory) {
    const hasComparison = Object.values(chart.tabs).some((tab) => tab.comparison);

    if (hasComparison) {
      // 금일/전일 비교 fetch (2회 병렬)
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const todayFrom = formatLocalDate(todayStart);
      const todayTo = formatLocalDate(now);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setTime(yesterdayEnd.getTime() - 1000);

      const yesterdayFrom = formatLocalDate(yesterdayStart);
      const yesterdayTo = formatLocalDate(yesterdayEnd);

      Promise.all([
        fetchData(this.page, datasetName, { ...param, timeFrom: todayFrom, timeTo: todayTo }),
        fetchData(this.page, datasetName, {
          ...param,
          timeFrom: yesterdayFrom,
          timeTo: yesterdayTo,
        }),
      ])
        .then(([todayResp, yesterdayResp]) => {
          const todayData = extractData(todayResp) || [];
          const yesterdayData = extractData(yesterdayResp) || [];
          this._trendData = todayData;
          this._trendDataComparison = { today: todayData, yesterday: yesterdayData };
          fx.each((fn) => this[fn]({ response: { data: todayData } }), render);
        })
        .catch((e) => console.warn('[SWBD] Comparison trend fetch failed:', e));
    } else {
      // 단일 timeRange fetch
      const now = new Date();
      const from = new Date(now.getTime() - param.timeRange);
      param.timeFrom = formatLocalDate(from);
      param.timeTo = formatLocalDate(now);

      fetchData(this.page, datasetName, param)
        .then((response) => {
          const data = extractData(response);
          if (!data) return;
          this._trendData = data;
          this._trendDataComparison = null;
          fx.each((fn) => this[fn](response), render);
        })
        .catch((e) => console.warn('[SWBD] Trend fetch failed:', e));
    }
    return;
  }

  // 일반 데이터셋 (assetDetail 등)
  fetchData(this.page, datasetName, param)
    .then((response) => {
      const data = extractData(response);
      if (!data) return;
      fx.each((fn) => this[fn](response), render);
    })
    .catch((e) => console.warn(`[SWBD] ${datasetName} fetch failed:`, e));
}

function stopRefresh() {
  const datasetInfo = this.datasetInfo ?? [];
  fx.go(
    datasetInfo,
    fx.filter((d) => d._intervalId),
    fx.each((d) => {
      clearInterval(d._intervalId);
      d._intervalId = null;
    })
  );
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

function fetchVendorDirect(ctx, asset, chainConfig) {
  const { datasetNames } = ctx.config;
  const setCell = (selector, value) => {
    const el = ctx.popupQuery(selector);
    if (el) el.textContent = value ?? '-';
  };

  // gx 응답에 assetVendorKey가 직접 포함됨 (model chain 불필요)
  if (!asset.assetVendorKey) return;

  fx.go(
    fetchData(ctx.page, datasetNames.vendorDetail, {
      baseUrl: ctx._baseUrl,
      assetVendorKey: asset.assetVendorKey,
    }),
    (vendorResp) => {
      const vendor = extractData(vendorResp, 'data');
      if (vendor) setCell(chainConfig.vendor, vendor.name);
    }
  ).catch(() => {});
}

// ======================
// RENDER: 기본정보 테이블
// ======================

function renderBasicInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    console.warn('[SWBD] renderBasicInfo: 자산 데이터가 없습니다.');
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

  // 제조사명 직접 조회 (gx가 assetVendorKey 반환)
  fetchVendorDirect(this, asset, infoTable.chain);

  // properties 동적 렌더링 (기본정보 테이블에 행 추가)
  renderPropertiesRows(this, data.properties);
}

function renderPropertiesRows(ctx, properties) {
  if (!properties || properties.length === 0) return;

  const tbody = ctx.popupQuery('.info-table tbody');
  if (!tbody) return;

  tbody.querySelectorAll('tr[data-property]').forEach((tr) => tr.remove());

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

  // 단일 시리즈 렌더링 (데이터 없어도 빈 차트 표시)
  const safeData = Array.isArray(data) ? data : [];
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find((d) => d.datasetName === datasetNames.metricHistory);
  const { timeField } = trendInfo?.param || {};
  const timeKey = timeField || 'time';

  // 현재 탭의 metricCode로 필터링
  const tabData = safeData.filter((row) => row.metricCode === tabConfig.metricCode);

  // 필터링된 데이터를 시간별로 그룹핑
  const timeMap = fx.reduce(
    (acc, row) => {
      const time = row[timeKey];
      if (!acc[time]) acc[time] = {};
      const statsKey = this.config.api.statsKeyMap[row.metricCode];
      acc[time][row.metricCode] = statsKey ? row.statsBody?.[statsKey] ?? null : null;
      return acc;
    },
    {},
    tabData
  );

  const times = Object.keys(timeMap);
  const values = fx.go(
    times,
    fx.map((t) => {
      const raw = timeMap[t]?.[tabConfig.metricCode];
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
      data: times,
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
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
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
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find((d) => d.datasetName === datasetNames.metricHistory);
  const { timeField } = trendInfo?.param || {};
  const statsKey = this.config.api.statsKeyMap[tabConfig.metricCode];
  const timeKey = timeField || 'time';

  // 시간 부분만 추출 (금일/전일 비교를 위해 날짜 제거)
  const extractHHMM = (timeStr) => {
    const d = new Date(timeStr);
    return (
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    );
  };

  // 데이터를 시간(HH:MM)별로 그룹핑하는 헬퍼
  const groupByTime = (data) =>
    fx.reduce(
      (acc, row) => {
        const time = extractHHMM(row[timeKey]);
        if (row.metricCode === tabConfig.metricCode) {
          acc[time] = row.statsBody?.[statsKey] ?? null;
        }
        return acc;
      },
      {},
      data || []
    );

  const todayMap = groupByTime(today);
  const yesterdayMap = groupByTime(yesterday);

  // 금일/전일 데이터의 시간 키 합집합 (HH:MM 정렬)
  const times = [...new Set([...Object.keys(todayMap), ...Object.keys(yesterdayMap)])].sort();

  const todayValues = fx.go(
    times,
    fx.map((t) => {
      const raw = todayMap[t];
      return raw != null ? +(raw * tabConfig.scale).toFixed(2) : null;
    })
  );

  const yesterdayValues = fx.go(
    times,
    fx.map((t) => {
      const raw = yesterdayMap[t];
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
      data: times,
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
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
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
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
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

// ======================================
// RUNTIME PARAMETER UPDATE API
// ======================================

function updateTrendParams(options) {
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find((d) => d.datasetName === datasetNames.metricHistory);
  if (!trendInfo) return;

  const { timeRange, interval, apiEndpoint, timeField } = options;
  if (timeRange !== undefined) trendInfo.param.timeRange = timeRange;
  if (interval !== undefined) trendInfo.param.interval = interval;
  if (apiEndpoint !== undefined) trendInfo.param.apiEndpoint = apiEndpoint;
  if (timeField !== undefined) trendInfo.param.timeField = timeField;
}

function updateSwbdTabMetric(tabName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find((d) => d.datasetName === datasetNames.metricHistory);
  if (!trendInfo) return;

  const tab = chart.tabs[tabName];
  if (!tab) return;

  const { metricCode, statsKey, label, unit, color, scale } = options;

  // metricCode 변경 시 statsKey 필수 검증
  if (metricCode !== undefined && statsKey === undefined) {
    console.warn(`[updateSwbdTabMetric] metricCode 변경 시 statsKey 필수 (tab: ${tabName})`);
    return;
  }

  // chart.tabs 업데이트 + statsKeyMap 업데이트
  if (metricCode !== undefined) {
    tab.metricCode = metricCode;
    this.config.api.statsKeyMap[metricCode] = statsKey;
  }

  // UI 필드 업데이트
  if (label !== undefined) tab.label = label;
  if (unit !== undefined) tab.unit = unit;
  if (color !== undefined) tab.color = color;
  if (scale !== undefined) tab.scale = scale;

  // param.metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);
}

function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { tabs } = this.config.chart;
  Object.values(tabs).forEach((tab) => {
    if (tab.metricCode && !codes.includes(tab.metricCode)) codes.push(tab.metricCode);
  });
}

function updateGlobalParams(options) {
  const { assetKey, baseUrl, locale } = options;

  if (assetKey !== undefined) this._defaultAssetKey = assetKey;
  if (baseUrl !== undefined) this._baseUrl = baseUrl;
  if (locale !== undefined) this._locale = locale;

  this.datasetInfo.forEach((d) => {
    if (assetKey !== undefined) d.param.assetKey = assetKey;
    if (baseUrl !== undefined) d.param.baseUrl = baseUrl;
    if (locale !== undefined) d.param.locale = locale;
  });
}

function updateRefreshInterval(datasetName, interval) {
  const target = this.datasetInfo.find((d) => d.datasetName === datasetName);
  if (!target) return;
  target.refreshInterval = interval;
}
