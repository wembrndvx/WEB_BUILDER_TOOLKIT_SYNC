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

  // 현재 활성화된 데이터셋 (기본 정보만)
  this.datasetInfo = [
    { datasetName: 'assetDetail', render: ['renderBaseInfo'] },  // Asset API v1 - 자산 기본 정보
    // { datasetName: 'pdu', render: ['renderPDUFields'] },        // PDU 상세 필드 (추후 활성화)
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

  // fields-container에 카드로 표시할 Asset API 필드들
  this.assetFieldsConfig = [
    { key: 'assetType', label: 'Type' },
    { key: 'assetCategoryType', label: 'Category' },
    { key: 'serviceType', label: 'Service' },
    { key: 'serialNumber', label: 'Serial No.' },
    { key: 'assetModelKey', label: 'Model' },
    { key: 'installDate', label: 'Install Date', transform: this.formatDate },
    { key: 'ownerUserId', label: 'Owner' },
    { key: 'description', label: 'Description' },
  ];

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
  // - xKey, valuesKey: API 응답 구조에 맞게 수정 필요
  // - series 정보는 API response의 fields 배열에서 가져옴
  // - 색상, yAxisIndex 등 스타일 정보만 로컬에서 정의
  // ======================
  this.chartConfig = {
    xKey: 'timestamps', // ← API 응답의 x축 데이터 키
    valuesKey: 'values', // ← API 응답의 시계열 데이터 객체 키
    styleMap: {
      power: { color: '#3b82f6', smooth: true, areaStyle: true, yAxisIndex: 0 },
      current: { color: '#f59e0b', smooth: true, yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
  };

  // ======================
  // 6. 렌더링 함수 바인딩
  // ======================
  this.renderBaseInfo = renderBaseInfo.bind(this);      // 자산 기본 정보 (Asset API)
  this.renderPDUFields = renderPDUFields.bind(this);    // PDU 상세 필드
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
        fetchData(this.page, datasetName, { assetKey: this._defaultAssetKey, assetId: this._defaultAssetKey }),
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

// 자산 기본 정보 렌더링 (Asset API v1 - assetDetail)
function renderBaseInfo({ response }) {
  const { data } = response;
  if (!data) {
    renderError.call(this, '자산 데이터가 없습니다.');
    return;
  }

  // 1. 헤더 영역 고정 필드 렌더링
  fx.go(
    this.baseInfoConfig,
    fx.each(({ key, selector, dataAttr, transform }) => {
      const el = this.popupQuery(selector);
      if (!el) return;
      let value = data[key];
      if (transform) value = transform(value);
      if (dataAttr) {
        el.dataset[dataAttr] = value;
      } else {
        el.textContent = value;
      }
    })
  );

  // 2. summary-bar에 카드 형태로 Asset 필드들 렌더링
  const container = this.popupQuery(this.fieldsContainerSelector);
  if (!container || !this.assetFieldsConfig) return;

  container.innerHTML = this.assetFieldsConfig
    .map(({ key, label, transform }) => {
      let value = data[key];
      if (transform) value = transform(value);
      return `<div class="summary-item">
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

// PDU 상세 필드 렌더링 (pdu 데이터셋 - fields 배열)
function renderPDUFields({ response }) {
  const { data } = response;
  if (!data) {
    console.warn('[PDU] renderPDUFields: data is null');
    return;
  }

  const container = this.popupQuery(this.fieldsContainerSelector);
  if (!container) return;
  if (!data.fields) {
    console.warn('[PDU] renderPDUFields: fields is null');
    return;
  }

  const sortedFields = [...data.fields].sort((a, b) => (a.order || 0) - (b.order || 0));
  container.innerHTML = sortedFields
    .map(({ label, value, unit, valueLabel }) => {
      const displayValue = valueLabel ? valueLabel : unit ? `${value}${unit}` : value;
      return `<div class="summary-item">
        <span class="summary-label">${label}</span>
        <span class="summary-value">${displayValue ?? '-'}</span>
      </div>`;
    })
    .join('');
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
  if (!data.fields || !data[config.valuesKey]) {
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
  const { xKey, valuesKey, styleMap } = config;
  const { fields } = data;
  const values = data[valuesKey];

  // API fields를 기반으로 series 생성
  const seriesData = fields.map((field) => {
    const style = styleMap[field.key] || {};
    return {
      key: field.key,
      name: field.label,
      unit: field.unit,
      ...style,
    };
  });

  // yAxis 설정: fields의 unit 정보 활용
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
      data: values[key],
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
