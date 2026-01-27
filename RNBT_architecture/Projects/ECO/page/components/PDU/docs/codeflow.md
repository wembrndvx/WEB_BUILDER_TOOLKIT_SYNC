# PDU 컴포넌트 코드 흐름

## 개요

PDU(Power Distribution Unit) 컴포넌트는 3D 환경에서 사용되는 **팝업 컴포넌트(Component With Popup)**입니다. Shadow DOM 팝업을 통해 PDU 상세 정보, 회로 테이블, 히스토리 차트를 **탭 UI**로 표시합니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  PDU Component With Popup                                       │
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

상세 내용은 UPS의 [config.md](../../UPS/docs/config.md) 참조 (동일 패턴)

| Config | 역할 |
|--------|------|
| `datasetInfo` | API 호출 ↔ 렌더링 함수 매핑 |
| `baseInfoConfig` | asset 객체 → 헤더 UI 매핑 |
| `fieldsContainerSelector` | 동적 필드 컨테이너 (`.summary-bar`) |
| `tableConfig` | Tabulator 테이블 설정 |
| `chartConfig` | 차트 렌더링 설정 (이중 Y축) |
| `templateConfig` | 팝업 템플릿 ID |
| `popupCreatedConfig` | 팝업 생성 후 초기화 |

---

## 코드 흐름

### 1. 초기화 (register.js 로드)

```
┌─────────────────────────────────────────────────────────────────┐
│  register.js 실행                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. _defaultAssetKey 설정 (setter.assetInfo.assetKey || id)     │
│  2. datasetInfo 정의 (assetDetailUnified)                       │
│  3. 변환 함수 바인딩 (statusTypeToLabel, formatDate 등)         │
│  4. baseInfoConfig 정의 (name, locationLabel, statusType)       │
│  5. fieldsContainerSelector 정의 (.summary-bar)                 │
│  6. tableConfig 정의 (회로 테이블)                               │
│  7. chartConfig 정의 (이중 Y축)                                  │
│  8. 렌더링 함수 바인딩 (renderAssetInfo, renderProperties 등)   │
│  9. customEvents 정의 + bind3DEvents 호출                       │
│  10. templateConfig 정의                                        │
│  11. popupCreatedConfig 정의 (탭 이벤트 포함)                   │
│  12. applyShadowPopupMixin(this) 적용                           │
│  13. applyEChartsMixin(this) 적용                               │
│  14. applyTabulatorMixin(this) 적용                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 3D 클릭 → showDetail()

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자가 3D PDU 클릭                                           │
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
│     ├─→ this._switchTab('circuits') (기본 탭 설정)             │
│     │                                                           │
│     └─→ fx.go(this.datasetInfo, ...) 실행                      │
│             │                                                   │
│             └─→ 각 datasetInfo에 대해:                          │
│                     │                                           │
│                     ├─→ fetchData(page, datasetName, params)   │
│                     │       params: { assetKey, locale: 'ko' } │
│                     │                                           │
│                     └─→ 응답 처리:                              │
│                             ├─→ 에러 시 renderError() 호출     │
│                             └─→ 성공 시 render[] 함수들 호출   │
│                                     ├─→ renderAssetInfo()      │
│                                     └─→ renderProperties()     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. 자산 정보 렌더링 (renderAssetInfo)

API 응답의 `data.asset` 객체를 헤더 영역에 렌더링:

```javascript
function renderAssetInfo({ response }) {
    const { data } = response;
    if (!data || !data.asset) {
        renderError.call(this, '자산 데이터가 없습니다.');
        return;
    }

    const asset = data.asset;

    // baseInfoConfig 순회하며 헤더 영역 렌더링
    fx.go(
        this.baseInfoConfig,
        fx.each(({ key, selector, dataAttr, transform }) => {
            const el = this.popupQuery(selector);
            if (!el) return;
            let value = asset[key];
            if (transform) value = transform(value);
            if (dataAttr) {
                el.dataset[dataAttr] = value;  // data-status="normal"
            } else {
                el.textContent = value;        // textContent 설정
            }
        })
    );
}
```

**매핑 결과**:
```
API: asset.name = "PDU 0001"        →  .pdu-name.textContent = "PDU 0001"
API: asset.locationLabel = "서버실 A"  →  .pdu-zone.textContent = "서버실 A"
API: asset.statusType = "ACTIVE"    →  .pdu-status.textContent = "Normal"
API: asset.statusType = "ACTIVE"    →  .pdu-status[data-status] = "normal"
```

### 4. 동적 프로퍼티 렌더링 (renderProperties)

API 응답의 `data.properties[]` 배열을 동적으로 렌더링:

```javascript
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

    // displayOrder로 정렬
    const sortedProperties = [...data.properties]
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    // 카드 HTML 생성
    container.innerHTML = sortedProperties
        .map(({ label, value, helpText }) => {
            return `<div class="summary-item" title="${helpText || ''}">
                <span class="summary-label">${label}</span>
                <span class="summary-value">${value ?? '-'}</span>
            </div>`;
        })
        .join('');
}
```

### 5. 에러 렌더링 (renderError)

API 호출 실패 또는 데이터 없음 시 에러 상태 표시:

```javascript
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
}
```

### 6. 탭 전환 (switchTab)

```javascript
function switchTab(tabName) {
    const buttons = this.popupQueryAll('.tab-btn');
    const panels = this.popupQueryAll('.tab-panel');

    // 탭 버튼 활성화 상태 변경
    fx.go(buttons, fx.each((btn) =>
        btn.classList.toggle('active', btn.dataset.tab === tabName)));

    // 탭 패널 표시/숨김
    fx.go(panels, fx.each((panel) =>
        panel.classList.toggle('active', panel.dataset.panel === tabName)));

    // 탭 전환 시 차트/테이블 리사이즈
    if (tabName === 'power') {
        const chart = this.getChart('.chart-container');
        if (chart) setTimeout(() => chart.resize(), 10);
    } else if (tabName === 'circuits') {
        if (this.isTableReady('.table-container')) {
            const table = this.getTable('.table-container');
            setTimeout(() => table.redraw(true), 10);
        }
    }
}
```

### 7. 회로 테이블 렌더링 (renderCircuitTable) - 추후 활성화

```javascript
function renderCircuitTable(config, { response }) {
    const { data } = response;
    if (!data) return;
    const circuits = data.circuits || data;
    this.updateTable(config.selector, circuits);
}
```

### 8. 차트 렌더링 (renderPowerChart) - 추후 활성화

```javascript
function renderPowerChart(config, { response }) {
    const { data } = response;
    if (!data || !data.fields || !data[config.valuesKey]) return;
    const option = config.optionBuilder(config, data);
    this.updateChart('.chart-container', option);
}
```

---

## 탭 UI 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  PDU-0001                                      Normal   [X]     │
│  서버실 A                                                       │
├─────────────────────────────────────────────────────────────────┤
│  [총 전력]  [입력 전압]  [입력 전류]  [출력 전류]               │
│   15.2kW      220V        69A         68A                       │
├────────────┬────────────┬───────────────────────────────────────┤
│ [Circuits] │  [Power]   │                                       │
├────────────┴────────────┴───────────────────────────────────────┤
│                                                                  │
│  (탭에 따라 다른 콘텐츠 표시)                                     │
│                                                                  │
│  Circuits: Tabulator 테이블                                      │
│  Power: ECharts 차트 (이중 Y축)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 이벤트 흐름

### 발행 이벤트

| 이벤트 | 발행 시점 | 설정 위치 |
|--------|----------|-----------|
| `@assetClicked` | 3D 클릭 시 | `customEvents.click` |

### 외부 클릭 닫기

```
사용자 클릭 (팝업 외부)
    │
    └─→ ShadowPopupMixin의 outsideClick 핸들러
            │
            └─→ hideDetail()
                    │
                    └─→ hidePopup() → 팝업 숨김
```

---

## Public Methods

| 메서드 | 설명 |
|--------|------|
| `showDetail()` | 팝업 표시 + 데이터 로드 |
| `hideDetail()` | 팝업 숨김 |

---

## 데이터 흐름 다이어그램

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌────────────┐
│ 3D Click │────▶│ showDetail│────▶│ fetchData()  │────▶│ Mock Server│
└──────────┘     └───────────┘     └──────────────┘     └────────────┘
                                          │                    │
                                          │  /api/v1/ast/detail│
                                          │◀───────────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │  response   │
                                   │  {          │
                                   │   asset,    │
                                   │   properties│
                                   │  }          │
                                   └──────┬──────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
                  ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
                  │renderAsset│     │renderProp │     │  (추후)   │
                  │   Info    │     │  erties   │     │Table/Chart│
                  └─────┬─────┘     └─────┬─────┘     └───────────┘
                        │                 │
                  ┌─────▼─────┐     ┌─────▼─────┐
                  │ 헤더 영역  │     │ Summary   │
                  │ DOM 업데이트│    │  Bar 생성  │
                  └───────────┘     └───────────┘
```

---

## UPS와의 차이점

| 항목 | UPS | PDU |
|------|-----|-----|
| 탭 UI | X | O (Circuits/Power) |
| Tabulator 테이블 | X | O (회로 목록) |
| 차트 Y축 | 단일 (Load) | 이중 (Power/Current) |
| fieldsContainerSelector | `.fields-container` | `.summary-bar` |
| 카드 클래스 | `.value-card` | `.summary-item` |

---

## 파일 구조

```
PDU/
├── docs/
│   └── codeflow.md     # 이 문서
├── scripts/
│   ├── register.js     # 메인 로직 (탭 UI 포함)
│   └── beforeDestroy.js # 정리 (팝업, 테이블, 차트 파괴)
├── styles/
│   └── component.css   # 팝업 + 탭 스타일
├── views/
│   └── component.html  # 3D 모델 + 팝업 템플릿
└── preview.html        # 단독 테스트 페이지
```

---

## 참고

- [UPS config.md](../../UPS/docs/config.md) - Config 상세 명세 (동일 패턴)
- [Shadow Popup Mixin](/RNBT_architecture/Utils/Mixins/ShadowPopupMixin.js)
- [Tabulator Mixin](/RNBT_architecture/Utils/Mixins/TabulatorMixin.js)
- [ECharts Mixin](/RNBT_architecture/Utils/Mixins/EChartsMixin.js)
- [API 명세](/RNBT_architecture/Projects/ECO/API_SPEC.md)

---

*최종 업데이트: 2026-01-27*
