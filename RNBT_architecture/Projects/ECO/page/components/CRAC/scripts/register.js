/**
 * CRAC (Computer Room Air Conditioning) - 3D Popup Component
 *
 * 항온항습기 컴포넌트
 * - 급기/환기 온도, 습도 실시간 표시
 * - 온습도 히스토리 차트 (듀얼 Y축: 온도/습도)
 */

const { bind3DEvents, fetchData } = Wkit;
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

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
    // { datasetName: 'cracHistory', render: ['renderChart'] },    // 차트 (추후 활성화)
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
    { key: 'name', selector: '.crac-name' },
    { key: 'locationLabel', selector: '.crac-zone' },
    { key: 'statusType', selector: '.crac-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.crac-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
  ];

  // 동적 필드 컨테이너 selector
  this.fieldsContainerSelector = '.fields-container';

  // assetFieldsConfig 제거됨 - 통합 API의 properties 배열에서 동적으로 렌더링

  // chartConfig: 차트 렌더링 설정
  // - xKey: X축 데이터 키
  // - styleMap: 시리즈별 메타데이터 + 스타일 (키는 API 응답 필드명)
  this.chartConfig = {
    xKey: 'timestamps',
    styleMap: {
      supplyTemp: { label: '공급 온도', unit: '°C', color: '#3b82f6', yAxisIndex: 0 },
      returnTemp: { label: '환기 온도', unit: '°C', color: '#ef4444', yAxisIndex: 0 },
      humidity: { label: '습도', unit: '%', color: '#22c55e', yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
  };

  // ======================
  // 4. 렌더링 함수 바인딩
  // ======================
  this.renderAssetInfo = renderAssetInfo.bind(this);    // 자산 기본 정보 (통합 API - data.asset)
  this.renderProperties = renderProperties.bind(this);  // 동적 프로퍼티 (통합 API - data.properties[])
  this.renderChart = renderChart.bind(this, this.chartConfig);
  this.renderError = renderError.bind(this);            // 에러 상태 렌더링

  // ======================
  // 5. Public Methods
  // ======================
  this.showDetail = showDetail.bind(this);
  this.hideDetail = hideDetail.bind(this);

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
    popup: 'popup-crac',
  };

  // ======================
  // 8. Popup (template 기반)
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
    console.error('[CRAC]', e);
    this.renderError('데이터 로드 중 오류가 발생했습니다.');
  });
}

// 에러 상태 렌더링
function renderError(message) {
  // 헤더 영역에 에러 표시
  const nameEl = this.popupQuery('.crac-name');
  const zoneEl = this.popupQuery('.crac-zone');
  const statusEl = this.popupQuery('.crac-status');

  if (nameEl) nameEl.textContent = '데이터 없음';
  if (zoneEl) zoneEl.textContent = message;
  if (statusEl) {
    statusEl.textContent = 'Error';
    statusEl.dataset.status = 'critical';
  }

  // fields-container에 에러 메시지 표시
  const container = this.popupQuery(this.fieldsContainerSelector);
  if (container) {
    container.innerHTML = `
      <div class="value-card" style="grid-column: 1 / -1; text-align: center;">
        <div class="value-label">오류</div>
        <div class="value-data" style="font-size: 14px; color: #ef4444;">${message}</div>
      </div>
    `;
  }

  console.warn('[CRAC] renderError:', message);
}

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
      <div class="value-card" style="grid-column: 1 / -1; text-align: center;">
        <div class="value-label">알림</div>
        <div class="value-data" style="font-size: 14px; color: #6b7280;">프로퍼티 정보가 없습니다</div>
      </div>
    `;
    return;
  }

  // displayOrder로 정렬된 properties 배열을 카드로 렌더링
  const sortedProperties = [...data.properties].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  container.innerHTML = sortedProperties
    .map(({ label, value, helpText }) => {
      return `<div class="value-card" title="${helpText || ''}">
        <div class="value-label">${label}</div>
        <div class="value-data">${value ?? '-'}</div>
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

function renderChart(config, { response }) {
  const { data } = response;
  if (!data) {
    console.warn('[CRAC] renderChart: data is null');
    return;
  }
  if (!data[config.xKey]) {
    console.warn('[CRAC] renderChart: chart data is incomplete');
    return;
  }
  const { optionBuilder, ...chartConfig } = config;
  const option = optionBuilder(chartConfig, data);
  this.updateChart('.chart-container', option);
}

function hideDetail() {
  this.hidePopup();
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
    yAxisIndex: style.yAxisIndex,
  }));

  // yAxis 설정: styleMap의 unit 정보 활용
  const yAxisUnits = [...new Set(seriesData.map((s) => s.unit))];
  const yAxes = yAxisUnits.map((unit, idx) => ({
    type: 'value',
    name: unit,
    position: idx === 0 ? 'left' : 'right',
    axisLine: { show: true, lineStyle: { color: '#333' } },
    axisLabel: { color: '#888', fontSize: 10 },
    splitLine: { lineStyle: { color: idx === 0 ? '#333' : 'transparent' } },
  }));

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 31, 46, 0.95)',
      borderColor: '#2a3142',
      textStyle: { color: '#e0e6ed', fontSize: 12 },
    },
    legend: {
      data: seriesData.map((s) => s.name),
      top: 8,
      textStyle: { color: '#8892a0', fontSize: 11 },
    },
    grid: {
      left: 50,
      right: 50,
      top: 40,
      bottom: 24,
    },
    xAxis: {
      type: 'category',
      data: data[xKey],
      axisLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: yAxes,
    series: seriesData.map(({ key, name, color, yAxisIndex = 0 }) => ({
      name,
      type: 'line',
      yAxisIndex,
      data: data[key],
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: hexToRgba(color, 0.2) },
            { offset: 1, color: hexToRgba(color, 0) },
          ],
        },
      },
    })),
  };
}

// ======================
// POPUP LIFECYCLE
// ======================

function onPopupCreated({ chartSelector, events }) {
  chartSelector && this.createChart(chartSelector);
  events && this.bindPopupEvents(events);
}
