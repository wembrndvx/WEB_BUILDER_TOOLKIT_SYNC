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
- **Flexbox 우선** (Grid/absolute 지양)
- 상세: [CODING_STYLE.md](/.claude/guides/CODING_STYLE.md) CSS 원칙 섹션

---

## JS 공통 규칙

### 구조분해 응답

```javascript
// ❌ response를 직접 사용
function renderData(config, response) { ... }

// ✅ { response }로 구조분해
function renderData(config, { response }) {
    const { data } = response;
}
```

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

- **inline 방식** (LogViewer 패턴) — 외부 파일 로드 금지
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
- ❌ `function(response)` 사용 → `function({ response })` 필수
- ❌ 생성 후 정리 누락 (register ↔ beforeDestroy 쌍)
