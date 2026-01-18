# PDU 컴포넌트 코드 흐름

## 개요

PDU(Power Distribution Unit) 컴포넌트는 3D 환경에서 사용되는 **팝업 컴포넌트(Component With Popup)**입니다. Shadow DOM 팝업을 통해 PDU 상세 정보, 회로 테이블, 히스토리 차트를 **탭 UI**로 표시합니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  PDU Component With Popup                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │ Shadow DOM  │  │  Tabulator  │  │  ECharts    │  │fetchData││
│  │   Popup     │  │   Mixin     │  │   Mixin     │  │  (API)  ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘│
│         │                │                │              │      │
│         └────────┬───────┴────────┬───────┴──────┬──────┘      │
│                  │                │              │              │
│           ┌──────▼──────┐  ┌──────▼──────┐ ┌─────▼─────┐       │
│           │   Tab UI    │  │   Circuit   │ │   Power   │       │
│           │  (탭 전환)   │  │   Table     │ │   Chart   │       │
│           └─────────────┘  └─────────────┘ └───────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 적용 Mixin

| Mixin | 역할 |
|-------|------|
| `applyShadowPopupMixin` | Shadow DOM 팝업 생성/관리, 외부 클릭 닫기, 드래그 |
| `applyTabulatorMixin` | Tabulator 테이블 인스턴스 관리 |
| `applyEChartsMixin` | ECharts 차트 인스턴스 관리, 리사이즈 핸들링 |

---

## 주요 설정

### datasetInfo

API 호출과 렌더링 함수를 매핑합니다.

```javascript
this.datasetInfo = [
    {
        name: 'pdu',           // 현재 상태
        renderFn: 'renderStatus',
        params: { assetId: this.id }
    },
    {
        name: 'pduCircuits',   // 회로 목록
        renderFn: 'renderCircuits',
        params: { assetId: this.id }
    },
    {
        name: 'pduHistory',    // 히스토리 차트
        renderFn: 'renderChart',
        params: { assetId: this.id }
    }
];
```

### baseInfoConfig

기본 정보 필드와 DOM 셀렉터 매핑:

```javascript
this.baseInfoConfig = [
    { key: 'name', selector: '.pdu-name' },
    { key: 'typeLabel', selector: '.pdu-type' },
    { key: 'id', selector: '.pdu-id' },
    { key: 'statusLabel', selector: '.pdu-status' }
];
```

### fieldsContainerSelector

동적 필드가 렌더링될 컨테이너:

```javascript
this.fieldsContainerSelector = '.fields-container';
```

### tableConfig

Tabulator 테이블 설정 (회로 목록):

```javascript
this.tableConfig = {
    containerSelector: '.circuits-table',
    height: '200px',
    columns: [
        { title: 'ID', field: 'id', width: 80 },
        { title: 'Name', field: 'name', widthGrow: 1 },
        { title: 'Current', field: 'current', width: 80 },
        { title: 'Power', field: 'power', width: 80 },
        { title: 'Status', field: 'statusLabel', width: 80 }
    ]
};
```

### chartConfig

ECharts 차트 설정:

```javascript
this.chartConfig = {
    containerSelector: '.chart-container',
    height: '200px',
    option: {
        xAxis: { type: 'category', data: [] },
        yAxis: [
            { type: 'value', name: 'Power (kW)' },
            { type: 'value', name: 'Current (A)' }
        ],
        series: [
            { type: 'line', data: [], yAxisIndex: 0 },
            { type: 'line', data: [], yAxisIndex: 1 }
        ]
    }
};
```

---

## 탭 UI 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  PDU-0001                                          [X]          │
│  PDU · pdu-0001                                                 │
├────────────┬────────────┬────────────────────────────────────────┤
│  [Status]  │ [Circuits] │ [History]                             │
├────────────┴────────────┴────────────────────────────────────────┤
│                                                                  │
│  (탭에 따라 다른 콘텐츠 표시)                                      │
│                                                                  │
│  Status: 동적 필드 그리드                                         │
│  Circuits: Tabulator 테이블                                      │
│  History: ECharts 차트                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 코드 흐름

### 1. 초기화 (register.js 로드)

```
┌─────────────────────────────────────────────────────────────────┐
│  register.js 실행                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. datasetInfo 정의 (pdu, pduCircuits, pduHistory)             │
│  2. baseInfoConfig 정의                                         │
│  3. fieldsContainerSelector 정의                                │
│  4. tableConfig 정의 (회로 테이블)                               │
│  5. chartConfig 정의                                            │
│  6. applyShadowPopupMixin(this) 적용                            │
│  7. applyTabulatorMixin(this) 적용                              │
│  8. applyEChartsMixin(this) 적용                                │
│  9. 탭 전환 이벤트 바인딩                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 3D 클릭 → showDetail()

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자가 3D PDU 클릭                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Page의 @assetClicked 핸들러 호출                            │
│     └─→ targetInstance.showDetail()                            │
│                                                                 │
│  2. showDetail() 내부:                                          │
│     ├─→ _showPopup() (Shadow DOM 팝업 표시)                     │
│     ├─→ _initTabs() (탭 UI 초기화)                              │
│     ├─→ fetchData('pdu', params)                               │
│     │       └─→ renderStatus() 호출                            │
│     ├─→ fetchData('pduCircuits', params)                       │
│     │       └─→ renderCircuits() 호출                          │
│     └─→ fetchData('pduHistory', params)                        │
│             └─→ renderChart() 호출                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. 탭 전환 (switchTab)

```javascript
switchTab(tabName) {
    // 1. 탭 버튼 활성화 상태 변경
    this._popupRoot.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 2. 탭 콘텐츠 표시/숨김
    this._popupRoot.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.tab === tabName);
    });

    // 3. 차트 리사이즈 (History 탭일 때)
    if (tabName === 'history' && this._chart) {
        this._chart.resize();
    }

    // 4. 테이블 리레이아웃 (Circuits 탭일 때)
    if (tabName === 'circuits' && this._table) {
        this._table.redraw();
    }
}
```

### 4. 상태 렌더링 (renderStatus)

```javascript
renderStatus({ response }) {
    const { data } = response;

    // 1. 기본 정보 렌더링
    this.baseInfoConfig.forEach(({ key, selector }) => {
        const el = this._popupRoot.querySelector(selector);
        if (el && data[key] !== undefined) {
            el.textContent = data[key];
        }
    });

    // 2. 상태에 따른 스타일 적용
    this._applyStatusStyle(data.status);

    // 3. 동적 필드 렌더링 (API fields 배열 사용)
    this._renderFields(data.fields);
}
```

### 5. 회로 테이블 렌더링 (renderCircuits)

```javascript
renderCircuits({ response }) {
    const { data } = response;
    const { circuits = [] } = data;

    // Tabulator 데이터 설정
    this._table.setData(circuits);
}
```

### 6. 차트 렌더링 (renderChart)

```javascript
renderChart({ response }) {
    const { data } = response;
    const { history = [] } = data;

    // ECharts 옵션 업데이트 (이중 Y축)
    this._chart.setOption({
        xAxis: {
            data: history.map(h => h.timestamp)
        },
        series: [
            { data: history.map(h => h.power) },   // Power (kW)
            { data: history.map(h => h.current) }  // Current (A)
        ]
    });
}
```

---

## 이벤트 흐름

### 발행 이벤트

| 이벤트 | 발행 시점 | Payload |
|--------|----------|---------|
| `@assetClicked` | 3D 클릭 시 (Page에서 처리) | `{ event, targetInstance }` |

### 탭 클릭 이벤트

```
탭 버튼 클릭
    │
    └─→ click 이벤트 핸들러
            │
            └─→ switchTab(tabName)
                    │
                    ├─→ 탭 UI 업데이트
                    └─→ 차트/테이블 리사이즈
```

---

## Public Methods

| 메서드 | 설명 |
|--------|------|
| `showDetail()` | 팝업 표시 + 데이터 로드 |
| `hideDetail()` | 팝업 숨김 + 리소스 정리 |
| `renderStatus({ response })` | 상태 정보 렌더링 |
| `renderCircuits({ response })` | 회로 테이블 렌더링 |
| `renderChart({ response })` | 히스토리 차트 렌더링 |
| `switchTab(tabName)` | 탭 전환 |

---

## 데이터 흐름 다이어그램

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌────────────┐
│ 3D Click │────▶│ showDetail│────▶│ fetchData()  │────▶│ Mock Server│
└──────────┘     └───────────┘     └──────────────┘     └────────────┘
                      │                   │                    │
                      │                   │    API Response    │
                      ▼                   │◀───────────────────┘
                 _initTabs()              │
                      │            ┌──────▼──────┐
                      │            │ datasetInfo │
                      │            │   매핑      │
                      │            └──────┬──────┘
                      │                   │
                      │     ┌─────────────┼─────────────┐
                      │     │             │             │
                      │ ┌───▼───┐   ┌─────▼─────┐ ┌─────▼─────┐
                      │ │render │   │render     │ │render     │
                      │ │Status │   │Circuits   │ │Chart      │
                      │ └───┬───┘   └─────┬─────┘ └─────┬─────┘
                      │     │             │             │
                      │ ┌───▼───┐   ┌─────▼─────┐ ┌─────▼─────┐
                      │ │Fields │   │Tabulator  │ │ECharts    │
                      │ │Update │   │setData()  │ │setOption()│
                      │ └───────┘   └───────────┘ └───────────┘
                      │
                 ┌────▼────┐
                 │Tab Click│
                 └────┬────┘
                      │
                 ┌────▼────┐
                 │switchTab│
                 └─────────┘
```

---

## 파일 구조

```
PDU/
├── docs/
│   └── codeflow.md          # 이 문서
├── scripts/
│   ├── register.js          # 메인 로직 (탭 UI 포함)
│   └── beforeDestroy.js     # 정리 (팝업, 테이블, 차트 파괴)
├── styles/
│   └── component.css        # 팝업 + 탭 스타일
├── views/
│   └── component.html       # 3D 모델 컨테이너
└── README.md
```

---

## UPS와의 차이점

| 항목 | UPS | PDU |
|------|-----|-----|
| 탭 UI | X | O (Status/Circuits/History) |
| Tabulator 테이블 | X | O (회로 목록) |
| 차트 Y축 | 단일 (Load) | 이중 (Power/Current) |
| datasetInfo | 2개 | 3개 |

---

## 참고

- [Shadow Popup Mixin](../../../Utils/Mixins/ShadowPopupMixin.js)
- [Tabulator Mixin](../../../Utils/Mixins/TabulatorMixin.js)
- [ECharts Mixin](../../../Utils/Mixins/EChartsMixin.js)
- [API 명세](../../../API_SPEC.md)
- [다국어 명세](../../../I18N_SPEC.md)

---

*최종 업데이트: 2026-01-15*
