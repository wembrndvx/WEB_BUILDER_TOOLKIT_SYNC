# this 참조 해제 후 속성이 살아남는 메모리 누수 시나리오

## 문서 목적

컴포넌트(또는 객체 인스턴스)의 this 참조가 끊어진 상황에서,
this의 속성이 메모리에 잔존할 수 있는 조건과
이때 this 전체가 누수되는지 여부를 정리한다.

### 작성일: 2026-02-14

### 관련 문서
- `INSTANCE_LIFECYCLE_GC.md` — 인스턴스 생명주기 및 GC 분석
- `WHY_NULL_UNNECESSARY.md` — 외부 null 처리가 불필요한 이유

---

## 전제: Mark-and-Sweep GC의 판단 기준

JavaScript의 모든 현대 엔진(V8 포함)은 Mark-and-Sweep 알고리즘을 사용한다.

핵심 원리는 단 하나다:

> 루트(global, 스택 변수, 활성 클로저 등)에서 참조 경로가 존재하면 살아남고,
> 존재하지 않으면 수거된다.

"참조 횟수"가 아니라 **"루트로부터의 도달 가능성(reachability)"**이 기준이다.

> 근거: [MDN Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)
> — *"Starting from the roots, the garbage collector will thus find all
> reachable objects and collect all non-reachable objects."*

---

## 케이스 분류

### 케이스 1: 속성값(객체)을 직접 외부에 전달한 경우

```javascript
class Widget {
  constructor() {
    this.data = new ArrayBuffer(50 * 1024 * 1024); // 50MB
    this.name = "widget";
  }
}

let widget = new Widget();
let externalRef = widget.data;  // 속성값(객체)을 직접 전달
widget = null;                  // this 참조 해제
```

**참조 그래프:**

```
루트
 └── externalRef ──→ ArrayBuffer (50MB)   ← GC 불가 (루트에서 도달 가능)

     Widget 인스턴스                       ← GC 가능 (루트에서 도달 불가)
       ├── data ──→ (같은 ArrayBuffer)
       └── name
```

**결과:**

| 대상 | GC 가능 여부 | 이유 |
|------|-------------|------|
| Widget 인스턴스 (this) | GC됨 | 루트에서 도달 경로 없음 |
| ArrayBuffer (this.data가 가리키던 값) | GC 불가 | externalRef가 루트에서 도달 가능 |
| this.name | GC됨 | Widget과 함께 수거 |

**핵심:** 속성이 가리키는 값(객체)은 살아남지만, this(인스턴스) 자체는 GC된다.
속성값에 대한 외부 참조가 this를 잡아두지 않는다.

---

### 케이스 2: this를 캡처한 클로저(화살표 함수)를 외부에 전달한 경우

```javascript
class Widget {
  constructor() {
    this.data = new ArrayBuffer(50 * 1024 * 1024);
    this.name = "widget";

    // 화살표 함수는 렉시컬 this를 캡처
    this.handler = () => {
      console.log(this.name);  // this.name만 사용
    };
  }
}

let widget = new Widget();
externalModule.callback = widget.handler;  // 클로저 전달
widget = null;                              // this 참조 해제
```

**참조 그래프:**

```
루트
 └── externalModule.callback ──→ 화살표 함수
                                    │
                                    └── [[Environment]].this ──→ Widget 인스턴스 전체
                                                                   ├── data (50MB) ← GC 불가
                                                                   ├── name
                                                                   └── handler
```

**결과:**

| 대상 | GC 가능 여부 | 이유 |
|------|-------------|------|
| Widget 인스턴스 (this) | GC 불가 | 화살표 함수의 [[Environment]]가 this 참조 |
| this.data (50MB) | GC 불가 | this가 살아있으므로 모든 속성 잔존 |
| this.name | GC 불가 | 동일 |

**핵심:** 코드에서 `this.name`만 사용하더라도, 클로저는 `this` 전체를 캡처한다.
따라서 `this.data`를 포함한 인스턴스 전체가 GC되지 않는다.

---

### 케이스 3: bind(this)를 사용한 경우

```javascript
class Widget {
  constructor() {
    this.data = new ArrayBuffer(50 * 1024 * 1024);
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    console.log(this.name);
  }

  destroy() {
    // bind()는 매번 새 함수 객체를 생성하므로 아래 코드는 실패한다
    window.removeEventListener('resize', this.onResize.bind(this)); // 다른 함수 객체!
  }
}
```

`bind(this)`는 내부적으로 this 참조를 보관하는 새로운 함수를 반환한다.
`window`는 영구 생존 객체이므로, 리스너가 제거되지 않는 한
Widget 인스턴스 전체가 영구 잔존한다.

**추가 문제:** `bind()`는 호출할 때마다 새 함수 객체를 생성하므로,
등록 시점의 함수와 `removeEventListener`에 전달하는 함수가 다른 객체이다.
따라서 해제가 실패한다.

---

### 케이스 4: V8의 공유 렉시컬 환경 (Shared Closure Scope)

이것은 직관적이지 않은 엣지 케이스다.

```javascript
function createWidget() {
  const heavyData = new ArrayBuffer(50 * 1024 * 1024);

  // 이 함수는 heavyData를 참조하지만, 실제로 호출되지 않음
  const unused = function() {
    console.log(heavyData.byteLength);
  };

  // 이 함수는 heavyData를 참조하지 않음
  const handler = function() {
    console.log("hello");
  };

  return handler;
}

let fn = createWidget();  // handler만 반환
```

**기대:** handler는 heavyData를 참조하지 않으므로 50MB는 GC될 것이다.

**실제(V8 동작):** heavyData가 GC되지 않는다.

**이유:** V8에서 같은 부모 스코프의 클로저들은 하나의 렉시컬 환경 객체를 공유한다.
`unused`가 `heavyData`를 참조하면, 그 변수는 공유 렉시컬 환경에 포함된다.
`handler`도 같은 렉시컬 환경을 참조하므로, `handler`가 살아있는 한 `heavyData`도 잔존한다.

> 근거: [Meteor 블로그(David Glasser)](https://blog.meteor.com/an-interesting-kind-of-javascript-memory-leak-8b47d2e7f156)
> — *"as soon as a variable is used by any closure, it ends up in the lexical
> environment shared by all closures in that scope."*

> 근거: [Jake Archibald (2024)](https://jakearchibald.com/2024/garbage-collection-and-closures/)
> — *"The engine sees bigArrayBuffer is referenced by inner functions, so it's
> kept around. It's associated with the scope that was created when demo() was called."*

**주의:** V8은 어떤 클로저도 참조하지 않는 변수는 렉시컬 환경에서 제외하는 최적화를
수행한다. 하지만 하나라도 참조하는 클로저가 존재하면, 같은 스코프의 모든 클로저가
그 변수를 잡게 된다.

---

## 판단 플로우차트

```
참조 데이터를 외부에 전달한 적이 있는가?
    │
    ├── 없다 → 누수 없음. this 참조 해제 시 전체 GC.
    │
    └── 있다
          │
          ├── 전달받은 쪽이 아직 살아있는가?
          │     │
          │     ├── 아니다 (함께 파괴됨) → 누수 없음
          │     │
          │     └── 예 (window, document, EventBus, 전역 변수 등)
          │           │
          │           ├── 전달한 것이 무엇인가?
          │           │     │
          │           │     ├── 속성값(객체) 자체
          │           │     │   → 해당 객체만 잔존. this는 GC됨.
          │           │     │
          │           │     ├── this를 캡처한 클로저 (화살표 함수, bind)
          │           │     │   → this 전체 잔존
          │           │     │
          │           │     └── 일반 함수 (this 미캡처)
          │           │         → this는 GC됨.
          │           │           단, V8 공유 렉시컬 환경 주의 (케이스 4)
          │           │
```

---

## 실전 적용: destroy() 패턴

### 최소한 해야 하는 것

```javascript
destroy() {
  // 1. 장수명 대상에 등록한 리스너 해제
  window.removeEventListener('resize', this._boundOnResize);
  document.removeEventListener('keydown', this._boundOnKeydown);
  this.eventBus.off('dataUpdate', this._onDataUpdate);

  // 2. 저장해둔 핸들러 참조 해제
  this._boundOnResize = null;
  this._boundOnKeydown = null;
  this._onDataUpdate = null;
}
```

### 해야 할 수도 있는 것

```javascript
destroy() {
  // ... 위의 리스너 해제 ...

  // 3. 대용량 데이터를 외부에 전달한 적이 있다면
  this.data = null;       // 외부 참조가 끊어질 때까지 잔존하지만,
                           // this 속성에서 끊으면 this 크기는 줄어듦

  // 4. this를 캡처한 클로저가 해제 불가능한 경우 (서드파티 등)
  //    → 대용량 속성을 null로 설정하여 this가 잡혀있더라도 메모리 영향 최소화
  this.heavyCache = null;
}
```

### 하지 않아도 되는 것

외부에 전달한 적 없는 속성은 null 처리 불필요하다.
this가 GC되면 그 속성들도 도달 불가능해지므로 함께 수거된다.

---

## 정리 테이블

| 시나리오 | 전달된 것 | 전달받은 쪽 생존 | this GC | 잔존 대상 |
|----------|----------|---------------|---------|----------|
| 속성값 직접 전달 | 객체 참조 | 예 | GC됨 | 해당 속성값만 |
| 화살표 함수 전달 | this 캡처 클로저 | 예 | 전체 잔존 | this + 모든 속성 |
| bind(this) 전달 | this 캡처 함수 | 예 | 전체 잔존 | this + 모든 속성 |
| 일반 함수 전달 (this 미사용) | 함수 객체 | 예 | GC됨 | 함수 객체만 |
| 아무것도 전달 안 함 | — | — | GC됨 | 없음 |
| 공유 렉시컬 환경 (케이스 4) | 일반 함수 | 예 | GC됨 | 스코프 내 캡처된 변수 |

---

## 참고 자료

- [MDN: Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)
- [javascript.info: Garbage Collection](https://javascript.info/garbage-collection)
- [David Glasser / Meteor Blog: An interesting kind of JavaScript memory leak](https://blog.meteor.com/an-interesting-kind-of-javascript-memory-leak-8b47d2e7f156)
- [Jake Archibald: Garbage collection and closures](https://jakearchibald.com/2024/garbage-collection-and-closures/)
- [V8 Blog: Weak references and finalizers](https://v8.dev/features/weak-references)
