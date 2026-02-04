# UPS 컴포넌트 코드 흐름

## 개요

UPS(Uninterruptible Power Supply) 컴포넌트는 3D 환경에서 사용되는 **팝업 컴포넌트(Component With Popup)**입니다.

**기획서 v.0.8_260128 기준:**
- ① 기본정보 테이블 (assetDetailUnified + mdl/g + vdr/g 체이닝)
- ② UPS 전력현황 4카드 (metricLatest, 5초 갱신)
- ③ UPS 입/출력 추이 3탭 트렌드 차트 (전류/전압/주파수)

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  UPS Component With Popup                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Shadow DOM  │    │  ECharts    │    │  fetchData  │         │
│  │   Popup     │    │   Mixin     │    │   (API)     │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         └──────────┬───────┴──────────┬──────┘                 │
│                    │                  │                         │
│              ┌─────▼─────┐      ┌─────▼─────┐                  │
│              │  Popup UI │      │   Chart   │                  │
│              │  Render   │      │  Render   │                  │
│              └───────────┘      └───────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 적용 Mixin

| Mixin | 역할 |
|-------|------|
| `applyShadowPopupMixin` | Shadow DOM 팝업 생성/관리, 이벤트 바인딩 |
| `applyEChartsMixin` | ECharts 차트 인스턴스 관리, 리사이즈 핸들링 |

---

## initComponent 섹션 구조

| 섹션 | 내용 |
|------|------|
| 1. 내부 상태 | `_defaultAssetKey`, `_baseUrl`, `_trendData`, `_activeTab`, `_refreshIntervalId` |
| 2. 변환 함수 바인딩 | `statusTypeToLabel`, `statusTypeToDataAttr`, `formatDate`, `formatTimestamp` |
| 3. Config 통합 | `this.config` 객체 정의 (아래 Config 구조 참조) |
| 4. 데이터셋 정의 | `this.datasetInfo` 배열 정의 |
| 5. 렌더링 함수 바인딩 | `renderBasicInfo`, `renderPowerStatus`, `renderTrendChart` |
| 6. Public Methods | `showDetail`, `hideDetail`, `refreshMetrics`, `stopRefresh`, `_switchTab` |
| 7. 3D 이벤트 바인딩 | `this.customEvents` + `bind3DEvents()` |
| 8. Popup | `applyShadowPopupMixin()` + `applyEChartsMixin()` |

---

## Config 구조 (this.config)

```javascript
this.config = {
  // 데이터셋 이름
  datasetNames: {
    assetDetail: 'assetDetailUnified',
    metricLatest: 'metricLatest',
    metricHistory: 'metricHistoryStats',
    modelDetail: 'modelDetail',
    vendorDetail: 'vendorDetail',
  },

  // 템플릿
  template: { popup: 'popup-ups' },

  // 갱신 주기
  refresh: { interval: 5000 },

  // API 엔드포인트 및 파라미터
  api: {
    trendHistory: '/api/v1/mhs/l',
    trendParams: {
      interval: '1h',
      metricCodes: [...],
      statsKeys: ['avg'],
      timeRangeMs: 24 * 60 * 60 * 1000,
    },
  },

  // 상태 매핑
  statusMap: { labels: {...}, dataAttrs: {...}, defaultDataAttr: 'normal' },

  // UI 영역별 설정
  header: { fields: [...] },
  infoTable: { fields: [...], chain: { model, vendor } },
  powerStatus: { metrics: {...}, selectors: {...} },
  chart: { tabs: {...}, series: {...}, selectors: {...} },
};
```

---

## 코드 흐름

### 1. 초기화 (register.js 로드)

```
┌─────────────────────────────────────────────────────────────────┐
│  register.js 실행                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 내부 상태 초기화                                            │
│     └─→ _defaultAssetKey, _baseUrl, _trendData, _activeTab     │
│                                                                 │
│  2. 변환 함수 바인딩                                            │
│     └─→ statusTypeToLabel, formatDate 등                       │
│                                                                 │
│  3. this.config 정의                                            │
│     └─→ datasetNames, api, statusMap, header, infoTable, ...  │
│                                                                 │
│  4. this.datasetInfo 정의                                       │
│     └─→ assetDetail, metricLatest, metricHistory               │
│                                                                 │
│  5. 렌더링 함수 바인딩                                          │
│     └─→ renderBasicInfo, renderPowerStatus, renderTrendChart   │
│                                                                 │
│  6. Public Methods 바인딩                                       │
│     └─→ showDetail, hideDetail, refreshMetrics, stopRefresh    │
│                                                                 │
│  7. 3D 이벤트 바인딩                                            │
│     └─→ customEvents.click = '@assetClicked'                   │
│     └─→ bind3DEvents(this, this.customEvents)                  │
│                                                                 │
│  8. Popup Mixin 적용                                            │
│     └─→ applyShadowPopupMixin(this, {...})                     │
│     └─→ applyEChartsMixin(this)                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 3D 클릭 → showDetail()

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자가 3D UPS 클릭                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. bind3DEvents에서 등록한 click 이벤트 발생                   │
│     └─→ customEvents.click = '@assetClicked' 발행              │
│                                                                 │
│  2. Page의 @assetClicked 핸들러 호출                            │
│     └─→ targetInstance.showDetail()                            │
│                                                                 │
│  3. showDetail() 내부:                                          │
│     ├─→ this.showPopup() (Shadow DOM 팝업 표시)                │
│     │                                                           │
│     ├─→ assetDetailUnified 호출                                │
│     │     └─→ renderBasicInfo()                                │
│     │           ├─→ header 영역 렌더링                         │
│     │           ├─→ infoTable 영역 렌더링                      │
│     │           └─→ fetchModelVendorChain() (체이닝)           │
│     │                                                           │
│     ├─→ metricLatest 호출                                      │
│     │     └─→ renderPowerStatus() (4카드)                      │
│     │                                                           │
│     ├─→ fetchTrendData() (mhs/l API 직접 호출)                 │
│     │     └─→ renderTrendChart() (3탭 차트)                    │
│     │                                                           │
│     └─→ setInterval(refreshMetrics, 5000) 시작                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. 기본정보 렌더링 (renderBasicInfo)

API 응답의 `data.asset` 객체를 헤더 + 테이블 영역에 렌더링:

```javascript
function renderBasicInfo({ response }) {
  const asset = response.data.asset;
  const { header, infoTable, datasetNames } = this.config;

  // Header 영역 (config.header.fields 순회)
  fx.go(header.fields, fx.each(field => renderField(this, asset, field)));

  // 기본정보 테이블 (config.infoTable.fields 순회)
  fx.go(infoTable.fields, fx.each(field => renderField(this, asset, field)));

  // 제조사/모델 체이닝
  if (asset.assetModelKey) {
    fetchModelVendorChain(assetModelKey, infoTable.chain, datasetNames);
  }
}
```

**매핑 결과:**
```
API: asset.name = "UPS-A01"         →  .ups-name.textContent = "UPS-A01"
API: asset.locationLabel = "2층"    →  .ups-zone.textContent = "2층"
API: asset.statusType = "ACTIVE"    →  .ups-status.textContent = "정상운영"
API: asset.statusType = "ACTIVE"    →  .ups-status[data-status] = "normal"
```

### 4. 전력현황 렌더링 (renderPowerStatus)

API 응답의 `data[]` 배열을 4카드에 렌더링:

```javascript
function renderPowerStatus({ response }) {
  const { powerStatus } = this.config;
  const { metrics, selectors } = powerStatus;

  // 메트릭 코드 → 값 매핑
  const metricMap = fx.reduce((acc, m) => {
    acc[m.metricCode] = m.valueNumber;
    return acc;
  }, {}, data);

  // 각 카드 업데이트 (config.powerStatus.metrics 순회)
  fx.go(
    Object.entries(metrics),
    fx.each(([key, cfg]) => updatePowerCard(this, selectors, metricMap, key, cfg))
  );
}
```

**매핑 결과:**
```
API: UPS.BATT_PCT = 85    →  [data-metric="batterySoc"] .power-card-value = "85.0"
API: UPS.LOAD_PCT = 45    →  [data-metric="loadRate"] .power-card-value = "45.0"
API: UPS.BATT_V = 5400    →  [data-metric="batteryVolt"] .power-card-value = "540.0"
```

### 5. 트렌드 차트 렌더링 (renderTrendChart)

API 응답의 시계열 데이터를 탭별 듀얼 라인 차트로 렌더링:

```javascript
function renderTrendChart({ response }) {
  const { chart } = this.config;
  const tabConfig = chart.tabs[this._activeTab];

  // 시간별 그룹핑
  const timeMap = fx.reduce((acc, row) => {
    const hour = new Date(row.time).getHours() + '시';
    acc[hour][row.metricCode] = row.statsBody.avg;
    return acc;
  }, {}, data);

  // ECharts 옵션 생성 후 업데이트
  this.updateChart(chart.selectors.container, option);
}
```

### 6. 메트릭 자동 갱신 (refreshMetrics)

5초마다 metricLatest API를 호출하여 전력현황 4카드 갱신:

```
showDetail()
    │
    └─→ setInterval(refreshMetrics, 5000)
            │
            └─→ fetchData(metricLatest)
                    │
                    └─→ renderPowerStatus()
```

---

## Public Methods

| 메서드 | 설명 |
|--------|------|
| `showDetail()` | 팝업 표시 + 데이터 로드 + 갱신 시작 |
| `hideDetail()` | 갱신 중지 + 팝업 숨김 |
| `refreshMetrics()` | metricLatest 갱신 |
| `stopRefresh()` | 갱신 interval 중지 |
| `_switchTab(tabName)` | 트렌드 차트 탭 전환 |

---

## 이벤트 흐름

### 발행 이벤트

| 이벤트 | 발행 시점 | 설정 위치 |
|--------|----------|-----------|
| `@assetClicked` | 3D 클릭 시 | `customEvents.click` |

### 팝업 내부 이벤트

| 이벤트 | 대상 | 핸들러 |
|--------|------|--------|
| click | `.close-btn` | `hideDetail()` |
| click | `.tab-btn` | `_switchTab(tabName)` |

---

## 데이터 흐름 다이어그램

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌────────────┐
│ 3D Click │────▶│ showDetail│────▶│ fetchData()  │────▶│   Server   │
└──────────┘     └───────────┘     └──────────────┘     └────────────┘
                                          │                    │
                                          │  assetDetailUnified│
                                          │  metricLatest      │
                                          │  mhs/l (trend)     │
                                          │◀───────────────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
                  ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
                  │renderBasic│     │renderPower│     │renderTrend│
                  │   Info    │     │  Status   │     │   Chart   │
                  └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
                        │                 │                 │
                  ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
                  │ 헤더+테이블│     │  4카드    │     │ 3탭 차트  │
                  └───────────┘     └───────────┘     └───────────┘
```

---

## 파일 구조

```
UPS/
├── docs/
│   └── codeflow.md     # 이 문서
├── scripts/
│   ├── register.js     # 메인 로직
│   └── beforeDestroy.js # 정리 (팝업 제거, interval 중지)
├── styles/
│   └── component.css   # 팝업 스타일
├── views/
│   └── component.html  # 팝업 템플릿
└── preview.html        # 단독 테스트 페이지
```

---

## 참고

- [Shadow Popup Mixin](/RNBT_architecture/Utils/Mixins/ShadowPopupMixin.js)
- [ECharts Mixin](/RNBT_architecture/Utils/Mixins/EChartsMixin.js)
- [DEFAULT_JS_NAMING.md](/RNBT_architecture/docs/DEFAULT_JS_NAMING.md)

---

*최종 업데이트: 2026-02-04*
