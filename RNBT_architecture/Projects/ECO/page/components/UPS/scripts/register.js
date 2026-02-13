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
  this._baseUrl = wemb.configManager.assetApiUrl.replace(/^https?:\/\//, '');
  this._locale = 'ko';
  this._popupTemplateId = 'popup-ups';
  this._trendData = null;
  this._activeTab = 'voltage';

  // ======================
  // 2. 변환 함수 바인딩 (config.fields.transform에서 사용)
  // ======================
  this.statusTypeToLabel = statusTypeToLabel.bind(this); // 'ACTIVE' → '정상'
  this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this); // 'ACTIVE' → 'normal' (CSS 선택자용)
  this.formatDate = formatDate.bind(this); // ISO → 'YYYY-MM-DD'
  this.formatTimestamp = formatTimestamp.bind(this); // ISO → 'HH:mm:ss'

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
        metricCodes: [
          'UPS.INPUT_A_SUM',
          'UPS.OUTPUT_A_SUM',
          'UPS.INPUT_V_AVG',
          'UPS.OUTPUT_V_AVG',
          'UPS.INPUT_F_AVG',
          'UPS.OUTPUT_F_AVG',
        ],
        statsKeys: [],
        timeField: 'time',
      },
      statsKeyMap: {
        'UPS.INPUT_A_SUM': 'sum',
        'UPS.OUTPUT_A_SUM': 'sum',
        'UPS.INPUT_V_AVG': 'avg',
        'UPS.OUTPUT_V_AVG': 'avg',
        'UPS.INPUT_F_AVG': 'avg',
        'UPS.OUTPUT_F_AVG': 'avg',
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
        { key: 'name', selector: '.ups-name' },
        { key: 'locationLabel', selector: '.ups-zone' },
        { key: 'statusType', selector: '.ups-status', transform: this.statusTypeToLabel },
        {
          key: 'statusType',
          selector: '.ups-status',
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

    // 전력현황 영역 (4카드)
    powerStatus: {
      metrics: {
        batterySoc: {
          label: '배터리 사용률',
          unit: '%',
          metricCode: 'UPS.BATT_PCT',
          scale: 1.0,
          demoRange: [75, 100],
        },
        batteryTime: {
          label: '배터리 잔여시간',
          unit: 'h',
          metricCode: null,
          scale: 1.0,
          demoRange: [2.0, 8.0],
        }, // API 미지원
        loadRate: {
          label: '부하율',
          unit: '%',
          metricCode: 'UPS.LOAD_PCT',
          scale: 1.0,
          demoRange: [20, 65],
        },
        batteryVolt: {
          label: '배터리 출력전압',
          unit: 'V',
          metricCode: 'UPS.BATT_V',
          scale: 1.0,
          demoRange: [380, 420],
        },
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
        current: {
          label: '입/출력 전류',
          unit: 'A',
          inputCode: 'UPS.INPUT_A_SUM',
          outputCode: 'UPS.OUTPUT_A_SUM',
        },
        voltage: {
          label: '입/출력 전압',
          unit: 'V',
          inputCode: 'UPS.INPUT_V_AVG',
          outputCode: 'UPS.OUTPUT_V_AVG',
        },
        frequency: {
          label: '입/출력 주파수',
          unit: 'Hz',
          inputCode: 'UPS.INPUT_F_AVG',
          outputCode: 'UPS.OUTPUT_F_AVG',
        },
      },
      series: {
        input: { label: '입력', color: '#f59e0b' },
        output: { label: '출력', color: '#22c55e' },
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
      datasetName: datasetNames.metricLatest,
      param: { ...baseParam },
      render: ['renderPowerStatus'],
      refreshInterval: 5000,
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
  this.renderPowerStatus = renderPowerStatus.bind(this);
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
  this.updateUpsTabMetric = updateUpsTabMetric.bind(this);
  this.updateGlobalParams = updateGlobalParams.bind(this);
  this.updateRefreshInterval = updateRefreshInterval.bind(this);

  // Category E: 현황카드 API
  this.updateUpsStatusMetric = updateUpsStatusMetric.bind(this);
  this.addUpsStatusMetric = addUpsStatusMetric.bind(this);
  this.removeUpsStatusMetric = removeUpsStatusMetric.bind(this);

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

  // destroyPopup 체인 확장 - interval 정리
  const _origDestroyPopup = this.destroyPopup;
  const _ctx = this;
  this.destroyPopup = function() {
    _ctx.stopRefresh();
    _origDestroyPopup.call(_ctx);
  };

  console.log('[UPS] Registered:', this._defaultAssetKey);
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

  // 모든 datasetInfo를 fetchData로 호출
  fx.go(
    this.datasetInfo,
    fx.each((d) => fetchDatasetAndRender.call(this, d))
  );

  // refreshInterval > 0인 데이터셋에 대해 주기적 갱신 시작
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
    .then((response) => {
      const data = extractData(response);
      if (!data) return;
      if (datasetName === datasetNames.metricHistory) {
        this._trendData = data;
      }
      fx.each((fn) => this[fn](response), render);
    })
    .catch((e) => console.warn(`[UPS] ${datasetName} fetch failed:`, e));
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
    fetchData(ctx.page, datasetNames.modelDetail, {
      baseUrl: ctx._baseUrl,
      assetModelKey: asset.assetModelKey,
    }),
    (modelResp) => {
      const model = extractData(modelResp, 'data');
      if (!model) return;
      setCell(chainConfig.model, model.name);

      if (model.assetVendorKey) {
        fx.go(
          fetchData(ctx.page, datasetNames.vendorDetail, {
            baseUrl: ctx._baseUrl,
            assetVendorKey: model.assetVendorKey,
          }),
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
    (acc, m) => (
      (acc[m.metricCode] = m.valueType === 'NUMBER' ? m.valueNumber : m.valueString), acc
    ),
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

  const rawValue = cfg.metricCode ? metricMap[cfg.metricCode] : undefined;
  if (rawValue != null) {
    valueEl.textContent = (rawValue * cfg.scale).toFixed(1);
  } else if (cfg.demoRange) {
    const [min, max] = cfg.demoRange;
    valueEl.textContent = (min + Math.random() * (max - min)).toFixed(1);
  } else {
    valueEl.textContent = '-';
  }
}

// ======================
// RENDER: 트렌드 차트 (탭별 듀얼 라인)
// ======================

function renderTrendChart({ response }) {
  const { data } = response;
  const { chart } = this.config;
  const { tabs, series, selectors } = chart;
  const tabConfig = tabs[this._activeTab];
  if (!tabConfig) return;

  // 단일 시리즈 렌더링 (데이터 없어도 빈 차트 표시)
  const safeData = Array.isArray(data) ? data : [];
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find((d) => d.datasetName === datasetNames.metricHistory);
  const { timeField } = trendInfo?.param || {};
  const timeKey = timeField || 'time';

  // 현재 탭의 metricCode로 필터링
  const tabMetricCodes = [tabConfig.inputCode, tabConfig.outputCode];
  const tabData = safeData.filter((row) => tabMetricCodes.includes(row.metricCode));

  // 필터링된 데이터로 시간별 그룹핑
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

  const extractValues = (code) =>
    fx.map((t) => {
      const raw = timeMap[t]?.[code];
      return raw != null ? +raw.toFixed(2) : null;
    }, times);

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
      data: times,
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
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
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
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
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

function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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
  const { powerStatus, chart } = this.config;
  const { metrics, selectors } = powerStatus;
  const container = this.popupQuery('.power-cards');

  // 전력현황 카드 reconciliation: config 기준으로 DOM 동기화
  fx.go(
    Object.entries(metrics),
    fx.each(([key, cfg]) => {
      let card = this.popupQuery(`${selectors.card}[data-metric="${key}"]`);
      if (!card && container) {
        card = createPowerCardElement(key);
        container.appendChild(card);
      }
      if (!card) return;
      const labelEl = card.querySelector(selectors.label);
      const unitEl = card.querySelector(selectors.unit);
      if (labelEl) labelEl.textContent = cfg.label;
      if (unitEl) unitEl.textContent = cfg.unit;
    })
  );

  // DOM에 있지만 config에 없는 카드 제거
  if (container) {
    container.querySelectorAll(selectors.card).forEach((card) => {
      if (!metrics[card.dataset.metric]) card.remove();
    });
  }

  // 탭 버튼 라벨
  fx.go(
    Object.entries(chart.tabs),
    fx.each(([key, cfg]) => {
      const btn = this.popupQuery(`${chart.selectors.tabBtn}[data-tab="${key}"]`);
      if (btn) btn.textContent = cfg.label;
    })
  );

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

function updateUpsTabMetric(tabName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find((d) => d.datasetName === datasetNames.metricHistory);
  if (!trendInfo) return;

  const tab = chart.tabs[tabName];
  if (!tab) return;

  const { inputCode, outputCode, statsKey, label, unit } = options;

  // metricCode 변경 시 statsKey 필수 검증
  if ((inputCode !== undefined || outputCode !== undefined) && statsKey === undefined) {
    console.warn(`[updateUpsTabMetric] metricCode 변경 시 statsKey 필수 (tab: ${tabName})`);
    return;
  }

  // chart.tabs 업데이트 + statsKeyMap 업데이트
  if (inputCode !== undefined) {
    tab.inputCode = inputCode;
    this.config.api.statsKeyMap[inputCode] = statsKey;
  }
  if (outputCode !== undefined) {
    tab.outputCode = outputCode;
    this.config.api.statsKeyMap[outputCode] = statsKey;
  }

  // UI 필드 업데이트
  if (label !== undefined) tab.label = label;
  if (unit !== undefined) tab.unit = unit;

  // param.metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);
}

function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { tabs } = this.config.chart;
  Object.values(tabs).forEach((tab) => {
    if (tab.inputCode && !codes.includes(tab.inputCode)) codes.push(tab.inputCode);
    if (tab.outputCode && !codes.includes(tab.outputCode)) codes.push(tab.outputCode);
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

// ======================================
// CATEGORY E: 현황카드 API
// ======================================

function updateUpsStatusMetric(key, options) {
  const metric = this.config.powerStatus.metrics[key];
  if (!metric) {
    console.warn(`[updateUpsStatusMetric] 존재하지 않는 키: ${key}`);
    return;
  }

  const { metricCode, label, unit, scale } = options;
  if (metricCode !== undefined) metric.metricCode = metricCode;
  if (label !== undefined) metric.label = label;
  if (unit !== undefined) metric.unit = unit;
  if (scale !== undefined) metric.scale = scale;
}

function addUpsStatusMetric(key, options) {
  const { metrics } = this.config.powerStatus;
  if (metrics[key]) {
    console.warn(`[addUpsStatusMetric] 이미 존재하는 키: ${key}`);
    return;
  }

  const { label, unit, metricCode = null, scale = 1.0 } = options;
  if (!label || !unit) {
    console.warn(`[addUpsStatusMetric] label과 unit은 필수`);
    return;
  }

  metrics[key] = { label, unit, metricCode, scale };
}

function removeUpsStatusMetric(key) {
  const { metrics } = this.config.powerStatus;
  if (!metrics[key]) {
    console.warn(`[removeUpsStatusMetric] 존재하지 않는 키: ${key}`);
    return;
  }

  delete metrics[key];
}

function createPowerCardElement(key) {
  const card = document.createElement('div');
  card.className = 'power-card';
  card.dataset.metric = key;
  card.innerHTML = `
    <div class="power-card-label"></div>
    <div class="power-card-body">
      <span class="power-card-value">-</span>
      <span class="power-card-unit"></span>
    </div>
  `;
  return card;
}
