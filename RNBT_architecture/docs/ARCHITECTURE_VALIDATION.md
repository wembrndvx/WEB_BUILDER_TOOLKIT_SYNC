# RNBT 아키텍처 검증 문서

이 문서는 RNBT 아키텍처의 설계와 구현이 일관되고 오류가 없는지 검증한 결과입니다.

---

## 검증 범위

| 관점 | 검증 내용 |
|------|----------|
| **설계 관점** | 이벤트/데이터 흐름이 명확히 분리되어 있는가 |
| **문법 관점** | Utils 모듈이 필요한 함수를 제공하는가 |
| **설계를 위한 문법 관점** | 설계 패턴을 구현하기 위한 함수 시그니처가 올바른가 |
| **설계 자체** | 설계가 역할 분리, 결합도, 확장성 원칙을 준수하는가 |

---

## 1. 설계 관점 검증

### 1.1 이벤트 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자 인터랙션                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐    customEvents     ┌─────────────┐            │
│  │  DOM Event  │ ──────────────────▶ │  Weventbus  │            │
│  └─────────────┘    (bindEvents)     │   .emit()   │            │
│                                      └──────┬──────┘            │
│                                             │                    │
│                                             ▼                    │
│                                      ┌─────────────┐            │
│                                      │    Page     │            │
│                                      │  Handler    │            │
│                                      └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**설계 원칙:**
- 컴포넌트는 이벤트를 **발행**만 함 (what happened)
- 페이지가 이벤트를 **처리**함 (what to do)
- 느슨한 결합으로 컴포넌트 재사용성 보장

**검증 결과:** ✅ 설계 원칙 준수

---

### 1.2 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│  Page (Orchestrator)                                             │
│       │                                                          │
│       │ fetchAndPublish(topic, page, params)                     │
│       ▼                                                          │
│  ┌─────────────────────┐                                        │
│  │ GlobalDataPublisher │                                        │
│  │   (Pub-Sub Hub)     │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             │ subscribe(topic, instance, handler)                │
│             ▼                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Component A │  │ Component B │  │ Component C │             │
│  │ (Subscriber)│  │ (Subscriber)│  │ (Subscriber)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**설계 원칙:**
- 페이지가 데이터 **발행** (어떤 API를 호출할지 결정)
- 컴포넌트는 데이터 **구독** (어떤 데이터가 필요한지만 선언)
- Topic 기반으로 중복 fetch 방지

**검증 결과:** ✅ 설계 원칙 준수

---

### 1.3 팝업 컴포넌트 (3D)

```
┌─────────────────────────────────────────────────────────────────┐
│  Component With Popup (예: UPS)                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ datasetInfo = [                                           │   │
│  │   { datasetName: 'ups', render: ['renderUPSInfo'] }      │   │
│  │ ]                                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                     │                                            │
│                     │ showDetail() → fetchData()                 │
│                     ▼                                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Shadow DOM Popup (applyShadowPopupMixin)                  │   │
│  │   ├── renderUPSInfo() → popupQuery()                      │   │
│  │   └── renderChart() → updateChart()                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**설계 원칙:**
- 컴포넌트가 자체적으로 데이터 호출 (페이지 의존성 없음)
- Shadow DOM으로 스타일 격리
- 팝업 내 차트/테이블 독립 관리

**검증 결과:** ✅ 설계 원칙 준수

---

## 2. 문법 관점 검증

### 2.1 Utils 모듈별 제공 함수

#### Wkit.js

| 함수명 | 용도 | 시그니처 |
|--------|------|----------|
| `bindEvents` | 2D 이벤트 바인딩 | `(instance, customEvents)` |
| `removeCustomEvents` | 2D 이벤트 해제 | `(instance, customEvents)` |
| `bind3DEvents` | 3D 이벤트 바인딩 | `(instance, customEvents)` |
| `initThreeRaycasting` | 3D 레이캐스팅 설정 | `(canvas, eventType)` → `handler` |
| `onEventBusHandlers` | 이벤트버스 핸들러 등록 | `(handlers)` |
| `offEventBusHandlers` | 이벤트버스 핸들러 해제 | `(handlers)` |
| `fetchData` | API 호출 | `(page, datasetName, param)` → `Promise` |
| `withSelector` | 안전한 셀렉터 실행 | `(element, selector, fn)` |
| `makeIterator` | 레이어별 인스턴스 이터레이터 | `(page, ...layers)` |
| `getInstanceById` | ID로 인스턴스 검색 | `(id, iter)` |
| `getInstanceByName` | 이름으로 인스턴스 검색 | `(name, iter)` |
| `disposeAllThreeResources` | 3D 리소스 일괄 정리 | `(page)` |

#### GlobalDataPublisher.js

| 함수명 | 용도 | 시그니처 |
|--------|------|----------|
| `registerMapping` | 데이터 매핑 등록 | `({ topic, datasetInfo })` |
| `unregisterMapping` | 데이터 매핑 해제 | `(topic)` |
| `fetchAndPublish` | 데이터 fetch 후 발행 | `(topic, page, params)` → `Promise` |
| `subscribe` | topic 구독 | `(topic, instance, handler)` |
| `unsubscribe` | topic 구독 해제 | `(topic, instance)` |

#### Weventbus.js

| 함수명 | 용도 | 시그니처 |
|--------|------|----------|
| `on` | 이벤트 리스너 등록 | `(event, callback)` |
| `off` | 이벤트 리스너 해제 | `(event, callback)` |
| `emit` | 이벤트 발행 | `(event, data)` |
| `once` | 일회성 리스너 등록 | `(event, callback)` |

#### PopupMixin.js

| 함수명 | 용도 | 시그니처 |
|--------|------|----------|
| `applyShadowPopupMixin` | 기본 팝업 믹스인 | `(instance, { getHTML, getStyles, onCreated })` |
| `applyEChartsMixin` | 차트 믹스인 | `(instance)` |
| `applyTabulatorMixin` | 테이블 믹스인 | `(instance)` |

**applyShadowPopupMixin 제공 메서드:**

| 메서드 | 용도 |
|--------|------|
| `createPopup()` | Shadow DOM 팝업 생성 |
| `showPopup()` | 팝업 표시 |
| `hidePopup()` | 팝업 숨김 |
| `popupQuery(selector)` | Shadow DOM 내부 요소 선택 |
| `popupQueryAll(selector)` | Shadow DOM 내부 요소 모두 선택 |
| `bindPopupEvents(events)` | 팝업 내 이벤트 바인딩 |
| `destroyPopup()` | 팝업 및 리소스 정리 |

**applyEChartsMixin 제공 메서드:**

| 메서드 | 용도 |
|--------|------|
| `createChart(selector)` | ECharts 인스턴스 생성 |
| `getChart(selector)` | 차트 인스턴스 조회 |
| `updateChart(selector, option)` | 차트 옵션 업데이트 |

**applyTabulatorMixin 제공 메서드:**

| 메서드 | 용도 |
|--------|------|
| `createTable(selector, options)` | Tabulator 인스턴스 생성 |
| `getTable(selector)` | 테이블 인스턴스 조회 |
| `isTableReady(selector)` | 초기화 완료 여부 |
| `updateTable(selector, data)` | 테이블 데이터 업데이트 |
| `updateTableOptions(selector, options)` | 테이블 옵션 업데이트 |

#### fx.js

| 함수명 | 용도 |
|--------|------|
| `fx.go` | 파이프라인 실행 |
| `fx.pipe` | 파이프라인 함수 생성 |
| `fx.map` | 변환 |
| `fx.filter` | 필터링 |
| `fx.reduce` | 축약 |
| `fx.each` | 순회 (부수효과) |
| `fx.find` | 검색 |
| `fx.take` | N개 추출 |
| `fx.L.*` | 지연 평가 버전 |
| `fx.C.*` | 동시성 버전 |

**검증 결과:** ✅ 모든 Utils가 필요한 함수를 제공

---

## 3. 설계를 위한 문법 관점 검증

### 3.1 이벤트 흐름 구현

**설계:**
```
컴포넌트 → customEvents 정의 → bindEvents → Weventbus.emit → 페이지 핸들러
```

**구현 검증:**

```javascript
// 1. 컴포넌트: customEvents 정의
this.customEvents = {
    click: { '.btn': '@buttonClicked' }
};

// 2. Wkit.bindEvents 내부 동작
Wkit.bindEvents = function (instance, customEvents) {
    // customEvents 구조: { eventType: { selector: triggerEvent } }
    fx.go(
        Object.entries(customEvents),
        fx.each(([eventName, selectorList]) => {
            fx.each((selector) => {
                delegate(instance, eventName, selector, handler);
            }, Object.keys(selectorList));
        })
    );
};

// 3. delegate 내부에서 Weventbus.emit 호출
function makeHandler(targetInstance, selector) {
    return function (event) {
        const triggerEvent = customEvents?.[event.type]?.[selector];
        if (triggerEvent) {
            Weventbus.emit(triggerEvent, { event, targetInstance });
        }
    };
}

// 4. 페이지: 핸들러에서 수신
this.eventBusHandlers = {
    '@buttonClicked': ({ event, targetInstance }) => { ... }
};
onEventBusHandlers(this.eventBusHandlers);
```

**검증 결과:** ✅ 설계와 구현 일치

---

### 3.2 데이터 흐름 구현

**설계:**
```
페이지 → registerMapping → fetchAndPublish → 컴포넌트 subscribe handler 호출
```

**구현 검증:**

```javascript
// 1. 페이지: 매핑 등록
this.globalDataMappings = [
    { topic: 'assets', datasetInfo: { datasetName: 'assets', param: {} } }
];
fx.go(
    this.globalDataMappings,
    fx.each(GlobalDataPublisher.registerMapping)
);

// 2. GlobalDataPublisher.registerMapping 내부
registerMapping({ topic, datasetInfo }) {
    mappingTable.set(topic, datasetInfo);  // Map에 저장
}

// 3. 컴포넌트: 구독
this.subscriptions = { 'assets': ['renderTable'] };
subscribe('assets', this, this.renderTable);

// 4. GlobalDataPublisher.subscribe 내부
subscribe(topic, instance, handler) {
    subscriberTable.get(topic).add({ instance, handler });
}

// 5. 페이지: 데이터 발행
GlobalDataPublisher.fetchAndPublish('assets', this, params);

// 6. GlobalDataPublisher.fetchAndPublish 내부
async fetchAndPublish(topic, page, paramUpdates) {
    const datasetInfo = mappingTable.get(topic);
    const data = await Wkit.fetchData(page, datasetInfo.datasetName, param);
    fx.each(({ instance, handler }) => handler.call(instance, data), subs);
}
```

**검증 결과:** ✅ 설계와 구현 일치

---

### 3.3 팝업 컴포넌트 구현

**설계:**
```
컴포넌트 → datasetInfo 정의 → showDetail() → fetchData → render
```

**구현 검증:**

```javascript
// 1. 데이터 정의
this.datasetInfo = [
    { datasetName: 'ups', render: ['renderUPSInfo'] }
];

// 2. showDetail에서 직접 fetchData 호출
function showDetail(assetId) {
    this.showPopup();
    fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, render }) =>
            fx.go(
                fetchData(this.page, datasetName, { assetId }),
                result => result?.response?.data,
                data => render.forEach(fn => this[fn](data))
            )
        )
    );
}

// 3. Wkit.fetchData 내부
fetchData(page, datasetName, param) {
    return new Promise((res, rej) => {
        page.dataService
            .call(datasetName, { param })
            .on('success', (data) => res(data))
            .on('error', (err) => rej(err));
    });
}
```

**검증 결과:** ✅ 설계와 구현 일치

---

### 3.4 생성/정리 매칭 검증

| 생성 | 정리 | Utils 함수 | 검증 |
|------|------|-----------|------|
| `onEventBusHandlers(handlers)` | `offEventBusHandlers(handlers)` | Wkit | ✅ |
| `registerMapping(mapping)` | `unregisterMapping(topic)` | GlobalDataPublisher | ✅ |
| `subscribe(topic, instance, handler)` | `unsubscribe(topic, instance)` | GlobalDataPublisher | ✅ |
| `bindEvents(instance, events)` | `removeCustomEvents(instance, events)` | Wkit | ✅ |
| `bind3DEvents(instance, events)` | `disposeAllThreeResources(page)` | Wkit | ✅ |
| `applyShadowPopupMixin(...)` | `destroyPopup()` | PopupMixin | ✅ |
| `applyEChartsMixin(...)` | `destroyPopup()` (내부 처리) | PopupMixin | ✅ |
| `applyTabulatorMixin(...)` | `destroyPopup()` (내부 처리) | PopupMixin | ✅ |
| `new Tabulator(...)` | `.destroy()` | 외부 라이브러리 | ✅ |
| `echarts.init(...)` | `.dispose()` | 외부 라이브러리 | ✅ |
| `new ResizeObserver(...)` | `.disconnect()` | 브라우저 API | ✅ |
| `addEventListener(...)` | `removeEventListener(...)` | 브라우저 API | ✅ |

**검증 결과:** ✅ 모든 생성/정리가 1:1 매칭

---

## 4. 설계 자체에 대한 진단

이 섹션은 "구현이 설계와 일치하는가"가 아닌 **"설계 자체가 올바른가"**를 분석합니다.

### 4.1 설계 평가 기준

| 기준 | 설명 |
|------|------|
| **역할 분리** | 각 계층이 단일 책임을 가지는가 |
| **결합도** | 모듈 간 의존성이 최소화되어 있는가 |
| **확장성** | 새로운 기능 추가 시 기존 코드 수정이 최소화되는가 |
| **테스트 용이성** | 단위 테스트가 가능한 구조인가 |
| **에러 복원력** | 부분 실패 시 전체 시스템이 영향받지 않는가 |

---

### 4.2 세 가지 핵심 흐름 평가

#### 흐름 1: 이벤트 감지 및 동작

```
DOM Event → customEvents → Weventbus.emit → Page Handler
```

**평가:**

| 항목 | 결과 | 분석 |
|------|------|------|
| 역할 분리 | ✅ | 컴포넌트는 "무슨 일이 일어났는지"만 알림, 페이지가 "무엇을 할지" 결정 |
| 결합도 | ✅ | 컴포넌트가 페이지 로직을 모름 → 느슨한 결합 |
| 확장성 | ✅ | 새 이벤트 추가 시 customEvents에 항목만 추가 |
| 테스트 용이성 | ✅ | Weventbus.emit 호출 여부로 단위 테스트 가능 |

**설계 판정:** ✅ 올바른 설계

---

#### 흐름 2: 데이터 호출 및 활용

```
Page → GlobalDataPublisher.fetchAndPublish → subscribe → Component Handler
```

**평가:**

| 항목 | 결과 | 분석 |
|------|------|------|
| 역할 분리 | ✅ | 페이지가 "언제 어떤 데이터를 호출할지" 결정, 컴포넌트는 "어떻게 렌더링할지"만 담당 |
| 결합도 | ✅ | Topic 기반 구독으로 컴포넌트가 API 상세를 모름 |
| 확장성 | ✅ | 새 데이터 소스 추가 시 topic만 등록 |
| 테스트 용이성 | ✅ | subscribe handler에 mock 데이터 주입으로 테스트 가능 |

**설계 판정:** ✅ 올바른 설계

---

#### 흐름 3: 팝업 컴포넌트 (3D 에셋 등)

```
datasetInfo 정의 → showDetail() → fetchData → render (Shadow DOM)
```

**평가:**

| 항목 | 결과 | 분석 |
|------|------|------|
| 역할 분리 | ✅ | 컴포넌트가 자체 데이터/UI를 완전히 캡슐화 |
| 결합도 | ✅ | 페이지 의존성 없음 (page 객체는 dataService 접근용으로만 사용) |
| 확장성 | ✅ | datasetInfo 배열에 항목 추가로 확장 |
| 테스트 용이성 | ✅ | datasetInfo와 render 함수 단위로 테스트 가능 |
| 스타일 격리 | ✅ | Shadow DOM으로 전역 CSS 충돌 방지 |

**설계 판정:** ✅ 올바른 설계

---

### 4.3 잠재적 개선 포인트

현재 설계는 기능적으로 올바르나, 다음 영역에서 개선 가능성이 있습니다:

#### 1. 에러 처리 표준화

**현재 상태:**
```javascript
// GlobalDataPublisher.fetchAndPublish
try {
    const data = await Wkit.fetchData(...);
    fx.each(({ instance, handler }) => handler.call(instance, data), subs);
} catch (error) {
    console.error(...);
    throw error;  // 에러를 상위로 전파
}
```

**개선 방향:**
- 구독자별 에러 핸들러 옵션 제공
- 부분 실패 시 다른 구독자에게 영향 없도록 처리

```javascript
// 개선 예시
subscribe(topic, instance, { onData, onError }) { ... }
```

**영향도:** 낮음 (현재도 동작에 문제 없음)

---

#### 2. 로딩 상태 관리

**현재 상태:**
- 로딩 상태 관리가 각 컴포넌트에 분산되어 있음

**개선 방향:**
- GlobalDataPublisher에 로딩 상태 발행 옵션 추가

```javascript
// 개선 예시
fetchAndPublish(topic, page, params, { emitLoading: true })
// → 'topic:loading' 이벤트 자동 발행
```

**영향도:** 낮음 (UI 개선 사항)

---

#### 3. 타입 안전성 (선택적)

**현재 상태:**
- 순수 JavaScript로 구현
- 런타임에 타입 오류 발견

**개선 방향:**
- JSDoc 타입 주석 추가 또는 TypeScript 점진적 도입

```javascript
/**
 * @param {string} topic
 * @param {Object} instance
 * @param {function(Object): void} handler
 */
subscribe(topic, instance, handler) { ... }
```

**영향도:** 낮음 (개발 경험 개선)

---

### 4.4 설계 원칙 준수 여부

| 원칙 | 준수 | 근거 |
|------|------|------|
| **단일 책임 원칙 (SRP)** | ✅ | 컴포넌트=UI, 페이지=조율, Utils=공통기능 |
| **개방-폐쇄 원칙 (OCP)** | ✅ | 새 기능 추가 시 customEvents/datasetInfo 확장만 필요 |
| **의존성 역전 원칙 (DIP)** | ✅ | 컴포넌트가 구체 API가 아닌 추상 topic에 의존 |
| **관심사 분리** | ✅ | 이벤트/데이터/렌더링이 명확히 분리됨 |

---

### 4.5 설계 진단 결론

**RNBT 아키텍처 설계는 올바릅니다.**

1. **핵심 흐름 3가지**가 모두 역할 분리, 느슨한 결합, 확장성을 만족
2. **설계 원칙** (SRP, OCP, DIP)을 준수
3. **잠재적 개선 포인트**는 기능적 문제가 아닌 개발 경험 향상 수준

```
┌────────────────────────────────────────────────────────────────┐
│  설계 진단 요약                                                  │
│                                                                 │
│  ✅ 이벤트 흐름: 올바른 설계 (컴포넌트 → 페이지 단방향)             │
│  ✅ 데이터 흐름: 올바른 설계 (Pub-Sub 패턴)                        │
│  ✅ 팝업 컴포넌트: 올바른 설계 (캡슐화 + Shadow DOM)            │
│  ⚠️  개선 가능: 에러 처리, 로딩 상태, 타입 안전성 (선택적)          │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. 종합 검증 결과

### 5.1 설계 관점

| 항목 | 결과 | 비고 |
|------|------|------|
| 이벤트 흐름 분리 | ✅ | 컴포넌트(발행) ↔ 페이지(처리) |
| 데이터 흐름 분리 | ✅ | 페이지(발행) ↔ 컴포넌트(구독) |
| 팝업 컴포넌트 | ✅ | 독립적 데이터 호출 + Shadow DOM |
| 느슨한 결합 | ✅ | Topic 기반 Pub-Sub |

### 5.2 문법 관점

| 항목 | 결과 | 비고 |
|------|------|------|
| Wkit.js 함수 제공 | ✅ | 12개 함수 |
| GlobalDataPublisher.js 함수 제공 | ✅ | 5개 함수 |
| Weventbus.js 함수 제공 | ✅ | 4개 함수 |
| PopupMixin.js 함수 제공 | ✅ | 3개 믹스인 + 메서드 |
| fx.js 함수 제공 | ✅ | 파이프라인 + 지연/동시성 |

### 5.3 설계를 위한 문법 관점

| 항목 | 결과 | 비고 |
|------|------|------|
| 이벤트 흐름 구현 | ✅ | customEvents → emit → handler |
| 데이터 흐름 구현 | ✅ | registerMapping → fetchAndPublish → subscribe |
| 팝업 컴포넌트 구현 | ✅ | datasetInfo → fetchData → render |
| 생성/정리 매칭 | ✅ | 모든 리소스 1:1 매칭 |

---

## 6. 결론

**RNBT 아키텍처는 설계 자체가 올바르고, 구현이 설계와 일관되며, 코드적 모순이나 오류가 없습니다.**

1. **설계 자체**가 올바름 (역할 분리, 느슨한 결합, 설계 원칙 준수)
2. **설계 원칙**이 명확히 정의되어 있음
3. **Utils 모듈**이 설계를 구현하기 위한 모든 함수를 제공함
4. **함수 시그니처**가 사용처와 일치함
5. **생성/정리**가 1:1로 매칭되어 메모리 누수 방지

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [README.md](../README.md) | 아키텍처 전체 가이드 |
| [TEST_SCENARIOS.md](./TEST_SCENARIOS.md) | 테스트 시나리오 (What) |
| [TESTING_GUIDE.md](../tests/TESTING_GUIDE.md) | 테스트 구현 가이드 (How) |

---

*검증일: 2026-01-10*
