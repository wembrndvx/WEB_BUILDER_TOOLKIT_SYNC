# PDU 컴포넌트 Config 명세

## 개요

PDU 컴포넌트는 설정(Config)을 통해 API 응답과 UI를 매핑합니다. 공통 패턴은 [UPS config.md](../../UPS/docs/config.md)를 참조하세요.

이 문서는 **PDU만의 차이점**을 중심으로 설명합니다.

---

## Config 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  PDU Component Config                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  datasetInfo          API 호출 ↔ 렌더링 함수 매핑               │
│  baseInfoConfig       헤더 영역 (asset 객체 → UI selector)      │
│  fieldsContainerSelector  동적 필드 컨테이너 (.summary-bar)     │
│  tableConfig          회로 테이블 (Tabulator) ← PDU 전용        │
│  chartConfig          차트 렌더링 설정                          │
│  templateConfig       팝업 템플릿 ID                            │
│  popupCreatedConfig   팝업 생성 후 초기화 설정                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## UPS와의 차이점

| 항목 | UPS | PDU |
|------|-----|-----|
| **fieldsContainerSelector** | `.fields-container` | `.summary-bar` |
| **카드 클래스** | `.value-card` | `.summary-item` |
| **tableConfig** | ❌ 없음 | ✅ 회로 테이블 |
| **탭 UI** | ❌ 없음 | ✅ circuits / power 탭 |
| **Mixin** | Shadow + ECharts | Shadow + ECharts + **Tabulator** |

---

## 1. baseInfoConfig

**역할**: API의 `asset` 객체 필드를 헤더 UI에 매핑

```javascript
this.baseInfoConfig = [
    { key: 'name', selector: '.pdu-name' },
    { key: 'locationLabel', selector: '.pdu-zone' },
    { key: 'statusType', selector: '.pdu-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.pdu-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
];
```

**매핑 예시**:
```
API: asset.name = "PDU 0001"       →  .pdu-name.textContent = "PDU 0001"
API: asset.locationLabel = "서버실 A"  →  .pdu-zone.textContent = "서버실 A"
API: asset.statusType = "ACTIVE"    →  .pdu-status.textContent = "Normal"
API: asset.statusType = "ACTIVE"    →  .pdu-status[data-status] = "normal"
```

---

## 2. fieldsContainerSelector

**역할**: 동적 프로퍼티가 렌더링될 컨테이너 지정

```javascript
this.fieldsContainerSelector = '.summary-bar';
```

**UPS와의 차이**: PDU는 Summary Bar 스타일 사용

```html
<!-- PDU: .summary-bar + .summary-item -->
<div class="summary-bar">
    <div class="summary-item" title="총 전력">
        <span class="summary-label">총 전력</span>
        <span class="summary-value">24.5kW</span>
    </div>
    ...
</div>

<!-- UPS: .fields-container + .value-card -->
<div class="fields-container">
    <div class="value-card" title="정격 전력">
        <div class="value-label">정격 전력</div>
        <div class="value-data">75</div>
    </div>
    ...
</div>
```

---

## 3. tableConfig (PDU 전용)

**역할**: Tabulator 회로 테이블 설정

```javascript
this.tableConfig = {
    selector: '.table-container',
    columns: [
        { title: 'ID', field: 'id', widthGrow: 0.5, hozAlign: 'right' },
        { title: 'Name', field: 'name', widthGrow: 2 },
        { title: 'Current', field: 'current', widthGrow: 1, hozAlign: 'right',
          formatter: (cell) => `${cell.getValue()}A` },
        { title: 'Power', field: 'power', widthGrow: 1, hozAlign: 'right',
          formatter: (cell) => `${cell.getValue()}kW` },
        { title: 'Status', field: 'status', widthGrow: 1,
          formatter: (cell) => { /* ... */ } },
        { title: 'Breaker', field: 'breaker', widthGrow: 0.8,
          formatter: (cell) => { /* ... */ } },
    ],
    optionBuilder: getTableOption,
};
```

| 필드 | 타입 | 설명 |
|------|------|------|
| selector | string | 테이블 렌더링 컨테이너 |
| columns | array | Tabulator 컬럼 정의 |
| optionBuilder | function | Tabulator 옵션 생성 함수 |

**왜 하드코딩인가?**

```
┌─────────────────────────────────────────────────────────────────┐
│  하드코딩의 원인: UI columns 정의 (HTML 테이블 구조 종속)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  columns는 Tabulator의 컬럼 정의이며:                           │
│  - title: 테이블 헤더 텍스트                                    │
│  - field: API 응답의 필드명                                     │
│  - formatter: 셀 렌더링 함수 (A, kW 단위 추가 등)              │
│                                                                 │
│  이 정보들은 PDU 회로 데이터의 구조와 UI 표현에 종속되어       │
│  하드코딩이 불가피합니다.                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. chartConfig

**역할**: ECharts 차트 렌더링 설정 (이중 Y축)

```javascript
this.chartConfig = {
    xKey: 'timestamps',
    valuesKey: 'values',
    styleMap: {
        power: { color: '#3b82f6', smooth: true, areaStyle: true, yAxisIndex: 0 },
        current: { color: '#f59e0b', smooth: true, yAxisIndex: 1 },
    },
    optionBuilder: getDualAxisChartOption,
};
```

**UPS와의 styleMap 차이**:

| 컴포넌트 | styleMap keys | Y축 |
|----------|--------------|-----|
| UPS | `load`, `battery` | 단일 |
| **PDU** | `power`, `current` | **이중** (kW / A) |

---

## 5. popupCreatedConfig

**역할**: 팝업 Shadow DOM 생성 후 초기화 설정

```javascript
this.popupCreatedConfig = {
    chartSelector: '.chart-container',
    tableSelector: '.table-container',   // ← PDU 전용
    events: {
        click: {
            '.close-btn': () => this.hideDetail(),
            '.tab-btn': (e) => this._switchTab(e.target.dataset.tab),  // ← 탭 전환
        },
    },
};
```

| 필드 | 타입 | 설명 |
|------|------|------|
| chartSelector | string | ECharts 인스턴스 생성 컨테이너 |
| tableSelector | string | Tabulator 인스턴스 생성 컨테이너 (PDU 전용) |
| events | object | 팝업 내 이벤트 바인딩 |

---

## 탭 UI 구조

PDU는 탭 기반 UI를 사용합니다:

```
┌─────────────────────────────────────────────────────────────────┐
│  PDU 팝업 구조                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  헤더 (baseInfoConfig)                                   │   │
│  │  name | zone | status                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Summary Bar (fieldsContainerSelector)                   │   │
│  │  전력 | 전류 | ...                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Circuits] [Power]  ← 탭 버튼                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  탭 패널 (circuits 또는 power)                          │   │
│  │  - circuits: Tabulator 테이블                           │   │
│  │  - power: ECharts 차트                                  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 참고

- [UPS config.md](../../UPS/docs/config.md) - Config 상세 명세 (공통 패턴)
- [codeflow.md](./codeflow.md) - 코드 실행 흐름

---

*최종 업데이트: 2026-01-27*
