/*
 * PDU - 3D Popup Component (Tabbed UI)
 *
 * applyShadowPopupMixin을 사용한 탭 팝업 컴포넌트
 *
 * 핵심 구조:
 * 1. datasetInfo - 데이터 정의 (assetDetail, circuits, history)
 * 2. Data Config - API 필드 매핑
 * 3. Chart Config - ECharts 옵션 빌더
 * 4. 렌더링 함수 바인딩
 * 5. Public Methods - Page에서 호출
 * 6. customEvents - 이벤트 발행
 * 7. Template Data - HTML/CSS (publishCode에서 로드)
 * 8. Popup - template 기반 탭 Shadow DOM 팝업
 */

const { bind3DEvents, fetchData } = Wkit;
const { applyShadowPopupMixin, applyEChartsMixin, applyTabulatorMixin } = PopupMixin;

const BASE_URL = 'http://10.23.128.140:8811';

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

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. 데이터 정의 (동적 assetKey 지원)
  // ======================
  this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;

  // 현재 활성화된 데이터셋 (통합 API 사용)
  this.datasetInfo = [
    { datasetName: 'assetDetailUnified', render: ['renderAssetInfo', 'renderProperties'] },  // 통합 API: asset + properties
    // { datasetName: 'pduCircuits', render: ['renderCircuitTable'] },
    // { datasetName: 'pduHistory', render: ['renderPowerChart'] },
  ];

  // ======================
  // 2. 변환 함수 바인딩
  // ======================
  this.statusTypeToLabel = statusTypeToLabel.bind(this);
  this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this);
  this.formatDate = formatDate.bind(this);

  // ======================
  // 3. Data Config (Asset API v1 필드만 사용)
  // ======================
  // 헤더 영역 고정 필드
  this.baseInfoConfig = [
    { key: 'name', selector: '.pdu-name' },
    { key: 'locationLabel', selector: '.pdu-zone' },
    { key: 'statusType', selector: '.pdu-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.pdu-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  // 동적 필드 컨테이너 selector (Summary Bar)
  this.fieldsContainerSelector = '.summary-bar';

  // assetFieldsConfig 제거됨 - 통합 API의 properties 배열에서 동적으로 렌더링

  // ======================
  // 4. Table Config - Tabulator 옵션 빌더
  // ======================
  this.tableConfig = {
    selector: '.table-container',
    columns: [
      { title: 'ID', field: 'id', widthGrow: 0.5, hozAlign: 'right' },
      { title: 'Name', field: 'name', widthGrow: 2 },
      { title: 'Current', field: 'current', widthGrow: 1, hozAlign: 'right', formatter: (cell) => `${cell.getValue()}A` },
      { title: 'Power', field: 'power', widthGrow: 1, hozAlign: 'right', formatter: (cell) => `${cell.getValue()}kW` },
      {
        title: 'Status', field: 'status', widthGrow: 1,
        formatter: (cell) => {
          const value = cell.getValue();
          const colors = { active: '#22c55e', inactive: '#8892a0' };
          return `<span style="color: ${colors[value] || '#8892a0'}">${value}</span>`;
        },
      },
      {
        title: 'Breaker', field: 'breaker', widthGrow: 0.8,
        formatter: (cell) => {
          const value = cell.getValue();
          const color = value === 'on' ? '#22c55e' : '#ef4444';
          return `<span style="color: ${color}">${value.toUpperCase()}</span>`;
        },
      },
    ],
    optionBuilder: getTableOption,
  };

  // ======================
  // 5. Chart Config - ECharts 옵션 빌더
  // - xKey: X축 데이터 키
  // - styleMap: 시리즈별 메타데이터 + 스타일 (키는 API 응답 필드명)
  // ======================
  this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
      power: { label: '전력', unit: 'kW', color: '#3b82f6', smooth: true, areaStyle: true, yAxisIndex: 0 },
      current: { label: '전류', unit: 'A', color: '#f59e0b', smooth: true, yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
  };

  // ======================
  // 6. 렌더링 함수 바인딩
  // ======================
  this.renderAssetInfo = renderAssetInfo.bind(this);    // 자산 기본 정보 (통합 API - data.asset)
  this.renderProperties = renderProperties.bind(this);  // 동적 프로퍼티 (통합 API - data.properties[])
  this.renderCircuitTable = renderCircuitTable.bind(this, this.tableConfig);
  this.renderPowerChart = renderPowerChart.bind(this, this.chartConfig);
  this.renderError = renderError.bind(this);            // 에러 상태 렌더링

  // ======================
  // 7. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);
  this._switchTab = switchTab.bind(this);

  // ======================
  // 8. 이벤트 발행
  // ======================
  this.customEvents = {
    click: '@assetClicked',
  };

  bind3DEvents(this, this.customEvents);

  // ======================
  // 9. Template Config
  // ======================
  this.templateConfig = {
    popup: 'popup-pdu',
  };

  this.popupCreatedConfig = {
    chartSelector: '.chart-container',
    tableSelector: '.table-container',
    events: {
      click: {
        '.close-btn': () => this.hideDetail(),
        '.tab-btn': (e) => this._switchTab(e.target.dataset.tab),
      },
    },
  };

  // ======================
  // 10. Popup Setup
  // ======================
  const { htmlCode, cssCode } = this.properties.publishCode || {};

  this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
  this.getPopupStyles = () => cssCode || '';
  this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig, this.tableConfig);

  applyShadowPopupMixin(this, {
    getHTML: this.getPopupHTML,
    getStyles: this.getPopupStyles,
    onCreated: this.onPopupCreated,
  });

  applyEChartsMixin(this);
  applyTabulatorMixin(this);

  console.log('[PDU] Registered:', this._defaultAssetKey);
}

// ======================
// PUBLIC METHODS
// ======================

function showDetail() {
  this.showPopup();
  this._switchTab('circuits');

  fx.go(
    this.datasetInfo,
    fx.each(({ datasetName, render }) =>
      fx.go(
        fetchData(this.page, datasetName, { baseUrl: BASE_URL, assetKey: this._defaultAssetKey, locale: 'ko' }),
        (response) => {
          // response가 없거나 response.response가 없는 경우 에러 표시
          if (!response || !response.response) {
            this.renderError('데이터를 불러올 수 없습니다.');
            return;
          }
          // response.response.data가 null/undefined인 경우 에러 표시
          if (response.response.data === null || response.response.data === undefined) {
            this.renderError('자산 정보가 존재하지 않습니다.');
            return;
          }
          fx.each((fn) => this[fn](response), render);
        }
      )
    )
  ).catch((e) => {
    console.error('[PDU]', e);
    this.renderError('데이터 로드 중 오류가 발생했습니다.');
  });
}

// 에러 상태 렌더링
function renderError(message) {
  // 헤더 영역에 에러 표시
  const nameEl = this.popupQuery('.pdu-name');
  const zoneEl = this.popupQuery('.pdu-zone');
  const statusEl = this.popupQuery('.pdu-status');

  if (nameEl) nameEl.textContent = '데이터 없음';
  if (zoneEl) zoneEl.textContent = message;
  if (statusEl) {
    statusEl.textContent = 'Error';
    statusEl.dataset.status = 'critical';
  }

  // summary-bar에 에러 메시지 표시
  const container = this.popupQuery(this.fieldsContainerSelector);
  if (container) {
    container.innerHTML = `
      <div class="summary-item" style="grid-column: 1 / -1; text-align: center;">
        <span class="summary-label">오류</span>
        <span class="summary-value" style="color: #ef4444;">${message}</span>
      </div>
    `;
  }

  console.warn('[PDU] renderError:', message);
}

function hideDetail() {
  this.hidePopup();
}

function switchTab(tabName) {
  const buttons = this.popupQueryAll('.tab-btn');
  const panels = this.popupQueryAll('.tab-panel');

  fx.go(buttons, fx.each((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName)));
  fx.go(panels, fx.each((panel) => panel.classList.toggle('active', panel.dataset.panel === tabName)));

  // 탭 전환 시 차트/테이블 리사이즈 (초기화 완료된 경우만)
  if (tabName === 'power') {
    const chart = this.getChart('.chart-container');
    if (chart) setTimeout(() => chart.resize(), 10);
  } else if (tabName === 'circuits') {
    // Tabulator 초기화 완료 확인
    if (this.isTableReady('.table-container')) {
      const table = this.getTable('.table-container');
      setTimeout(() => table.redraw(true), 10);
    }
  }
}

// ======================
// POPUP CREATED
// ======================

function onPopupCreated(popupConfig, tableConfig) {
  const { chartSelector, tableSelector, events } = popupConfig;
  if (chartSelector) this.createChart(chartSelector);
  if (tableSelector) {
    const tableOptions = tableConfig.optionBuilder(tableConfig.columns);
    this.createTable(tableSelector, tableOptions);
  }
  if (events) this.bindPopupEvents(events);
}

// ======================
// RENDER FUNCTIONS
// ======================

// 자산 기본 정보 렌더링 (통합 API - data.asset)
function renderAssetInfo({ response }) {
  const { data } = response;
  if (!data || !data.asset) {
    renderError.call(this, '자산 데이터가 없습니다.');
    return;
  }

  const asset = data.asset;

  // 헤더 영역 고정 필드 렌더링
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

// 동적 프로퍼티 렌더링 (통합 API - data.properties[])
function renderProperties({ response }) {
  const { data } = response;
  const container = this.popupQuery(this.fieldsContainerSelector);
  if (!container) return;

  // properties가 없거나 빈 배열인 경우
  if (!data?.properties || data.properties.length === 0) {
    container.innerHTML = `
      <div class="summary-item" style="grid-column: 1 / -1; text-align: center;">
        <span class="summary-label">알림</span>
        <span class="summary-value" style="color: #6b7280;">프로퍼티 정보가 없습니다</span>
      </div>
    `;
    return;
  }

  // displayOrder로 정렬된 properties 배열을 카드로 렌더링
  const sortedProperties = [...data.properties].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  container.innerHTML = sortedProperties
    .map(({ label, value, helpText }) => {
      return `<div class="summary-item" title="${helpText || ''}">
        <span class="summary-label">${label}</span>
        <span class="summary-value">${value ?? '-'}</span>
      </div>`;
    })
    .join('');
}

// 날짜 포맷 함수
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

function renderCircuitTable(config, { response }) {
  const { data } = response;
  if (!data) {
    console.warn('[PDU] renderCircuitTable: data is null');
    return;
  }
  const circuits = data.circuits || data;
  this.updateTable(config.selector, circuits);
}

function renderPowerChart(config, { response }) {
  const { data } = response;
  if (!data) {
    console.warn('[PDU] renderPowerChart: data is null');
    return;
  }
  if (!data[config.xKey]) {
    console.warn('[PDU] renderPowerChart: chart data is incomplete');
    return;
  }
  const option = config.optionBuilder(config, data);
  this.updateChart('.chart-container', option);
}

// ======================
// STATUS TRANSFORM
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

// ======================
// TABLE OPTION BUILDER
// ======================

function getTableOption(columns) {
  return {
    layout: 'fitColumns',
    responsiveLayout: 'collapse',
    placeholder: 'No circuits found',
    initialSort: [{ column: 'power', dir: 'desc' }],
    columns,
  };
}

// ======================
// CHART OPTION BUILDER
// ======================

function getDualAxisChartOption(config, data) {
  const { xKey, styleMap } = config;

  // styleMap 기반으로 series 생성
  const seriesData = Object.entries(styleMap).map(([key, style]) => ({
    key,
    name: style.label,
    unit: style.unit,
    color: style.color,
    smooth: style.smooth,
    areaStyle: style.areaStyle,
    yAxisIndex: style.yAxisIndex,
  }));

  // yAxis 설정: styleMap의 unit 정보 활용
  const yAxisUnits = [...new Set(seriesData.map((s) => s.unit))];
  const yAxes = yAxisUnits.map((unit, idx) => ({
    type: 'value',
    name: unit,
    position: idx === 0 ? 'left' : 'right',
    axisLine: { show: true, lineStyle: { color: seriesData.find((s) => s.unit === unit)?.color || '#888' } },
    axisLabel: { color: '#888', fontSize: 10 },
    splitLine: idx === 0 ? { lineStyle: { color: '#333' } } : { show: false },
  }));

  return {
    grid: { left: 50, right: 50, top: 35, bottom: 24 },
    legend: {
      data: seriesData.map((s) => s.name),
      top: 0,
      textStyle: { color: '#8892a0', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1f2e',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: data[xKey],
      axisLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: yAxes,
    series: seriesData.map(({ key, name, color, smooth, areaStyle, yAxisIndex = 0 }) => ({
      name,
      type: 'line',
      yAxisIndex,
      data: data[key],
      smooth,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: areaStyle
        ? {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(color, 0.3) },
                { offset: 1, color: hexToRgba(color, 0) },
              ],
            },
          }
        : null,
    })),
  };
}
