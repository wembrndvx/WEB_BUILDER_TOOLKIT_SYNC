# 모든 스킬 공통 지침

모든 SKILL.md에서 참조하는 공통 규칙입니다.

---

## 작업 전 필수 확인

**이전에 읽었더라도 매번 다시 읽어야 합니다 - 캐싱하거나 생략하지 마세요.**

| 스킬 단계 | 필수 확인 문서 |
|-----------|---------------|
| 1-figma (정적 퍼블리싱) | [/Figma_Conversion/README.md](/Figma_Conversion/README.md), [/Figma_Conversion/CLAUDE.md](/Figma_Conversion/CLAUDE.md), [CODING_STYLE.md](/.claude/guides/CODING_STYLE.md) |
| 2-component (동적 변환) | [/RNBT_architecture/README.md](/RNBT_architecture/README.md), [CODING_STYLE.md](/.claude/guides/CODING_STYLE.md), 기존 컴포넌트 패턴 |
| 3-page (프로젝트 생성) | [/RNBT_architecture/README.md](/RNBT_architecture/README.md), [CODING_STYLE.md](/.claude/guides/CODING_STYLE.md) |

---

## CSS 공통 규칙

- **px 단위 사용** (rem/em 금지) - RNBT 런타임 호환성 보장
- **Flexbox 우선** (Grid는 2D 카드 레이아웃 등 명확한 경우만 허용, absolute 지양)
- 상세: [CODING_STYLE.md](/.claude/guides/CODING_STYLE.md) CSS 원칙 섹션

---

## JS 공통 규칙

### 구조분해 응답

**적용 대상:** datasetName 기반 데이터 응답을 받는 함수

런타임은 datasetName 기반 데이터 응답을 `{ response: data }`로 감싸서 전달합니다.

```javascript
// ❌ 데이터 응답을 직접 사용
function renderData(config, response) { ... }

// ✅ 데이터 응답은 { response }로 구조분해
function renderData(config, { response }) {
    const { data } = response;
}
```

datasetName 기반이 아닌 직접 호출 메서드(appendLog, clearLogs 등)는 해당하지 않습니다.

### fx.go 파이프라인 패턴

데이터 변환은 `fx.go` 파이프라인으로 표현합니다.

```javascript
// 구독 등록 패턴 (모든 컴포넌트 공통)
fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, fnList]) =>
        fx.each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// 데이터 변환 패턴
fx.go(
    items,
    fx.filter(item => item.active),
    fx.map(item => createItemElement(template, item)),
    fx.each(el => container.appendChild(el))
);
```

### 함수 바인딩 패턴

```javascript
// config를 첫 번째 인수로 바인딩 → 호출 시 config 없이 사용 가능
this.renderData = renderData.bind(this, config);
this.renderList = renderList.bind(this, listConfig);

// 함수 정의는 호이스팅
function renderData(config, { response }) { ... }
function renderList(config, { response }) { ... }
```

---

## 주기적 데이터 갱신 패턴

`setInterval` 대신 **setTimeout 체이닝 + `_stopped` 가드**를 사용합니다.
기존 컴포넌트 예제나 문서에 `setInterval` + `_intervalId` 패턴이 남아있을 수 있으나, 이는 구 패턴입니다.
새로 작성하거나 수정하는 코드는 반드시 아래 패턴을 따르며, 구 패턴은 발견 시 교체합니다.

| 방식 | 문제 |
|------|------|
| `setInterval` | 응답 완료 전 다음 요청이 누적됨 |
| `setTimeout` + `.finally()` | 응답 완료 후에만 다음 요청 예약 |
| + `_stopped` 가드 | `stopRefresh` 후 `.finally()`가 좀비 타이머를 재등록하는 것을 방지 |

### 시작: setTimeout 체이닝

```javascript
// refreshInterval > 0인 데이터셋에 대해 주기적 갱신 시작
this.stopRefresh();
fx.go(
    this.datasetInfo,
    fx.filter(d => d.refreshInterval > 0),
    fx.each(d => {
        d._stopped = false;
        const scheduleNext = () => {
            if (d._stopped) return;        // 좀비 방지 가드
            d._timerId = setTimeout(() => {
                fetchDatasetAndRender.call(this, d).finally(scheduleNext);
            }, d.refreshInterval);
        };
        scheduleNext();
    })
);
```

### 정지: _stopped 플래그

```javascript
function stopRefresh() {
    const datasetInfo = this.datasetInfo ?? [];
    fx.go(
        datasetInfo,
        fx.filter(d => d.refreshInterval > 0),
        fx.each(d => {
            d._stopped = true;             // 반드시 clearTimeout보다 먼저
            clearTimeout(d._timerId);
            d._timerId = null;
        })
    );
}
```

### fetchDatasetAndRender: Promise 반환 필수

```javascript
function fetchDatasetAndRender(d) {
    // ... param 설정 ...

    return fetchData(this.page, datasetName, param)   // ← return 필수
        .then(response => { ... })
        .catch(e => console.warn(...));
}
```

`.finally(scheduleNext)`가 동작하려면 `fetchDatasetAndRender`가 **반드시 Promise를 반환**해야 합니다.

### 좀비 타이머가 발생하는 시나리오

```
1. scheduleNext() → d._timerId = setTimeout(callback, 5s)
2. 5초 후 callback 실행: fetchDatasetAndRender() 시작 (HTTP 대기중)
3. 이 시점에 stopRefresh() 호출
   → clearTimeout(d._timerId)  ← 이미 실행된 타이머라 no-op
   → d._timerId = null
4. HTTP 응답 도착
   → .finally(scheduleNext) 실행
   → _stopped 가드 없으면 새 타이머 등록됨 ← 좀비!
```

`d._stopped = true`가 설정되어 있으므로 `scheduleNext()`는 즉시 return하여 좀비를 방지합니다.

---

## beforeDestroy 정리 순서

**반드시 이 순서를 따릅니다. 생성의 역순입니다.**

```javascript
// 1. 구독 해제
fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, _]) => unsubscribe(topic, this))
);
this.subscriptions = null;

// 2. 외부 이벤트 제거 (bindEvents로 등록한 것)
removeCustomEvents(this, this.customEvents);
this.customEvents = null;

// 3. 내부 핸들러 제거 (addEventListener로 등록한 것)
if (this._internalHandlers) {
    root.querySelector('.btn')?.removeEventListener('click', this._internalHandlers.btnClick);
    // ... 등록한 모든 핸들러 제거
}
this._internalHandlers = null;

// 4. 상태 초기화
this._someState = null;

// 5. 바인딩된 메서드 null 처리
this.renderData = null;
this.renderList = null;
```

**핵심:** register에서 생성한 모든 것은 beforeDestroy에서 정리해야 합니다.

---

## 이벤트 처리 이중 구조

컴포넌트의 이벤트는 두 가지 방식으로 처리됩니다.

| 방식 | 등록 | 제거 | 용도 |
|------|------|------|------|
| `customEvents` + `bindEvents` | `bindEvents(this, customEvents)` | `removeCustomEvents(this, customEvents)` | 페이지에 전달할 이벤트 (@eventName) |
| `_internalHandlers` + `addEventListener` | 수동 `addEventListener` | 수동 `removeEventListener` | 컴포넌트 내부 동작 (clear, toggle 등) |

**판단 기준: "이 동작의 결과를 페이지가 알아야 하는가?"**

```javascript
// 페이지가 알아야 함 → customEvents
this.customEvents = {
    click: { '.row': '@rowClicked' }
};
bindEvents(this, this.customEvents);

// 페이지가 몰라도 됨 → _internalHandlers
this._internalHandlers = {};
this._internalHandlers.clearClick = () => this.clearLogs();
root.querySelector('.btn-clear')?.addEventListener('click', this._internalHandlers.clearClick);
```

---

## 정적 CSS 복사 규칙 (Figma → RNBT 변환 시)

Figma_Conversion에서 검증된 CSS를 복사하되, 아래만 제외합니다:

```css
/* 제외 */
@import url('...');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { ... }

/* 복사 */
#component-container { ... }    /* 컴포넌트 스타일 전체 */
.component-class { ... }
```

**절대 금지:** 검증된 CSS를 "비슷하게" 새로 작성하는 것

---

## preview.html 작성 규칙

- **inline 방식** — CSS는 `<style>` 태그로 인라인, `<link rel="stylesheet" href="...">` 로컬 파일 참조 금지 (CDN 폰트 등 외부 라이브러리는 허용)
- register.js 내용을 복사해서 붙여넣기
- fx는 최소 기능만 inline 구현
- mockThis 컨텍스트에서 IIFE로 실행
- HTML 구조는 `views/component.html`과 **동일**해야 함

---

## 스크린샷 검증 필수

```
1. Playwright 스크린샷 캡처
2. 정적 HTML 원본 (또는 Figma get_screenshot)과 비교
3. 시각적 차이가 있으면 수정
4. 차이점 없음 확인 후에만 완료
```

---

## 금지 사항 (전체 공통)

- ❌ 추측하지 않는다 — 데이터 기반으로만 작업
- ❌ 존재하지 않는 함수를 사용하지 않는다 — grep으로 확인 후 사용
- ❌ 확인 없이 완료라고 말하지 않는다
- ❌ datasetName 기반 데이터 응답을 받는 함수에서 `function(response)` 사용 → `function({ response })` 필수
- ❌ 생성 후 정리 누락 (register ↔ beforeDestroy 쌍)
