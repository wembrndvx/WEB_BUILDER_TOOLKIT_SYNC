# RNBT Architecture 테스트 시나리오

이 문서는 RNBT_architecture README.md를 기반으로 작성된 테스트 시나리오입니다.

---

## 관련 문서

| 문서 | 역할 | 내용 |
|------|------|------|
| **이 문서 (TEST_SCENARIOS.md)** | 테스트 명세서 (What) | 무엇을 테스트해야 하는가 - 테스트 케이스 목록과 검증 기준 |
| [TESTING_GUIDE.md](../tests/TESTING_GUIDE.md) | 테스트 구현 가이드 (How) | 어떻게 테스트를 작성하는가 - Mock 구현, 테스트 작성법 |

```
TEST_SCENARIOS.md          TESTING_GUIDE.md
(무엇을 테스트?)     →     (어떻게 테스트?)
                              ↓
                         tests/examples/*.test.js
                         (실제 테스트 코드)
```

---

## 목차

1. [라이프사이클 테스트](#1-라이프사이클-테스트)
2. [이벤트 시스템 테스트](#2-이벤트-시스템-테스트)
3. [데이터 흐름 테스트](#3-데이터-흐름-테스트)
4. [Interval 관리 테스트](#4-interval-관리-테스트)
5. [리소스 정리 테스트](#5-리소스-정리-테스트)
6. [PopupMixin 테스트](#6-popupmixin-테스트)
7. [팝업 컴포넌트 테스트](#7-팝업-컴포넌트-테스트)
8. [fx.go 에러 핸들링 테스트](#8-fxgo-에러-핸들링-테스트)

---

## 1. 라이프사이클 테스트

### 1.1 개요

RNBT 아키텍처에서 라이프사이클은 페이지와 컴포넌트가 생성되고 소멸되는 순서를 정의합니다.
올바른 순서가 보장되어야 리소스 정리와 이벤트 바인딩이 정상 동작합니다.

### 1.2 테스트 대상

| 대상 | 라이프사이클 단계 |
|------|------------------|
| 페이지 | Before Load → Loaded → Before Unload |
| 컴포넌트 | register → beforeDestroy |
| 뷰어 훅 | _onViewerReady → _onViewerDestroy |
| WScript | REGISTER → BEFORE_DESTROY → DESTROY |

---

### 1.3 테스트 시나리오

#### TC-LC-001: 페이지 라이프사이클 순서 검증

**목적:** 페이지의 Before Load → Loaded → Before Unload 순서가 올바르게 실행되는지 검증

**사전조건:**
- 테스트용 페이지가 준비되어 있음
- 각 라이프사이클 단계에서 로그를 출력하도록 설정됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 페이지 로드 시작 | `[Page] Before Load` 로그 출력 |
| 2 | 모든 컴포넌트 register 완료 대기 | 컴포넌트 register 로그들이 Before Load 이후에 출력 |
| 3 | 모든 컴포넌트 completed 후 | `[Page] Loaded` 로그 출력 |
| 4 | 페이지 언로드 시작 | `[Page] Before Unload` 로그 출력 |
| 5 | 컴포넌트 beforeDestroy 실행 | 컴포넌트 beforeDestroy가 Before Unload 이후에 실행 |

**검증 코드:**

```javascript
// page_before_load.js
console.log('[Page] Before Load - timestamp:', Date.now());

// page_loaded.js
console.log('[Page] Loaded - timestamp:', Date.now());

// page_before_unload.js
console.log('[Page] Before Unload - timestamp:', Date.now());
```

**예상 로그 순서:**
```
[Page] Before Load - timestamp: 1000
[Component A] register - timestamp: 1001
[Component B] register - timestamp: 1002
[Page] Loaded - timestamp: 1003
... (사용자 인터랙션) ...
[Page] Before Unload - timestamp: 2000
[Component A] beforeDestroy - timestamp: 2001
[Component B] beforeDestroy - timestamp: 2002
```

**통과 기준:**
- Before Load가 모든 컴포넌트 register 이전에 실행됨
- Loaded가 모든 컴포넌트 completed 이후에 실행됨
- Before Unload가 모든 컴포넌트 beforeDestroy 이전에 실행됨

---

#### TC-LC-002: 컴포넌트 라이프사이클 순서 검증

**목적:** 컴포넌트의 register → beforeDestroy 순서가 올바르게 실행되는지 검증

**사전조건:**
- 테스트용 컴포넌트가 페이지에 배치되어 있음
- 각 라이프사이클 단계에서 로그를 출력하도록 설정됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 컴포넌트 로드 | `[Component] register` 로그 출력 |
| 2 | register에서 this.appendElement 접근 | HTMLElement(2D) 또는 THREE.Object3D(3D) 반환 |
| 3 | 페이지 언로드 시작 | `[Component] beforeDestroy` 로그 출력 |
| 4 | beforeDestroy에서 this.appendElement 접근 | 여전히 접근 가능 |

**검증 코드:**

```javascript
// register.js
console.log('[Component] register');
console.log('[Component] appendElement:', this.appendElement);
console.log('[Component] appendElement tagName:', this.appendElement?.tagName); // 2D의 경우 DIV

// beforeDestroy.js
console.log('[Component] beforeDestroy');
console.log('[Component] appendElement still accessible:', !!this.appendElement);
```

**통과 기준:**
- register에서 this.appendElement가 유효한 DOM 요소임
- beforeDestroy에서 this.appendElement가 여전히 접근 가능함

---

#### TC-LC-003: 뷰어 전용 라이프사이클 훅 실행 순서 검증

**목적:** _onViewerReady와 _onViewerDestroy가 WScript 이벤트와 올바른 순서로 실행되는지 검증

**사전조건:**
- 커스텀 컴포넌트 클래스가 정의되어 있음
- 뷰어 모드로 실행됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 컴포넌트 로드 (등록 시점) | 1) `_onViewerReady()` → 2) `WScript REGISTER` 순서로 실행 |
| 2 | 컴포넌트 언로드 (소멸 시점) | 1) `WScript BEFORE_DESTROY` → 2) `_onViewerDestroy()` → 3) `WScript DESTROY` 순서로 실행 |

**검증 코드:**

```javascript
class TestComponent extends WVDOMComponent {
  constructor() {
    super();
    this.lifecycleLog = [];
  }

  _onViewerReady() {
    this.lifecycleLog.push({ hook: '_onViewerReady', timestamp: Date.now() });
    console.log('[TestComponent] _onViewerReady');
  }

  _onViewerDestroy() {
    this.lifecycleLog.push({ hook: '_onViewerDestroy', timestamp: Date.now() });
    console.log('[TestComponent] _onViewerDestroy');
  }
}

// WScript register.js
this.lifecycleLog.push({ hook: 'WScript REGISTER', timestamp: Date.now() });
console.log('[TestComponent] WScript REGISTER');

// WScript beforeDestroy.js
this.lifecycleLog.push({ hook: 'WScript BEFORE_DESTROY', timestamp: Date.now() });
console.log('[TestComponent] WScript BEFORE_DESTROY');
```

**예상 로그 순서 (등록):**
```
[TestComponent] _onViewerReady
[TestComponent] WScript REGISTER
```

**예상 로그 순서 (소멸):**
```
[TestComponent] WScript BEFORE_DESTROY
[TestComponent] _onViewerDestroy
[TestComponent] WScript DESTROY
```

**통과 기준:**
- 등록 시점: _onViewerReady → WScript REGISTER 순서
- 소멸 시점: WScript BEFORE_DESTROY → _onViewerDestroy → WScript DESTROY 순서

---

#### TC-LC-004: appendElement 접근성 검증 (시점별)

**목적:** 각 라이프사이클 시점에서 this.appendElement 접근 가능 여부를 검증

**사전조건:**
- 테스트용 컴포넌트가 준비되어 있음

**테스트 단계:**

| 시점 | 행위 | 예상 결과 |
|------|------|----------|
| _onViewerReady() | this.appendElement 접근 | 접근 가능 (유효한 DOM) |
| WScript REGISTER | this.appendElement 접근 | 접근 가능 (유효한 DOM) |
| WScript BEFORE_DESTROY | this.appendElement 접근 | 접근 가능 (유효한 DOM) |
| _onViewerDestroy() | this.appendElement 접근 | 접근 가능 (유효한 DOM) |
| WScript DESTROY | this.appendElement 접근 | **접근 불가** (이미 제거됨) |

**검증 코드:**

```javascript
// 각 시점에서 실행
function checkAppendElement(phase) {
  const isAccessible = !!this.appendElement;
  const hasChildren = this.appendElement?.children?.length >= 0;
  console.log(`[${phase}] appendElement accessible: ${isAccessible}, hasChildren: ${hasChildren}`);
  return { phase, isAccessible, hasChildren };
}

// WScript DESTROY에서
try {
  console.log('[DESTROY] appendElement:', this.appendElement);
} catch (e) {
  console.log('[DESTROY] appendElement access failed:', e.message);
}
```

**통과 기준:**
- _onViewerReady ~ _onViewerDestroy: appendElement 접근 가능
- WScript DESTROY: appendElement가 null 또는 접근 불가

---

#### TC-LC-005: 다중 컴포넌트 라이프사이클 순서 검증

**목적:** 페이지에 여러 컴포넌트가 있을 때 라이프사이클 순서가 보장되는지 검증

**사전조건:**
- 페이지에 Component A, B, C가 배치되어 있음
- 각 컴포넌트에서 라이프사이클 로그 출력

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 페이지 로드 | Page Before Load → 모든 컴포넌트 register → Page Loaded |
| 2 | 페이지 언로드 | Page Before Unload → 모든 컴포넌트 beforeDestroy |

**검증 방법:**

```javascript
// 전역 로그 수집
window.lifecycleLog = [];

// page_before_load.js
window.lifecycleLog.push({ type: 'page', phase: 'before_load', timestamp: Date.now() });

// 각 컴포넌트 register.js
window.lifecycleLog.push({ type: 'component', name: this.name, phase: 'register', timestamp: Date.now() });

// page_loaded.js
window.lifecycleLog.push({ type: 'page', phase: 'loaded', timestamp: Date.now() });

// page_before_unload.js
window.lifecycleLog.push({ type: 'page', phase: 'before_unload', timestamp: Date.now() });

// 각 컴포넌트 beforeDestroy.js
window.lifecycleLog.push({ type: 'component', name: this.name, phase: 'beforeDestroy', timestamp: Date.now() });
```

**검증 함수:**

```javascript
function validateLifecycleOrder(log) {
  const pageBeforeLoad = log.find(l => l.type === 'page' && l.phase === 'before_load');
  const pageLoaded = log.find(l => l.type === 'page' && l.phase === 'loaded');
  const pageBeforeUnload = log.find(l => l.type === 'page' && l.phase === 'before_unload');

  const componentRegisters = log.filter(l => l.type === 'component' && l.phase === 'register');
  const componentDestroys = log.filter(l => l.type === 'component' && l.phase === 'beforeDestroy');

  // 검증 1: Before Load가 모든 register 이전
  const allRegistersAfterBeforeLoad = componentRegisters.every(r => r.timestamp > pageBeforeLoad.timestamp);

  // 검증 2: Loaded가 모든 register 이후
  const loadedAfterAllRegisters = componentRegisters.every(r => r.timestamp < pageLoaded.timestamp);

  // 검증 3: Before Unload가 모든 beforeDestroy 이전
  const allDestroysAfterBeforeUnload = componentDestroys.every(d => d.timestamp > pageBeforeUnload.timestamp);

  return {
    allRegistersAfterBeforeLoad,
    loadedAfterAllRegisters,
    allDestroysAfterBeforeUnload
  };
}
```

**통과 기준:**
- 모든 검증 항목이 true

---

#### TC-LC-006: 2D vs 3D appendElement 타입 검증

**목적:** 2D 컴포넌트와 3D 컴포넌트의 appendElement 타입이 올바른지 검증

**사전조건:**
- 2D 컴포넌트와 3D 컴포넌트가 각각 준비되어 있음

**테스트 단계:**

| 컴포넌트 타입 | 행위 | 예상 결과 |
|--------------|------|----------|
| 2D | this.appendElement 타입 확인 | HTMLElement (div), id 속성 = instance id |
| 3D | this.appendElement 타입 확인 | THREE.Object3D, name = "MainGroup" |

**검증 코드:**

```javascript
// 2D 컴포넌트 register.js
function validate2DAppendElement() {
  const el = this.appendElement;
  const is2D = el instanceof HTMLElement;
  const isDiv = el.tagName === 'DIV';
  const hasInstanceId = el.id === this.id;

  console.log('[2D Component] Validation:', { is2D, isDiv, hasInstanceId });
  return is2D && isDiv && hasInstanceId;
}

// 3D 컴포넌트 register.js
function validate3DAppendElement() {
  const obj = this.appendElement;
  const is3D = obj instanceof THREE.Object3D;
  const isMainGroup = obj.name === 'MainGroup';

  console.log('[3D Component] Validation:', { is3D, isMainGroup });
  return is3D && isMainGroup;
}
```

**통과 기준:**
- 2D: HTMLElement(div) + id = instance id
- 3D: THREE.Object3D + name = "MainGroup"

---

#### TC-LC-007: this.name 접근성 검증

**목적:** 컴포넌트 인스턴스 이름이 this.name으로 접근 가능한지 검증

**사전조건:**
- 테스트 컴포넌트의 인스턴스 이름이 지정되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | register에서 this.name 접근 | 인스턴스 이름 문자열 반환 |
| 2 | beforeDestroy에서 this.name 접근 | 동일한 인스턴스 이름 반환 |

**검증 코드:**

```javascript
// register.js
console.log('[Component] Instance name:', this.name);
console.log('[Component] Name type:', typeof this.name);
console.log('[Component] Name is not empty:', this.name.length > 0);

// beforeDestroy.js
console.log('[Component] Name still accessible:', this.name);
```

**통과 기준:**
- this.name이 비어있지 않은 문자열
- register와 beforeDestroy에서 동일한 값

---

### 1.4 테스트 요약 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-LC-001 | 페이지 라이프사이클 순서 검증 | ☐ |
| TC-LC-002 | 컴포넌트 라이프사이클 순서 검증 | ☐ |
| TC-LC-003 | 뷰어 전용 라이프사이클 훅 실행 순서 검증 | ☐ |
| TC-LC-004 | appendElement 접근성 검증 (시점별) | ☐ |
| TC-LC-005 | 다중 컴포넌트 라이프사이클 순서 검증 | ☐ |
| TC-LC-006 | 2D vs 3D appendElement 타입 검증 | ☐ |
| TC-LC-007 | this.name 접근성 검증 | ☐ |

---

## 2. 이벤트 시스템 테스트

### 2.1 개요

RNBT 아키텍처의 이벤트 시스템은 크게 세 가지로 구성됩니다:
1. **EventBus (Weventbus)**: 페이지-컴포넌트 간 통신
2. **customEvents + bindEvents**: 컴포넌트 DOM 이벤트를 EventBus로 발행
3. **3D 이벤트 (bind3DEvents)**: 3D 오브젝트 상호작용

### 2.2 테스트 대상

| 대상 | 설명 |
|------|------|
| eventBusHandlers | 페이지에서 정의하는 이벤트 핸들러 객체 |
| onEventBusHandlers | EventBus 핸들러 등록 함수 |
| offEventBusHandlers | EventBus 핸들러 해제 함수 |
| customEvents | 컴포넌트 DOM 이벤트 정의 객체 |
| bindEvents | DOM 이벤트를 EventBus로 바인딩하는 함수 |
| removeCustomEvents | DOM 이벤트 바인딩 해제 함수 |
| bind3DEvents | 3D 오브젝트 이벤트 바인딩 함수 |
| @ 접두사 | 커스텀 이벤트 구분자 |

---

### 2.3 테스트 시나리오

#### TC-EV-001: EventBus 핸들러 등록 및 호출 검증

**목적:** onEventBusHandlers로 등록한 핸들러가 정상적으로 호출되는지 검증

**사전조건:**
- 페이지 before_load.js에 eventBusHandlers가 정의되어 있음
- 컴포넌트에서 해당 이벤트를 발행할 준비가 되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | eventBusHandlers 객체 정의 | 객체 생성됨 |
| 2 | onEventBusHandlers() 호출 | 핸들러가 EventBus에 등록됨 |
| 3 | Weventbus.emit('@testEvent', payload) 호출 | 등록된 핸들러가 payload와 함께 호출됨 |

**검증 코드:**

```javascript
// page_before_load.js
const { onEventBusHandlers } = Wkit;

let handlerCallCount = 0;
let receivedPayload = null;

this.eventBusHandlers = {
    '@testEvent': ({ event, targetInstance }) => {
        handlerCallCount++;
        receivedPayload = { event, targetInstance };
        console.log('[EventBus] @testEvent received:', { event, targetInstance });
    }
};

onEventBusHandlers(this.eventBusHandlers);

// 테스트용 함수
this.getHandlerCallCount = () => handlerCallCount;
this.getReceivedPayload = () => receivedPayload;
```

```javascript
// 컴포넌트 또는 테스트 코드에서
Weventbus.emit('@testEvent', {
    event: { type: 'click', target: { value: 'test-value' } },
    targetInstance: this
});

// 검증
console.log('Handler call count:', page.getHandlerCallCount()); // 1
console.log('Received payload:', page.getReceivedPayload());
```

**통과 기준:**
- handlerCallCount가 1 증가
- receivedPayload에 event와 targetInstance가 포함됨

---

#### TC-EV-002: EventBus 핸들러 해제 검증

**목적:** offEventBusHandlers로 핸들러를 해제하면 이벤트가 더 이상 수신되지 않는지 검증

**사전조건:**
- 이벤트 핸들러가 등록되어 있음
- 이벤트가 정상 동작하는 것이 확인됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 핸들러가 등록된 상태에서 이벤트 발행 | 핸들러 호출됨, callCount = 1 |
| 2 | offEventBusHandlers() 호출 | 핸들러가 해제됨 |
| 3 | 동일한 이벤트 다시 발행 | 핸들러 호출되지 않음, callCount = 1 (변화 없음) |

**검증 코드:**

```javascript
// page_before_unload.js
const { offEventBusHandlers } = Wkit;

// 해제 전 테스트
Weventbus.emit('@testEvent', { event: {}, targetInstance: this });
console.log('[Before off] callCount:', this.getHandlerCallCount()); // 1

// 해제
offEventBusHandlers.call(this, this.eventBusHandlers);

// 해제 후 테스트
Weventbus.emit('@testEvent', { event: {}, targetInstance: this });
console.log('[After off] callCount:', this.getHandlerCallCount()); // 여전히 1
```

**통과 기준:**
- 해제 후 이벤트 발행 시 핸들러가 호출되지 않음
- callCount가 증가하지 않음

---

#### TC-EV-003: customEvents + bindEvents 동작 검증 (2D)

**목적:** 컴포넌트의 customEvents 정의와 bindEvents를 통한 이벤트 위임이 정상 동작하는지 검증

**사전조건:**
- 컴포넌트에 버튼 요소가 존재함
- customEvents가 정의되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | customEvents 객체 정의 | { click: { '.my-button': '@buttonClicked' } } 형태 |
| 2 | bindEvents(this, customEvents) 호출 | 이벤트 위임이 설정됨 |
| 3 | .my-button 클릭 | '@buttonClicked' 이벤트가 EventBus로 발행됨 |
| 4 | 페이지의 '@buttonClicked' 핸들러 호출됨 | event와 targetInstance 수신 |

**검증 코드:**

```javascript
// 컴포넌트 register.js
const { bindEvents } = Wkit;

this.customEvents = {
    click: {
        '.my-button': '@buttonClicked',
        '.my-link': '@linkClicked'
    }
};

bindEvents(this, this.customEvents);
```

```javascript
// 페이지 before_load.js
this.eventBusHandlers = {
    '@buttonClicked': ({ event, targetInstance }) => {
        console.log('[Page] Button clicked in component:', targetInstance.name);
        console.log('[Page] Event target:', event.target);
    }
};

onEventBusHandlers(this.eventBusHandlers);
```

```javascript
// 테스트 코드 (버튼 클릭 시뮬레이션)
const button = component.appendElement.querySelector('.my-button');
button.click(); // 또는 button.dispatchEvent(new Event('click', { bubbles: true }));
```

**통과 기준:**
- .my-button 클릭 시 페이지의 '@buttonClicked' 핸들러가 호출됨
- targetInstance가 해당 컴포넌트를 가리킴
- event.target이 클릭된 버튼 요소를 가리킴

---

#### TC-EV-004: 이벤트 위임 패턴 검증 (동적 요소)

**목적:** 이벤트 위임을 통해 동적으로 생성된 요소에서도 이벤트가 정상 동작하는지 검증

**사전조건:**
- bindEvents가 적용된 컴포넌트가 있음
- 초기 로드 시 .dynamic-item 요소가 없음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | customEvents에 '.dynamic-item': '@itemClicked' 정의 | 이벤트 위임 설정됨 |
| 2 | bindEvents 호출 (이 시점에 .dynamic-item 없음) | 정상 완료 |
| 3 | 동적으로 .dynamic-item 요소 생성 | DOM에 추가됨 |
| 4 | 동적 생성된 요소 클릭 | '@itemClicked' 이벤트 발행됨 |

**검증 코드:**

```javascript
// 컴포넌트 register.js
const { bindEvents } = Wkit;

this.customEvents = {
    click: {
        '.dynamic-item': '@itemClicked'
    }
};

bindEvents(this, this.customEvents);

// 동적 요소 생성 함수
this.addDynamicItem = (id, text) => {
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    item.dataset.id = id;
    item.textContent = text;
    this.appendElement.querySelector('.item-list').appendChild(item);
};
```

```javascript
// 테스트 코드
// 1. 초기 상태: .dynamic-item 없음
console.log('Initial items:', component.appendElement.querySelectorAll('.dynamic-item').length); // 0

// 2. 동적 생성
component.addDynamicItem('item-1', 'First Item');

// 3. 동적 요소 클릭
const dynamicItem = component.appendElement.querySelector('.dynamic-item');
dynamicItem.click();

// 4. 페이지 핸들러에서 수신 확인
```

**통과 기준:**
- bindEvents 시점에 존재하지 않던 요소도 클릭 이벤트가 정상 발행됨
- 이벤트 위임 패턴이 올바르게 동작함

---

#### TC-EV-005: removeCustomEvents 동작 검증

**목적:** removeCustomEvents로 이벤트 바인딩을 해제하면 더 이상 이벤트가 발행되지 않는지 검증

**사전조건:**
- bindEvents로 이벤트가 바인딩되어 있음
- 이벤트가 정상 동작하는 것이 확인됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 바인딩된 상태에서 버튼 클릭 | 이벤트 발행됨, callCount = 1 |
| 2 | removeCustomEvents(this, customEvents) 호출 | 이벤트 바인딩 해제됨 |
| 3 | 동일 버튼 다시 클릭 | 이벤트 발행되지 않음, callCount = 1 (변화 없음) |

**검증 코드:**

```javascript
// 컴포넌트 beforeDestroy.js
const { removeCustomEvents } = Wkit;

// 해제 전 테스트
const button = this.appendElement.querySelector('.my-button');
button.click();
console.log('[Before remove] Event was fired');

// 해제
removeCustomEvents(this, this.customEvents);
this.customEvents = null;

// 해제 후 테스트
button.click();
console.log('[After remove] Event should not fire');
```

**통과 기준:**
- removeCustomEvents 후 클릭해도 이벤트가 발행되지 않음

---

#### TC-EV-006: @ 접두사 커스텀 이벤트 구분 검증

**목적:** @ 접두사가 커스텀 이벤트를 구분하는 용도로 올바르게 사용되는지 검증

**사전조건:**
- customEvents에 @ 접두사가 있는 이벤트명과 없는 이벤트명이 정의됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | '@customEvent' 형태로 정의 | EventBus를 통해 발행됨 |
| 2 | 'nativeEvent' 형태로 정의 (@ 없음) | 동작 방식 확인 필요 |

**검증 코드:**

```javascript
// 컴포넌트 register.js
this.customEvents = {
    click: {
        '.custom-btn': '@customButtonClicked',   // @ 접두사: 커스텀 이벤트
        '.native-btn': 'nativeButtonClicked'     // @ 없음: 네이티브 이벤트
    }
};

bindEvents(this, this.customEvents);
```

```javascript
// 페이지 before_load.js
this.eventBusHandlers = {
    '@customButtonClicked': ({ event, targetInstance }) => {
        console.log('[Page] Custom event received');
    },
    'nativeButtonClicked': ({ event, targetInstance }) => {
        console.log('[Page] Native event received (if supported)');
    }
};

onEventBusHandlers(this.eventBusHandlers);
```

**통과 기준:**
- @ 접두사가 있는 이벤트명은 EventBus를 통해 정상 발행/수신됨
- @ 접두사의 의미와 동작이 명확함

---

#### TC-EV-007: 3D 이벤트 바인딩 검증 (bind3DEvents)

**목적:** bind3DEvents로 3D 오브젝트에 이벤트가 정상 바인딩되는지 검증

**사전조건:**
- 3D 컴포넌트가 준비되어 있음
- Three.js 환경이 설정되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | this.customEvents = { click: '@3dObjectClicked' } 정의 | 3D 이벤트 정의됨 |
| 2 | bind3DEvents(this, customEvents) 호출 | 3D 오브젝트에 이벤트 바인딩됨 |
| 3 | 3D 오브젝트 클릭 | '@3dObjectClicked' 이벤트 발행됨 |

**검증 코드:**

```javascript
// 3D 컴포넌트 register.js
const { bind3DEvents } = Wkit;

this.customEvents = {
    click: '@3dObjectClicked',
    mousemove: '@3dObjectHovered'
};

bind3DEvents(this, this.customEvents);
```

```javascript
// 페이지 before_load.js
this.eventBusHandlers = {
    '@3dObjectClicked': ({ event, targetInstance }) => {
        console.log('[Page] 3D object clicked');
        console.log('[Page] Intersected object:', event.intersects[0]?.object);
        console.log('[Page] Target instance:', targetInstance.name);
    }
};

onEventBusHandlers(this.eventBusHandlers);
```

**통과 기준:**
- 3D 오브젝트 클릭 시 이벤트가 발행됨
- event.intersects에 교차 정보가 포함됨
- targetInstance가 3D 컴포넌트를 가리킴

---

#### TC-EV-008: 3D 이벤트와 2D 이벤트 차이점 검증

**목적:** 3D 이벤트와 2D 이벤트의 구조적 차이를 검증

**사전조건:**
- 2D 컴포넌트와 3D 컴포넌트가 각각 준비되어 있음

**테스트 단계:**

| 구분 | 2D 이벤트 | 3D 이벤트 |
|------|----------|----------|
| customEvents 구조 | `{ click: { '.selector': '@event' } }` | `{ click: '@event' }` |
| event 객체 | DOM Event (target, type 등) | intersects 배열 포함 |
| 선택자 | CSS 선택자 사용 | 선택자 없음 (전체 오브젝트 대상) |

**검증 코드:**

```javascript
// 2D 이벤트 구조
const customEvents2D = {
    click: {
        '.button-a': '@buttonAClicked',
        '.button-b': '@buttonBClicked'
    }
};

// 3D 이벤트 구조
const customEvents3D = {
    click: '@3dClicked'  // 선택자 없이 이벤트명만
};

// 페이지 핸들러에서 event 구조 비교
this.eventBusHandlers = {
    '@buttonAClicked': ({ event }) => {
        console.log('[2D] event.target:', event.target);       // DOM Element
        console.log('[2D] event.type:', event.type);           // 'click'
    },
    '@3dClicked': ({ event }) => {
        console.log('[3D] event.intersects:', event.intersects);  // Array
        console.log('[3D] event.intersects[0].object:', event.intersects[0]?.object);  // THREE.Object3D
    }
};
```

**통과 기준:**
- 2D: event.target이 DOM Element
- 3D: event.intersects가 배열이며, 교차된 3D 오브젝트 정보 포함
- 구조적 차이가 문서와 일치

---

#### TC-EV-009: datasetInfo 검증 (3D 컴포넌트)

**목적:** 3D 컴포넌트의 datasetInfo가 배열 형태로 정의되고, targetInstance를 통해 접근 가능한지 검증

**사전조건:**
- 3D 컴포넌트에 datasetInfo가 정의되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | this.datasetInfo 배열 정의 | 다중 데이터셋 정보 포함 |
| 2 | 3D 오브젝트 클릭 | 이벤트 발행됨 |
| 3 | targetInstance.datasetInfo 접근 | 배열 반환됨 |
| 4 | datasetInfo 순회하며 데이터 fetch | 각 데이터셋에 대해 fetchData 호출 가능 |

**검증 코드:**

```javascript
// 3D 컴포넌트 register.js
const { bind3DEvents } = Wkit;

this.datasetInfo = [
    {
        datasetName: 'sensorData',
        param: { id: this.id, type: 'temperature' }
    },
    {
        datasetName: 'historyData',
        param: { id: this.id, range: '24h' }
    }
];

this.customEvents = {
    click: '@sensorClicked'
};

bind3DEvents(this, this.customEvents);
```

```javascript
// 페이지 before_load.js
const { fetchData } = Wkit;

this.eventBusHandlers = {
    '@sensorClicked': async ({ event, targetInstance }) => {
        const { datasetInfo } = targetInstance;

        console.log('[Page] datasetInfo is array:', Array.isArray(datasetInfo));
        console.log('[Page] datasetInfo length:', datasetInfo?.length);

        if (datasetInfo?.length) {
            for (const { datasetName, param } of datasetInfo) {
                console.log(`[Page] Fetching ${datasetName} with param:`, param);
                const data = await fetchData(this, datasetName, param);
                console.log(`[Page] Received data from ${datasetName}:`, data);
            }
        }
    }
};

onEventBusHandlers(this.eventBusHandlers);
```

**통과 기준:**
- datasetInfo가 배열 형태
- targetInstance를 통해 접근 가능
- 배열 순회하며 각 데이터셋에 대해 fetchData 호출 가능

---

#### TC-EV-010: event vs targetInstance 정보 비교 검증

**목적:** 이벤트 발생 시 event와 targetInstance가 제공하는 정보의 차이를 검증

**사전조건:**
- 컴포넌트에 이벤트가 바인딩되어 있음
- 해당 컴포넌트에 datasetInfo와 커스텀 메서드가 정의되어 있음

**테스트 단계:**

| 정보 타입 | event.target | targetInstance |
|-----------|--------------|----------------|
| 사용자 입력 | value, textContent | - |
| DOM 속성 | dataset, classList | - |
| 인스턴스 메타 | - | id, name |
| 데이터셋 정보 | - | datasetInfo |
| 인스턴스 메서드 | - | showDetail() 등 |

**검증 코드:**

```javascript
// 컴포넌트 register.js
const { bindEvents } = Wkit;

this.datasetInfo = [{ datasetName: 'myData', param: {} }];
this.showDetail = () => console.log('Show detail for:', this.name);

this.customEvents = {
    click: {
        '.item': '@itemClicked'
    }
};

bindEvents(this, this.customEvents);
```

```javascript
// 페이지 before_load.js
this.eventBusHandlers = {
    '@itemClicked': ({ event, targetInstance }) => {
        // event.target에서 얻을 수 있는 정보
        console.log('--- event.target 정보 ---');
        console.log('value:', event.target.value);
        console.log('textContent:', event.target.textContent);
        console.log('dataset:', event.target.dataset);
        console.log('classList:', event.target.classList);

        // targetInstance에서 얻을 수 있는 정보
        console.log('--- targetInstance 정보 ---');
        console.log('id:', targetInstance.id);
        console.log('name:', targetInstance.name);
        console.log('datasetInfo:', targetInstance.datasetInfo);
        console.log('showDetail (method):', typeof targetInstance.showDetail);

        // targetInstance의 메서드 호출
        if (targetInstance.showDetail) {
            targetInstance.showDetail();
        }
    }
};

onEventBusHandlers(this.eventBusHandlers);
```

**통과 기준:**
- event.target: DOM 관련 정보 (value, textContent, dataset, classList)
- targetInstance: 인스턴스 메타 정보 (id, name), datasetInfo, 커스텀 메서드
- 두 객체가 상호 보완적으로 완전한 컨텍스트 제공

---

#### TC-EV-011: 다중 이벤트 타입 바인딩 검증

**목적:** 하나의 컴포넌트에 여러 이벤트 타입(click, mouseover, change 등)을 바인딩할 수 있는지 검증

**사전조건:**
- 컴포넌트에 다양한 인터랙티브 요소가 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 여러 이벤트 타입으로 customEvents 정의 | click, mouseover, change 등 포함 |
| 2 | bindEvents 호출 | 모든 이벤트 타입이 바인딩됨 |
| 3 | 각 이벤트 타입 트리거 | 각각의 핸들러가 호출됨 |

**검증 코드:**

```javascript
// 컴포넌트 register.js
const { bindEvents } = Wkit;

this.customEvents = {
    click: {
        '.button': '@buttonClicked',
        '.link': '@linkClicked'
    },
    mouseover: {
        '.card': '@cardHovered'
    },
    change: {
        '.input-field': '@inputChanged',
        '.select-box': '@selectChanged'
    },
    submit: {
        '.form': '@formSubmitted'
    }
};

bindEvents(this, this.customEvents);
```

```javascript
// 테스트 코드
const button = component.appendElement.querySelector('.button');
const card = component.appendElement.querySelector('.card');
const input = component.appendElement.querySelector('.input-field');

// click 이벤트
button.click();

// mouseover 이벤트
card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

// change 이벤트
input.value = 'new value';
input.dispatchEvent(new Event('change', { bubbles: true }));
```

**통과 기준:**
- 각 이벤트 타입별로 정의된 핸들러가 정상 호출됨
- 이벤트 타입별 분리가 명확함

---

#### TC-EV-012: 이벤트 핸들러에서 비동기 처리 검증

**목적:** EventBus 핸들러에서 async/await를 사용한 비동기 처리가 정상 동작하는지 검증

**사전조건:**
- fetchData 등 비동기 함수가 준비되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | async 핸들러 정의 | 비동기 핸들러가 등록됨 |
| 2 | 이벤트 발생 | 핸들러 내 await가 정상 동작함 |
| 3 | 비동기 작업 완료 후 | 후속 로직이 실행됨 |

**검증 코드:**

```javascript
// 페이지 before_load.js
const { fetchData } = Wkit;

this.eventBusHandlers = {
    '@itemClicked': async ({ event, targetInstance }) => {
        console.log('[Handler] Start - timestamp:', Date.now());

        const { datasetInfo } = targetInstance;

        if (datasetInfo?.length) {
            for (const { datasetName, param } of datasetInfo) {
                try {
                    const data = await fetchData(this, datasetName, param);
                    console.log('[Handler] Data received:', data);
                    // 데이터 처리 로직
                } catch (error) {
                    console.error('[Handler] Fetch error:', error);
                }
            }
        }

        console.log('[Handler] End - timestamp:', Date.now());
    }
};

onEventBusHandlers(this.eventBusHandlers);
```

**통과 기준:**
- async 핸들러 내에서 await가 정상 동작함
- 비동기 작업 완료 후 후속 로직이 실행됨
- 에러 발생 시 catch 블록에서 처리됨

---

### 2.4 테스트 요약 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-EV-001 | EventBus 핸들러 등록 및 호출 검증 | ☐ |
| TC-EV-002 | EventBus 핸들러 해제 검증 | ☐ |
| TC-EV-003 | customEvents + bindEvents 동작 검증 (2D) | ☐ |
| TC-EV-004 | 이벤트 위임 패턴 검증 (동적 요소) | ☐ |
| TC-EV-005 | removeCustomEvents 동작 검증 | ☐ |
| TC-EV-006 | @ 접두사 커스텀 이벤트 구분 검증 | ☐ |
| TC-EV-007 | 3D 이벤트 바인딩 검증 (bind3DEvents) | ☐ |
| TC-EV-008 | 3D 이벤트와 2D 이벤트 차이점 검증 | ☐ |
| TC-EV-009 | datasetInfo 검증 (3D 컴포넌트) | ☐ |
| TC-EV-010 | event vs targetInstance 정보 비교 검증 | ☐ |
| TC-EV-011 | 다중 이벤트 타입 바인딩 검증 | ☐ |
| TC-EV-012 | 이벤트 핸들러에서 비동기 처리 검증 | ☐ |

---

## 3. 데이터 흐름 테스트

### 3.1 개요

RNBT 아키텍처의 데이터 흐름은 **GlobalDataPublisher**를 중심으로 한 Pub-Sub 패턴입니다.
페이지가 데이터를 발행(publish)하고, 컴포넌트들이 구독(subscribe)하여 데이터를 수신합니다.

**핵심 흐름:**
```
페이지 (Publisher)
  → globalDataMappings 정의
  → registerMapping()
  → fetchAndPublish()
        ↓
컴포넌트들 (Subscribers)
  → subscribe(topic, handler)
  → 데이터 수신 및 렌더링
```

### 3.2 테스트 대상

| 대상 | 설명 |
|------|------|
| globalDataMappings | 페이지에서 정의하는 데이터 매핑 배열 |
| GlobalDataPublisher.registerMapping | 데이터 매핑 등록 |
| GlobalDataPublisher.unregisterMapping | 데이터 매핑 해제 |
| GlobalDataPublisher.fetchAndPublish | 데이터 fetch 후 구독자에게 발행 |
| GlobalDataPublisher.subscribe | 컴포넌트에서 topic 구독 |
| GlobalDataPublisher.unsubscribe | 컴포넌트에서 topic 구독 해제 |
| currentParams | topic별 동적 파라미터 관리 |

---

### 3.3 테스트 시나리오

#### TC-DF-001: globalDataMappings 정의 및 registerMapping 검증

**목적:** globalDataMappings 구조가 올바르게 정의되고 registerMapping이 정상 동작하는지 검증

**사전조건:**
- 페이지 loaded.js가 준비되어 있음
- GlobalDataPublisher가 사용 가능함

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | globalDataMappings 배열 정의 | topic, datasetInfo, refreshInterval 포함 |
| 2 | registerMapping() 호출 | 각 매핑이 등록됨 |
| 3 | 등록된 매핑 확인 | GlobalDataPublisher 내부에 매핑 저장됨 |

**검증 코드:**

```javascript
// page_loaded.js
const { each } = fx;

this.globalDataMappings = [
    {
        topic: 'sensorData',
        datasetInfo: {
            datasetName: 'sensorApi',
            param: { endpoint: '/api/sensors' }
        },
        refreshInterval: 5000
    },
    {
        topic: 'alertData',
        datasetInfo: {
            datasetName: 'alertApi',
            param: { endpoint: '/api/alerts' }
        }
        // refreshInterval 없음 = 한 번만 fetch
    }
];

// 매핑 등록
fx.go(
    this.globalDataMappings,
    each(mapping => {
        console.log('[Page] Registering mapping:', mapping.topic);
        GlobalDataPublisher.registerMapping(mapping);
    })
);

// 검증: 등록된 topic 확인
this.globalDataMappings.forEach(({ topic }) => {
    console.log(`[Verify] Topic '${topic}' registered:`, GlobalDataPublisher.isRegistered?.(topic));
});
```

**globalDataMappings 구조 검증:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| topic | string | O | 구독자들이 사용할 topic 이름 |
| datasetInfo.datasetName | string | O | API 데이터셋 이름 |
| datasetInfo.param | object | O | API 호출 파라미터 |
| refreshInterval | number | X | 밀리초 단위 갱신 주기 (없으면 1회 fetch) |

**통과 기준:**
- globalDataMappings 배열이 정상 생성됨
- 각 topic이 GlobalDataPublisher에 등록됨

---

#### TC-DF-002: subscribe 및 데이터 수신 검증

**목적:** 컴포넌트가 topic을 구독하고 데이터를 정상적으로 수신하는지 검증

**사전조건:**
- 페이지에서 topic이 등록되어 있음
- 컴포넌트가 준비되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | subscriptions 객체 정의 | topic과 핸들러 매핑 |
| 2 | subscribe() 호출 | 구독이 등록됨 |
| 3 | fetchAndPublish() 실행 | 구독자에게 데이터 전달됨 |
| 4 | 핸들러에서 response 수신 | { response: { data: ... } } 형태 |

**검증 코드:**

```javascript
// 컴포넌트 register.js
const { subscribe } = GlobalDataPublisher;
const { each } = fx;

let receivedData = null;
let handlerCallCount = 0;

this.subscriptions = {
    sensorData: ['renderSensorTable'],
    alertData: ['renderAlertList', 'updateAlertCount']
};

// 핸들러 정의 및 바인딩
function renderSensorTable({ response }) {
    handlerCallCount++;
    receivedData = response;
    console.log('[Component] renderSensorTable received:', response);

    const { data } = response;
    if (!data) return;

    // 렌더링 로직
    console.log('[Component] Rendering table with data:', data);
}

this.renderSensorTable = renderSensorTable.bind(this);

// 구독 등록
fx.go(
    Object.entries(this.subscriptions),
    each(([topic, fnList]) =>
        each(fn => {
            if (this[fn]) {
                console.log(`[Component] Subscribing ${fn} to ${topic}`);
                subscribe(topic, this, this[fn]);
            }
        }, fnList)
    )
);

// 테스트용 getter
this.getReceivedData = () => receivedData;
this.getHandlerCallCount = () => handlerCallCount;
```

**통과 기준:**
- subscribe 호출 시 에러 없음
- fetchAndPublish 후 핸들러가 호출됨
- response 객체에 data가 포함됨

---

#### TC-DF-003: 하나의 topic에 여러 핸들러 구독 검증

**목적:** 동일한 topic에 여러 핸들러가 구독할 수 있고, 모든 핸들러가 호출되는지 검증

**사전조건:**
- topic이 등록되어 있음
- 컴포넌트에 여러 렌더링 함수가 정의되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | topicA: ['handler1', 'handler2'] 정의 | 하나의 topic에 2개 핸들러 |
| 2 | 각 핸들러에 대해 subscribe() 호출 | 2개 구독 등록됨 |
| 3 | fetchAndPublish('topicA') 실행 | handler1, handler2 모두 호출됨 |

**검증 코드:**

```javascript
// 컴포넌트 register.js
let handler1Called = false;
let handler2Called = false;

this.subscriptions = {
    sensorData: ['renderTable', 'updateCount']
};

function renderTable({ response }) {
    handler1Called = true;
    console.log('[handler1] renderTable called');
}

function updateCount({ response }) {
    handler2Called = true;
    console.log('[handler2] updateCount called');
}

this.renderTable = renderTable.bind(this);
this.updateCount = updateCount.bind(this);

fx.go(
    Object.entries(this.subscriptions),
    each(([topic, fnList]) =>
        each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// 검증 (fetchAndPublish 후)
this.verifyAllHandlersCalled = () => {
    console.log('[Verify] handler1Called:', handler1Called);
    console.log('[Verify] handler2Called:', handler2Called);
    return handler1Called && handler2Called;
};
```

**통과 기준:**
- fetchAndPublish 후 모든 핸들러(renderTable, updateCount)가 호출됨
- verifyAllHandlersCalled()가 true 반환

---

#### TC-DF-004: 여러 컴포넌트가 동일 topic 구독 검증

**목적:** 서로 다른 컴포넌트들이 동일한 topic을 구독하고 모두 데이터를 수신하는지 검증

**사전조건:**
- 페이지에 Component A, B, C가 배치되어 있음
- 동일한 topic을 구독함

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | Component A, B, C 각각 'sharedTopic' 구독 | 3개 구독 등록 |
| 2 | fetchAndPublish('sharedTopic') 실행 | 3개 컴포넌트 모두에 데이터 전달 |
| 3 | 각 컴포넌트의 핸들러 호출 확인 | 모두 호출됨 |

**검증 코드:**

```javascript
// Component A - register.js
this.subscriptions = { sharedTopic: ['handleDataA'] };
this.handleDataA = ({ response }) => {
    window.componentAReceived = true;
    console.log('[Component A] Received data');
};
subscribe('sharedTopic', this, this.handleDataA);

// Component B - register.js
this.subscriptions = { sharedTopic: ['handleDataB'] };
this.handleDataB = ({ response }) => {
    window.componentBReceived = true;
    console.log('[Component B] Received data');
};
subscribe('sharedTopic', this, this.handleDataB);

// Component C - register.js
this.subscriptions = { sharedTopic: ['handleDataC'] };
this.handleDataC = ({ response }) => {
    window.componentCReceived = true;
    console.log('[Component C] Received data');
};
subscribe('sharedTopic', this, this.handleDataC);

// 페이지에서 검증
function verifyAllComponentsReceived() {
    return window.componentAReceived &&
           window.componentBReceived &&
           window.componentCReceived;
}
```

**통과 기준:**
- 3개 컴포넌트 모두 데이터 수신
- 중복 fetch 없이 한 번의 API 호출로 모두에게 전달

---

#### TC-DF-005: fetchAndPublish 동작 및 응답 구조 검증

**목적:** fetchAndPublish가 올바른 응답 구조로 데이터를 발행하는지 검증

**사전조건:**
- topic이 등록되어 있음
- 구독자가 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | fetchAndPublish(topic, page, param) 호출 | API fetch 실행 |
| 2 | 응답 수신 | { response: { data: ... } } 구조 |
| 3 | 구독자에게 전달 | 동일한 구조로 전달됨 |

**검증 코드:**

```javascript
// 페이지 loaded.js
const result = await GlobalDataPublisher.fetchAndPublish(
    'sensorData',
    this,
    this.currentParams['sensorData'] || {}
);

console.log('[fetchAndPublish] Result:', result);

// 컴포넌트 핸들러에서 응답 구조 검증
function renderData({ response }) {
    // 응답 구조 검증
    console.log('[Response] Has response:', 'response' in arguments[0]);
    console.log('[Response] response value:', response);
    console.log('[Response] Has data:', response?.data !== undefined);

    const { data } = response;
    if (!data) {
        console.warn('[Response] data is empty');
        return;
    }

    console.log('[Response] data type:', typeof data);
    console.log('[Response] data value:', data);
}
```

**응답 구조:**
```javascript
// 핸들러가 받는 인자
{
    response: {
        data: /* API 응답 데이터 */
    }
}
```

**통과 기준:**
- fetchAndPublish가 Promise를 반환
- 구독자가 { response: { data: ... } } 구조로 데이터 수신
- data가 null/undefined일 경우 핸들러에서 early return

---

#### TC-DF-006: unsubscribe 동작 검증

**목적:** unsubscribe 후 해당 컴포넌트에 더 이상 데이터가 전달되지 않는지 검증

**사전조건:**
- 컴포넌트가 topic을 구독 중임
- 데이터가 정상 수신되는 것이 확인됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 구독 상태에서 fetchAndPublish | 핸들러 호출됨, callCount = 1 |
| 2 | unsubscribe(topic, this) 호출 | 구독 해제됨 |
| 3 | 다시 fetchAndPublish | 핸들러 호출되지 않음, callCount = 1 (변화 없음) |

**검증 코드:**

```javascript
// 컴포넌트 beforeDestroy.js
const { unsubscribe } = GlobalDataPublisher;
const { each } = fx;

// 해제 전 callCount 확인
console.log('[Before unsubscribe] callCount:', this.getHandlerCallCount());

// 구독 해제
fx.go(
    Object.entries(this.subscriptions),
    each(([topic, _]) => {
        console.log(`[Component] Unsubscribing from ${topic}`);
        unsubscribe(topic, this);
    })
);

this.subscriptions = null;

// 해제 후 fetchAndPublish (페이지에서)
// await GlobalDataPublisher.fetchAndPublish('sensorData', page);

// 해제 후 callCount 확인
console.log('[After unsubscribe] callCount:', this.getHandlerCallCount()); // 변화 없어야 함
```

**통과 기준:**
- unsubscribe 후 fetchAndPublish 시 핸들러가 호출되지 않음
- 다른 구독자들은 여전히 데이터를 수신함

---

#### TC-DF-007: unregisterMapping 동작 검증

**목적:** unregisterMapping 후 해당 topic의 fetchAndPublish가 동작하지 않는지 검증

**사전조건:**
- 페이지에서 topic이 등록되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 등록 상태에서 fetchAndPublish | 정상 동작 |
| 2 | unregisterMapping(topic) 호출 | 매핑 해제됨 |
| 3 | 다시 fetchAndPublish | 에러 또는 무시됨 |

**검증 코드:**

```javascript
// 페이지 before_unload.js
const { each } = fx;

// 매핑 해제
fx.go(
    this.globalDataMappings,
    each(({ topic }) => {
        console.log(`[Page] Unregistering mapping: ${topic}`);
        GlobalDataPublisher.unregisterMapping(topic);
    })
);

this.globalDataMappings = null;

// 해제 후 fetchAndPublish 시도
try {
    await GlobalDataPublisher.fetchAndPublish('sensorData', this);
    console.log('[After unregister] fetchAndPublish succeeded (unexpected?)');
} catch (e) {
    console.log('[After unregister] fetchAndPublish failed:', e.message);
}
```

**통과 기준:**
- unregisterMapping 후 해당 topic의 fetchAndPublish가 동작하지 않거나 에러 발생

---

#### TC-DF-008: currentParams 초기화 및 관리 검증

**목적:** currentParams가 topic별로 올바르게 초기화되고 관리되는지 검증

**사전조건:**
- globalDataMappings가 정의되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | this.currentParams = {} 초기화 | 빈 객체 생성 |
| 2 | 각 topic에 대해 currentParams[topic] = {} | topic별 빈 객체 생성 |
| 3 | fetchAndPublish 시 currentParams[topic] 전달 | 해당 param으로 API 호출 |

**검증 코드:**

```javascript
// 페이지 loaded.js
this.currentParams = {};

fx.go(
    this.globalDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) => {
        this.currentParams[topic] = {};
        console.log(`[Page] Initialized currentParams['${topic}']`);
    }),
    each(({ topic }) =>
        GlobalDataPublisher.fetchAndPublish(topic, this, this.currentParams[topic])
    )
);

// 검증
console.log('[Verify] currentParams:', this.currentParams);
console.log('[Verify] currentParams keys:', Object.keys(this.currentParams));
```

**currentParams 구조:**
```javascript
this.currentParams = {
    sensorData: {},     // topic별 param 객체
    alertData: {}
};
```

**통과 기준:**
- globalDataMappings의 모든 topic에 대해 currentParams가 초기화됨
- fetchAndPublish 시 해당 topic의 currentParams가 전달됨

---

#### TC-DF-009: 동적 Param 변경 및 즉시 반영 검증

**목적:** currentParams를 동적으로 변경하고 즉시 fetchAndPublish로 반영되는지 검증

**사전조건:**
- currentParams가 초기화되어 있음
- 해당 topic에 구독자가 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 초기 param으로 fetchAndPublish | 초기 데이터 수신 |
| 2 | currentParams[topic] 업데이트 | { filter: 'new-value' } 추가 |
| 3 | 즉시 fetchAndPublish 호출 | 새로운 param으로 API 호출 |
| 4 | 구독자가 새로운 데이터 수신 | 필터링된 데이터 수신 |

**검증 코드:**

```javascript
// 페이지 before_load.js - 이벤트 핸들러
this.eventBusHandlers = {
    '@filterChanged': ({ event }) => {
        const filter = event.target.value;

        // 1. currentParams 업데이트
        this.currentParams['sensorData'] = {
            ...this.currentParams['sensorData'],
            filter
        };

        console.log('[Page] Updated currentParams:', this.currentParams['sensorData']);

        // 2. 즉시 fetchAndPublish
        GlobalDataPublisher.fetchAndPublish(
            'sensorData',
            this,
            this.currentParams['sensorData']
        );

        // 3. Interval은 자동으로 업데이트된 param 사용
        // No stop/start needed!
    }
};
```

**통과 기준:**
- currentParams 업데이트 후 즉시 fetchAndPublish로 새 데이터 수신
- 기존 Interval은 재시작 없이 업데이트된 param 사용

---

#### TC-DF-010: 응답 데이터가 없는 경우 처리 검증

**목적:** API 응답에 data가 없거나 빈 경우 핸들러에서 올바르게 처리되는지 검증

**사전조건:**
- API가 빈 응답을 반환하도록 설정됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | API가 { response: { data: null } } 반환 | 핸들러 호출됨 |
| 2 | 핸들러에서 data 체크 | early return 발생 |
| 3 | 렌더링 로직 미실행 | 에러 없이 종료 |

**검증 코드:**

```javascript
// 컴포넌트 핸들러
function renderTable({ response }) {
    console.log('[Handler] Called with response:', response);

    const { data } = response;
    if (!data) {
        console.log('[Handler] Early return: data is empty');
        return;
    }

    console.log('[Handler] Processing data:', data);
    // 렌더링 로직
}
```

**통과 기준:**
- data가 null/undefined일 때 에러 없이 early return
- 렌더링 로직이 실행되지 않음

---

#### TC-DF-011: 다중 데이터셋 병렬 fetch 검증

**목적:** globalDataMappings에 여러 데이터셋이 있을 때 병렬로 fetch되는지 검증

**사전조건:**
- 여러 topic이 정의되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 3개 topic (A, B, C) 정의 | 3개 데이터셋 매핑 |
| 2 | 순차적 fetchAndPublish | 각각 독립적으로 fetch |
| 3 | 시간 측정 | 병렬이면 빠르고, 직렬이면 느림 |

**검증 코드:**

```javascript
// 페이지 loaded.js
this.globalDataMappings = [
    { topic: 'topicA', datasetInfo: { datasetName: 'apiA', param: {} } },
    { topic: 'topicB', datasetInfo: { datasetName: 'apiB', param: {} } },
    { topic: 'topicC', datasetInfo: { datasetName: 'apiC', param: {} } }
];

// 순차 실행 (현재 패턴)
const startTime = Date.now();

fx.go(
    this.globalDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) => this.currentParams[topic] = {}),
    each(({ topic }) =>
        GlobalDataPublisher.fetchAndPublish(topic, this)
            .catch(err => console.error(`[fetchAndPublish:${topic}]`, err))
    )
);

const endTime = Date.now();
console.log(`[Performance] Total fetch time: ${endTime - startTime}ms`);
```

**참고:** fx.go의 each는 기본적으로 순차 실행이지만, Promise를 반환하는 경우 비동기로 동작합니다.

**통과 기준:**
- 모든 topic에 대해 fetchAndPublish가 실행됨
- 각 구독자가 해당 topic의 데이터를 수신함

---

#### TC-DF-012: Topic 기반 중복 fetch 방지 검증

**목적:** 동일한 topic으로 여러 컴포넌트가 구독해도 API는 한 번만 호출되는지 검증

**사전조건:**
- 3개 컴포넌트가 동일 topic 구독
- API 호출 횟수 모니터링 가능

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 3개 컴포넌트가 'sharedTopic' 구독 | 3개 구독 등록 |
| 2 | fetchAndPublish('sharedTopic') 1회 호출 | API 1회 호출 |
| 3 | 3개 컴포넌트 모두 데이터 수신 | 각각 핸들러 호출됨 |

**검증 코드:**

```javascript
// API 호출 횟수 모니터링 (테스트용)
window.apiCallCount = 0;

// Mock fetchData
const originalFetchData = Wkit.fetchData;
Wkit.fetchData = async function(...args) {
    window.apiCallCount++;
    console.log(`[API] Call #${window.apiCallCount}`);
    return originalFetchData.apply(this, args);
};

// fetchAndPublish 후 검증
await GlobalDataPublisher.fetchAndPublish('sharedTopic', page);

console.log('[Verify] API call count:', window.apiCallCount); // 1
console.log('[Verify] All components received data:', verifyAllComponentsReceived()); // true
```

**통과 기준:**
- 3개 구독자가 있어도 API는 1회만 호출됨
- 모든 구독자가 동일한 데이터를 수신함

---

### 3.4 테스트 요약 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-DF-001 | globalDataMappings 정의 및 registerMapping 검증 | ☐ |
| TC-DF-002 | subscribe 및 데이터 수신 검증 | ☐ |
| TC-DF-003 | 하나의 topic에 여러 핸들러 구독 검증 | ☐ |
| TC-DF-004 | 여러 컴포넌트가 동일 topic 구독 검증 | ☐ |
| TC-DF-005 | fetchAndPublish 동작 및 응답 구조 검증 | ☐ |
| TC-DF-006 | unsubscribe 동작 검증 | ☐ |
| TC-DF-007 | unregisterMapping 동작 검증 | ☐ |
| TC-DF-008 | currentParams 초기화 및 관리 검증 | ☐ |
| TC-DF-009 | 동적 Param 변경 및 즉시 반영 검증 | ☐ |
| TC-DF-010 | 응답 데이터가 없는 경우 처리 검증 | ☐ |
| TC-DF-011 | 다중 데이터셋 병렬 fetch 검증 | ☐ |
| TC-DF-012 | Topic 기반 중복 fetch 방지 검증 | ☐ |

---

## 4. Interval 관리 테스트

### 4.1 개요

RNBT 아키텍처에서 Interval은 데이터의 주기적 갱신을 담당합니다.
각 topic은 독립적인 refreshInterval을 가질 수 있으며, 페이지가 이를 관리합니다.

**핵심 개념:**
- `refreshInterval`: globalDataMappings에서 정의하는 밀리초 단위 갱신 주기
- `this.refreshIntervals`: topic별 setInterval ID를 저장하는 객체
- `startAllIntervals()` / `stopAllIntervals()`: Interval 시작/중단 함수
- **currentParams는 참조**: Interval 재시작 없이 param 변경이 자동 반영됨

### 4.2 테스트 대상

| 대상 | 설명 |
|------|------|
| refreshInterval | topic별 갱신 주기 (밀리초) |
| this.refreshIntervals | topic별 interval ID 저장 객체 |
| startAllIntervals() | 모든 topic의 interval 시작 |
| stopAllIntervals() | 모든 topic의 interval 중단 |
| clearInterval() | 개별 interval 해제 |

---

### 4.3 테스트 시나리오

#### TC-IV-001: refreshInterval 정의 및 동작 검증

**목적:** globalDataMappings에 refreshInterval을 정의하면 주기적으로 fetchAndPublish가 실행되는지 검증

**사전조건:**
- globalDataMappings에 refreshInterval이 정의되어 있음
- 해당 topic에 구독자가 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | refreshInterval: 5000 정의 | 5초 주기 갱신 설정 |
| 2 | startAllIntervals() 호출 | interval 시작됨 |
| 3 | 5초 대기 | fetchAndPublish 1회 실행 |
| 4 | 10초 대기 | fetchAndPublish 2회 실행 |

**검증 코드:**

```javascript
// page_loaded.js
this.globalDataMappings = [
    {
        topic: 'sensorData',
        datasetInfo: {
            datasetName: 'sensorApi',
            param: { endpoint: '/api/sensors' }
        },
        refreshInterval: 5000  // 5초
    }
];

// fetch 횟수 추적
let fetchCount = 0;
const originalFetchAndPublish = GlobalDataPublisher.fetchAndPublish;
GlobalDataPublisher.fetchAndPublish = async function(topic, ...args) {
    if (topic === 'sensorData') {
        fetchCount++;
        console.log(`[Interval] Fetch #${fetchCount} for ${topic} at ${Date.now()}`);
    }
    return originalFetchAndPublish.call(this, topic, ...args);
};

// Interval 시작
this.startAllIntervals = () => {
    this.refreshIntervals = {};

    fx.go(
        this.globalDataMappings,
        each(({ topic, refreshInterval }) => {
            if (refreshInterval) {
                console.log(`[Page] Setting interval for ${topic}: ${refreshInterval}ms`);
                this.refreshIntervals[topic] = setInterval(() => {
                    GlobalDataPublisher.fetchAndPublish(
                        topic,
                        this,
                        this.currentParams[topic] || {}
                    ).catch(err => console.error(`[fetchAndPublish:${topic}]`, err));
                }, refreshInterval);
            }
        })
    );
};

this.startAllIntervals();

// 검증 (15초 후)
setTimeout(() => {
    console.log(`[Verify] Fetch count after 15s: ${fetchCount}`);
    // 최초 1회 + interval 2회 = 약 3회 예상 (타이밍에 따라 2~3회)
}, 15000);
```

**통과 기준:**
- refreshInterval 정의 시 해당 주기로 fetchAndPublish가 반복 실행됨
- 5초 interval일 경우 15초 후 약 2~3회 실행

---

#### TC-IV-002: refreshInterval 없는 topic 처리 검증

**목적:** refreshInterval이 없는 topic은 interval 없이 한 번만 fetch되는지 검증

**사전조건:**
- globalDataMappings에 refreshInterval이 없는 topic이 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | refreshInterval 없이 topic 정의 | 한 번만 fetch 설정 |
| 2 | startAllIntervals() 호출 | 해당 topic의 interval은 설정되지 않음 |
| 3 | 10초 대기 | 추가 fetch 없음 |

**검증 코드:**

```javascript
// page_loaded.js
this.globalDataMappings = [
    {
        topic: 'staticData',
        datasetInfo: {
            datasetName: 'staticApi',
            param: { endpoint: '/api/static' }
        }
        // refreshInterval 없음!
    },
    {
        topic: 'dynamicData',
        datasetInfo: {
            datasetName: 'dynamicApi',
            param: { endpoint: '/api/dynamic' }
        },
        refreshInterval: 3000
    }
];

// fetch 횟수 추적
const fetchCounts = { staticData: 0, dynamicData: 0 };

// startAllIntervals 후
this.startAllIntervals();

// 검증
setTimeout(() => {
    console.log('[Verify] staticData fetch count:', fetchCounts.staticData);   // 1 (최초만)
    console.log('[Verify] dynamicData fetch count:', fetchCounts.dynamicData); // 3~4 (최초 + interval)
}, 10000);
```

**통과 기준:**
- refreshInterval 없는 topic은 최초 1회만 fetch
- refreshInterval 있는 topic은 주기적으로 fetch

---

#### TC-IV-003: startAllIntervals 동작 검증

**목적:** startAllIntervals가 모든 topic의 interval을 올바르게 시작하는지 검증

**사전조건:**
- 여러 topic에 각각 다른 refreshInterval이 정의되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | topic A: 3000ms, topic B: 5000ms 정의 | 서로 다른 주기 |
| 2 | startAllIntervals() 호출 | 두 interval 모두 시작 |
| 3 | this.refreshIntervals 확인 | 두 topic의 interval ID 저장됨 |

**검증 코드:**

```javascript
// page_loaded.js
this.globalDataMappings = [
    { topic: 'topicA', datasetInfo: { datasetName: 'apiA', param: {} }, refreshInterval: 3000 },
    { topic: 'topicB', datasetInfo: { datasetName: 'apiB', param: {} }, refreshInterval: 5000 }
];

this.startAllIntervals = () => {
    this.refreshIntervals = {};

    fx.go(
        this.globalDataMappings,
        each(({ topic, refreshInterval }) => {
            if (refreshInterval) {
                this.refreshIntervals[topic] = setInterval(() => {
                    GlobalDataPublisher.fetchAndPublish(
                        topic,
                        this,
                        this.currentParams[topic] || {}
                    );
                }, refreshInterval);
            }
        })
    );

    // 검증
    console.log('[startAllIntervals] refreshIntervals:', this.refreshIntervals);
    console.log('[startAllIntervals] topicA interval ID:', this.refreshIntervals['topicA']);
    console.log('[startAllIntervals] topicB interval ID:', this.refreshIntervals['topicB']);
};

this.startAllIntervals();
```

**통과 기준:**
- this.refreshIntervals에 각 topic의 interval ID가 저장됨
- 각 interval ID가 유효한 숫자임

---

#### TC-IV-004: stopAllIntervals 동작 검증

**목적:** stopAllIntervals가 모든 interval을 올바르게 중단하는지 검증

**사전조건:**
- 여러 interval이 실행 중임

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 여러 interval 실행 중 | fetchAndPublish 주기적 실행 |
| 2 | stopAllIntervals() 호출 | 모든 interval 중단 |
| 3 | 10초 대기 | 추가 fetchAndPublish 없음 |

**검증 코드:**

```javascript
// page_before_unload.js 또는 테스트 코드
this.stopAllIntervals = () => {
    console.log('[stopAllIntervals] Stopping all intervals...');
    console.log('[stopAllIntervals] Current intervals:', Object.keys(this.refreshIntervals || {}));

    fx.go(
        Object.values(this.refreshIntervals || {}),
        each(interval => {
            console.log('[stopAllIntervals] Clearing interval:', interval);
            clearInterval(interval);
        })
    );

    console.log('[stopAllIntervals] All intervals stopped');
};

// 테스트
const fetchCountBefore = fetchCount;
this.stopAllIntervals();

setTimeout(() => {
    const fetchCountAfter = fetchCount;
    console.log('[Verify] Fetch count before stop:', fetchCountBefore);
    console.log('[Verify] Fetch count after 10s:', fetchCountAfter);
    console.log('[Verify] No new fetches:', fetchCountBefore === fetchCountAfter);
}, 10000);
```

**통과 기준:**
- stopAllIntervals 후 추가 fetchAndPublish가 실행되지 않음
- 모든 interval이 clearInterval로 해제됨

---

#### TC-IV-005: 개별 topic interval 정리 검증

**목적:** 특정 topic의 interval만 선택적으로 정리할 수 있는지 검증

**사전조건:**
- 여러 topic의 interval이 실행 중임

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | topicA, topicB interval 실행 중 | 둘 다 주기적 fetch |
| 2 | clearInterval(refreshIntervals['topicA']) | topicA만 중단 |
| 3 | 대기 | topicA는 중단, topicB는 계속 실행 |

**검증 코드:**

```javascript
// 개별 interval 정리
function stopIntervalForTopic(topic) {
    if (this.refreshIntervals?.[topic]) {
        console.log(`[Page] Stopping interval for ${topic}`);
        clearInterval(this.refreshIntervals[topic]);
        delete this.refreshIntervals[topic];
    }
}

// 테스트
stopIntervalForTopic.call(this, 'topicA');

// 검증
setTimeout(() => {
    console.log('[Verify] topicA fetch count:', fetchCounts.topicA); // 중단됨
    console.log('[Verify] topicB fetch count:', fetchCounts.topicB); // 계속 증가
}, 10000);
```

**통과 기준:**
- 특정 topic의 interval만 중단됨
- 다른 topic의 interval은 계속 실행됨

---

#### TC-IV-006: currentParams 참조 기반 자동 업데이트 검증

**목적:** currentParams가 참조이므로 interval 재시작 없이 param 변경이 반영되는지 검증

**사전조건:**
- interval이 실행 중임
- currentParams가 초기화되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | interval 실행 중 (param: { filter: 'a' }) | 기존 param으로 fetch |
| 2 | currentParams[topic] = { filter: 'b' } 변경 | 참조 업데이트 |
| 3 | 다음 interval tick | 새로운 param { filter: 'b' }로 fetch |
| 4 | interval stop/start 없음 | 자동 반영됨 |

**검증 코드:**

```javascript
// 초기 설정
this.currentParams = {
    sensorData: { filter: 'initial' }
};

// interval 설정
this.refreshIntervals.sensorData = setInterval(() => {
    console.log('[Interval] Fetching with param:', this.currentParams.sensorData);
    GlobalDataPublisher.fetchAndPublish(
        'sensorData',
        this,
        this.currentParams.sensorData  // ← 참조!
    );
}, 3000);

// 5초 후 param 변경 (interval 재시작 없이)
setTimeout(() => {
    console.log('[Page] Changing filter to "updated"');
    this.currentParams.sensorData = {
        ...this.currentParams.sensorData,
        filter: 'updated'
    };
    // No stop/start needed!
}, 5000);

// 10초 후 검증
setTimeout(() => {
    // 로그에서 'updated' filter로 fetch된 것 확인
}, 10000);
```

**통과 기준:**
- interval 재시작 없이 currentParams 변경이 다음 tick에 반영됨
- stop/start 호출 없이 새로운 param으로 fetch됨

---

#### TC-IV-007: 서로 다른 refreshInterval 독립성 검증

**목적:** 각 topic의 refreshInterval이 독립적으로 동작하는지 검증

**사전조건:**
- topic A: 2000ms, topic B: 5000ms로 설정

**테스트 단계:**

| 단계 | 시간 | topicA fetch | topicB fetch |
|------|------|--------------|--------------|
| 1 | 0s | 1회 (최초) | 1회 (최초) |
| 2 | 2s | 2회 | - |
| 3 | 4s | 3회 | - |
| 4 | 5s | - | 2회 |
| 5 | 6s | 4회 | - |
| 6 | 10s | 6회 | 3회 |

**검증 코드:**

```javascript
// page_loaded.js
this.globalDataMappings = [
    { topic: 'topicA', datasetInfo: { datasetName: 'apiA', param: {} }, refreshInterval: 2000 },
    { topic: 'topicB', datasetInfo: { datasetName: 'apiB', param: {} }, refreshInterval: 5000 }
];

const fetchLog = [];

// fetch 로깅
GlobalDataPublisher.fetchAndPublish = async function(topic, ...args) {
    fetchLog.push({ topic, timestamp: Date.now() });
    console.log(`[${topic}] Fetch at ${Date.now()}`);
    return originalFetchAndPublish.call(this, topic, ...args);
};

// 10초 후 검증
setTimeout(() => {
    const topicACounts = fetchLog.filter(l => l.topic === 'topicA').length;
    const topicBCounts = fetchLog.filter(l => l.topic === 'topicB').length;

    console.log('[Verify] topicA fetch count:', topicACounts); // 약 5~6회
    console.log('[Verify] topicB fetch count:', topicBCounts); // 약 2~3회
    console.log('[Verify] Ratio (A/B):', topicACounts / topicBCounts); // 약 2.5
}, 10000);
```

**통과 기준:**
- 각 topic이 자신의 refreshInterval에 따라 독립적으로 fetch
- 서로의 주기에 영향을 주지 않음

---

#### TC-IV-008: Interval 내 에러 처리 검증

**목적:** interval 내 fetchAndPublish에서 에러 발생 시 interval이 중단되지 않는지 검증

**사전조건:**
- interval이 실행 중임
- API가 간헐적으로 에러를 반환하도록 설정됨

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | interval 실행 중 | 주기적 fetch |
| 2 | 2번째 fetch에서 에러 발생 | 에러 로깅됨 |
| 3 | 3번째 fetch | 정상 실행됨 (interval 중단 안 됨) |

**검증 코드:**

```javascript
// interval 설정 (에러 처리 포함)
this.refreshIntervals[topic] = setInterval(() => {
    GlobalDataPublisher.fetchAndPublish(
        topic,
        this,
        this.currentParams[topic] || {}
    ).catch(err => {
        // 에러 로깅만 하고 interval은 계속
        console.error(`[fetchAndPublish:${topic}]`, err);
        // interval 중단하지 않음!
    });
}, refreshInterval);

// 에러 시뮬레이션
let callCount = 0;
const originalFetch = GlobalDataPublisher.fetchAndPublish;
GlobalDataPublisher.fetchAndPublish = async function(topic, ...args) {
    callCount++;
    if (callCount === 2) {
        throw new Error('Simulated API error');
    }
    return originalFetch.call(this, topic, ...args);
};

// 검증
setTimeout(() => {
    console.log('[Verify] Total fetch attempts:', callCount);
    console.log('[Verify] Interval still running:', callCount > 2); // true
}, 10000);
```

**통과 기준:**
- fetchAndPublish 에러 발생 시 interval이 중단되지 않음
- 에러 후 다음 tick에서 정상적으로 fetch 시도됨

---

#### TC-IV-009: 페이지 언로드 시 Interval 정리 검증

**목적:** 페이지 언로드 시 모든 interval이 올바르게 정리되는지 검증

**사전조건:**
- 여러 interval이 실행 중임

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 페이지 언로드 시작 | before_unload 실행 |
| 2 | stopAllIntervals() 호출 | 모든 interval 중단 |
| 3 | this.refreshIntervals = null | 참조 제거 |
| 4 | 메모리 누수 없음 | interval이 GC 대상이 됨 |

**검증 코드:**

```javascript
// page_before_unload.js
// 1. Interval 중단
if (this.stopAllIntervals) {
    this.stopAllIntervals();
}

// 2. 참조 제거
this.refreshIntervals = null;

// 3. 관련 리소스 정리
this.globalDataMappings = null;
this.currentParams = null;

console.log('[Page] All intervals cleaned up');
```

**정리 순서 테이블:**

| 순서 | 생성 (loaded) | 정리 (before_unload) |
|------|---------------|----------------------|
| 1 | setInterval() | clearInterval() via stopAllIntervals() |
| 2 | this.refreshIntervals = {} | this.refreshIntervals = null |
| 3 | this.currentParams = {} | this.currentParams = null |
| 4 | this.globalDataMappings = [...] | this.globalDataMappings = null |

**통과 기준:**
- 페이지 언로드 후 interval이 실행되지 않음
- 모든 참조가 null로 설정되어 GC 가능

---

#### TC-IV-010: Interval on/off 토글 기능 검증

**목적:** 런타임에 interval을 일시 중지하고 재시작할 수 있는지 검증

**사전조건:**
- interval이 실행 중임
- stop/start 함수가 정의되어 있음

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | interval 실행 중 | 주기적 fetch |
| 2 | stopAllIntervals() 호출 | 일시 중지 |
| 3 | 5초 대기 | fetch 없음 |
| 4 | startAllIntervals() 호출 | 재시작 |
| 5 | 5초 대기 | 다시 주기적 fetch |

**검증 코드:**

```javascript
// 테스트 시나리오
let fetchCount = 0;

// interval 시작
this.startAllIntervals();
console.log('[Test] Intervals started');

// 5초 후 중지
setTimeout(() => {
    const countBeforeStop = fetchCount;
    console.log('[Test] Stopping intervals, current count:', countBeforeStop);
    this.stopAllIntervals();

    // 5초 대기
    setTimeout(() => {
        console.log('[Test] Count after 5s pause:', fetchCount);
        console.log('[Test] No new fetches:', fetchCount === countBeforeStop);

        // 재시작
        console.log('[Test] Restarting intervals');
        this.startAllIntervals();

        // 5초 후 검증
        setTimeout(() => {
            console.log('[Test] Count after restart + 5s:', fetchCount);
            console.log('[Test] Fetches resumed:', fetchCount > countBeforeStop);
        }, 5000);
    }, 5000);
}, 5000);
```

**통과 기준:**
- stopAllIntervals 후 fetch가 중지됨
- startAllIntervals 후 fetch가 재개됨
- currentParams 상태가 유지됨

---

### 4.4 테스트 요약 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-IV-001 | refreshInterval 정의 및 동작 검증 | ☐ |
| TC-IV-002 | refreshInterval 없는 topic 처리 검증 | ☐ |
| TC-IV-003 | startAllIntervals 동작 검증 | ☐ |
| TC-IV-004 | stopAllIntervals 동작 검증 | ☐ |
| TC-IV-005 | 개별 topic interval 정리 검증 | ☐ |
| TC-IV-006 | currentParams 참조 기반 자동 업데이트 검증 | ☐ |
| TC-IV-007 | 서로 다른 refreshInterval 독립성 검증 | ☐ |
| TC-IV-008 | Interval 내 에러 처리 검증 | ☐ |
| TC-IV-009 | 페이지 언로드 시 Interval 정리 검증 | ☐ |
| TC-IV-010 | Interval on/off 토글 기능 검증 | ☐ |

---

## 5. 리소스 정리 테스트

### 5.1 개요

RNBT 아키텍처에서 리소스 정리는 메모리 누수를 방지하고 안정적인 애플리케이션 동작을 보장하는 핵심 요소입니다.
**"생성된 모든 리소스는 1:1 매칭으로 정리되어야 한다"**는 원칙을 따릅니다.

**핵심 원칙:**
- 생성과 정리는 반드시 1:1로 매칭
- 참조 타입은 null로 설정하여 GC 가능하게 함
- 정리 순서는 생성의 역순

### 5.2 테스트 대상

| 영역 | 생성 | 정리 |
|------|------|------|
| 페이지 이벤트 | onEventBusHandlers | offEventBusHandlers |
| 페이지 데이터 | registerMapping | unregisterMapping |
| 페이지 인터벌 | setInterval | clearInterval (stopAllIntervals) |
| 컴포넌트 이벤트 | bindEvents | removeCustomEvents |
| 컴포넌트 구독 | subscribe | unsubscribe |
| 3D 리소스 | Three.js 객체 | disposeAllThreeResources |
| 팝업 | createPopup | destroyPopup |

---

### 5.3 테스트 시나리오

#### TC-RC-001: 페이지 생성/정리 매칭 검증 (eventBusHandlers)

**목적:** eventBusHandlers가 생성/정리 1:1 매칭되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (before_load) | 정리 (before_unload) |
|--------------------|----------------------|
| `this.eventBusHandlers = {...}` | `this.eventBusHandlers = null` |
| `onEventBusHandlers(...)` | `offEventBusHandlers(...)` |

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | eventBusHandlers 생성 및 등록 | 핸들러가 EventBus에 등록됨 |
| 2 | 이벤트 발행 | 핸들러 호출됨 |
| 3 | offEventBusHandlers 호출 | 핸들러 해제됨 |
| 4 | this.eventBusHandlers = null | 참조 제거됨 |
| 5 | 이벤트 다시 발행 | 핸들러 호출되지 않음 |

**검증 코드:**

```javascript
// page_before_load.js
const { onEventBusHandlers } = Wkit;

this.eventBusHandlers = {
    '@testEvent': ({ event }) => {
        console.log('[Handler] Called');
    }
};

onEventBusHandlers(this.eventBusHandlers);

// page_before_unload.js
const { offEventBusHandlers } = Wkit;

// 1. 핸들러 해제
offEventBusHandlers.call(this, this.eventBusHandlers);

// 2. 참조 제거
this.eventBusHandlers = null;

// 검증
console.log('[Verify] eventBusHandlers:', this.eventBusHandlers); // null
```

**통과 기준:**
- offEventBusHandlers 호출 후 이벤트 수신 안 됨
- this.eventBusHandlers가 null로 설정됨

---

#### TC-RC-002: 페이지 생성/정리 매칭 검증 (globalDataMappings)

**목적:** globalDataMappings와 관련 리소스가 1:1 매칭되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (loaded) | 정리 (before_unload) |
|---------------|----------------------|
| `this.globalDataMappings = [...]` | `this.globalDataMappings = null` |
| `this.currentParams = {}` | `this.currentParams = null` |
| `GlobalDataPublisher.registerMapping(...)` | `GlobalDataPublisher.unregisterMapping(...)` |

**검증 코드:**

```javascript
// page_loaded.js - 생성
this.globalDataMappings = [
    { topic: 'topicA', datasetInfo: { datasetName: 'apiA', param: {} } },
    { topic: 'topicB', datasetInfo: { datasetName: 'apiB', param: {} } }
];

this.currentParams = {};

fx.go(
    this.globalDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) => this.currentParams[topic] = {})
);

// page_before_unload.js - 정리
fx.go(
    this.globalDataMappings,
    each(({ topic }) => GlobalDataPublisher.unregisterMapping(topic))
);

this.globalDataMappings = null;
this.currentParams = null;

// 검증
console.log('[Verify] globalDataMappings:', this.globalDataMappings); // null
console.log('[Verify] currentParams:', this.currentParams); // null
```

**통과 기준:**
- 모든 topic에 대해 unregisterMapping 호출됨
- globalDataMappings와 currentParams가 null

---

#### TC-RC-003: 페이지 생성/정리 매칭 검증 (refreshIntervals)

**목적:** interval 생성과 정리가 1:1 매칭되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (loaded) | 정리 (before_unload) |
|---------------|----------------------|
| `this.refreshIntervals = {}` | `this.refreshIntervals = null` |
| `setInterval(...)` | `clearInterval(...)` via stopAllIntervals |

**검증 코드:**

```javascript
// page_loaded.js - 생성
this.refreshIntervals = {};

fx.go(
    this.globalDataMappings,
    each(({ topic, refreshInterval }) => {
        if (refreshInterval) {
            this.refreshIntervals[topic] = setInterval(() => {
                // fetch logic
            }, refreshInterval);
        }
    })
);

console.log('[Create] Interval count:', Object.keys(this.refreshIntervals).length);

// page_before_unload.js - 정리
const intervalCount = Object.keys(this.refreshIntervals || {}).length;

this.stopAllIntervals();
this.refreshIntervals = null;

console.log('[Destroy] Intervals cleared:', intervalCount);
console.log('[Verify] refreshIntervals:', this.refreshIntervals); // null
```

**통과 기준:**
- 생성된 interval 개수 = 정리된 interval 개수
- this.refreshIntervals가 null

---

#### TC-RC-004: 컴포넌트 생성/정리 매칭 검증 (customEvents)

**목적:** 컴포넌트의 customEvents가 1:1 매칭되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (register) | 정리 (beforeDestroy) |
|-----------------|----------------------|
| `this.customEvents = {...}` | `this.customEvents = null` |
| `bindEvents(this, customEvents)` | `removeCustomEvents(this, customEvents)` |

**검증 코드:**

```javascript
// register.js - 생성
const { bindEvents } = Wkit;

this.customEvents = {
    click: {
        '.button': '@buttonClicked'
    }
};

bindEvents(this, this.customEvents);

// beforeDestroy.js - 정리
const { removeCustomEvents } = Wkit;

// 1. 이벤트 제거 (참조가 있는 동안 호출)
removeCustomEvents(this, this.customEvents);

// 2. 참조 제거
this.customEvents = null;

console.log('[Verify] customEvents:', this.customEvents); // null
```

**통과 기준:**
- removeCustomEvents 호출 후 이벤트 발행 안 됨
- this.customEvents가 null

---

#### TC-RC-005: 컴포넌트 생성/정리 매칭 검증 (subscriptions)

**목적:** 컴포넌트의 subscriptions가 1:1 매칭되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (register) | 정리 (beforeDestroy) |
|-----------------|----------------------|
| `this.subscriptions = {...}` | `this.subscriptions = null` |
| `subscribe(topic, this, handler)` | `unsubscribe(topic, this)` |
| `this.renderData = fn.bind(this)` | `this.renderData = null` |

**검증 코드:**

```javascript
// register.js - 생성
const { subscribe } = GlobalDataPublisher;

this.subscriptions = {
    sensorData: ['renderTable', 'updateCount']
};

this.renderTable = renderTable.bind(this);
this.updateCount = updateCount.bind(this);

fx.go(
    Object.entries(this.subscriptions),
    each(([topic, fnList]) =>
        each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// beforeDestroy.js - 정리
const { unsubscribe } = GlobalDataPublisher;

// 1. 구독 해제
fx.go(
    Object.entries(this.subscriptions),
    each(([topic, _]) => unsubscribe(topic, this))
);

// 2. 참조 제거
this.subscriptions = null;
this.renderTable = null;
this.updateCount = null;

console.log('[Verify] subscriptions:', this.subscriptions); // null
console.log('[Verify] renderTable:', this.renderTable); // null
```

**통과 기준:**
- 모든 topic에 대해 unsubscribe 호출됨
- subscriptions와 핸들러 참조가 null

---

#### TC-RC-006: 3D 리소스 정리 검증 (disposeAllThreeResources)

**목적:** 3D 컴포넌트의 리소스가 올바르게 정리되는지 검증

**정리 대상:**
- subscriptions 해제
- customEvents, datasetInfo 참조 제거
- geometry, material, texture dispose
- Scene background 정리

**검증 코드:**

```javascript
// 3D 컴포넌트 register.js
const { bind3DEvents } = Wkit;

this.customEvents = {
    click: '@3dObjectClicked'
};

this.datasetInfo = [
    { datasetName: 'sensorData', param: { id: this.id } }
];

bind3DEvents(this, this.customEvents);

// 페이지 before_unload.js
const { disposeAllThreeResources } = Wkit;

// 한 줄로 모든 3D 컴포넌트 정리
disposeAllThreeResources(this);

console.log('[Verify] 3D resources disposed');
```

**disposeAllThreeResources가 처리하는 항목:**

| 항목 | 처리 방식 |
|------|----------|
| subscriptions | unsubscribe 호출 |
| customEvents | 참조 제거 |
| datasetInfo | 참조 제거 |
| geometry | dispose() 호출 |
| material | dispose() 호출 |
| texture | dispose() 호출 |
| Scene background | 정리 |

**통과 기준:**
- disposeAllThreeResources 호출 시 에러 없음
- GPU 메모리가 해제됨 (개발자 도구에서 확인)

---

#### TC-RC-007: 내부 이벤트 핸들러 정리 검증 (_internalHandlers)

**목적:** 컴포넌트 내부 이벤트 핸들러가 1:1 매칭되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (register) | 정리 (beforeDestroy) |
|-----------------|----------------------|
| `this._internalHandlers = {}` | `this._internalHandlers = null` |
| `addEventListener(...)` | `removeEventListener(...)` |

**검증 코드:**

```javascript
// register.js - 생성
this._internalHandlers = {};

function setupInternalHandlers() {
    const root = this.appendElement;

    this._internalHandlers.clearClick = () => this.clearLogs();
    this._internalHandlers.scrollClick = () => this.toggleAutoScroll();

    root.querySelector('.btn-clear')?.addEventListener('click', this._internalHandlers.clearClick);
    root.querySelector('.btn-scroll')?.addEventListener('click', this._internalHandlers.scrollClick);
}

setupInternalHandlers.call(this);

// beforeDestroy.js - 정리
const root = this.appendElement;

if (this._internalHandlers) {
    root.querySelector('.btn-clear')?.removeEventListener('click', this._internalHandlers.clearClick);
    root.querySelector('.btn-scroll')?.removeEventListener('click', this._internalHandlers.scrollClick);
}

this._internalHandlers = null;

console.log('[Verify] _internalHandlers:', this._internalHandlers); // null
```

**통과 기준:**
- 모든 addEventListener에 대응하는 removeEventListener 호출됨
- this._internalHandlers가 null

---

#### TC-RC-008: 바인딩된 메서드 참조 정리 검증

**목적:** bind()로 생성된 메서드 참조가 정리되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (register) | 정리 (beforeDestroy) |
|-----------------|----------------------|
| `this.methodA = fn.bind(this)` | `this.methodA = null` |
| `this.methodB = fn.bind(this)` | `this.methodB = null` |

**검증 코드:**

```javascript
// register.js - 생성
function renderTable({ response }) { /* ... */ }
function updateCount({ response }) { /* ... */ }
function handleClick(e) { /* ... */ }

this.renderTable = renderTable.bind(this);
this.updateCount = updateCount.bind(this);
this.handleClick = handleClick.bind(this);

// beforeDestroy.js - 정리
this.renderTable = null;
this.updateCount = null;
this.handleClick = null;

console.log('[Verify] All bound methods nullified');
```

**통과 기준:**
- 모든 bind()로 생성된 참조가 null로 설정됨

---

#### TC-RC-009: 상태 객체 정리 검증

**목적:** 컴포넌트의 상태 객체(_state 등)가 정리되는지 검증

**생성/정리 매칭 테이블:**

| 생성 (register) | 정리 (beforeDestroy) |
|-----------------|----------------------|
| `this._state = value` | `this._state = null` |
| `this.data = {}` | `this.data = null` |

**검증 코드:**

```javascript
// register.js - 생성
this._state = {
    isExpanded: false,
    selectedIndex: -1,
    cache: new Map()
};

this.data = {
    items: [],
    total: 0
};

// beforeDestroy.js - 정리
if (this._state?.cache) {
    this._state.cache.clear();
}

this._state = null;
this.data = null;

console.log('[Verify] _state:', this._state); // null
console.log('[Verify] data:', this.data); // null
```

**통과 기준:**
- Map, Set 등 컬렉션은 clear() 후 null
- 모든 상태 객체가 null로 설정됨

---

#### TC-RC-010: 전체 생성/정리 매칭 테이블 검증

**목적:** 전체 생성/정리 매칭이 누락 없이 이루어지는지 검증

**전체 생성/정리 매칭 테이블:**

| 생성 (register) | 정리 (beforeDestroy) |
|-----------------|----------------------|
| `this.subscriptions = {...}` | `this.subscriptions = null` |
| `subscribe(topic, this, handler)` | `unsubscribe(topic, this)` |
| `this.customEvents = {...}` | `this.customEvents = null` |
| `bindEvents(this, customEvents)` | `removeCustomEvents(this, customEvents)` |
| `this._internalHandlers = {...}` | `this._internalHandlers = null` |
| `addEventListener(...)` | `removeEventListener(...)` |
| `this.renderData = fn.bind(this)` | `this.renderData = null` |
| `this._state = value` | `this._state = null` |
| `createPopup(this, config)` | `destroyPopup(this)` |
| `this.eventBusHandlers = {...}` | `this.eventBusHandlers = null` |
| `onEventBusHandlers(handlers)` | `offEventBusHandlers(handlers)` |

**검증 함수:**

```javascript
function verifyResourceCleanup(instance) {
    const leaks = [];

    // 체크할 속성들
    const properties = [
        'subscriptions',
        'customEvents',
        '_internalHandlers',
        'renderTable',
        'updateCount',
        '_state',
        'data',
        'eventBusHandlers',
        'globalDataMappings',
        'currentParams',
        'refreshIntervals'
    ];

    properties.forEach(prop => {
        if (instance[prop] !== null && instance[prop] !== undefined) {
            leaks.push(prop);
        }
    });

    if (leaks.length > 0) {
        console.error('[Resource Leak] Not cleaned up:', leaks);
        return false;
    }

    console.log('[Verify] All resources cleaned up');
    return true;
}
```

**통과 기준:**
- verifyResourceCleanup이 true 반환
- 모든 속성이 null로 설정됨

---

#### TC-RC-011: 정리 순서 검증

**목적:** 리소스 정리 순서가 올바른지 검증 (생성의 역순)

**페이지 정리 순서:**

```
page_before_unload.js 실행 순서:
1. stopAllIntervals()        ← Interval 먼저 중단
2. offEventBusHandlers()     ← EventBus 정리
3. unregisterMapping()       ← DataPublisher 정리
4. disposeAllThreeResources() ← 3D 정리 (선택)
5. 참조 제거 (null 설정)     ← 마지막
```

**컴포넌트 정리 순서:**

```
beforeDestroy.js 실행 순서:
1. removeCustomEvents()      ← DOM 이벤트 해제
2. unsubscribe()             ← 구독 해제
3. removeEventListener()     ← 내부 이벤트 해제
4. 참조 제거 (null 설정)     ← 마지막
```

**검증 코드:**

```javascript
// 정리 순서 로깅
const cleanupLog = [];

// page_before_unload.js
cleanupLog.push({ step: 1, action: 'stopAllIntervals', timestamp: Date.now() });
this.stopAllIntervals();

cleanupLog.push({ step: 2, action: 'offEventBusHandlers', timestamp: Date.now() });
offEventBusHandlers.call(this, this.eventBusHandlers);

cleanupLog.push({ step: 3, action: 'unregisterMapping', timestamp: Date.now() });
fx.go(this.globalDataMappings, each(({ topic }) => GlobalDataPublisher.unregisterMapping(topic)));

cleanupLog.push({ step: 4, action: 'nullify references', timestamp: Date.now() });
this.eventBusHandlers = null;
this.globalDataMappings = null;
this.currentParams = null;
this.refreshIntervals = null;

console.log('[Cleanup Order]', cleanupLog);
```

**통과 기준:**
- 정리 순서가 문서화된 순서와 일치
- 참조 제거가 마지막에 수행됨

---

#### TC-RC-012: 메모리 누수 검증

**목적:** 페이지 로드/언로드 반복 시 메모리 누수가 없는지 검증

**테스트 단계:**

| 단계 | 행위 | 예상 결과 |
|------|------|----------|
| 1 | 초기 메모리 측정 | baseline 기록 |
| 2 | 페이지 로드 → 언로드 5회 반복 | 정상 정리됨 |
| 3 | GC 실행 (chrome://gc) | 메모리 해제됨 |
| 4 | 최종 메모리 측정 | baseline과 유사 |

**검증 방법:**

```javascript
// Chrome DevTools Console에서 실행
// 1. 메모리 스냅샷 (초기)
// 2. 페이지 이동 반복
// 3. 메모리 스냅샷 (최종)
// 4. 비교

// 또는 Performance Monitor에서
// - JS heap size 모니터링
// - DOM Nodes 수 모니터링
// - Event Listeners 수 모니터링

function measureMemory() {
    if (performance.memory) {
        console.log({
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        });
    }
}

// 테스트
measureMemory(); // 초기

// ... 페이지 로드/언로드 반복 ...

measureMemory(); // 최종
```

**통과 기준:**
- 5회 반복 후 메모리 사용량이 초기 대비 크게 증가하지 않음
- Event Listeners 수가 증가하지 않음
- DOM Nodes 수가 증가하지 않음

---

### 5.4 테스트 요약 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-RC-001 | 페이지 생성/정리 매칭 검증 (eventBusHandlers) | ☐ |
| TC-RC-002 | 페이지 생성/정리 매칭 검증 (globalDataMappings) | ☐ |
| TC-RC-003 | 페이지 생성/정리 매칭 검증 (refreshIntervals) | ☐ |
| TC-RC-004 | 컴포넌트 생성/정리 매칭 검증 (customEvents) | ☐ |
| TC-RC-005 | 컴포넌트 생성/정리 매칭 검증 (subscriptions) | ☐ |
| TC-RC-006 | 3D 리소스 정리 검증 (disposeAllThreeResources) | ☐ |
| TC-RC-007 | 내부 이벤트 핸들러 정리 검증 (_internalHandlers) | ☐ |
| TC-RC-008 | 바인딩된 메서드 참조 정리 검증 | ☐ |
| TC-RC-009 | 상태 객체 정리 검증 | ☐ |
| TC-RC-010 | 전체 생성/정리 매칭 테이블 검증 | ☐ |
| TC-RC-011 | 정리 순서 검증 | ☐ |
| TC-RC-012 | 메모리 누수 검증 | ☐ |

---

## 6. PopupMixin 테스트

PopupMixin은 Shadow DOM 기반 팝업 시스템을 제공합니다.
- `applyShadowPopupMixin`: 기본 Shadow DOM 팝업 (필수, 먼저 적용)
- `applyEChartsMixin`: ECharts 차트 관리 (선택)
- `applyTabulatorMixin`: Tabulator 테이블 관리 (선택)

### 6.1 applyShadowPopupMixin 기본 기능

#### TC-PM-001: applyShadowPopupMixin 적용 검증

**목적:** applyShadowPopupMixin이 인스턴스에 필요한 메서드들을 추가하는지 검증

**사전 조건:**
- 컴포넌트 인스턴스가 존재함
- PopupMixin이 로드됨

**테스트 순서:**
1. applyShadowPopupMixin을 인스턴스에 적용
2. 추가된 메서드들 확인
3. _popup 내부 상태 확인

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin } = PopupMixin;

// Mixin 적용
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup">Test</div>',
    getStyles: () => '.popup { background: #1a1f2e; }',
    onCreated: null
});

// 검증: 메서드 추가 확인
console.assert(typeof this.createPopup === 'function', 'createPopup 메서드 추가됨');
console.assert(typeof this.showPopup === 'function', 'showPopup 메서드 추가됨');
console.assert(typeof this.hidePopup === 'function', 'hidePopup 메서드 추가됨');
console.assert(typeof this.popupQuery === 'function', 'popupQuery 메서드 추가됨');
console.assert(typeof this.popupQueryAll === 'function', 'popupQueryAll 메서드 추가됨');
console.assert(typeof this.bindPopupEvents === 'function', 'bindPopupEvents 메서드 추가됨');
console.assert(typeof this.destroyPopup === 'function', 'destroyPopup 메서드 추가됨');

// 검증: 내부 상태 초기화 확인
console.assert(this._popup !== undefined, '_popup 상태 객체 생성됨');
console.assert(this._popup.host === null, '_popup.host 초기값 null');
console.assert(this._popup.shadowRoot === null, '_popup.shadowRoot 초기값 null');
console.assert(Array.isArray(this._popup.eventCleanups), '_popup.eventCleanups 배열 초기화');
```

**통과 기준:**
- 7개 메서드 모두 추가됨
- _popup 상태 객체가 올바르게 초기화됨

---

#### TC-PM-002: createPopup Shadow DOM 생성 검증

**목적:** createPopup이 Shadow DOM을 올바르게 생성하는지 검증

**사전 조건:**
- applyShadowPopupMixin이 적용됨
- page.appendElement가 존재함

**테스트 순서:**
1. createPopup() 호출
2. Shadow DOM 호스트 생성 확인
3. Shadow DOM 내용 확인
4. 페이지에 추가 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup-content">Hello World</div>',
    getStyles: () => '.popup-content { color: white; }',
    onCreated: null
});

// createPopup 호출
const shadowRoot = this.createPopup();

// 검증: Shadow DOM 호스트 생성
console.assert(this._popup.host !== null, 'host 요소 생성됨');
console.assert(this._popup.host.id === `popup-${this.id}`, 'host id 설정됨');

// 검증: Shadow Root 생성
console.assert(this._popup.shadowRoot !== null, 'shadowRoot 생성됨');
console.assert(shadowRoot === this._popup.shadowRoot, 'createPopup이 shadowRoot 반환');

// 검증: 스타일 + HTML 삽입
const styleEl = this._popup.shadowRoot.querySelector('style');
console.assert(styleEl !== null, 'style 태그 존재');
console.assert(styleEl.textContent.includes('.popup-content'), '스타일 삽입됨');

const contentEl = this._popup.shadowRoot.querySelector('.popup-content');
console.assert(contentEl !== null, 'HTML 컨텐츠 존재');
console.assert(contentEl.textContent === 'Hello World', 'HTML 내용 일치');

// 검증: 페이지에 추가됨
console.assert(
    this.page.appendElement.contains(this._popup.host),
    '페이지 appendElement에 추가됨'
);
```

**통과 기준:**
- Shadow DOM 호스트가 고유 ID로 생성됨
- 스타일과 HTML이 Shadow Root에 삽입됨
- 페이지의 appendElement에 추가됨

---

#### TC-PM-003: createPopup 중복 호출 방지 검증

**목적:** createPopup을 여러 번 호출해도 한 번만 생성되는지 검증

**사전 조건:**
- applyShadowPopupMixin이 적용됨

**테스트 순서:**
1. createPopup() 첫 번째 호출
2. 호스트 참조 저장
3. createPopup() 두 번째 호출
4. 동일한 인스턴스인지 확인

**검증 코드:**
```javascript
// register.js
let createdCount = 0;

applyShadowPopupMixin(this, {
    getHTML: () => {
        createdCount++;
        return '<div>Popup</div>';
    },
    getStyles: () => '',
    onCreated: null
});

// 첫 번째 호출
const shadowRoot1 = this.createPopup();
const host1 = this._popup.host;

// 두 번째 호출
const shadowRoot2 = this.createPopup();
const host2 = this._popup.host;

// 검증: 동일한 인스턴스
console.assert(host1 === host2, '호스트 인스턴스 동일');
console.assert(shadowRoot1 === shadowRoot2, 'shadowRoot 인스턴스 동일');
console.assert(createdCount === 1, 'getHTML은 한 번만 호출됨');

// 검증: DOM에도 하나만 존재
const popupHosts = this.page.appendElement.querySelectorAll(`#popup-${this.id}`);
console.assert(popupHosts.length === 1, 'DOM에 팝업 호스트 하나만 존재');
```

**통과 기준:**
- createPopup을 여러 번 호출해도 팝업은 하나만 생성됨
- getHTML, getStyles는 최초 1회만 호출됨

---

#### TC-PM-004: onCreated 콜백 실행 검증

**목적:** 팝업 생성 시 onCreated 콜백이 올바르게 실행되는지 검증

**사전 조건:**
- applyShadowPopupMixin이 적용됨
- onCreated 콜백이 정의됨

**테스트 순서:**
1. onCreated 콜백 정의
2. createPopup() 호출
3. 콜백 실행 확인
4. 콜백 컨텍스트(this) 확인

**검증 코드:**
```javascript
// register.js
let callbackExecuted = false;
let callbackContext = null;
let receivedShadowRoot = null;

applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup">Content</div>',
    getStyles: () => '',
    onCreated: function(shadowRoot) {
        callbackExecuted = true;
        callbackContext = this;
        receivedShadowRoot = shadowRoot;

        // 콜백 내에서 초기화 작업 수행
        const popup = shadowRoot.querySelector('.popup');
        popup.dataset.initialized = 'true';
    }
});

this.createPopup();

// 검증: 콜백 실행됨
console.assert(callbackExecuted === true, 'onCreated 콜백 실행됨');

// 검증: this 컨텍스트가 인스턴스
console.assert(callbackContext === this, 'onCreated의 this는 인스턴스');

// 검증: shadowRoot 파라미터 전달됨
console.assert(receivedShadowRoot === this._popup.shadowRoot, 'shadowRoot 파라미터 전달됨');

// 검증: 콜백 내 작업 반영됨
const popup = this.popupQuery('.popup');
console.assert(popup.dataset.initialized === 'true', '콜백 내 초기화 작업 반영됨');
```

**통과 기준:**
- onCreated 콜백이 실행됨
- 콜백의 this는 컴포넌트 인스턴스
- shadowRoot가 파라미터로 전달됨

---

#### TC-PM-005: showPopup/hidePopup 표시 제어 검증

**목적:** showPopup과 hidePopup이 팝업 표시 상태를 올바르게 제어하는지 검증

**사전 조건:**
- applyShadowPopupMixin이 적용됨

**테스트 순서:**
1. showPopup() 호출 (팝업 미생성 상태)
2. 팝업 자동 생성 및 표시 확인
3. hidePopup() 호출
4. 숨김 상태 확인
5. showPopup() 다시 호출
6. 재표시 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup">Content</div>',
    getStyles: () => '',
    onCreated: null
});

// 검증 1: 팝업 미생성 상태에서 showPopup
console.assert(this._popup.host === null, '초기 상태: 팝업 미생성');

this.showPopup();

// 검증 2: 팝업 자동 생성 + 표시
console.assert(this._popup.host !== null, 'showPopup이 팝업 자동 생성');
console.assert(this._popup.host.style.display === 'block', '팝업 표시됨 (display: block)');

// 검증 3: hidePopup
this.hidePopup();
console.assert(this._popup.host.style.display === 'none', '팝업 숨김 (display: none)');

// 검증 4: showPopup 재호출
this.showPopup();
console.assert(this._popup.host.style.display === 'block', '팝업 재표시됨');

// 검증 5: 팝업이 새로 생성되지 않음 (동일 인스턴스)
const hostsBefore = this.page.appendElement.querySelectorAll(`[id^="popup-"]`).length;
this.showPopup();
const hostsAfter = this.page.appendElement.querySelectorAll(`[id^="popup-"]`).length;
console.assert(hostsBefore === hostsAfter, '재호출 시 새 팝업 생성 안 함');
```

**통과 기준:**
- showPopup은 팝업이 없으면 자동 생성 후 표시
- hidePopup은 display: none 설정
- showPopup은 display: block 설정
- 여러 번 호출해도 팝업 인스턴스는 하나

---

#### TC-PM-006: popupQuery/popupQueryAll Shadow DOM 쿼리 검증

**목적:** Shadow DOM 내부 요소를 올바르게 선택하는지 검증

**사전 조건:**
- 팝업이 생성됨
- Shadow DOM에 복수의 요소가 존재

**테스트 순서:**
1. 복수 요소를 포함한 팝업 생성
2. popupQuery로 단일 요소 선택
3. popupQueryAll로 복수 요소 선택
4. 존재하지 않는 선택자 테스트

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup">
            <h1 class="title">Title</h1>
            <ul class="list">
                <li class="item">Item 1</li>
                <li class="item">Item 2</li>
                <li class="item">Item 3</li>
            </ul>
        </div>
    `,
    getStyles: () => '',
    onCreated: null
});

this.createPopup();

// 검증 1: popupQuery - 단일 요소
const title = this.popupQuery('.title');
console.assert(title !== null, 'popupQuery: 요소 찾음');
console.assert(title.textContent === 'Title', 'popupQuery: 내용 일치');

// 검증 2: popupQuery - 복수 요소 중 첫 번째
const firstItem = this.popupQuery('.item');
console.assert(firstItem.textContent === 'Item 1', 'popupQuery: 첫 번째 요소 반환');

// 검증 3: popupQueryAll - 모든 요소
const items = this.popupQueryAll('.item');
console.assert(items.length === 3, 'popupQueryAll: 모든 요소 반환');
console.assert(items[2].textContent === 'Item 3', 'popupQueryAll: 세 번째 요소 확인');

// 검증 4: 존재하지 않는 선택자
const notFound = this.popupQuery('.not-exist');
console.assert(notFound === null, 'popupQuery: 없는 요소는 null');

const notFoundAll = this.popupQueryAll('.not-exist');
console.assert(notFoundAll.length === 0, 'popupQueryAll: 없는 요소는 빈 배열');

// 검증 5: 팝업 생성 전 쿼리 (shadowRoot null)
const freshInstance = {};
applyShadowPopupMixin(freshInstance, {
    getHTML: () => '<div></div>',
    getStyles: () => '',
    onCreated: null
});
// createPopup 호출 안 함
const result = freshInstance.popupQuery('.anything');
console.assert(result === undefined || result === null, '팝업 미생성 시 안전하게 처리');
```

**통과 기준:**
- popupQuery는 단일 요소 반환 (없으면 null)
- popupQueryAll은 NodeList 반환 (없으면 빈 배열)
- Shadow DOM 경계 내에서만 검색됨

---

#### TC-PM-007: bindPopupEvents 이벤트 델리게이션 검증

**목적:** bindPopupEvents가 이벤트 델리게이션 방식으로 작동하는지 검증

**사전 조건:**
- 팝업이 생성됨
- 이벤트 핸들러가 정의됨

**테스트 순서:**
1. 버튼들이 있는 팝업 생성
2. bindPopupEvents로 이벤트 바인딩
3. 버튼 클릭 시뮬레이션
4. 핸들러 실행 확인

**검증 코드:**
```javascript
// register.js
let closeClicked = false;
let refreshClicked = false;
let clickedTarget = null;

applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup">
            <button class="close-btn">Close</button>
            <button class="refresh-btn">Refresh</button>
            <div class="content">
                <span class="inner-text">Click me</span>
            </div>
        </div>
    `,
    getStyles: () => '',
    onCreated: (shadowRoot) => {
        this.bindPopupEvents({
            click: {
                '.close-btn': (e) => {
                    closeClicked = true;
                    clickedTarget = e.target;
                },
                '.refresh-btn': () => {
                    refreshClicked = true;
                }
            }
        });
    }
});

this.createPopup();

// 검증 1: close 버튼 클릭
const closeBtn = this.popupQuery('.close-btn');
closeBtn.click();
console.assert(closeClicked === true, 'close 버튼 핸들러 실행됨');
console.assert(clickedTarget === closeBtn, '이벤트 타겟이 버튼');

// 검증 2: refresh 버튼 클릭
const refreshBtn = this.popupQuery('.refresh-btn');
refreshBtn.click();
console.assert(refreshClicked === true, 'refresh 버튼 핸들러 실행됨');

// 검증 3: 바인딩 안 된 요소 클릭 (에러 없이 무시)
const content = this.popupQuery('.content');
content.click();  // 에러 없이 무시되어야 함

// 검증 4: closest 매칭 (자식 요소 클릭 시 부모 선택자 매칭)
let contentClicked = false;
this.bindPopupEvents({
    click: {
        '.content': () => {
            contentClicked = true;
        }
    }
});

const innerText = this.popupQuery('.inner-text');
innerText.click();  // .content의 자식을 클릭
console.assert(contentClicked === true, 'closest로 부모 선택자 매칭됨');
```

**통과 기준:**
- 선택자에 매칭되는 요소 클릭 시 핸들러 실행
- closest()로 부모 요소까지 매칭
- 바인딩 안 된 요소는 무시

---

#### TC-PM-008: destroyPopup 리소스 정리 검증

**목적:** destroyPopup이 모든 리소스를 올바르게 정리하는지 검증

**사전 조건:**
- 팝업이 생성됨
- 이벤트가 바인딩됨

**테스트 순서:**
1. 팝업 생성 및 이벤트 바인딩
2. destroyPopup() 호출
3. DOM 제거 확인
4. 이벤트 정리 확인
5. 상태 초기화 확인

**검증 코드:**
```javascript
// register.js
let handlerCalled = false;

applyShadowPopupMixin(this, {
    getHTML: () => `<div class="popup"><button class="btn">Click</button></div>`,
    getStyles: () => '',
    onCreated: () => {
        this.bindPopupEvents({
            click: {
                '.btn': () => { handlerCalled = true; }
            }
        });
    }
});

this.createPopup();

// 정리 전 상태 확인
const hostBefore = this._popup.host;
const cleanupsBefore = this._popup.eventCleanups.length;
console.assert(hostBefore !== null, '정리 전: host 존재');
console.assert(cleanupsBefore > 0, '정리 전: 이벤트 클린업 존재');
console.assert(this.page.appendElement.contains(hostBefore), '정리 전: DOM에 존재');

// destroyPopup 호출
this.destroyPopup();

// 검증 1: DOM 제거
console.assert(this._popup.host === null, '정리 후: host null');
console.assert(this._popup.shadowRoot === null, '정리 후: shadowRoot null');
console.assert(!this.page.appendElement.contains(hostBefore), '정리 후: DOM에서 제거됨');

// 검증 2: 이벤트 클린업 배열 비워짐
console.assert(this._popup.eventCleanups.length === 0, '정리 후: eventCleanups 비워짐');

// 검증 3: 이벤트 실제로 해제됨 (버튼 클릭해도 핸들러 안 불림)
// (DOM이 제거되어 클릭 자체가 불가하므로 간접 검증)
handlerCalled = false;
// 버튼이 DOM에서 제거되어 클릭 불가
```

**통과 기준:**
- DOM에서 팝업 호스트 제거됨
- _popup.host, _popup.shadowRoot null로 설정
- eventCleanups 배열 비워짐
- 이벤트 리스너 해제됨

---

### 6.2 applyEChartsMixin 테스트

#### TC-PM-009: applyEChartsMixin 전제조건 검증

**목적:** applyShadowPopupMixin 없이 호출 시 경고 출력 확인

**사전 조건:**
- 컴포넌트 인스턴스가 존재함
- applyShadowPopupMixin이 적용되지 않음

**테스트 순서:**
1. applyShadowPopupMixin 없이 applyEChartsMixin 호출
2. 경고 메시지 확인
3. 메서드 미추가 확인

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

// applyShadowPopupMixin 없이 바로 호출
const originalWarn = console.warn;
let warnMessage = '';
console.warn = (msg) => { warnMessage = msg; };

applyEChartsMixin(this);

console.warn = originalWarn;

// 검증: 경고 메시지
console.assert(
    warnMessage.includes('applyShadowPopupMixin'),
    '경고 메시지에 applyShadowPopupMixin 언급'
);

// 검증: 메서드 미추가
console.assert(this.createChart === undefined, 'createChart 메서드 미추가');
console.assert(this.getChart === undefined, 'getChart 메서드 미추가');
console.assert(this.updateChart === undefined, 'updateChart 메서드 미추가');
```

**통과 기준:**
- 경고 메시지가 콘솔에 출력됨
- 차트 관련 메서드가 추가되지 않음

---

#### TC-PM-010: createChart ECharts 인스턴스 생성 검증

**목적:** createChart가 ECharts 인스턴스를 올바르게 생성하는지 검증

**사전 조건:**
- applyShadowPopupMixin 적용됨
- applyEChartsMixin 적용됨
- echarts 라이브러리 로드됨

**테스트 순서:**
1. 차트 컨테이너가 있는 팝업 생성
2. createChart() 호출
3. ECharts 인스턴스 생성 확인
4. ResizeObserver 연결 확인

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup">
            <div class="chart-container" style="width: 400px; height: 300px;"></div>
        </div>
    `,
    getStyles: () => '',
    onCreated: null
});
applyEChartsMixin(this);

this.createPopup();

// 검증 1: charts Map 초기화됨
console.assert(this._popup.charts instanceof Map, 'charts Map 존재');
console.assert(this._popup.charts.size === 0, '초기 상태: 차트 없음');

// 검증 2: createChart 호출
const chart = this.createChart('.chart-container');
console.assert(chart !== null, 'createChart가 인스턴스 반환');

// 검증 3: Map에 저장됨
console.assert(this._popup.charts.has('.chart-container'), 'charts Map에 저장됨');

const stored = this._popup.charts.get('.chart-container');
console.assert(stored.chart === chart, 'Map에 저장된 chart 일치');
console.assert(stored.resizeObserver instanceof ResizeObserver, 'ResizeObserver 생성됨');

// 검증 4: ECharts 인스턴스 확인
console.assert(typeof chart.setOption === 'function', 'ECharts setOption 메서드 존재');
console.assert(typeof chart.dispose === 'function', 'ECharts dispose 메서드 존재');
```

**통과 기준:**
- ECharts 인스턴스가 생성됨
- _popup.charts Map에 저장됨
- ResizeObserver가 연결됨

---

#### TC-PM-011: createChart 중복 생성 방지 검증

**목적:** 동일 선택자로 createChart 재호출 시 기존 인스턴스 반환

**사전 조건:**
- 차트가 이미 생성됨

**테스트 순서:**
1. createChart() 첫 번째 호출
2. createChart() 두 번째 호출 (동일 선택자)
3. 동일 인스턴스인지 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="chart" style="width:400px;height:300px;"></div></div>',
    getStyles: () => '',
    onCreated: null
});
applyEChartsMixin(this);
this.createPopup();

// 첫 번째 생성
const chart1 = this.createChart('.chart');

// 두 번째 호출
const chart2 = this.createChart('.chart');

// 검증: 동일 인스턴스
console.assert(chart1 === chart2, '동일 인스턴스 반환');
console.assert(this._popup.charts.size === 1, 'charts Map에 하나만 존재');
```

**통과 기준:**
- 동일 선택자로 재호출 시 새 인스턴스 생성하지 않음
- 기존 인스턴스 반환

---

#### TC-PM-012: createChart 존재하지 않는 컨테이너 처리 검증

**목적:** 존재하지 않는 선택자로 createChart 호출 시 null 반환

**사전 조건:**
- 팝업이 생성됨
- 지정한 선택자의 요소가 없음

**테스트 순서:**
1. 존재하지 않는 선택자로 createChart 호출
2. null 반환 확인
3. 경고 메시지 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"></div>',  // .chart-container 없음
    getStyles: () => '',
    onCreated: null
});
applyEChartsMixin(this);
this.createPopup();

// 경고 메시지 캡처
const originalWarn = console.warn;
let warnMessage = '';
console.warn = (msg) => { warnMessage = msg; };

const chart = this.createChart('.chart-container');

console.warn = originalWarn;

// 검증
console.assert(chart === null, '존재하지 않는 컨테이너: null 반환');
console.assert(warnMessage.includes('.chart-container'), '경고 메시지에 선택자 포함');
console.assert(this._popup.charts.size === 0, 'charts Map에 추가되지 않음');
```

**통과 기준:**
- null 반환
- 경고 메시지 출력
- charts Map에 추가되지 않음

---

#### TC-PM-013: getChart/updateChart 사용 검증

**목적:** getChart로 인스턴스 조회, updateChart로 옵션 업데이트

**사전 조건:**
- 차트가 생성됨

**테스트 순서:**
1. createChart로 차트 생성
2. getChart로 조회
3. updateChart로 옵션 적용
4. 없는 선택자로 조회/업데이트 시도

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="chart" style="width:400px;height:300px;"></div></div>',
    getStyles: () => '',
    onCreated: null
});
applyEChartsMixin(this);
this.createPopup();

// 차트 생성
this.createChart('.chart');

// 검증 1: getChart
const chart = this.getChart('.chart');
console.assert(chart !== null, 'getChart: 인스턴스 반환');

// 검증 2: updateChart
const option = {
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [10, 20, 30] }]
};
this.updateChart('.chart', option);

// 검증: 옵션이 적용됨 (getOption으로 확인)
const appliedOption = chart.getOption();
console.assert(appliedOption.xAxis[0].data.length === 3, 'updateChart: 옵션 적용됨');

// 검증 3: 없는 선택자
const notFound = this.getChart('.not-exist');
console.assert(notFound === null, 'getChart: 없는 선택자는 null');

// updateChart 없는 선택자 (에러 없이 경고만)
this.updateChart('.not-exist', option);  // 경고 출력, 에러 없음
```

**통과 기준:**
- getChart는 인스턴스 또는 null 반환
- updateChart는 setOption 호출
- 없는 선택자는 경고만 출력

---

#### TC-PM-014: ECharts destroyPopup 체이닝 검증

**목적:** destroyPopup 호출 시 차트가 자동으로 정리되는지 검증

**사전 조건:**
- applyEChartsMixin 적용됨
- 차트가 생성됨

**테스트 순서:**
1. 차트 생성
2. destroyPopup() 호출
3. 차트 정리 확인
4. ResizeObserver 해제 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="chart" style="width:400px;height:300px;"></div></div>',
    getStyles: () => '',
    onCreated: null
});
applyEChartsMixin(this);
this.createPopup();

// 차트 생성
const chart = this.createChart('.chart');
const stored = this._popup.charts.get('.chart');

// 정리 전 상태
console.assert(this._popup.charts.size === 1, '정리 전: 차트 1개');

// ResizeObserver disconnect 추적
let observerDisconnected = false;
const originalDisconnect = stored.resizeObserver.disconnect;
stored.resizeObserver.disconnect = function() {
    observerDisconnected = true;
    originalDisconnect.call(this);
};

// chart.dispose 추적
let chartDisposed = false;
const originalDispose = chart.dispose;
chart.dispose = function() {
    chartDisposed = true;
    originalDispose.call(this);
};

// destroyPopup 호출
this.destroyPopup();

// 검증
console.assert(observerDisconnected === true, 'ResizeObserver disconnect 호출됨');
console.assert(chartDisposed === true, 'chart.dispose 호출됨');
console.assert(this._popup.charts.size === 0, 'charts Map 비워짐');
console.assert(this._popup.host === null, 'DOM도 정리됨 (기본 destroyPopup 실행)');
```

**통과 기준:**
- 모든 차트의 dispose() 호출됨
- 모든 ResizeObserver disconnect() 호출됨
- charts Map 비워짐
- 기본 destroyPopup도 실행됨 (DOM 제거)

---

### 6.3 applyTabulatorMixin 테스트

#### TC-PM-015: applyTabulatorMixin 전제조건 검증

**목적:** applyShadowPopupMixin 없이 호출 시 경고 확인

**사전 조건:**
- applyShadowPopupMixin이 적용되지 않음

**테스트 순서:**
1. applyShadowPopupMixin 없이 applyTabulatorMixin 호출
2. 경고 및 미동작 확인

**검증 코드:**
```javascript
// register.js
const { applyTabulatorMixin } = PopupMixin;

const originalWarn = console.warn;
let warnMessage = '';
console.warn = (msg) => { warnMessage = msg; };

applyTabulatorMixin(this);

console.warn = originalWarn;

// 검증
console.assert(
    warnMessage.includes('applyShadowPopupMixin'),
    '경고 메시지 출력'
);
console.assert(this.createTable === undefined, 'createTable 메서드 미추가');
```

**통과 기준:**
- 경고 메시지 출력
- 테이블 메서드 미추가

---

#### TC-PM-016: createTable Tabulator 인스턴스 생성 검증

**목적:** createTable이 Tabulator 인스턴스를 올바르게 생성하는지 검증

**사전 조건:**
- applyShadowPopupMixin, applyTabulatorMixin 적용됨
- Tabulator 라이브러리 로드됨

**테스트 순서:**
1. 테이블 컨테이너가 있는 팝업 생성
2. createTable() 호출
3. Tabulator 인스턴스 확인
4. ResizeObserver 연결 확인

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin, applyTabulatorMixin } = PopupMixin;

applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup">
            <div class="table-container"></div>
        </div>
    `,
    getStyles: () => '.table-container { height: 300px; }',
    onCreated: null
});
applyTabulatorMixin(this);

this.createPopup();

// 검증 1: tables Map 초기화
console.assert(this._popup.tables instanceof Map, 'tables Map 존재');

// 검증 2: createTable 호출
const options = {
    columns: [
        { title: 'Name', field: 'name' },
        { title: 'Age', field: 'age' }
    ]
};
const table = this.createTable('.table-container', options);

// 검증 3: 인스턴스 반환
console.assert(table !== null, 'Tabulator 인스턴스 반환');

// 검증 4: Map에 저장
const stored = this._popup.tables.get('.table-container');
console.assert(stored.table === table, 'tables Map에 저장됨');
console.assert(stored.resizeObserver instanceof ResizeObserver, 'ResizeObserver 생성됨');
console.assert(stored.state.initialized === false, '초기 상태: initialized false');

// 검증 5: Tabulator 메서드 존재
console.assert(typeof table.setData === 'function', 'setData 메서드 존재');
console.assert(typeof table.destroy === 'function', 'destroy 메서드 존재');
```

**통과 기준:**
- Tabulator 인스턴스 생성됨
- tables Map에 저장됨
- ResizeObserver 연결됨
- 초기화 상태 추적 가능

---

#### TC-PM-017: Tabulator CSS Shadow DOM 주입 검증

**목적:** Shadow DOM에 Tabulator CSS가 자동 주입되는지 검증

**사전 조건:**
- applyTabulatorMixin 적용됨
- CSS 파일 경로가 유효함

**테스트 순서:**
1. createTable() 호출
2. Shadow DOM에 style 태그 삽입 확인
3. 중복 주입 방지 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="table"></div></div>',
    getStyles: () => '',
    onCreated: null
});
applyTabulatorMixin(this);
this.createPopup();

// CSS 주입 전 상태
console.assert(
    this._popup.tabulatorCssInjected === false,
    '초기 상태: CSS 미주입'
);

// createTable 호출 (CSS 자동 주입 트리거)
this.createTable('.table', { columns: [] });

// 비동기 대기 (CSS fetch)
await new Promise(resolve => setTimeout(resolve, 100));

// 검증 1: 플래그 설정됨
console.assert(
    this._popup.tabulatorCssInjected === true,
    'CSS 주입 플래그 true'
);

// 검증 2: style 태그 존재
const styleTag = this._popup.shadowRoot.querySelector('style[data-tabulator-theme]');
console.assert(styleTag !== null, 'Tabulator CSS style 태그 존재');
console.assert(styleTag.getAttribute('data-tabulator-theme') === 'midnight', 'midnight 테마');

// 검증 3: 두 번째 테이블 생성 시 중복 주입 안 함
const styleCountBefore = this._popup.shadowRoot.querySelectorAll('style[data-tabulator-theme]').length;

this.createTable('.another-table', { columns: [] });
await new Promise(resolve => setTimeout(resolve, 100));

const styleCountAfter = this._popup.shadowRoot.querySelectorAll('style[data-tabulator-theme]').length;
console.assert(styleCountBefore === styleCountAfter, 'CSS 중복 주입 방지');
```

**통과 기준:**
- Tabulator CSS가 Shadow DOM에 주입됨
- 중복 주입 방지됨
- midnight 테마 적용

---

#### TC-PM-018: isTableReady 초기화 완료 감지 검증

**목적:** tableBuilt 이벤트로 초기화 완료를 감지하는지 검증

**사전 조건:**
- 테이블이 생성됨

**테스트 순서:**
1. createTable() 호출
2. 즉시 isTableReady() 확인 (false)
3. tableBuilt 이벤트 후 확인 (true)

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="table"></div></div>',
    getStyles: () => '',
    onCreated: null
});
applyTabulatorMixin(this);
this.createPopup();

const table = this.createTable('.table', {
    columns: [{ title: 'Name', field: 'name' }],
    data: [{ name: 'Test' }]
});

// 검증 1: 생성 직후 (초기화 진행 중)
// 주의: Tabulator 초기화는 동기/비동기 혼합
const immediateReady = this.isTableReady('.table');
console.log('생성 직후 isTableReady:', immediateReady);

// 검증 2: tableBuilt 이벤트 대기
await new Promise(resolve => {
    if (this.isTableReady('.table')) {
        resolve();
    } else {
        table.on('tableBuilt', resolve);
    }
});

console.assert(this.isTableReady('.table') === true, 'tableBuilt 후: initialized true');

// 검증 3: 없는 선택자
console.assert(this.isTableReady('.not-exist') === false, '없는 선택자: false');
```

**통과 기준:**
- tableBuilt 이벤트 후 isTableReady()가 true 반환
- 존재하지 않는 선택자는 false 반환

---

#### TC-PM-019: getTable/updateTable/updateTableOptions 사용 검증

**목적:** 테이블 조회 및 업데이트 메서드 동작 확인

**사전 조건:**
- 테이블이 생성됨

**테스트 순서:**
1. getTable로 인스턴스 조회
2. updateTable로 데이터 업데이트
3. updateTableOptions로 컬럼 변경

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="table"></div></div>',
    getStyles: () => '',
    onCreated: null
});
applyTabulatorMixin(this);
this.createPopup();

this.createTable('.table', {
    columns: [
        { title: 'Name', field: 'name' },
        { title: 'Age', field: 'age' }
    ]
});

// tableBuilt 대기
await new Promise(resolve => setTimeout(resolve, 100));

// 검증 1: getTable
const table = this.getTable('.table');
console.assert(table !== null, 'getTable: 인스턴스 반환');

// 검증 2: updateTable (setData)
const newData = [
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 }
];
this.updateTable('.table', newData);

const rows = table.getData();
console.assert(rows.length === 2, 'updateTable: 데이터 2행');
console.assert(rows[0].name === 'Alice', 'updateTable: 데이터 일치');

// 검증 3: updateTableOptions (컬럼 변경)
this.updateTableOptions('.table', {
    columns: [
        { title: 'Full Name', field: 'name' },
        { title: 'Years', field: 'age' }
    ]
});

const columns = table.getColumns();
console.assert(columns[0].getDefinition().title === 'Full Name', 'updateTableOptions: 컬럼 변경됨');

// 검증 4: 없는 선택자
console.assert(this.getTable('.not-exist') === null, 'getTable: 없는 선택자 null');
this.updateTable('.not-exist', []);  // 경고만, 에러 없음
```

**통과 기준:**
- getTable은 인스턴스 또는 null 반환
- updateTable은 setData 호출
- updateTableOptions는 setColumns, setData 호출 가능

---

#### TC-PM-020: Tabulator destroyPopup 체이닝 검증

**목적:** destroyPopup 호출 시 테이블이 자동 정리되는지 검증

**사전 조건:**
- applyTabulatorMixin 적용됨
- 테이블이 생성됨

**테스트 순서:**
1. 테이블 생성
2. destroyPopup() 호출
3. 테이블 정리 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="table"></div></div>',
    getStyles: () => '',
    onCreated: null
});
applyTabulatorMixin(this);
this.createPopup();

const table = this.createTable('.table', {
    columns: [{ title: 'Test', field: 'test' }]
});

const stored = this._popup.tables.get('.table');

// 추적용 플래그
let observerDisconnected = false;
let tableOffCalled = false;
let tableDestroyed = false;

const originalDisconnect = stored.resizeObserver.disconnect;
stored.resizeObserver.disconnect = function() {
    observerDisconnected = true;
    originalDisconnect.call(this);
};

const originalOff = table.off;
table.off = function() {
    tableOffCalled = true;
    return originalOff.call(this);
};

const originalDestroy = table.destroy;
table.destroy = function() {
    tableDestroyed = true;
    originalDestroy.call(this);
};

// destroyPopup 호출
this.destroyPopup();

// 검증
console.assert(observerDisconnected === true, 'ResizeObserver disconnect 호출됨');
console.assert(tableOffCalled === true, 'table.off 호출됨 (이벤트 해제)');
console.assert(tableDestroyed === true, 'table.destroy 호출됨');
console.assert(this._popup.tables.size === 0, 'tables Map 비워짐');
console.assert(this._popup.host === null, 'DOM도 정리됨');
```

**통과 기준:**
- table.off() 호출됨 (이벤트 해제)
- table.destroy() 호출됨
- ResizeObserver disconnect() 호출됨
- tables Map 비워짐
- 기본 destroyPopup도 실행됨

---

### 6.4 Mixin 조합 테스트

#### TC-PM-021: ECharts + Tabulator 동시 사용 검증

**목적:** 두 Mixin을 함께 사용할 때 충돌 없이 동작하는지 검증

**사전 조건:**
- applyShadowPopupMixin 적용됨
- applyEChartsMixin, applyTabulatorMixin 모두 적용됨

**테스트 순서:**
1. 차트와 테이블 컨테이너가 있는 팝업 생성
2. 차트 생성
3. 테이블 생성
4. destroyPopup으로 모두 정리

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin, applyEChartsMixin, applyTabulatorMixin } = PopupMixin;

applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup">
            <div class="chart" style="width:400px;height:200px;"></div>
            <div class="table"></div>
        </div>
    `,
    getStyles: () => '',
    onCreated: null
});
applyEChartsMixin(this);
applyTabulatorMixin(this);

this.createPopup();

// 검증 1: 두 Mixin의 메서드 공존
console.assert(typeof this.createChart === 'function', 'createChart 존재');
console.assert(typeof this.createTable === 'function', 'createTable 존재');

// 검증 2: 차트 생성
const chart = this.createChart('.chart');
console.assert(chart !== null, '차트 생성됨');

// 검증 3: 테이블 생성
const table = this.createTable('.table', {
    columns: [{ title: 'Test', field: 'test' }]
});
console.assert(table !== null, '테이블 생성됨');

// 검증 4: 각각의 저장소에 저장됨
console.assert(this._popup.charts.size === 1, 'charts Map에 1개');
console.assert(this._popup.tables.size === 1, 'tables Map에 1개');

// 검증 5: destroyPopup으로 모두 정리
this.destroyPopup();

console.assert(this._popup.charts.size === 0, 'charts 정리됨');
console.assert(this._popup.tables.size === 0, 'tables 정리됨');
console.assert(this._popup.host === null, 'DOM 정리됨');
```

**통과 기준:**
- 두 Mixin의 메서드가 충돌 없이 공존
- 각각의 리소스가 독립적으로 관리됨
- destroyPopup이 체이닝되어 모두 정리됨

---

#### TC-PM-022: destroyPopup 체이닝 순서 검증

**목적:** Mixin 적용 역순으로 정리되는지 검증

**사전 조건:**
- applyShadowPopupMixin → applyEChartsMixin → applyTabulatorMixin 순서로 적용

**테스트 순서:**
1. 순서대로 Mixin 적용
2. destroyPopup 호출
3. 정리 순서 확인 (역순: Tabulator → ECharts → 기본)

**검증 코드:**
```javascript
// register.js
const cleanupOrder = [];

applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup">
            <div class="chart" style="width:400px;height:200px;"></div>
            <div class="table"></div>
        </div>
    `,
    getStyles: () => '',
    onCreated: null
});

// 원본 destroyPopup 감시
const originalDestroyBase = this.destroyPopup;
this.destroyPopup = function() {
    cleanupOrder.push('base');
    originalDestroyBase.call(this);
};

applyEChartsMixin(this);

// ECharts destroyPopup 감시
const originalDestroyCharts = this.destroyPopup;
this.destroyPopup = function() {
    cleanupOrder.push('charts');
    originalDestroyCharts.call(this);
};

applyTabulatorMixin(this);

// Tabulator destroyPopup 감시
const originalDestroyTables = this.destroyPopup;
this.destroyPopup = function() {
    cleanupOrder.push('tables');
    originalDestroyTables.call(this);
};

this.createPopup();
this.createChart('.chart');
this.createTable('.table', { columns: [] });

// destroyPopup 호출
this.destroyPopup();

// 검증: 역순 정리
console.log('정리 순서:', cleanupOrder);
console.assert(cleanupOrder[0] === 'tables', '첫 번째: tables (마지막 적용)');
console.assert(cleanupOrder[1] === 'charts', '두 번째: charts');
console.assert(cleanupOrder[2] === 'base', '세 번째: base (처음 적용)');
```

**통과 기준:**
- 정리 순서가 적용 역순 (Tabulator → ECharts → 기본)
- 각 단계에서 해당 리소스가 정리됨

---

### 6.5 PopupMixin 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-PM-001 | applyShadowPopupMixin 적용 검증 | ☐ |
| TC-PM-002 | createPopup Shadow DOM 생성 검증 | ☐ |
| TC-PM-003 | createPopup 중복 호출 방지 검증 | ☐ |
| TC-PM-004 | onCreated 콜백 실행 검증 | ☐ |
| TC-PM-005 | showPopup/hidePopup 표시 제어 검증 | ☐ |
| TC-PM-006 | popupQuery/popupQueryAll Shadow DOM 쿼리 검증 | ☐ |
| TC-PM-007 | bindPopupEvents 이벤트 델리게이션 검증 | ☐ |
| TC-PM-008 | destroyPopup 리소스 정리 검증 | ☐ |
| TC-PM-009 | applyEChartsMixin 전제조건 검증 | ☐ |
| TC-PM-010 | createChart ECharts 인스턴스 생성 검증 | ☐ |
| TC-PM-011 | createChart 중복 생성 방지 검증 | ☐ |
| TC-PM-012 | createChart 존재하지 않는 컨테이너 처리 검증 | ☐ |
| TC-PM-013 | getChart/updateChart 사용 검증 | ☐ |
| TC-PM-014 | ECharts destroyPopup 체이닝 검증 | ☐ |
| TC-PM-015 | applyTabulatorMixin 전제조건 검증 | ☐ |
| TC-PM-016 | createTable Tabulator 인스턴스 생성 검증 | ☐ |
| TC-PM-017 | Tabulator CSS Shadow DOM 주입 검증 | ☐ |
| TC-PM-018 | isTableReady 초기화 완료 감지 검증 | ☐ |
| TC-PM-019 | getTable/updateTable/updateTableOptions 사용 검증 | ☐ |
| TC-PM-020 | Tabulator destroyPopup 체이닝 검증 | ☐ |
| TC-PM-021 | ECharts + Tabulator 동시 사용 검증 | ☐ |
| TC-PM-022 | destroyPopup 체이닝 순서 검증 | ☐ |

---

## 7. 팝업 컴포넌트 테스트

팝업 컴포넌트(Component With Popup)는 데이터 fetch, 렌더링, 이벤트, UI(팝업)를 모두 내부에서 관리하는 컴포넌트입니다.

**핵심 요소:**
- `datasetInfo`: 데이터 정의 (무엇을 fetch하고 어떻게 render할지)
- `Config`: API 필드 매핑 + 스타일 설정
- `Public Methods`: Page에서 호출 (showDetail, hideDetail)
- `customEvents`: 3D 이벤트 발행
- `Popup`: Shadow DOM 기반 UI

### 7.1 datasetInfo 정의 및 사용

#### TC-SC-001: datasetInfo 배열 구조 검증

**목적:** datasetInfo가 올바른 배열 구조로 정의되는지 검증

**사전 조건:**
- 3D 컴포넌트 인스턴스가 존재함

**테스트 순서:**
1. datasetInfo 배열 정의
2. 구조 검증 (datasetName, param, render)
3. 다중 데이터셋 지원 확인

**검증 코드:**
```javascript
// register.js
const assetId = this.setter.ecoAssetInfo?.assetId || 'sensor-001';

this.datasetInfo = [
    {
        datasetName: 'sensor',
        param: { id: assetId },
        render: ['renderSensorInfo']
    },
    {
        datasetName: 'sensorHistory',
        param: { id: assetId },
        render: ['renderChart']
    }
];

// 검증 1: 배열 타입
console.assert(Array.isArray(this.datasetInfo), 'datasetInfo는 배열');

// 검증 2: 필수 필드 존재
this.datasetInfo.forEach((info, index) => {
    console.assert(typeof info.datasetName === 'string', `[${index}] datasetName 존재`);
    console.assert(typeof info.param === 'object', `[${index}] param 존재`);
    console.assert(Array.isArray(info.render), `[${index}] render 배열 존재`);
});

// 검증 3: 다중 데이터셋
console.assert(this.datasetInfo.length === 2, '다중 데이터셋 정의 가능');

// 검증 4: render 배열 내 메서드명
console.assert(
    this.datasetInfo[0].render.includes('renderSensorInfo'),
    '렌더 메서드명 포함'
);
```

**통과 기준:**
- datasetInfo가 배열 형태
- 각 항목에 datasetName, param, render 필드 존재
- render는 문자열 배열 (메서드명)

---

#### TC-SC-002: datasetInfo 기반 데이터 fetch 검증

**목적:** datasetInfo를 순회하며 fetchData를 호출하는지 검증

**사전 조건:**
- datasetInfo가 정의됨
- fetchData 함수가 사용 가능

**테스트 순서:**
1. showDetail() 메서드에서 datasetInfo 순회
2. fetchData 호출 확인
3. 응답 데이터가 render 메서드로 전달되는지 확인

**검증 코드:**
```javascript
// register.js
const { fetchData } = Wkit;

this.datasetInfo = [
    { datasetName: 'sensor', param: { id: 'test-001' }, render: ['renderSensorInfo'] }
];

let fetchCalled = false;
let fetchedDatasetName = null;
let fetchedParam = null;

// fetchData 모킹
const originalFetchData = Wkit.fetchData;
Wkit.fetchData = (page, datasetName, param) => {
    fetchCalled = true;
    fetchedDatasetName = datasetName;
    fetchedParam = param;
    return Promise.resolve({
        response: { data: { name: 'Test Sensor', temperature: 25.5 } }
    });
};

// renderSensorInfo 정의
let renderCalled = false;
let renderedData = null;
this.renderSensorInfo = (data) => {
    renderCalled = true;
    renderedData = data;
};

// showDetail 구현
this.showDetail = function() {
    fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, param, render }) =>
            fx.go(
                Wkit.fetchData(this.page, datasetName, param),
                result => result?.response?.data,
                data => data && render.forEach(fn => this[fn](data))
            )
        )
    );
};

// 실행
await this.showDetail();

// 검증
console.assert(fetchCalled === true, 'fetchData 호출됨');
console.assert(fetchedDatasetName === 'sensor', 'datasetName 전달됨');
console.assert(fetchedParam.id === 'test-001', 'param 전달됨');
console.assert(renderCalled === true, 'render 메서드 호출됨');
console.assert(renderedData.name === 'Test Sensor', '데이터가 render로 전달됨');

// 원복
Wkit.fetchData = originalFetchData;
```

**통과 기준:**
- datasetInfo의 각 항목에 대해 fetchData 호출
- 응답 데이터가 render 배열의 메서드로 전달됨

---

#### TC-SC-003: datasetInfo 다중 렌더 메서드 실행 검증

**목적:** render 배열에 여러 메서드가 있을 때 모두 실행되는지 검증

**사전 조건:**
- render 배열에 복수의 메서드명이 있음

**테스트 순서:**
1. 여러 render 메서드를 가진 datasetInfo 정의
2. fetchData 후 모든 render 메서드 호출 확인

**검증 코드:**
```javascript
// register.js
this.datasetInfo = [
    {
        datasetName: 'combinedData',
        param: { id: 'test-001' },
        render: ['renderBasicInfo', 'renderStatistics', 'renderChart']
    }
];

const calledMethods = [];

this.renderBasicInfo = () => calledMethods.push('renderBasicInfo');
this.renderStatistics = () => calledMethods.push('renderStatistics');
this.renderChart = () => calledMethods.push('renderChart');

// fetchData 모킹
const originalFetchData = Wkit.fetchData;
Wkit.fetchData = () => Promise.resolve({
    response: { data: { value: 100 } }
});

// showDetail 실행
this.showDetail = function() {
    fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, param, render }) =>
            fx.go(
                Wkit.fetchData(this.page, datasetName, param),
                result => result?.response?.data,
                data => data && render.forEach(fn => this[fn](data))
            )
        )
    );
};

await this.showDetail();

// 검증
console.assert(calledMethods.length === 3, '3개 메서드 모두 호출됨');
console.assert(calledMethods.includes('renderBasicInfo'), 'renderBasicInfo 호출됨');
console.assert(calledMethods.includes('renderStatistics'), 'renderStatistics 호출됨');
console.assert(calledMethods.includes('renderChart'), 'renderChart 호출됨');

Wkit.fetchData = originalFetchData;
```

**통과 기준:**
- render 배열의 모든 메서드가 호출됨
- 호출 순서는 배열 순서와 동일

---

### 7.2 Config 기반 렌더링

#### TC-SC-004: baseInfoConfig 정의 및 적용 검증

**목적:** Config 기반으로 DOM에 데이터가 렌더링되는지 검증

**사전 조건:**
- applyShadowPopupMixin 적용됨
- 팝업 템플릿에 config의 selector에 해당하는 요소가 있음

**테스트 순서:**
1. baseInfoConfig 정의
2. 데이터로 렌더링 실행
3. DOM에 값이 삽입되었는지 확인

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin } = PopupMixin;

applyShadowPopupMixin(this, {
    getHTML: () => `
        <div class="popup">
            <span class="sensor-name"></span>
            <span class="sensor-zone"></span>
            <span class="sensor-status"></span>
        </div>
    `,
    getStyles: () => '',
    onCreated: null
});

this.createPopup();

// Config 정의
this.baseInfoConfig = [
    { key: 'name', selector: '.sensor-name' },
    { key: 'zone', selector: '.sensor-zone' },
    { key: 'status', selector: '.sensor-status', dataAttr: 'status' }
];

// 렌더 함수 (config 바인딩 패턴)
function renderInfo(config, data) {
    fx.go(
        config,
        fx.each(({ key, selector, dataAttr }) => {
            const el = this.popupQuery(selector);
            if (el) {
                el.textContent = data[key];
                if (dataAttr) el.dataset[dataAttr] = data[key];
            }
        })
    );
}

this.renderSensorInfo = renderInfo.bind(this, this.baseInfoConfig);

// 렌더링 실행
const testData = {
    name: 'Sensor A',
    zone: 'Zone 1',
    status: 'active'
};

this.renderSensorInfo(testData);

// 검증
const nameEl = this.popupQuery('.sensor-name');
const zoneEl = this.popupQuery('.sensor-zone');
const statusEl = this.popupQuery('.sensor-status');

console.assert(nameEl.textContent === 'Sensor A', 'name 렌더링됨');
console.assert(zoneEl.textContent === 'Zone 1', 'zone 렌더링됨');
console.assert(statusEl.textContent === 'active', 'status 렌더링됨');
console.assert(statusEl.dataset.status === 'active', 'dataAttr 설정됨');
```

**통과 기준:**
- config의 각 항목에 대해 DOM에 값이 삽입됨
- dataAttr가 있으면 dataset 속성도 설정됨

---

#### TC-SC-005: chartConfig optionBuilder 패턴 검증

**목적:** chartConfig의 optionBuilder가 올바른 차트 옵션을 생성하는지 검증

**사전 조건:**
- chartConfig가 정의됨
- optionBuilder 함수가 존재함

**테스트 순서:**
1. chartConfig 정의
2. optionBuilder 호출
3. 생성된 옵션 구조 검증

**검증 코드:**
```javascript
// register.js

// 옵션 빌더 함수
function getLineChartOption(config, data) {
    const { xKey, series } = config;
    return {
        xAxis: { type: 'category', data: data[xKey] },
        yAxis: { type: 'value' },
        series: series.map(({ yKey, color, smooth }) => ({
            type: 'line',
            data: data[yKey],
            lineStyle: { color },
            smooth: smooth ?? false
        }))
    };
}

// Config 정의
this.chartConfig = {
    xKey: 'timestamps',
    series: [
        { yKey: 'temperatures', color: '#3b82f6', smooth: true },
        { yKey: 'humidities', color: '#22c55e', smooth: true }
    ],
    optionBuilder: getLineChartOption
};

// 테스트 데이터
const testData = {
    timestamps: ['10:00', '11:00', '12:00'],
    temperatures: [20, 22, 21],
    humidities: [60, 55, 58]
};

// optionBuilder 호출
const { optionBuilder, ...chartConfig } = this.chartConfig;
const option = optionBuilder(chartConfig, testData);

// 검증 1: xAxis 데이터
console.assert(option.xAxis.data.length === 3, 'xAxis 데이터 3개');
console.assert(option.xAxis.data[0] === '10:00', 'xAxis 첫 번째 값');

// 검증 2: series 개수
console.assert(option.series.length === 2, 'series 2개 생성');

// 검증 3: 첫 번째 시리즈 (temperatures)
console.assert(option.series[0].type === 'line', '라인 차트 타입');
console.assert(option.series[0].data.length === 3, 'temperatures 데이터 3개');
console.assert(option.series[0].lineStyle.color === '#3b82f6', '색상 적용됨');
console.assert(option.series[0].smooth === true, 'smooth 옵션 적용됨');

// 검증 4: 두 번째 시리즈 (humidities)
console.assert(option.series[1].data[0] === 60, 'humidities 첫 번째 값');
```

**통과 기준:**
- optionBuilder가 config와 data를 받아 ECharts 옵션 생성
- xKey, series 설정이 옵션에 반영됨

---

#### TC-SC-006: tableConfig 테이블 옵션 생성 검증

**목적:** tableConfig가 Tabulator 옵션을 올바르게 생성하는지 검증

**사전 조건:**
- tableConfig가 정의됨

**테스트 순서:**
1. tableConfig 정의
2. optionBuilder 호출
3. columns, layout 등 옵션 검증

**검증 코드:**
```javascript
// register.js

function getTableOption(config, data) {
    return {
        layout: 'fitColumns',
        height: 250,
        columns: config.columns,
        data: data
    };
}

this.tableConfig = {
    columns: [
        { title: 'PID', field: 'pid', widthGrow: 1 },
        { title: 'Name', field: 'name', widthGrow: 2 },
        { title: 'CPU', field: 'cpu', widthGrow: 1 }
    ],
    optionBuilder: getTableOption
};

const testData = [
    { pid: 1234, name: 'process1', cpu: 10 },
    { pid: 5678, name: 'process2', cpu: 25 }
];

const { optionBuilder, ...tableConfig } = this.tableConfig;
const option = optionBuilder(tableConfig, testData);

// 검증
console.assert(option.layout === 'fitColumns', 'layout 설정됨');
console.assert(option.height === 250, 'height 설정됨');
console.assert(option.columns.length === 3, 'columns 3개');
console.assert(option.columns[0].title === 'PID', '첫 번째 컬럼 title');
console.assert(option.data.length === 2, 'data 2행');
```

**통과 기준:**
- tableConfig의 columns가 옵션에 포함됨
- optionBuilder가 완전한 Tabulator 옵션 반환

---

### 7.3 Public Methods 검증

#### TC-SC-007: showDetail 팝업 표시 및 데이터 로드 검증

**목적:** showDetail()이 팝업을 표시하고 데이터를 로드하는지 검증

**사전 조건:**
- PopupMixin 적용됨
- datasetInfo 정의됨

**테스트 순서:**
1. showDetail() 호출
2. showPopup() 호출 확인
3. datasetInfo 순회하여 fetchData 호출 확인
4. render 메서드 호출 확인

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="chart" style="width:400px;height:300px;"></div></div>',
    getStyles: () => '',
    onCreated: () => this.createChart('.chart')
});
applyEChartsMixin(this);

this.datasetInfo = [
    { datasetName: 'sensor', param: { id: 'test' }, render: ['renderInfo'] }
];

let showPopupCalled = false;
let renderInfoCalled = false;

const originalShowPopup = this.showPopup;
this.showPopup = function() {
    showPopupCalled = true;
    originalShowPopup.call(this);
};

this.renderInfo = () => { renderInfoCalled = true; };

// fetchData 모킹
const originalFetchData = Wkit.fetchData;
Wkit.fetchData = () => Promise.resolve({
    response: { data: { value: 100 } }
});

// showDetail 구현
function showDetail() {
    this.showPopup();
    fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, param, render }) =>
            fx.go(
                Wkit.fetchData(this.page, datasetName, param),
                result => result?.response?.data,
                data => data && render.forEach(fn => this[fn](data))
            )
        )
    );
}

this.showDetail = showDetail.bind(this);

// 실행
await this.showDetail();

// 검증
console.assert(showPopupCalled === true, 'showPopup 호출됨');
console.assert(renderInfoCalled === true, 'render 메서드 호출됨');
console.assert(this._popup.host.style.display === 'block', '팝업 표시됨');

Wkit.fetchData = originalFetchData;
```

**통과 기준:**
- showPopup()이 호출되어 팝업 표시
- fetchData로 데이터 로드
- render 메서드로 데이터 렌더링

---

#### TC-SC-008: hideDetail 팝업 숨김 검증

**목적:** hideDetail()이 팝업을 숨기는지 검증

**사전 조건:**
- 팝업이 표시된 상태

**테스트 순서:**
1. showDetail()로 팝업 표시
2. hideDetail() 호출
3. 팝업 숨김 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup">Content</div>',
    getStyles: () => '',
    onCreated: null
});

function hideDetail() {
    this.hidePopup();
}

this.hideDetail = hideDetail.bind(this);

// 팝업 표시
this.showPopup();
console.assert(this._popup.host.style.display === 'block', '팝업 표시됨');

// hideDetail 호출
this.hideDetail();

// 검증
console.assert(this._popup.host.style.display === 'none', '팝업 숨겨짐');
```

**통과 기준:**
- hideDetail() 호출 시 팝업이 숨겨짐

---

#### TC-SC-009: showDetail 에러 처리 검증

**목적:** fetchData 실패 시 에러가 처리되고 팝업이 숨겨지는지 검증

**사전 조건:**
- fetchData가 에러를 던질 수 있음

**테스트 순서:**
1. fetchData가 실패하도록 설정
2. showDetail() 호출
3. 에러 catch 및 hidePopup 호출 확인

**검증 코드:**
```javascript
// register.js
applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup">Content</div>',
    getStyles: () => '',
    onCreated: null
});

this.datasetInfo = [
    { datasetName: 'failingDataset', param: {}, render: ['renderInfo'] }
];

this.renderInfo = () => {};

// fetchData가 에러를 던지도록 설정
const originalFetchData = Wkit.fetchData;
Wkit.fetchData = () => Promise.reject(new Error('Network Error'));

let hidePopupCalled = false;
const originalHidePopup = this.hidePopup;
this.hidePopup = function() {
    hidePopupCalled = true;
    originalHidePopup.call(this);
};

let errorCaught = false;

function showDetail() {
    this.showPopup();
    return fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, param, render }) =>
            fx.go(
                Wkit.fetchData(this.page, datasetName, param),
                result => result?.response?.data,
                data => data && render.forEach(fn => this[fn](data))
            )
        )
    ).catch(e => {
        errorCaught = true;
        console.error('[Component]', e.message);
        this.hidePopup();
    });
}

this.showDetail = showDetail.bind(this);

// 실행
await this.showDetail();

// 검증
console.assert(errorCaught === true, '에러가 catch됨');
console.assert(hidePopupCalled === true, '에러 시 hidePopup 호출됨');

Wkit.fetchData = originalFetchData;
```

**통과 기준:**
- fetchData 실패 시 catch 블록 실행
- 에러 발생 시 팝업 숨김

---

### 7.4 3D 이벤트 연동

#### TC-SC-010: bind3DEvents customEvents 바인딩 검증

**목적:** bind3DEvents가 customEvents를 올바르게 바인딩하는지 검증

**사전 조건:**
- 3D 컴포넌트임
- bind3DEvents 함수가 사용 가능

**테스트 순서:**
1. customEvents 정의
2. bind3DEvents 호출
3. 이벤트 바인딩 확인

**검증 코드:**
```javascript
// register.js
const { bind3DEvents } = Wkit;

this.customEvents = {
    click: '@sensorClicked',
    dblclick: '@sensorDoubleClicked'
};

// bind3DEvents 모킹 (실제로는 Wkit 내부에서 처리)
let boundEvents = [];
const originalBind3DEvents = Wkit.bind3DEvents;
Wkit.bind3DEvents = (instance, events) => {
    Object.entries(events).forEach(([eventType, eventName]) => {
        boundEvents.push({ instance, eventType, eventName });
    });
};

bind3DEvents(this, this.customEvents);

// 검증
console.assert(boundEvents.length === 2, '2개 이벤트 바인딩됨');
console.assert(
    boundEvents.some(e => e.eventType === 'click' && e.eventName === '@sensorClicked'),
    'click 이벤트 바인딩됨'
);
console.assert(
    boundEvents.some(e => e.eventType === 'dblclick' && e.eventName === '@sensorDoubleClicked'),
    'dblclick 이벤트 바인딩됨'
);
console.assert(boundEvents[0].instance === this, '인스턴스 참조 전달됨');

Wkit.bind3DEvents = originalBind3DEvents;
```

**통과 기준:**
- customEvents의 각 항목이 바인딩됨
- 컴포넌트 인스턴스가 연결됨

---

#### TC-SC-011: Page eventBusHandler에서 3D 이벤트 수신 검증

**목적:** Page에서 3D 컴포넌트가 발행한 이벤트를 수신하는지 검증

**사전 조건:**
- eventBusHandlers에 '@sensorClicked' 핸들러 등록
- 3D 컴포넌트가 이벤트를 발행함

**테스트 순서:**
1. Page의 eventBusHandlers에 핸들러 등록
2. 3D 컴포넌트에서 이벤트 발행
3. 핸들러 실행 및 targetInstance, datasetInfo 전달 확인

**검증 코드:**
```javascript
// before_load.js (Page)
const { onEventBusHandlers, fetchData } = Wkit;

let eventReceived = false;
let receivedTargetInstance = null;
let receivedDatasetInfo = null;

this.eventBusHandlers = {
    '@sensorClicked': async ({ event, targetInstance }) => {
        eventReceived = true;
        receivedTargetInstance = targetInstance;
        receivedDatasetInfo = targetInstance.datasetInfo;

        // datasetInfo가 있으면 데이터 fetch
        if (receivedDatasetInfo?.length) {
            for (const { datasetName, param } of receivedDatasetInfo) {
                const data = await fetchData(this, datasetName, param);
                console.log('Fetched data:', data);
            }
        }
    }
};

onEventBusHandlers(this.eventBusHandlers);

// 3D 컴포넌트 시뮬레이션
const mockComponent = {
    id: 'sensor-001',
    datasetInfo: [
        { datasetName: 'sensorData', param: { id: 'sensor-001' }, render: [] }
    ]
};

// 이벤트 발행 시뮬레이션
Weventbus.emit('@sensorClicked', {
    event: { intersects: [{ object: {} }] },
    targetInstance: mockComponent
});

// 검증 (비동기 대기 필요)
await new Promise(resolve => setTimeout(resolve, 50));

console.assert(eventReceived === true, '이벤트 수신됨');
console.assert(receivedTargetInstance.id === 'sensor-001', 'targetInstance 전달됨');
console.assert(receivedDatasetInfo.length === 1, 'datasetInfo 접근 가능');
console.assert(receivedDatasetInfo[0].datasetName === 'sensorData', 'datasetName 확인');
```

**통과 기준:**
- Page의 eventBusHandler가 이벤트 수신
- targetInstance를 통해 컴포넌트의 datasetInfo 접근 가능

---

### 7.5 Template 및 publishCode 연동

#### TC-SC-012: publishCode에서 HTML/CSS 추출 검증

**목적:** properties.publishCode에서 HTML과 CSS를 추출하는지 검증

**사전 조건:**
- this.properties.publishCode가 존재함

**테스트 순서:**
1. publishCode 구조 확인
2. htmlCode, cssCode 추출
3. getPopupHTML, getPopupStyles 정의

**검증 코드:**
```javascript
// register.js

// publishCode 시뮬레이션
this.properties = {
    publishCode: {
        htmlCode: `
            <template id="popup-sensor">
                <div class="sensor-popup">
                    <h1 class="title">Sensor Info</h1>
                    <div class="content"></div>
                </div>
            </template>
        `,
        cssCode: `
            .sensor-popup { background: #1a1f2e; }
            .title { color: white; }
        `
    }
};

function extractTemplate(htmlCode, templateId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlCode, 'text/html');
    const template = doc.querySelector(`template#${templateId}`);
    return template?.innerHTML || '';
}

const { htmlCode, cssCode } = this.properties.publishCode || {};

this.templateConfig = {
    popup: 'popup-sensor'
};

this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
this.getPopupStyles = () => cssCode || '';

// 검증
const html = this.getPopupHTML();
const css = this.getPopupStyles();

console.assert(html.includes('sensor-popup'), 'HTML 템플릿 추출됨');
console.assert(html.includes('Sensor Info'), 'HTML 내용 포함');
console.assert(!html.includes('<template'), 'template 태그는 제외');
console.assert(css.includes('.sensor-popup'), 'CSS 추출됨');
console.assert(css.includes('background'), 'CSS 스타일 포함');
```

**통과 기준:**
- htmlCode에서 지정된 template 내용 추출
- cssCode 그대로 반환
- template 태그 자체는 제외되고 내부 HTML만 추출

---

#### TC-SC-013: extractTemplate 없는 템플릿 처리 검증

**목적:** 존재하지 않는 템플릿 ID로 요청 시 빈 문자열 반환

**사전 조건:**
- htmlCode에 해당 template ID가 없음

**테스트 순서:**
1. 존재하지 않는 templateId로 extractTemplate 호출
2. 빈 문자열 반환 확인

**검증 코드:**
```javascript
// register.js
function extractTemplate(htmlCode, templateId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlCode, 'text/html');
    const template = doc.querySelector(`template#${templateId}`);
    return template?.innerHTML || '';
}

const htmlCode = '<template id="other-popup"><div>Other</div></template>';

// 존재하지 않는 ID
const result = extractTemplate(htmlCode, 'non-existent');
console.assert(result === '', '없는 템플릿은 빈 문자열');

// 존재하는 ID
const existing = extractTemplate(htmlCode, 'other-popup');
console.assert(existing.includes('Other'), '존재하는 템플릿은 내용 반환');

// 빈 htmlCode
const empty = extractTemplate('', 'any-id');
console.assert(empty === '', '빈 HTML은 빈 문자열');

// publishCode 없는 경우
const nullCheck = extractTemplate(null || '', 'popup');
console.assert(nullCheck === '', 'null/undefined 안전 처리');
```

**통과 기준:**
- 없는 템플릿 ID는 빈 문자열 반환
- null/undefined 안전 처리

---

### 7.6 컴포넌트 정리

#### TC-SC-014: beforeDestroy에서 destroyPopup 호출 검증

**목적:** beforeDestroy.js에서 팝업이 정리되는지 검증

**사전 조건:**
- 팝업이 생성된 상태

**테스트 순서:**
1. 팝업 생성 및 차트 생성
2. beforeDestroy.js 실행 (destroyPopup 호출)
3. 모든 리소스 정리 확인

**검증 코드:**
```javascript
// register.js
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><div class="chart" style="width:400px;height:300px;"></div></div>',
    getStyles: () => '',
    onCreated: () => this.createChart('.chart')
});
applyEChartsMixin(this);

this.createPopup();
this.createChart('.chart');

// 정리 전 상태 확인
console.assert(this._popup.host !== null, '정리 전: host 존재');
console.assert(this._popup.charts.size === 1, '정리 전: 차트 1개');

// beforeDestroy.js 실행
this.destroyPopup();
console.log('[Component] Destroyed');

// 검증
console.assert(this._popup.host === null, '정리 후: host null');
console.assert(this._popup.charts.size === 0, '정리 후: charts 비워짐');
```

**통과 기준:**
- destroyPopup()이 호출됨
- 팝업 DOM, 차트, 이벤트 모두 정리됨

---

#### TC-SC-015: 3D 컴포넌트 customEvents/datasetInfo 참조 정리 검증

**목적:** 3D 컴포넌트 정리 시 참조가 null로 설정되는지 검증

**사전 조건:**
- disposeAllThreeResources가 호출됨

**테스트 순서:**
1. customEvents, datasetInfo 정의
2. disposeAllThreeResources 호출 (Page의 before_unload.js)
3. 참조 null 확인

**검증 코드:**
```javascript
// register.js (3D 컴포넌트)
this.customEvents = {
    click: '@objectClicked'
};

this.datasetInfo = [
    { datasetName: 'test', param: {}, render: [] }
];

// before_unload.js (Page)에서 disposeAllThreeResources 호출 시
// 각 3D 컴포넌트에 대해 아래 정리 수행

// disposeAllThreeResources 시뮬레이션
function cleanupComponent(component) {
    // subscriptions 해제는 내부에서 처리

    // 참조 제거
    component.customEvents = null;
    component.datasetInfo = null;
}

cleanupComponent(this);

// 검증
console.assert(this.customEvents === null, 'customEvents null');
console.assert(this.datasetInfo === null, 'datasetInfo null');
```

**통과 기준:**
- customEvents 참조가 null
- datasetInfo 참조가 null

---

### 7.7 통합 테스트

#### TC-SC-016: 팝업 컴포넌트 전체 흐름 검증

**목적:** 생성 → 이벤트 → 팝업 표시 → 데이터 로드 → 렌더링 → 정리 전체 흐름 검증

**사전 조건:**
- 모든 구성 요소가 설정됨

**테스트 순서:**
1. 컴포넌트 생성 (register.js)
2. 3D 클릭 이벤트 발생
3. showDetail() 호출
4. 데이터 fetch 및 렌더링
5. hideDetail() 호출
6. 정리 (beforeDestroy.js)

**검증 코드:**
```javascript
// 전체 흐름 테스트
const lifecycle = [];

// === 1. 생성 (register.js) ===
const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;
const { bind3DEvents, fetchData } = Wkit;

applyShadowPopupMixin(this, {
    getHTML: () => '<div class="popup"><span class="name"></span><div class="chart" style="width:400px;height:300px;"></div></div>',
    getStyles: () => '',
    onCreated: () => {
        this.createChart('.chart');
        lifecycle.push('popup:created');
    }
});
applyEChartsMixin(this);

this.datasetInfo = [
    { datasetName: 'sensor', param: { id: 'test' }, render: ['renderName'] }
];

this.customEvents = { click: '@sensorClicked' };

this.renderName = (data) => {
    this.popupQuery('.name').textContent = data.name;
    lifecycle.push('render:name');
};

function showDetail() {
    lifecycle.push('showDetail:called');
    this.showPopup();
    return fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, param, render }) =>
            fx.go(
                Wkit.fetchData(this.page, datasetName, param),
                result => result?.response?.data,
                data => {
                    lifecycle.push('data:fetched');
                    data && render.forEach(fn => this[fn](data));
                }
            )
        )
    );
}

function hideDetail() {
    lifecycle.push('hideDetail:called');
    this.hidePopup();
}

this.showDetail = showDetail.bind(this);
this.hideDetail = hideDetail.bind(this);

lifecycle.push('component:registered');

// === 2. fetchData 모킹 ===
Wkit.fetchData = () => Promise.resolve({
    response: { data: { name: 'Test Sensor' } }
});

// === 3. 이벤트 시뮬레이션 (Page에서) ===
// 실제로는 eventBusHandler가 showDetail 호출
await this.showDetail();

// === 4. 팝업 숨김 ===
this.hideDetail();

// === 5. 정리 (beforeDestroy.js) ===
this.destroyPopup();
this.customEvents = null;
this.datasetInfo = null;
lifecycle.push('component:destroyed');

// === 검증 ===
console.log('Lifecycle:', lifecycle);

console.assert(lifecycle[0] === 'component:registered', '1. 컴포넌트 등록');
console.assert(lifecycle[1] === 'showDetail:called', '2. showDetail 호출');
console.assert(lifecycle[2] === 'popup:created', '3. 팝업 생성');
console.assert(lifecycle[3] === 'data:fetched', '4. 데이터 fetch');
console.assert(lifecycle[4] === 'render:name', '5. 렌더링');
console.assert(lifecycle[5] === 'hideDetail:called', '6. hideDetail 호출');
console.assert(lifecycle[6] === 'component:destroyed', '7. 컴포넌트 정리');

console.assert(this._popup.host === null, '팝업 DOM 정리됨');
console.assert(this.customEvents === null, 'customEvents 정리됨');
console.assert(this.datasetInfo === null, 'datasetInfo 정리됨');
```

**통과 기준:**
- 전체 라이프사이클이 순서대로 실행됨
- 모든 리소스가 정리됨

---

### 7.8 팝업 컴포넌트 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-SC-001 | datasetInfo 배열 구조 검증 | ☐ |
| TC-SC-002 | datasetInfo 기반 데이터 fetch 검증 | ☐ |
| TC-SC-003 | datasetInfo 다중 렌더 메서드 실행 검증 | ☐ |
| TC-SC-004 | baseInfoConfig 정의 및 적용 검증 | ☐ |
| TC-SC-005 | chartConfig optionBuilder 패턴 검증 | ☐ |
| TC-SC-006 | tableConfig 테이블 옵션 생성 검증 | ☐ |
| TC-SC-007 | showDetail 팝업 표시 및 데이터 로드 검증 | ☐ |
| TC-SC-008 | hideDetail 팝업 숨김 검증 | ☐ |
| TC-SC-009 | showDetail 에러 처리 검증 | ☐ |
| TC-SC-010 | bind3DEvents customEvents 바인딩 검증 | ☐ |
| TC-SC-011 | Page eventBusHandler에서 3D 이벤트 수신 검증 | ☐ |
| TC-SC-012 | publishCode에서 HTML/CSS 추출 검증 | ☐ |
| TC-SC-013 | extractTemplate 없는 템플릿 처리 검증 | ☐ |
| TC-SC-014 | beforeDestroy에서 destroyPopup 호출 검증 | ☐ |
| TC-SC-015 | 3D 컴포넌트 customEvents/datasetInfo 참조 정리 검증 | ☐ |
| TC-SC-016 | 팝업 컴포넌트 전체 흐름 검증 | ☐ |

---

## 8. fx.go 에러 핸들링 테스트

fx.go 기반 파이프라인에서의 에러 전파와 처리 전략을 검증합니다.

**핵심 원칙:**
- 유틸(fx.go, reduce)은 에러를 처리하지 않고 전파한다
- 호출자가 반드시 에러를 처리해야 한다
- 파이프라인은 fail-fast 동작 (에러 발생 시 즉시 중단)
- nop은 필터 전용 내부 시그널 (에러가 아님)
- catch 위치가 에러 처리 전략을 결정한다

### 8.1 기본 에러 전파

#### TC-FX-001: fx.go 에러 전파 검증

**목적:** fx.go 파이프라인에서 에러가 호출자까지 전파되는지 검증

**사전 조건:**
- fx.go 함수가 사용 가능

**테스트 순서:**
1. 중간 함수에서 에러 throw
2. fx.go가 rejected Promise 반환 확인
3. catch로 에러 수신 확인

**검증 코드:**
```javascript
// 에러를 발생시키는 파이프라인
let errorReceived = null;

await fx.go(
    1,
    x => x + 1,
    x => {
        throw new Error('Intentional Error');
    },
    x => x + 1  // 이 함수는 실행되지 않아야 함
).catch(e => {
    errorReceived = e;
});

// 검증
console.assert(errorReceived !== null, '에러가 catch로 전파됨');
console.assert(errorReceived.message === 'Intentional Error', '에러 메시지 일치');
```

**통과 기준:**
- 에러가 catch까지 전파됨
- 에러 후 함수는 실행되지 않음

---

#### TC-FX-002: 비동기 파이프라인 에러 전파 검증

**목적:** Promise 기반 비동기 함수에서 에러가 전파되는지 검증

**사전 조건:**
- 파이프라인에 비동기 함수 포함

**테스트 순서:**
1. async 함수에서 reject 발생
2. 에러 전파 확인

**검증 코드:**
```javascript
let errorReceived = null;
let afterErrorExecuted = false;

await fx.go(
    'start',
    async x => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return x + '_async';
    },
    async x => {
        await new Promise((_, reject) => reject(new Error('Async Error')));
        return x;  // 실행되지 않음
    },
    x => {
        afterErrorExecuted = true;
        return x;
    }
).catch(e => {
    errorReceived = e;
});

// 검증
console.assert(errorReceived !== null, '비동기 에러 전파됨');
console.assert(errorReceived.message === 'Async Error', '에러 메시지 일치');
console.assert(afterErrorExecuted === false, '에러 후 함수 미실행');
```

**통과 기준:**
- 비동기 에러가 전파됨
- fail-fast 동작 (에러 후 중단)

---

#### TC-FX-003: fx.each 내부 에러 전파 검증

**목적:** fx.each 순회 중 에러가 전파되는지 검증

**사전 조건:**
- fx.each로 배열 순회

**테스트 순서:**
1. 배열 순회 중 특정 항목에서 에러 발생
2. 순회 중단 및 에러 전파 확인

**검증 코드:**
```javascript
const processed = [];
let errorReceived = null;

await fx.go(
    [1, 2, 3, 4, 5],
    fx.each(x => {
        if (x === 3) {
            throw new Error(`Error at item ${x}`);
        }
        processed.push(x);
    })
).catch(e => {
    errorReceived = e;
});

// 검증
console.assert(errorReceived !== null, '에러가 전파됨');
console.assert(errorReceived.message === 'Error at item 3', '에러 메시지 일치');
console.assert(processed.length === 2, '에러 전 항목만 처리됨');
console.assert(processed.includes(1) && processed.includes(2), '1, 2만 처리됨');
console.assert(!processed.includes(4) && !processed.includes(5), '4, 5 미처리');
```

**통과 기준:**
- 에러 발생 시 순회 즉시 중단
- 에러 발생 전 항목만 처리됨

---

### 8.2 nop 시그널 동작

#### TC-FX-004: nop이 필터 스킵으로 동작하는지 검증

**목적:** L.filter에서 false인 항목이 nop으로 스킵되는지 검증

**사전 조건:**
- fx.L.filter 사용

**테스트 순서:**
1. 필터 조건으로 일부 항목 제외
2. nop이 에러가 아닌 스킵으로 동작 확인

**검증 코드:**
```javascript
const result = [];

await fx.go(
    [1, 2, 3, 4, 5],
    fx.L.filter(x => x % 2 === 1),  // 홀수만
    fx.each(x => result.push(x))
);

// 검증: nop은 에러가 아니라 스킵
console.assert(result.length === 3, '홀수 3개만 처리됨');
console.assert(result.includes(1), '1 포함');
console.assert(result.includes(3), '3 포함');
console.assert(result.includes(5), '5 포함');
console.assert(!result.includes(2), '2 스킵됨');
console.assert(!result.includes(4), '4 스킵됨');
```

**통과 기준:**
- false인 항목은 스킵됨 (에러 아님)
- 순회는 계속 진행됨

---

#### TC-FX-005: nop과 진짜 에러 구분 검증

**목적:** nop은 복구되고 진짜 에러는 전파되는지 검증

**사전 조건:**
- 필터와 에러 발생 함수가 함께 사용됨

**테스트 순서:**
1. 필터로 일부 스킵
2. 통과한 항목 중 에러 발생
3. nop은 스킵, 에러는 전파 확인

**검증 코드:**
```javascript
const processed = [];
let errorReceived = null;

await fx.go(
    [1, 2, 3, 4, 5],
    fx.L.filter(x => x % 2 === 1),  // 홀수만 통과: 1, 3, 5
    fx.each(x => {
        if (x === 3) {
            throw new Error('Error at 3');
        }
        processed.push(x);
    })
).catch(e => {
    errorReceived = e;
});

// 검증
console.assert(processed.length === 1, '1만 처리됨');
console.assert(processed[0] === 1, '첫 번째 홀수 1 처리');
console.assert(errorReceived !== null, '에러 전파됨');
console.assert(errorReceived.message === 'Error at 3', 'x=3에서 에러');

// nop(짝수 스킵)과 에러(x=3)가 구분됨
// 2, 4는 필터에서 스킵 (nop) → 순회 계속
// 3에서 에러 → 순회 중단
```

**통과 기준:**
- nop (필터 false)은 스킵 후 계속 진행
- 진짜 에러는 순회 중단 + 전파

---

### 8.3 catch 위치와 에러 처리 전략

#### TC-FX-006: 파이프라인 끝 catch (기본 패턴) 검증

**목적:** 파이프라인 끝에서 catch하면 에러가 일관되게 처리되는지 검증

**사전 조건:**
- 여러 단계의 파이프라인

**테스트 순서:**
1. 다단계 파이프라인에서 에러 발생
2. 끝의 catch에서 수신 확인

**검증 코드:**
```javascript
let errorReceived = null;
let step1Executed = false;
let step2Executed = false;
let step3Executed = false;

await fx.go(
    'input',
    x => { step1Executed = true; return x + '_1'; },
    x => { step2Executed = true; throw new Error('Step 2 Error'); },
    x => { step3Executed = true; return x + '_3'; }
).catch(e => {
    errorReceived = e;
    console.error('[Pipeline]', e.message);
    // 상태 복구 / 에러 UI / 중단 처리
});

// 검증
console.assert(step1Executed === true, 'Step 1 실행됨');
console.assert(step2Executed === true, 'Step 2 실행됨 (에러 발생)');
console.assert(step3Executed === false, 'Step 3 미실행 (fail-fast)');
console.assert(errorReceived !== null, '끝에서 에러 catch');
console.assert(errorReceived.message === 'Step 2 Error', '에러 메시지 일치');
```

**통과 기준:**
- 에러가 끝까지 전파됨
- 한 지점에서 일관되게 처리됨

---

#### TC-FX-007: 중간 catch (부분 복구) 검증

**목적:** 중간에서 catch하면 fulfilled로 변환되어 계속 진행되는지 검증 (주의 패턴)

**사전 조건:**
- 중간 함수에 catch 포함

**테스트 순서:**
1. 중간 함수에서 에러 발생 + catch
2. 반환값 없이 catch → undefined로 진행
3. 후속 함수 실행 확인

**검증 코드:**
```javascript
let step3Input = null;
let step3Executed = false;

await fx.go(
    'input',
    x => x + '_1',
    async x => {
        // 중간에서 에러 발생 + catch
        return await fx.go(
            x,
            y => { throw new Error('Inner Error'); }
        ).catch(err => {
            console.error('Caught:', err.message);
            // 반환값 없음 → resolved(undefined)
        });
    },
    x => {
        step3Executed = true;
        step3Input = x;
        return x;
    }
);

// 검증: 중간 catch가 에러를 삼킴
console.assert(step3Executed === true, 'Step 3 실행됨 (에러가 삼켜짐)');
console.assert(step3Input === undefined, 'Step 3 입력값 undefined');
```

**통과 기준:**
- 중간 catch가 에러를 fulfilled로 변환
- 파이프라인이 "성공"으로 계속 진행
- 의도하지 않으면 버그 원인

---

#### TC-FX-008: 중간 catch 명시적 대체값 반환 검증

**목적:** 중간 catch에서 명시적 대체값을 반환하면 의미 있는 값으로 진행되는지 검증

**사전 조건:**
- catch에서 대체값 반환

**테스트 순서:**
1. 에러 발생 + catch에서 대체값 반환
2. 대체값으로 파이프라인 계속 확인

**검증 코드:**
```javascript
let step3Input = null;

await fx.go(
    'input',
    x => x + '_1',
    async x => {
        return await fx.go(
            x,
            y => { throw new Error('Inner Error'); }
        ).catch(e => ({
            ok: false,
            error: e.message,
            fallback: 'default_value'
        }));
    },
    x => {
        step3Input = x;
        return x;
    }
);

// 검증: 명시적 대체값
console.assert(typeof step3Input === 'object', '대체 객체 전달됨');
console.assert(step3Input.ok === false, 'ok: false');
console.assert(step3Input.error === 'Inner Error', '에러 메시지 포함');
console.assert(step3Input.fallback === 'default_value', 'fallback 값 포함');
```

**통과 기준:**
- catch에서 반환한 값이 다음 단계로 전달됨
- 에러를 삼키지 않고 의미 있는 값으로 변환

---

### 8.4 interval / 이벤트 핸들러에서의 catch

#### TC-FX-009: setInterval 내 catch 필수 검증

**목적:** interval에서 unhandled rejection이 발생하지 않는지 검증

**사전 조건:**
- setInterval로 주기적 실행

**테스트 순서:**
1. interval 함수에서 에러 발생
2. catch로 처리 확인
3. unhandled rejection 없음 확인

**검증 코드:**
```javascript
let catchCount = 0;

// fetchAndPublish 시뮬레이션 (실패)
const fetchAndPublish = () => Promise.reject(new Error('Network Error'));

const run = () =>
    fetchAndPublish()
        .catch(e => {
            catchCount++;
            console.error('[fetchAndPublish]', e.message);
            // 재시도 / 백오프 / 사용자 알림 등
        });

// interval 시뮬레이션 (3회 실행)
await run();
await run();
await run();

// 검증: 모든 에러가 catch됨
console.assert(catchCount === 3, '모든 에러가 catch됨');

// unhandled rejection 없음 (콘솔에 UnhandledPromiseRejection 에러 없어야 함)
```

**통과 기준:**
- 모든 에러가 catch로 처리됨
- unhandled rejection 없음

---

#### TC-FX-010: 이벤트 핸들러 내 catch 검증

**목적:** 이벤트 핸들러에서 에러가 catch되는지 검증

**사전 조건:**
- eventBusHandler에서 비동기 작업 수행

**테스트 순서:**
1. 핸들러 내에서 에러 발생
2. catch 처리 확인

**검증 코드:**
```javascript
let errorHandled = false;

const eventBusHandlers = {
    '@itemClicked': async ({ event, targetInstance }) => {
        await fx.go(
            targetInstance.datasetInfo,
            fx.each(async ({ datasetName, param }) => {
                // 실패하는 fetchData
                throw new Error('Fetch failed');
            })
        ).catch(e => {
            errorHandled = true;
            console.error('[EventHandler]', e.message);
        });
    }
};

// 이벤트 시뮬레이션
await eventBusHandlers['@itemClicked']({
    event: {},
    targetInstance: {
        datasetInfo: [{ datasetName: 'test', param: {} }]
    }
});

// 검증
console.assert(errorHandled === true, '핸들러 내 에러 처리됨');
```

**통과 기준:**
- 이벤트 핸들러 내 에러가 catch됨
- unhandled rejection 방지

---

### 8.5 중첩 파이프라인 에러 처리

#### TC-FX-011: 내부 파이프라인 에러가 외부로 전파되는지 검증

**목적:** fx.each 내부의 fx.go 에러가 외부 파이프라인으로 전파되는지 검증

**사전 조건:**
- 중첩 파이프라인 구조

**테스트 순서:**
1. 외부 fx.go → 내부 fx.go 구조
2. 내부에서 에러 발생
3. 외부 catch로 전파 확인

**검증 코드:**
```javascript
let outerCatchCalled = false;
let errorMessage = null;

await fx.go(
    [
        { datasetName: 'data1', param: { id: 1 } },
        { datasetName: 'data2', param: { id: 2 } }
    ],
    fx.each(({ datasetName, param }) =>
        fx.go(
            fetchData(datasetName, param),  // 내부 파이프라인
            result => result.data,
            data => {
                if (param.id === 2) {
                    throw new Error(`Error processing ${datasetName}`);
                }
                return data;
            }
        )
    )
).catch(e => {
    outerCatchCalled = true;
    errorMessage = e.message;
});

// fetchData 시뮬레이션
function fetchData(name, param) {
    return Promise.resolve({ data: { name, id: param.id } });
}

// 검증
console.assert(outerCatchCalled === true, '외부 catch 호출됨');
console.assert(errorMessage === 'Error processing data2', '내부 에러가 외부로 전파');
```

**통과 기준:**
- 내부 파이프라인 에러가 외부 catch로 전파됨
- fail-fast 동작

---

#### TC-FX-012: 부분 실패 허용 패턴 (격리) 검증

**목적:** 각 항목을 독립적으로 처리하여 부분 실패를 허용하는지 검증

**사전 조건:**
- 각 항목마다 개별 catch

**테스트 순서:**
1. 여러 항목 순회
2. 일부 항목 실패해도 나머지 처리 확인

**검증 코드:**
```javascript
const results = [];

await fx.go(
    [1, 2, 3, 4, 5],
    fx.each(item =>
        fx.go(
            item,
            x => {
                if (x === 3) throw new Error(`Error at ${x}`);
                return x * 2;
            }
        ).catch(e => ({
            ok: false,
            item,
            error: e.message
        }))
        .then(result => {
            results.push(result !== undefined ? result : { ok: true, value: item * 2 });
        })
    )
);

// 검증: 부분 실패 허용
console.assert(results.length === 5, '모든 항목 처리됨');

// 성공한 항목들
const successItems = results.filter(r => typeof r === 'number' || r.ok !== false);
console.assert(successItems.length >= 4, '대부분 성공');

// 실패한 항목 (item 3)
const failedItem = results.find(r => r.ok === false);
console.assert(failedItem !== undefined, '실패 항목 존재');
console.assert(failedItem.item === 3, 'item 3이 실패');
console.assert(failedItem.error === 'Error at 3', '에러 메시지 포함');
```

**통과 기준:**
- 한 항목 실패해도 나머지 처리됨
- 실패 항목은 명시적 대체값으로 표현됨

---

### 8.6 에러 처리 체크리스트 검증

#### TC-FX-013: fx.go 호출부 catch 존재 검증

**목적:** 모든 fx.go 호출부에 에러 처리가 있는지 검증하는 패턴

**사전 조건:**
- 코드 리뷰 또는 린트 규칙

**테스트 순서:**
1. fx.go 호출 패턴 확인
2. catch 또는 try-catch 존재 확인

**검증 코드:**
```javascript
// 올바른 패턴 1: .catch()
async function correctPattern1() {
    await fx.go(
        data,
        process
    ).catch(e => {
        console.error('[Process]', e);
    });
}

// 올바른 패턴 2: try-catch
async function correctPattern2() {
    try {
        await fx.go(data, process);
    } catch (e) {
        console.error('[Process]', e);
    }
}

// 잘못된 패턴: catch 없음 (Unhandled Rejection 위험)
async function wrongPattern() {
    await fx.go(data, process);  // 위험!
}

// 검증 (코드 분석 패턴)
const hasExternalCatch = (fn) => {
    const fnStr = fn.toString();
    return fnStr.includes('.catch(') || fnStr.includes('catch (');
};

console.assert(hasExternalCatch(correctPattern1), '패턴 1: catch 존재');
console.assert(hasExternalCatch(correctPattern2), '패턴 2: try-catch 존재');
console.assert(!hasExternalCatch(wrongPattern), '잘못된 패턴: catch 없음');
```

**통과 기준:**
- 모든 fx.go에 catch 존재
- Unhandled Rejection 방지

---

#### TC-FX-014: interval/이벤트 핸들러 catch 존재 검증

**목적:** 비동기 컨텍스트에서 catch가 있는지 검증

**사전 조건:**
- setInterval 또는 이벤트 핸들러 코드

**테스트 순서:**
1. interval/핸들러 함수 확인
2. 내부 비동기 작업에 catch 존재 확인

**검증 코드:**
```javascript
// 올바른 interval 패턴
function correctIntervalPattern(page, topic, params, refreshMs) {
    const run = () =>
        GlobalDataPublisher.fetchAndPublish(topic, page, params)
            .catch(e => {
                console.error(`[fetchAndPublish:${topic}]`, e);
            });

    setInterval(run, refreshMs);
    run();  // 최초 실행
}

// 올바른 핸들러 패턴
const correctHandlerPattern = {
    '@dataRequest': async ({ targetInstance }) => {
        await fx.go(
            targetInstance.datasetInfo,
            fx.each(info => fetchData(info))
        ).catch(e => {
            console.error('[Handler]', e);
        });
    }
};

// 잘못된 패턴 (catch 없음)
function wrongIntervalPattern(page, topic, params, refreshMs) {
    const run = () =>
        GlobalDataPublisher.fetchAndPublish(topic, page, params);
        // catch 없음!

    setInterval(run, refreshMs);
}

// 검증 함수
const hasCatchInAsync = (code) => {
    const str = typeof code === 'function' ? code.toString() : JSON.stringify(code);
    return str.includes('.catch(');
};

console.assert(hasCatchInAsync(correctIntervalPattern), 'interval에 catch 존재');
console.assert(
    hasCatchInAsync(correctHandlerPattern['@dataRequest']),
    '핸들러에 catch 존재'
);
```

**통과 기준:**
- interval 내 catch 존재
- 이벤트 핸들러 내 catch 존재

---

### 8.7 fail-fast vs fail-safe 전략

#### TC-FX-015: Fail-fast 전략 검증

**목적:** 첫 에러에서 전체 중단되는지 검증 (초기 로딩에 적합)

**사전 조건:**
- 전체가 완전해야 하는 시나리오

**테스트 순서:**
1. 여러 topic 순차 로드
2. 하나 실패 시 전체 중단 확인

**검증 코드:**
```javascript
const loadedTopics = [];
let errorOccurred = false;

// Fail-fast: 하나라도 실패하면 전체 중단
await fx.go(
    ['topic1', 'topic2', 'topic3'],
    fx.each(async topic => {
        if (topic === 'topic2') {
            throw new Error(`Failed to load ${topic}`);
        }
        loadedTopics.push(topic);
        console.log(`Loaded: ${topic}`);
    })
).catch(e => {
    errorOccurred = true;
    console.error('[Initial Load]', e.message);
});

// 검증
console.assert(errorOccurred === true, '에러 발생');
console.assert(loadedTopics.length === 1, 'topic1만 로드됨');
console.assert(!loadedTopics.includes('topic2'), 'topic2 미로드 (에러)');
console.assert(!loadedTopics.includes('topic3'), 'topic3 미로드 (중단)');
```

**통과 기준:**
- 첫 에러에서 전체 중단
- 에러 후 항목 미처리

---

#### TC-FX-016: Fail-safe (격리) 전략 검증

**목적:** 각 항목이 독립적으로 처리되고 일부 실패를 허용하는지 검증

**사전 조건:**
- topic들이 독립적인 시나리오

**테스트 순서:**
1. 각 topic마다 개별 catch
2. 일부 실패해도 나머지 처리 확인

**검증 코드:**
```javascript
const results = [];

// Fail-safe: 개별 catch로 격리
await fx.go(
    ['topic1', 'topic2', 'topic3'],
    fx.each(async topic => {
        await fx.go(
            topic,
            async t => {
                if (t === 'topic2') {
                    throw new Error(`Failed to load ${t}`);
                }
                return { ok: true, topic: t, data: `data-${t}` };
            }
        ).catch(e => {
            results.push({ ok: false, topic, error: e.message });
        }).then(result => {
            if (result) results.push(result);
        });
    })
);

// 검증
console.assert(results.length === 3, '모든 topic 처리됨');

const successCount = results.filter(r => r.ok).length;
const failCount = results.filter(r => !r.ok).length;

console.assert(successCount === 2, '2개 성공');
console.assert(failCount === 1, '1개 실패');

const failedTopic = results.find(r => !r.ok);
console.assert(failedTopic.topic === 'topic2', 'topic2가 실패');
```

**통과 기준:**
- 모든 항목 처리 시도
- 일부 실패해도 나머지 성공
- 실패 정보 수집됨

---

### 8.8 fx.go 에러 핸들링 체크리스트

| TC ID | 테스트 항목 | 상태 |
|-------|------------|------|
| TC-FX-001 | fx.go 에러 전파 검증 | ☐ |
| TC-FX-002 | 비동기 파이프라인 에러 전파 검증 | ☐ |
| TC-FX-003 | fx.each 내부 에러 전파 검증 | ☐ |
| TC-FX-004 | nop이 필터 스킵으로 동작하는지 검증 | ☐ |
| TC-FX-005 | nop과 진짜 에러 구분 검증 | ☐ |
| TC-FX-006 | 파이프라인 끝 catch (기본 패턴) 검증 | ☐ |
| TC-FX-007 | 중간 catch (부분 복구) 검증 | ☐ |
| TC-FX-008 | 중간 catch 명시적 대체값 반환 검증 | ☐ |
| TC-FX-009 | setInterval 내 catch 필수 검증 | ☐ |
| TC-FX-010 | 이벤트 핸들러 내 catch 검증 | ☐ |
| TC-FX-011 | 내부 파이프라인 에러가 외부로 전파되는지 검증 | ☐ |
| TC-FX-012 | 부분 실패 허용 패턴 (격리) 검증 | ☐ |
| TC-FX-013 | fx.go 호출부 catch 존재 검증 | ☐ |
| TC-FX-014 | interval/이벤트 핸들러 catch 존재 검증 | ☐ |
| TC-FX-015 | Fail-fast 전략 검증 | ☐ |
| TC-FX-016 | Fail-safe (격리) 전략 검증 | ☐ |

---

