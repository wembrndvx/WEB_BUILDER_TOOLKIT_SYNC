# 외부에서 인스턴스 속성을 null 처리하는 것이 필요한가

## 문서 목적

컴포넌트 외부에서 `instance.X = null`과 같이 인스턴스 속성을 직접 제거하는 패턴이
실제로 GC에 도움이 되는지, 언제 필요하고 언제 불필요한지를 정리한다.

### 작성일: 2026-02-14

### 관련 문서
- `INSTANCE_LIFECYCLE_GC.md` — 인스턴스 생명주기 및 GC 분석
- `THIS_PROPERTY_MEMORY_LEAK.md` — this 참조 해제 후 속성 잔존 시나리오

---

## 1. 질문

```javascript
// Wkit.js
instance.datasetInfo = null;
instance.customEvents = null;
instance.subscriptions = null;
```

외부 유틸리티에서 인스턴스의 속성을 `null`로 설정하는 코드가 존재한다.
이 코드의 의도는 "GC를 돕기 위한 명시적 메모리 해제"로 추정된다.

**이것이 실제로 필요한가?**

---

## 2. GC의 동작 원칙

### 2.1 도달 가능성(Reachability)이 유일한 기준

JavaScript의 Mark-and-Sweep GC는 **루트에서 도달 가능한 객체만 유지**하고,
도달 불가능한 객체는 그 속성까지 포함하여 전체를 수거한다.

> *"Starting from the roots, the garbage collector will thus find all
> reachable objects and collect all non-reachable objects."*
>
> — [MDN: Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)

> *"The former "family" object has been unlinked from the root,
> there's no reference to it any more, so the whole island becomes
> unreachable and will be removed."*
>
> — [javascript.info: Garbage Collection](https://javascript.info/garbage-collection)

### 2.2 이것이 의미하는 바

인스턴스 자체가 루트에서 도달 불가능해지면:

```
루트에서 도달 불가능한 인스턴스
  ├── datasetInfo    ← 도달 불가능 → GC 수거
  ├── customEvents   ← 도달 불가능 → GC 수거
  ├── subscriptions  ← 도달 불가능 → GC 수거
  └── ... 모든 속성   ← 도달 불가능 → GC 수거
```

**인스턴스가 GC되면 속성도 함께 사라진다.** 속성을 개별적으로 `null` 처리할 필요가 없다.

---

## 3. 그러면 언제 null 처리가 필요한가

속성 `null` 처리가 의미를 가지는 경우는 **단 하나**다:

> **인스턴스 자체는 아직 GC되지 않지만, 특정 속성이 가리키는 대용량 데이터를
> 먼저 해제하고 싶을 때.**

예시:

```javascript
// 인스턴스가 아직 살아있지만, 50MB 데이터는 더 이상 필요 없는 경우
this.heavyCache = null;  // 50MB를 먼저 해제
// 인스턴스 자체는 다른 이유로 아직 살아있음
```

이것은 인스턴스의 **생존 기간 중** 메모리를 줄이는 최적화이며,
인스턴스가 **곧 GC될 예정**이라면 무의미하다.

### 3.1 판단 기준

```
instance.X = null이 필요한가?

  1. 인스턴스가 곧 GC되는가?
     ├── 예 → null 처리 불필요. GC가 전체 수거.
     └── 아니오 → 2번으로.

  2. X가 대용량이고, 인스턴스보다 먼저 해제해야 하는가?
     ├── 예 → null 처리 유효 (메모리 최적화 목적)
     └── 아니오 → null 처리 불필요.
```

### 3.2 추가 시나리오: this가 클로저에 캡처된 경우

인스턴스가 "곧 GC될 예정"이라고 해도, **this를 캡처한 클로저가 장수명 대상에 등록되어 있으면
인스턴스 전체가 GC되지 않는다.** 이 경우 대용량 속성의 null 처리가 방어적 의미를 가진다.

```javascript
// this를 캡처한 화살표 함수가 window에 등록된 경우
destroy() {
  // 1. 리스너 해제 (이것이 근본 해결)
  window.removeEventListener('resize', this._boundOnResize);

  // 2. 해제가 불가능한 경우 (서드파티, bind 참조 불일치 등)
  //    → 대용량 속성을 null로 설정하여 메모리 영향 최소화
  this.heavyCache = null;
}
```

이것은 `THIS_PROPERTY_MEMORY_LEAK.md`의 케이스 2(화살표 함수), 케이스 3(bind)에 해당한다.
**근본 해결은 리스너/타이머 해제**이며, 속성 null 처리는 해제가 불가능할 때의 **방어적 완화책**이다.

> 상세 시나리오는 `THIS_PROPERTY_MEMORY_LEAK.md` — "실전 적용: destroy() 패턴" 참조.

---

## 4. 외부에서 null 처리할 때의 위험

인스턴스 내부에는 속성 간 의존 관계가 존재할 수 있다.
외부 코드는 이 의존 관계를 알지 못한다.

### 4.1 실제 발생한 문제

`Wkit.disposeAllThreeResources`에서 `instance.datasetInfo = null`을 수행한 후,
프레임워크의 `_onViewerDestroy()`가 `datasetInfo`를 참조하여 내부 정리를 수행하려 했으나
이미 `null`이 되어 있어 정리 로직이 실패했다.

이것은 특정 리소스(인터벌)의 해제 실패가 핵심이 아니라,
**외부가 내부 상태를 직접 조작하면 내부 로직이 깨질 수 있다**는 것이 핵심이다.
어떤 내부 로직이 실패하느냐는 경우에 따라 달라지며, 근본 원인은 동일하다.

### 4.2 일반화

외부에서 속성을 `null` 처리하면 발생할 수 있는 문제:

- 내부 메서드가 해당 속성을 참조할 때 `TypeError` 또는 사일런트 실패
- 리소스 해제 경로 단절 (타이머, 이벤트 리스너, 구독 등)
- 내부 상태 불일치 (일부 속성만 정리되고 나머지는 잔존)

외부 코드는 속성의 **값**은 볼 수 있지만, 그 속성이 **어디서 어떻게 사용되는지**는 알 수 없다.
이것이 외부 직접 조작이 위험한 근본 이유다.

---

## 5. 올바른 접근

### 5.1 인스턴스가 곧 파괴된다면: 아무것도 하지 않는다

인스턴스의 `destroy()` → 외부 참조 해제 → GC가 전체를 수거한다.
외부에서 속성을 개별적으로 `null` 처리하는 것은 **GC가 이미 할 일을 중복 수행**하는 것이며,
내부 의존 관계를 깨뜨릴 위험만 추가한다.

### 5.2 인스턴스가 계속 살아있는데 데이터를 정리해야 한다면

인스턴스 자신의 메서드를 통해 정리한다.

```javascript
// ❌ 외부에서 직접 조작
instance.datasetInfo = null;

// ✅ 인스턴스가 제공하는 정리 인터페이스 호출
instance.cleanup();
```

인스턴스 메서드는 내부 의존 관계를 알고 있으므로,
필요한 선행 작업을 수행한 후 데이터를 정리할 수 있다.

이것은 TC39의 Explicit Resource Management 제안이 언어 수준에서 공식화한 원칙과 동일하다:

> *"Explicit Resource Management — Indicates a system whereby the lifetime
> of a "resource" is managed explicitly by the user either imperatively
> (by directly calling a method like Symbol.dispose) or declaratively
> (through a block-scoped declaration like using)."*
>
> — [TC39 proposal-explicit-resource-management](https://github.com/tc39/proposal-explicit-resource-management)

리소스의 해제는 외부에서 속성을 지우는 것이 아니라,
**소유자가 제공하는 해제 인터페이스**를 통해 수행해야 한다.

---

## 6. 정리

| 상황 | null 처리 필요? | 이유 |
|------|----------------|------|
| 인스턴스가 곧 GC될 예정 | ❌ | GC가 속성 포함 전체 수거 |
| 인스턴스 생존 중 + 대용량 데이터 불필요 | ✅ (인스턴스 내부에서) | 메모리 최적화 |
| this가 클로저에 캡처 + 해제 불가 | ✅ (인스턴스 내부 destroy에서) | 방어적 완화 (근본은 리스너 해제) |
| 인스턴스 생존 중 + 외부에서 직접 조작 | ❌ | 내부 의존 관계 파괴 위험 |

핵심 원칙:

1. **인스턴스가 GC되면 속성은 자동 수거된다** — 수동 null 처리는 중복 작업
2. **외부에서 내부 속성을 직접 조작하지 않는다** — 의존 관계를 알 수 없으므로 위험
3. **정리가 필요하면 소유자의 인터페이스를 통한다** — 내부 상태 일관성 보장

---

## 참고 자료

| 근거 | 출처 | 해당 내용 |
|------|------|----------|
| 도달 불가능한 객체는 속성 포함 전체 수거 | [MDN: Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management) | *"Starting from the roots, the garbage collector will thus find all reachable objects and collect all non-reachable objects."* |
| 상호 참조 객체 그래프도 루트에서 끊기면 전체 수거 | [javascript.info: Garbage Collection](https://javascript.info/garbage-collection) | *"the whole island becomes unreachable and will be removed"* |
| 리소스 해제는 소유자의 명시적 인터페이스를 통해 | [TC39: Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management) | `Symbol.dispose` — 리소스 생명주기를 외부 조작이 아닌 소유자 메서드로 관리하는 언어 수준 제안 |
