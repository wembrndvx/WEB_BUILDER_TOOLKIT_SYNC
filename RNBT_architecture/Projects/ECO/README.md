# ECO (Energy & Cooling Operations) Dashboard

데이터센터 전력/냉방 장비 모니터링 대시보드

## 컴포넌트 구조

```
page/
├── components/
│   ├── AssetList/           # 자산 목록 (일반 2D 컴포넌트)
│   ├── UPS/                 # 무정전 전원장치 (자기완결 3D 컴포넌트)
│   ├── PDU/                 # 분전반 (자기완결 3D 컴포넌트)
│   ├── CRAC/                # 항온항습기 (자기완결 3D 컴포넌트)
│   └── TempHumiditySensor/  # 온습도 센서 (자기완결 3D 컴포넌트)
└── page_scripts/
    ├── before_load.js       # 이벤트 핸들러 등록 + 3D raycasting
    ├── loaded.js            # GlobalDataPublisher 데이터 발행
    └── before_unload.js     # 정리 (구독, 이벤트, 3D 리소스)
```

## 컴포넌트 패턴

### AssetList (일반 2D 컴포넌트)

**역할**: 자산 목록 표시, 검색/필터링 UI

**데이터 흐름**:
- GlobalDataPublisher의 `assets` topic 구독
- 페이지(loaded.js)에서 데이터 발행 → 컴포넌트가 수신하여 렌더링

**이벤트 구분**:
- **내부 이벤트**: 검색, 타입 필터, 상태 필터 (컴포넌트 자체 UI 상태 관리)
- **외부 이벤트**: 새로고침 버튼(`@refreshClicked`), 행 클릭(`@assetSelected`)

### 자기완결 3D 컴포넌트 (UPS, PDU, CRAC, TempHumiditySensor)

**역할**: 3D 모델링된 실제 장비 표현 + 상세 팝업

**특징**:
- 자기 데이터를 스스로 조회 (`fetchData`)
- Shadow DOM 팝업 생성/관리
- `showDetail(assetId?)` - 파라미터로 다른 자산도 팝업 가능

**공통 이벤트**: `@assetClicked` (모든 자기완결 컴포넌트 동일)

## 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│  Page (loaded.js)                                                │
│                                                                  │
│  globalDataMappings → GlobalDataPublisher.fetchAndPublish        │
│       ↓                                                          │
│  'hierarchy' topic 발행                                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  AssetList (subscribe)                                           │
│                                                                  │
│  구독: 'hierarchy' → renderTree()                                 │
│        'hierarchyAssets' → renderTable()                         │
│        'hierarchyChildren' → appendChildren() (Lazy Loading)     │
│                                                                  │
│  내부: 검색/필터 → 로컬 상태 변경 → 테이블 필터링                      │
│  외부: @hierarchyNodeSelected → 페이지가 hierarchyAssets 발행       │
│        행 클릭 → 타입별 API 호출 → Modal 표시                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  3D 오브젝트 클릭                                                 │
│                                                                  │
│  @assetClicked → before_load.js 핸들러                            │
│       → targetInstance.showDetail()                              │
│       → fetchData → API 응답의 fields 배열로 동적 렌더링            │
└─────────────────────────────────────────────────────────────────┘
```

## 이벤트 설계

### 핵심 원칙

```
컴포넌트는 이벤트 발송만 → 페이지가 제어권 보유 → Public API 호출
```

### 페이지 핸들러 (before_load.js)

```javascript
this.eventBusHandlers = {
    // 3D 클릭 이벤트 (모든 자기완결 컴포넌트 공통)
    '@assetClicked': ({ event, targetInstance }) => {
        targetInstance.showDetail();
    },

    // AssetList 이벤트
    '@assetSelected': ({ event, targetInstance }) => {
        // TODO: 자산 타입에 맞는 3D 인스턴스 찾아서 showDetail 호출
        console.log(event, targetInstance);
    },

    '@refreshClicked': () => {
        GlobalDataPublisher.fetchAndPublish('assets', this, this.currentParams.assets);
    }
};
```

### 내부 vs 외부 이벤트 (AssetList)

```javascript
// 내부 이벤트 - addEventListener로 직접 등록
this._internalHandlers = {
    searchInput: (e) => this.search(e.target.value),
    typeChange: (e) => this.filterByType(e.target.value),
    statusChange: (e) => this.filterByStatus(e.target.value)
};

// 외부 이벤트 - bindEvents + Weventbus.emit
this.customEvents = {
    click: { '.refresh-btn': '@refreshClicked' }
};

// 행 클릭 → 외부 이벤트 발행
Weventbus.emit('@assetSelected', { event: { asset }, targetInstance: this });
```

## Public API

### AssetList

```javascript
search(term)           // 검색어로 필터링 (내부 상태)
filterByType(type)     // 타입으로 필터링 (내부 상태)
filterByStatus(status) // 상태로 필터링 (내부 상태)
```

### 팝업 컴포넌트 (UPS, PDU, CRAC, TempHumiditySensor)

```javascript
showDetail(assetId?)   // 팝업 표시 (동적 assetId 지원)
hideDetail()           // 팝업 숨김
```

### PDU 컴포넌트 구조

PDU는 탭 UI로 Circuits(테이블) + Power History(차트)를 제공합니다.

```
PDU/
├── views/component.html    # 탭 UI 템플릿
├── styles/component.css    # 테이블/차트 컨테이너 스타일
└── scripts/
    ├── register.js         # 테이블 + 차트 초기화, 탭 전환
    └── beforeDestroy.js    # 정리
```

**datasetInfo 구성**:
```javascript
this.datasetInfo = [
    { datasetName: 'pdu', render: ['renderPDUInfo'] },
    { datasetName: 'pduCircuits', render: ['renderCircuitTable'] },
    { datasetName: 'pduHistory', render: ['renderPowerChart'] }
];
```

**Mixin 사용**:
```javascript
applyShadowPopupMixin(this, { ... });  // Shadow DOM 팝업
applyEChartsMixin(this);               // 차트
applyTabulatorMixin(this);             // 테이블
```

**렌더링 함수 바인딩 (config 부분 적용)**:

`bind(this, config)` 패턴으로 config를 함수에 미리 바인딩합니다.

```javascript
// 바인딩 시점에 config 고정
this.renderPDUInfo = renderPDUInfo.bind(this, [...this.baseInfoConfig, ...this.pduInfoConfig]);
this.renderCircuitTable = renderCircuitTable.bind(this, this.tableConfig);
this.renderPowerChart = renderPowerChart.bind(this, this.chartConfig);
this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig, this.tableConfig);

// 함수는 config를 첫 번째 인자로 받음
function renderCircuitTable(config, data) {
    const circuits = data.circuits || data;
    this.updateTable(config.selector, circuits);
}
```

장점:
- config가 함수 생성 시점에 고정되어 예측 가능
- 함수 내부에서 `this.config` 참조 불필요
- 의존성이 명시적으로 드러남

## 실전 적용 시 고려사항

### 해결된 이슈

**PopupMixin의 Tabulator 초기화 타이밍 (해결됨)**

문제: `switchTab()` 호출 시 Tabulator가 아직 빌드되지 않아 `table.redraw()` 에러 발생

```
Cannot read properties of null (reading 'offsetWidth')
```

해결:
1. `tableBuilt` 이벤트로 초기화 완료 감지
2. `isTableReady(selector)` 메서드 추가
3. `switchTab()`에서 `isTableReady()` 체크 후 `redraw()` 호출

```javascript
// PopupMixin.js - 초기화 상태 추적
const tableState = { initialized: false };
table.on('tableBuilt', () => {
    tableState.initialized = true;
});

// register.js - 탭 전환 시 체크
if (this.isTableReady('.table-container')) {
    const table = this.getTable('.table-container');
    setTimeout(() => table.redraw(true), 10);
}
```

**Tabulator height: 100% CSS 덮어쓰기 (해결됨)**

문제: Tabulator JS 옵션의 `height: '100%'`가 CSS `height: 280px`를 덮어씀

원인: Tabulator는 JS 옵션으로 인라인 스타일을 설정하므로 CSS보다 우선순위가 높음

해결: PopupMixin의 `defaultOptions`와 컴포넌트의 `getTableOption()`에서 `height` 옵션 제거

```javascript
// 제거됨
const defaultOptions = {
    layout: 'fitColumns',
    responsiveLayout: 'collapse',
    // height: '100%'  ← 제거
};
```

### 점검 필요 사항

**AssetList 퍼포먼스 최적화**
- Lazy Loading: 스크롤 시 데이터 로드
- CSS `content-visibility`: 화면 밖 요소 렌더링 스킵
- API 분할 (Pagination): 대용량 자산 목록 대응

### 현재 Mock 환경

- Mock Server가 ID를 받아서 랜덤 데이터 반환
- 인터페이스만 유지하면 실제 API로 교체 가능

### Asset ID 매핑 문제

**현재**: 3D 인스턴스가 임시 ID 사용 (예: "UPS-001")
**실전**: 실제 Asset ID 사용 (예: "asset_12345")

**해결 방향**: 3D 인스턴스가 assetId를 속성으로 보유

```javascript
// 3D 인스턴스
instance.userData.assetId = "asset_12345";

// 3D 클릭 시
instance.showDetail();  // this.userData.assetId로 fetchData

// AssetList 클릭 시
const instance = findInstanceByAssetId(assetId);
instance.showDetail();  // 파라미터 불필요
```

**장점**:
- 인스턴스가 자신의 assetId를 알고 있음 (캡슐화)
- showDetail()이 메소드로서 파라미터 불필요
- Asset 정보에 instanceId를 추가할 필요 없음 (단방향 참조)

### AssetList → 3D 인스턴스 연결

```javascript
// before_load.js
'@assetSelected': ({ event }) => {
    const { asset } = event;
    const instance = findInstanceByAssetId(asset.id);
    if (instance) {
        instance.showDetail();
    } else {
        // 3D에 표현되지 않은 자산 처리
    }
}

function findInstanceByAssetId(assetId) {
    // 씬 순회하며 userData.assetId 일치하는 인스턴스 반환
}
```

## 실행

```bash
cd mock_server
npm install
npm start  # port 4004
```

## API 엔드포인트

| 엔드포인트 | 설명 |
|------------|------|
| GET /api/hierarchy?depth=n&locale=ko | 계층 트리 (depth 제한, i18n) |
| GET /api/hierarchy/:nodeId/children | 노드 하위 자산 (Lazy Loading) |
| GET /api/hierarchy/:nodeId/assets | 노드 하위 전체 자산 (테이블용) |
| GET /api/ups/:id?locale=ko | UPS 상태 + fields 메타데이터 |
| GET /api/ups/:id/history | UPS 부하/배터리 히스토리 |
| GET /api/pdu/:id?locale=ko | PDU 상태 + fields 메타데이터 |
| GET /api/pdu/:id/circuits | PDU 회로 목록 |
| GET /api/pdu/:id/history | PDU 전력 히스토리 |
| GET /api/crac/:id?locale=ko | CRAC 상태 + fields 메타데이터 |
| GET /api/crac/:id/history | CRAC 온습도 히스토리 |
| GET /api/sensor/:id?locale=ko | 센서 상태 + fields 메타데이터 |
| GET /api/sensor/:id/history | 센서 온습도 히스토리 |

### 자산 상세 API 응답 구조 (fields 메타데이터)

자산 상세 API는 `fields` 배열로 필드 메타정보를 제공합니다:

```json
{
  "data": {
    "id": "ups-001",
    "name": "UPS 0001",
    "status": "normal",
    "statusLabel": "정상",
    "fields": [
      { "key": "load", "label": "부하율", "value": 75, "unit": "%", "order": 1 },
      { "key": "batteryLevel", "label": "배터리 잔량", "value": 90, "unit": "%", "order": 2 },
      { "key": "mode", "label": "운전 모드", "value": "online", "valueLabel": "온라인", "order": 3 }
    ]
  }
}
```

컴포넌트는 이 `fields` 배열을 동적으로 렌더링하여 하드코딩 없이 다국어를 지원합니다.
