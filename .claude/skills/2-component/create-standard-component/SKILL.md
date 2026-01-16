---
name: create-standard-component
description: 표준 RNBT 컴포넌트를 생성합니다. 페이지가 GlobalDataPublisher로 데이터를 제어합니다. Figma 입력이 있으면 변환, 없으면 처음부터 작성합니다. Use when creating standard components where page controls data via GlobalDataPublisher.
---

# 표준 컴포넌트 생성

**표준 컴포넌트**를 생성하는 Skill입니다.
페이지가 GlobalDataPublisher로 데이터를 제어하고, 컴포넌트는 구독만 합니다.
Figma MCP는 필요하지 않습니다.

> **설계 원칙**: 컴포넌트는 스스로 데이터를 fetch하지 않습니다. 페이지가 데이터를 발행하고, 컴포넌트는 구독합니다.

---

## 입력 분기

### A. Figma 디자인이 있는 경우

Figma Conversion에서 생성된 정적 파일:
```
Figma_Conversion/Static_Components/[프로젝트명]/[컴포넌트명]/
├── assets/
├── [컴포넌트명].html
└── [컴포넌트명].css
```

### B. Figma 디자인이 없는 경우

- 입력 없음 (처음부터 작성)
- 요구사항 기반으로 HTML/CSS + register.js 작성
- TBD 패턴으로 외부 인터페이스 정의

---

## 출력 분기

### 프로젝트 전용 컴포넌트
```
RNBT_architecture/Projects/[프로젝트명]/page/components/[ComponentName]/
```

### 재사용 라이브러리 (Components/)
```
RNBT_architecture/Components/[ComponentName]/
```
- Components/README.md 목록 업데이트 필요

---

## 출력 구조

```
[ComponentName]/
├── assets/                    # SVG, 이미지 등 (Figma 있는 경우 복사)
├── views/component.html       # 데이터 바인딩 마크업
├── styles/component.css       # 스타일 (.component-name 스코프)
├── scripts/
│   ├── register.js            # 초기화 + 메서드 정의
│   └── beforeDestroy.js       # 정리
├── preview.html               # 독립 테스트 (Mock 데이터 포함)
└── README.md                  # 컴포넌트 문서 (필수)
```

---

## 워크플로우

### A. Figma 입력이 있는 경우

```
1. 정적 HTML 분석
   └─ Figma Conversion에서 생성된 HTML/CSS

2. 데이터 바인딩 마크업 변환
   <!-- 정적 -->
   <div class="value">1,234</div>

   <!-- 동적 -->
   <div class="value" data-bind="tps"></div>

3. register.js 작성
4. beforeDestroy.js 작성
5. preview.html 작성
```

### B. Figma 입력이 없는 경우

```
1. 요구사항 분석
   └─ 컴포넌트 용도, 데이터 구조, 필요한 이벤트

2. HTML 구조 설계
   └─ views/component.html 작성

3. CSS 스타일 작성
   └─ styles/component.css 작성

4. register.js 작성
   └─ TBD 패턴으로 외부 인터페이스 정의

5. beforeDestroy.js 작성
6. preview.html 작성
```

---

## 핵심 개념: 역할 분리

```
페이지 = 오케스트레이터
- 데이터 정의 (globalDataMappings)
- Interval 관리 (refreshIntervals)
- Param 관리 (currentParams)
- 이벤트 핸들러 등록 (eventBusHandlers)

컴포넌트 = 독립적 구독자
- 필요한 topic만 구독 (subscriptions)
- 이벤트 발행만 (@eventName)
- 데이터 렌더링만 집중
- 페이지의 내부 구조 몰라도 됨
```

---

## 라이프사이클

### 컴포넌트 라이프사이클

| 단계 | 파일 | 접근 가능 요소 |
|------|------|---------------|
| **register** | `register.js` | `this.appendElement` |
| **beforeDestroy** | `beforeDestroy.js` | `this.appendElement` |

### appendElement (컴포넌트 컨테이너)

`this.appendElement`는 컴포넌트의 가장 최상단 컨테이너입니다.

- **2D 컴포넌트**: instance id를 id 속성으로 가진 HTMLElement(div)
- **3D 컴포넌트**: "MainGroup"을 이름으로 가진 THREE.Object3D

```javascript
// DOM 요소 접근
const chart = this.appendElement.querySelector('.chart-container');

// 이벤트 위임
this.appendElement.addEventListener('click', handler);
```

### 페이지 라이프사이클 (참고)

| 단계 | 시점 | 역할 |
|------|------|------|
| **before_load** | 컴포넌트 register 이전 | 이벤트 핸들러 등록 |
| **loaded** | 컴포넌트 completed 이후 | 데이터 발행 및 interval 관리 |
| **before_unload** | 컴포넌트 beforeDestroy 이전 | 리소스 정리 |

---

## 작업 원칙

### 사용 전 필수 확인

**확실하지 않으면 추측하지 말고, 먼저 확인하거나 의논합니다.**

### 문제 해결 원칙

**문제가 발생하면 원인을 파악하는 것이 우선입니다.** 원인을 모르면서 이전 상태로 돌아가는 것은 해결이 아닙니다.

### 임시방편 금지 원칙

**`!important`나 임시방편은 근본 해결이 아닙니다.** 문제의 원인을 파악하고 구조적으로 해결해야 합니다.

### 스크린샷 검증 원칙

**스크린샷을 꼼꼼히 확인합니다.** 대충 보고 "정상"이라고 판단하거나, 사용자 반응에 맞춰 없는 문제를 지어내면 안 됩니다.

### 단계별 확인 원칙

**서두르지 말고 한 단계씩 확인합니다.** 변경 후 바로 다음 작업으로 넘어가지 않고, 결과를 확인한 뒤 진행합니다.

---

## fx.js 함수형 프로그래밍

컴포넌트 코드는 가능한 **fx.js**를 활용하여 함수형으로 작성합니다.

### 기본 함수

| 함수 | 용도 | 예시 |
|------|------|------|
| `fx.go` | 파이프라인 실행 | `fx.go(data, fx.filter(...), fx.map(...))` |
| `fx.pipe` | 파이프라인 함수 생성 | `const process = fx.pipe(filter, map)` |
| `fx.each` | 순회 (부수효과) | `fx.each(item => console.log(item), list)` |
| `fx.map` | 변환 | `fx.map(x => x * 2, [1,2,3])` |
| `fx.filter` | 필터링 | `fx.filter(x => x > 0, list)` |
| `fx.reduce` | 축약 | `fx.reduce((a, b) => a + b, 0, list)` |
| `fx.find` | 검색 | `fx.find(x => x.id === 1, list)` |
| `fx.take` | N개 추출 | `fx.take(5, list)` |

### 활용 패턴

#### 구독 등록 (fx.go + fx.each)
```javascript
fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, fnList]) =>
        fx.each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);
```

#### 필드 렌더링 (fx.go + fx.each)
```javascript
fx.go(
    config.fields,
    fx.each(({ key, selector, suffix }) => {
        const el = this.appendElement.querySelector(selector);
        if (el) el.textContent = suffix ? `${data[key]}${suffix}` : data[key];
    })
);
```

#### 데이터 변환 (fx.go + fx.map + fx.filter)
```javascript
const activeItems = fx.go(
    data.items,
    fx.filter(item => item.status === 'active'),
    fx.map(item => ({ ...item, label: `[${item.id}] ${item.name}` })),
    fx.take(10)
);
```

#### 집계 (fx.go + fx.reduce)
```javascript
const total = fx.go(
    data.items,
    fx.map(item => item.value),
    fx.reduce((a, b) => a + b, 0)
);
```

#### 파이프라인 함수 재사용 (fx.pipe)
```javascript
const processItems = fx.pipe(
    fx.filter(item => item.value > 0),
    fx.map(item => ({ ...item, percent: item.value / 100 })),
    fx.take(10)
);

// 재사용
const cpuItems = processItems(cpuData);
const gpuItems = processItems(gpuData);
```

### 명령형 vs 함수형

```javascript
// ❌ 명령형
const results = [];
for (const item of data.items) {
    if (item.value > 50) {
        results.push({ ...item, highlight: true });
    }
}

// ✅ 함수형 (fx.js)
const results = fx.go(
    data.items,
    fx.filter(item => item.value > 50),
    fx.map(item => ({ ...item, highlight: true }))
);
```

---

## 핵심 패턴

### 1. PUB-SUB 패턴 (GlobalDataPublisher)

```javascript
const { subscribe, unsubscribe } = GlobalDataPublisher;

// ==================
// BINDINGS
// ==================

this.renderData = renderData.bind(this, config);

// ==================
// SUBSCRIPTIONS
// ==================

this.subscriptions = {
    topicA: ['renderData'],
    topicB: ['renderList', 'updateCount']
};

// 구독 등록
fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, fnList]) =>
        fx.each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);
```

### 2. Event-Driven 패턴 (Weventbus)

```javascript
const { bindEvents, removeCustomEvents } = Wkit;

// ==================
// CUSTOM EVENTS
// ==================

this.customEvents = {
    click: {
        '.btn-refresh': '@refreshClicked',
        '.row-item': '@rowClicked'
    },
    change: {
        '.filter-select': '@filterChanged'
    }
};

bindEvents(this, this.customEvents);
```

### 이벤트 처리 방식 결정 원칙

컴포넌트 이벤트는 **내부 동작**과 **외부 알림** 두 가지로 구분됩니다. 두 방식은 공존 가능합니다.

**질문: "이 동작의 결과를 페이지가 알아야 하는가?"**

| 답변 | 처리 방식 | 예시 |
|------|----------|------|
| **아니오** (컴포넌트 내부 완결) | `setupInternalHandlers`만 | Clear, Toggle, 내부 탭 전환 |
| **예** (페이지가 후속 처리) | `customEvents`만 | 행 선택 → 상세 패널, Export → 파일 다운로드 |
| **둘 다** (내부 완결 + 알림) | 둘 다 | 노드 클릭 → 선택 표시(내부) + 상세 요청(외부) |

**더 구체적인 기준:**
1. **UI 상태 변경만** → 내부 (setupInternalHandlers)
2. **데이터 요청/페이지 변화 필요** → 외부 (customEvents)
3. **확신 없으면** → 둘 다 (내부 동작 필수, 외부 알림 선택적)

```javascript
// 내부 동작 (setupInternalHandlers) - _internalHandlers로 참조 저장
this._internalHandlers = {};

function setupInternalHandlers() {
    const root = this.appendElement;

    // 핸들러 참조 저장 (beforeDestroy에서 제거용)
    this._internalHandlers.clearClick = () => this.clearLogs();
    this._internalHandlers.toggleClick = () => this.toggleAutoScroll();

    // 핸들러 바인딩
    root.querySelector('.btn-clear')?.addEventListener('click', this._internalHandlers.clearClick);
    root.querySelector('.btn-toggle')?.addEventListener('click', this._internalHandlers.toggleClick);
}
setupInternalHandlers.call(this);

// beforeDestroy.js에서 정리:
// const root = this.appendElement;
// root.querySelector('.btn-clear')?.removeEventListener('click', this._internalHandlers.clearClick);
// root.querySelector('.btn-toggle')?.removeEventListener('click', this._internalHandlers.toggleClick);
// this._internalHandlers = null;
```

**중요:**
- 핸들러 참조를 `this._internalHandlers`에 저장해야 beforeDestroy에서 `removeEventListener`로 정리 가능
- 익명 함수(`() => ...`)를 직접 사용하면 제거 불가능
- 페이지가 이벤트를 구독하지 않아도 컴포넌트는 독립적으로 동작해야 합니다.

### 3. Config 패턴 (What to render)

#### Field Config
```javascript
const config = {
    fields: [
        { key: 'name', selector: '.ups-name' },
        { key: 'status', selector: '.ups-status', dataAttr: 'status' },
        { key: 'load', selector: '.ups-load', suffix: '%' }
    ]
};
```

#### Chart Config (ECharts)
```javascript
const chartConfig = {
    xKey: 'timestamps',
    series: [
        { yKey: 'load', name: 'Load', color: '#3b82f6', smooth: true },
        { yKey: 'battery', name: 'Battery', color: '#22c55e' }
    ],
    optionBuilder: getMultiLineChartOption
};
```

#### Table Config (Tabulator)
```javascript
const tableConfig = {
    columns: [
        { title: 'ID', field: 'id', width: 60, hozAlign: 'center' },
        { title: 'Name', field: 'name', widthGrow: 2 },
        { title: 'Status', field: 'status', width: 100 }
    ],
    optionBuilder: getTableOption
};
```

#### Summary Config
```javascript
const summaryConfig = [
    { key: 'revenue', label: 'Revenue', icon: '💰', format: v => `$${v.toLocaleString()}` },
    { key: 'orders', label: 'Orders', icon: '📦', format: v => v.toLocaleString() }
];
```

### 4. TBD 패턴 (API 없이 미리 개발)

```javascript
// API 필드명이 미정일 때
const config = {
    titleKey: 'TBD_title',
    logsKey: 'TBD_logs'
};

this.subscriptions = {
    TBD_topicName: ['renderData']
};

this.customEvents = {
    click: {
        '.btn-clear': '@TBD_clearClicked'
    }
};
```

### 5. 응답 구조 패턴

```javascript
// 런타임 응답 구조: response 키가 한 번 더 감싸져 있음
// { response: { data, meta, ... } }

function renderData(config, { response }) {
    const { data, meta } = response;
    if (!data) return;
    // 렌더링 로직
}
```

### 6. 동적 리스트 렌더링 패턴 (Template Clone)

**사용 시점**: 리스트 아이템 개수가 데이터에 따라 변하는 경우

#### HTML (template 요소 사용)
```html
<div class="list-container">
    <div class="list">
        <!-- Template: 런타임에 복제될 아이템 구조 -->
        <template id="list-item-template">
            <div class="list__item">
                <span class="item__rank">1</span>
                <span class="item__name">-</span>
                <div class="item__progress">
                    <div class="progress__bar" style="--progress: 0%;"></div>
                </div>
                <span class="item__value">0%</span>
            </div>
        </template>
    </div>
</div>
```

#### register.js
```javascript
const config = {
    selectors: {
        list: '.list',
        template: '#list-item-template',
        // 아이템 내부 셀렉터 (아이템 기준 상대 경로)
        rank: '.item__rank',
        name: '.item__name',
        progressBar: '.progress__bar',
        value: '.item__value'
    },
    fields: {
        rank: 'TBD_rank',
        name: 'TBD_name',
        value: 'TBD_value'
    }
};

function renderList(config, { response }) {
    const { data } = response;
    if (!data || !data.items) return;

    const root = this.appendElement;
    const list = root.querySelector(config.selectors.list);
    const template = root.querySelector(config.selectors.template);

    if (!list || !template) return;

    // 1. 기존 아이템 제거 (template 제외)
    list.querySelectorAll('.list__item').forEach(item => item.remove());

    // 2. 데이터 기반 아이템 생성
    data.items.forEach((itemData, index) => {
        // template 복제
        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.list__item');

        // 필드 바인딩
        const rankEl = item.querySelector(config.selectors.rank);
        if (rankEl) rankEl.textContent = itemData[config.fields.rank] ?? (index + 1);

        const nameEl = item.querySelector(config.selectors.name);
        if (nameEl) nameEl.textContent = itemData[config.fields.name] ?? '-';

        const progressBar = item.querySelector(config.selectors.progressBar);
        const value = itemData[config.fields.value] ?? 0;
        if (progressBar) progressBar.style.setProperty('--progress', `${value}%`);

        const valueEl = item.querySelector(config.selectors.value);
        if (valueEl) valueEl.textContent = `${value}%`;

        // 이벤트용 데이터 저장
        item.dataset.index = index;

        // 3. 리스트에 추가
        list.appendChild(item);
    });
}
```

#### 고정 개수 vs 동적 개수

| 유형 | 특징 | 패턴 |
|------|------|------|
| **고정 개수** | 아이템 수가 정해짐 (예: 2개 섹션) | `querySelectorAll` + 인덱스 매칭 |
| **동적 개수** | 아이템 수가 데이터에 따라 변함 | `template` + `cloneNode` |

```javascript
// 고정 개수: BusinessStatus 방식
const sections = root.querySelectorAll('.item[data-section]');
data.sections.forEach((sectionData, i) => {
    const sectionEl = sections[i];
    // 값 업데이트만
});

// 동적 개수: PerformanceMonitoring 방식
list.querySelectorAll('.list__item').forEach(item => item.remove());
data.items.forEach(itemData => {
    const clone = template.content.cloneNode(true);
    // 값 설정 후 appendChild
});
```

---

## register.js 템플릿

```javascript
/**
 * [ComponentName] Component - register.js
 *
 * 책임:
 * - [컴포넌트 역할 설명]
 *
 * Subscribes to: [topic명]
 * Events: [@이벤트명]
 */

const { subscribe } = GlobalDataPublisher;
const { bindEvents } = Wkit;

// ==================
// CONFIG
// ==================

const config = {
    fields: [
        { key: 'fieldName', selector: '.field-selector' }
    ]
};

// ==================
// BINDINGS
// ==================

this.renderData = renderData.bind(this, config);

// ==================
// SUBSCRIPTIONS
// ==================

this.subscriptions = {
    topicName: ['renderData']
};

fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, fnList]) =>
        fx.each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// ==================
// CUSTOM EVENTS
// ==================

this.customEvents = {
    click: {
        '.btn-action': '@actionClicked'
    }
};

bindEvents(this, this.customEvents);

console.log('[ComponentName] Registered');

// ==================
// RENDER FUNCTIONS
// ==================

/**
 * 데이터 렌더링
 *
 * @param {Object} config - Field Config
 * @param {Object} param - API 응답 { response: { data } }
 */
function renderData(config, { response }) {
    const { data } = response;
    if (!data) return;

    fx.go(
        config.fields,
        fx.each(({ key, selector, suffix, dataAttr }) => {
            const el = this.appendElement.querySelector(selector);
            if (!el) return;

            const value = data[key];
            if (dataAttr) {
                el.dataset[dataAttr] = value;
            } else {
                el.textContent = suffix ? `${value}${suffix}` : value;
            }
        })
    );

    console.log('[ComponentName] Rendered');
}
```

---

## beforeDestroy.js 템플릿

```javascript
/**
 * [ComponentName] Component - beforeDestroy.js
 */

const { unsubscribe } = GlobalDataPublisher;
const { removeCustomEvents } = Wkit;

// ==================
// UNSUBSCRIBE
// ==================

if (this.subscriptions) {
    fx.go(
        Object.entries(this.subscriptions),
        fx.each(([topic, _]) => unsubscribe(topic, this))
    );
    this.subscriptions = null;
}

// ==================
// REMOVE EVENTS
// ==================

if (this.customEvents) {
    removeCustomEvents(this, this.customEvents);
    this.customEvents = null;
}

// ==================
// CLEAR REFERENCES
// ==================

this.renderData = null;

console.log('[ComponentName] Destroyed');
```

---

## preview.html 템플릿

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[ComponentName] Preview</title>
    <!-- Component CSS (컨테이너 크기 포함) -->
    <link rel="stylesheet" href="styles/component.css">
    <style>
        /* Reset & Base - 인라인 스타일 최소화 */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f1f5f9;
            padding: 32px;
        }
    </style>
</head>
<body>
    <!-- 컨테이너 ID는 컴포넌트별 고유: #[component-name]-container -->
    <div id="[component-name]-container">
        <!-- views/component.html 내용 복사 -->
    </div>

    <!-- Mock Data -->
    <script>
        const MOCK_DATA = {
            topicName: {
                success: true,
                data: {
                    fieldName: 'Sample Value'
                }
            }
        };
    </script>

    <!-- Render Test -->
    <script>
        // 컨테이너 ID는 실제 컴포넌트명으로 변경 (예: 'transaction-table-container')
        const container = document.getElementById('[component-name]-container');

        function renderData(data) {
            const { fieldName } = data;
            container.querySelector('.field-selector').textContent = fieldName;
            console.log('[Preview] Rendered:', data);
        }

        // 초기 렌더링
        renderData(MOCK_DATA.topicName.data);
    </script>
</body>
</html>
```

---

## 생성/정리 매칭 테이블

| 생성 (register) | 정리 (beforeDestroy) |
|-----------------|----------------------|
| `this.subscriptions = {...}` | `this.subscriptions = null` |
| `subscribe(topic, this, handler)` | `unsubscribe(topic, this)` |
| `this.customEvents = {...}` | `this.customEvents = null` |
| `bindEvents(this, customEvents)` | `removeCustomEvents(this, customEvents)` |
| `this._internalHandlers = {}` | `this._internalHandlers = null` |
| `addEventListener(event, this._internalHandlers.xxx)` | `removeEventListener(event, this._internalHandlers.xxx)` |
| `this.renderData = fn.bind(this)` | `this.renderData = null` |
| `this.chartInstance = echarts.init(...)` | `this.chartInstance.dispose()` |
| `this.tableInstance = new Tabulator(...)` | `this.tableInstance.destroy()` |
| `this.resizeObserver = new ResizeObserver(...)` | `this.resizeObserver.disconnect()` |

---

## CSS 원칙

**[CODING_STYLE.md](../../../guides/CODING_STYLE.md)의 CSS 원칙 섹션 참조**

핵심 요약:
- **px 단위 사용** (rem/em 금지)
- **Flexbox 우선** (Grid/absolute 지양)

**컴포넌트 스크롤 패턴:**
```css
.component__content {
    flex: 1;
    min-height: 0;  /* overflow 스크롤 작동에 필요 */
}
```

---

## 라이브러리 활용

| 라이브러리 | 용도 | 초기화 | 정리 |
|------------|------|--------|------|
| **ECharts** | 차트 | `echarts.init(container)` | `.dispose()` |
| **Tabulator** | 테이블 | `new Tabulator(selector, options)` | `.destroy()` |
| **ResizeObserver** | 리사이즈 감지 | `new ResizeObserver(callback)` | `.disconnect()` |

---

## 차트 컴포넌트 필수 규칙

**Figma에서 차트가 정적 SVG로 제공되더라도, 동적 데이터를 표시하는 차트는 반드시 ECharts로 구현한다.**

```
❌ 잘못된 접근:
- Figma SVG를 그대로 사용 → "디자인 일치하니까 정적으로 두자"
- ECharts 구현을 TBD로 미루기
- "나중에 동적으로 바꾸면 되지" 생각

✅ 올바른 접근:
- 차트 영역 식별 → ECharts 컨테이너로 대체
- Figma의 정적 SVG 차트는 제거
- Figma 디자인은 차트 스타일(색상, 그리드, 레전드 등) 참고용으로만 사용
- config.chart에 ECharts 설정 정의
```

**이유**: create-standard-component의 목적은 "동적 컴포넌트" 생성이다. 정적 SVG 차트는 데이터 변경 시 업데이트가 불가능하여 컴포넌트의 목적에 맞지 않는다.

### 차트 변환 예시

```javascript
// Figma: 정적 SVG 라인 차트
// → 제거하고 ECharts 컨테이너로 대체

// HTML
<div class="component__chart-container"></div>

// register.js
const chartConfig = {
    container: '.component__chart-container',
    xKey: 'TBD_timestamps',
    series: [
        { yKey: 'TBD_yesterday', name: '전일', color: '#038c8c' },
        { yKey: 'TBD_today', name: '금일', color: '#5bdcc6' }
    ]
};

// ECharts 초기화
const chartContainer = this.appendElement.querySelector(chartConfig.container);
this.chartInstance = echarts.init(chartContainer);

// 렌더링 함수에서 차트 업데이트
function renderChart(config, { response }) {
    const { data } = response;
    if (!data || !this.chartInstance) return;

    const option = {
        xAxis: { data: data[config.xKey] },
        series: config.series.map(s => ({
            name: s.name,
            type: 'line',
            data: data[s.yKey],
            itemStyle: { color: s.color }
        }))
    };
    this.chartInstance.setOption(option);
}
```

---

## 금지 사항

```
❌ 페이지 구조에 컴포넌트 의존
- 컴포넌트는 topic만 알면 됨
- 페이지의 내부 구조 참조 금지

❌ 생성 후 정리 누락
- subscribe 후 unsubscribe 필수
- bindEvents 후 removeCustomEvents 필수
- 인스턴스 생성 후 dispose/destroy 필수

❌ 라이프사이클 순서 위반
- register에서만 초기화
- beforeDestroy에서만 정리

❌ 응답 구조 잘못 사용
- function(response) ❌
- function({ response }) ✅
```

---

## 완료 체크리스트

```
- [ ] 정적 HTML 구조 분석 완료
- [ ] views/component.html 생성 (data-bind 속성 포함)
- [ ] styles/component.css 생성 (#[component-name]-container 스코프)
- [ ] register.js 작성
    - [ ] subscriptions 정의
    - [ ] customEvents 정의
    - [ ] Config 정의
    - [ ] 렌더 함수 바인딩 (config 커링)
    - [ ] 응답 구조 ({ response }) 사용
- [ ] beforeDestroy.js 작성
    - [ ] unsubscribe 호출
    - [ ] removeCustomEvents 호출
    - [ ] 모든 참조 null 처리
- [ ] preview.html 작성
    - [ ] Mock 데이터 정의
    - [ ] 독립 렌더링 테스트
- [ ] README.md 작성 (필수)
- [ ] 브라우저에서 preview.html 열어 확인
```

---

## README.md 템플릿 (필수)

각 컴포넌트에 README.md를 작성하여 컴포넌트의 동작과 사용법을 문서화합니다.

```markdown
# [ComponentName]

[컴포넌트 한 줄 설명]

## 데이터 구조

\`\`\`javascript
{
    field1: "value",        // 필드 설명
    items: [                // 배열 필드 설명
        { id: 1, name: "Item" }
    ]
}
\`\`\`

## 구독 (Subscriptions)

| Topic | 함수 | 설명 |
|-------|------|------|
| `topicName` | `renderData` | 데이터 수신 시 렌더링 |

## 발행 이벤트 (Events)

| 이벤트 | 발생 시점 | payload |
|--------|----------|---------|
| `@eventName` | 버튼 클릭 시 | `{ event, targetInstance }` |

## 내부 동작

### [기능 1]
- 동작 설명

## 파일 구조

\`\`\`
[ComponentName]/
├── views/component.html
├── styles/component.css
├── scripts/
│   ├── register.js
│   └── beforeDestroy.js
├── preview.html
└── README.md
\`\`\`
```

---

## 참고 문서

| 문서 | 참고 시점 | 내용 |
|------|----------|------|
| [CODING_STYLE.md](../../../guides/CODING_STYLE.md) | **코드 작성 시 (필수)** | 함수형 코딩 지침, 안티패턴, 권장 패턴 |
| `discussions/2025-12-30_component_standalone.md` | API/Figma 없이 컴포넌트 개발 시 | 미리 완성 가능한 것 vs TBD 항목 구분 |
| `discussions/2025-12-31_config_pattern_catalog.md` | Config 구조 설계 시 | Field, Chart, Table 등 Config 패턴 카탈로그 |

## 참고 예제

| 예제 | 참고 시점 | 특징 |
|------|----------|------|
| `RNBT_architecture/Examples/SimpleDashboard/` | 표준 예제 (필수 참고) | CODING_STYLE 적용, 1920x1080 레이아웃, 컨테이너 ID 패턴 |
| `RNBT_architecture/Projects/ECO/` | 실제 프로젝트 패턴 확인 시 | 데이터센터 관리, 다양한 컴포넌트 |
| `RNBT_architecture/Projects/HANA_BANK_HIT_Dev/` | 동적 리스트 구현 시 | PerformanceMonitoring (template clone 패턴) |
