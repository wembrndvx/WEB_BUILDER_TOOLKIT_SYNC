---
name: create-standard-component
description: 표준 RNBT 컴포넌트를 생성합니다. 페이지가 GlobalDataPublisher로 데이터를 제어합니다.
---

# 표준 컴포넌트 생성

페이지가 GlobalDataPublisher로 데이터를 제어하고, 컴포넌트는 구독만 합니다.

> 공통 규칙: [SHARED_INSTRUCTIONS.md](/.claude/skills/SHARED_INSTRUCTIONS.md) 참조

---

## ⚠️ 작업 전 필수 확인

**코드 작성 전 반드시 다음 파일들을 Read 도구로 읽으세요.**
**이전에 읽었더라도 매번 다시 읽어야 합니다 - 캐싱하거나 생략하지 마세요.**

1. [/RNBT_architecture/README.md](/RNBT_architecture/README.md) - 아키텍처 이해
2. [/.claude/guides/CODING_STYLE.md](/.claude/guides/CODING_STYLE.md) - 코딩 스타일
3. **기존 컴포넌트 패턴 확인** - `/RNBT_architecture/Components/LogViewer/` 등 기존 컴포넌트의 구조와 패턴을 먼저 확인

---

## 🚨 실수 방지 체크리스트

### 1. 기존 컴포넌트 패턴을 먼저 확인

```
❌ 임의로 새 구조를 만들지 않는다
✅ LogViewer, AssetTree 등 기존 컴포넌트의 패턴을 먼저 확인한다
```

### 2. 정적 CSS는 그대로 복사 (body/reset/import 제외)

```
❌ 검증된 CSS를 "비슷하게" 새로 작성
✅ Figma_Conversion의 검증된 CSS를 복사하되, body/*/import만 제외
```

**정적 CSS에서 제외할 부분:**
```css
/* 제외 */
@import url('...');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { ... }

/* 복사 */
.component-name { ... }  /* 컴포넌트 스타일만 */
```

### 3. preview.html은 inline 방식으로 구현

```
❌ 외부 파일 로드 방식 (경로 문제 발생)
   <script src="../../Utils/fx.js"></script>

✅ inline 방식 (LogViewer 패턴)
   - register.js 내용을 복사해서 붙여넣기
   - fx는 최소 기능만 inline 구현
   - mockThis 컨텍스트에서 IIFE로 실행
```

### 4. 스크린샷으로 반드시 확인

```
❌ 코드 작성 후 바로 "완료"
✅ Playwright 스크린샷 캡처 → 정적 HTML과 비교 → 동일해야 완료
```

---

## 핵심 원칙

### 1. 역할 분리

```
페이지 = 오케스트레이터
- 데이터 정의 (globalDataMappings)
- Interval 관리 (refreshIntervals)
- 이벤트 핸들러 등록 (eventBusHandlers)

컴포넌트 = 독립적 구독자
- topic 구독 (subscriptions)
- 이벤트 발행 (@eventName)
- 렌더링만 집중
```

### 2. 메서드 분리 (재사용성)

**핵심: 컴포넌트 재사용을 위해 메서드를 철저히 분리한다.**

```javascript
// 고정 (재사용)
function renderChart(config, { response }) {
    const { optionBuilder, ...chartCfg } = config;
    const option = optionBuilder(chartCfg, data);
    this.chartInstance.setOption(option, true);
}

// 가변 (컴포넌트별)
const chartConfig = { optionBuilder: getChartOption };
this.renderChart = renderChart.bind(this, chartConfig);
```

| 구분 | 역할 | 재사용 |
|------|------|--------|
| renderChart / renderTable | 규격화된 렌더링 함수 | O (고정) |
| chartConfig / tableConfig | 데이터 매핑 + 옵션 | X (컴포넌트별) |
| optionBuilder | ECharts/Tabulator 옵션 생성 | X (컴포넌트별) |

### 3. 응답 구조

```javascript
// response 키가 한 번 더 감싸져 있음
function renderData(config, { response }) {
    const { data, meta } = response;
}
```

---

## register.js 구조

### 전체 구조 (LogViewer 패턴 기준)

```javascript
const { subscribe } = GlobalDataPublisher;
const { bindEvents } = Wkit;

// ======================
// CONFIG (정적 선언)
// ======================

const config = {
    titleKey: 'TBD_title',
    itemsKey: 'TBD_items',
    fields: { name: 'TBD_name', value: 'TBD_value' },
    maxItems: 100
};

// ======================
// STATE
// ======================

this._someState = null;
this._internalHandlers = {};

// ======================
// BINDINGS (config 바인딩)
// ======================

this.renderData = renderData.bind(this, config);
this.renderList = renderList.bind(this, config);

// ======================
// SUBSCRIPTIONS (구독 등록)
// ======================

this.subscriptions = {
    TBD_topicName: ['renderData']
};

fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, fnList]) =>
        fx.each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// ======================
// EVENT BINDING (이벤트 등록)
// ======================

// 페이지에 전달할 이벤트
this.customEvents = {
    click: {
        '.btn-refresh': '@refreshClicked',
        '.row': '@rowClicked'
    }
};
bindEvents(this, this.customEvents);

// 컴포넌트 내부 이벤트
setupInternalHandlers.call(this);

// ======================
// RENDER FUNCTIONS (호이스팅)
// ======================

function renderData(config, { response }) { ... }
function renderList(config, { response }) { ... }
function setupInternalHandlers() { ... }
```

### 이벤트 처리 이중 구조

**판단 기준: "이 동작의 결과를 페이지가 알아야 하는가?"**

| 페이지가 알아야 하는가? | 처리 | 예시 |
|----------------------|------|------|
| 아니오 | `_internalHandlers` + `addEventListener` | Clear, Toggle, 스크롤 |
| 예 | `customEvents` + `bindEvents` | 행 선택, 필터 변경 |
| 둘 다 | 둘 다 | 노드 클릭 → 선택 표시 + 상세 요청 |

```javascript
// 페이지에 전달 → customEvents
this.customEvents = {
    click: { '.row': '@rowClicked' }
};
bindEvents(this, this.customEvents);

// 컴포넌트 내부 동작 → _internalHandlers
function setupInternalHandlers() {
    const root = this.appendElement;

    // 핸들러 참조 저장 (beforeDestroy에서 제거용)
    this._internalHandlers.clearClick = () => this.clearLogs();
    this._internalHandlers.scrollClick = () => this.toggleAutoScroll();

    root.querySelector('.btn-clear')?.addEventListener('click', this._internalHandlers.clearClick);
    root.querySelector('.btn-scroll')?.addEventListener('click', this._internalHandlers.scrollClick);
}
```

**핵심:** `_internalHandlers`에 함수 참조를 저장해야 `removeEventListener`가 가능합니다.

### fx.go 파이프라인 활용

데이터 변환과 DOM 렌더링에 `fx.go` 파이프라인을 사용합니다.

```javascript
// 리스트 렌더링
function renderData(config, { response }) {
    const { data } = response;
    if (!data) return;

    const items = data[config.itemsKey];
    if (!items || !Array.isArray(items)) return;

    const container = this.appendElement.querySelector('.list');
    container.innerHTML = '';

    fx.go(
        items,
        fx.map(item => createItemElement(config, item)),
        fx.each(el => container.appendChild(el))
    );
}

// DOM 생성은 순수 함수로 분리
function createItemElement(config, item) {
    const { fields } = config;
    const el = document.createElement('div');
    el.className = 'list-item';
    el.textContent = item[fields.name];
    return el;
}
```

### 재귀 DOM 빌딩 (트리 구조)

트리형 데이터(AssetTree 패턴)에서는 재귀적으로 DOM을 구축합니다.

```javascript
function renderTree(config, items, searchTerm) {
    const rootEl = this.appendElement.querySelector('.tree-root');
    rootEl.innerHTML = '';

    fx.go(
        items,
        fx.each(item => {
            const nodeEl = createNodeElement.call(this, config, item, searchTerm);
            if (nodeEl) rootEl.appendChild(nodeEl);
        })
    );
}

function createNodeElement(config, item, searchTerm) {
    const children = item[config.fields.children] || [];
    const hasChildren = children.length > 0;

    const li = document.createElement('li');
    // ... 노드 생성

    if (hasChildren) {
        const childrenUl = document.createElement('ul');
        fx.go(
            children,
            fx.each(child => {
                const childEl = createNodeElement.call(this, config, child, searchTerm);
                if (childEl) childrenUl.appendChild(childEl);
            })
        );
        li.appendChild(childrenUl);
    }

    return li;
}
```

---

## beforeDestroy 패턴

**반드시 생성의 역순으로 정리합니다.**

```javascript
const { unsubscribe } = GlobalDataPublisher;
const { removeCustomEvents } = Wkit;

// 1. 구독 해제
fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, _]) => unsubscribe(topic, this))
);
this.subscriptions = null;

// 2. 외부 이벤트 제거
removeCustomEvents(this, this.customEvents);
this.customEvents = null;

// 3. 내부 핸들러 제거 (등록한 모든 리스너)
const root = this.appendElement;
if (this._internalHandlers) {
    root.querySelector('.btn-clear')?.removeEventListener('click', this._internalHandlers.clearClick);
    root.querySelector('.btn-scroll')?.removeEventListener('click', this._internalHandlers.scrollClick);
}
this._internalHandlers = null;

// 4. 상태 초기화
this._someState = null;

// 5. 바인딩 메서드 null 처리
this.renderData = null;
this.renderList = null;
```

**핵심:** register에서 생성한 **모든 것**은 beforeDestroy에서 정리합니다.

---

## 출력 구조

```
[ComponentName]/
├── views/component.html
├── styles/component.css
├── scripts/
│   ├── register.js
│   └── beforeDestroy.js
├── preview.html
└── README.md
```

---

## 핵심 패턴

### PUB-SUB (GlobalDataPublisher)

```javascript
this.subscriptions = {
    topicA: ['renderData'],
    topicB: ['renderList', 'updateCount']
};
```

### Event-Driven (Weventbus)

```javascript
this.customEvents = {
    click: { '.btn-refresh': '@refreshClicked' },
    change: { '.filter-select': '@filterChanged' }
};
```

---

## 금지 사항

- ❌ 컴포넌트가 직접 fetch (팝업 없이)
- ❌ 생성 후 정리 누락 (register ↔ beforeDestroy 쌍)
- ❌ `function(response)` 사용 → `function({ response })` 필수
- ❌ _internalHandlers에 참조 저장 없이 addEventListener 사용
- ❌ 검증된 CSS를 "비슷하게" 새로 작성

---

## 관련 자료

| 문서 | 위치 |
|------|------|
| LogViewer (기본 패턴) | [/RNBT_architecture/Components/LogViewer/](/RNBT_architecture/Components/LogViewer/) |
| AssetTree (트리/검색 패턴) | [/RNBT_architecture/Components/AssetTree/](/RNBT_architecture/Components/AssetTree/) |
| EventStatus (단순 패턴) | [/RNBT_architecture/Components/EventStatus/](/RNBT_architecture/Components/EventStatus/) |
| 예제 | [/RNBT_architecture/Examples/SimpleDashboard/](/RNBT_architecture/Examples/SimpleDashboard/) |
