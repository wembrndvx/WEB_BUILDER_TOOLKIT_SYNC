# Figma 구현 가이드

> 이 문서는 Figma → HTML/CSS 변환 시 구현 주의사항, 워크플로우, Playwright 검증을 다룹니다.
> Skill이 작업 전 Read로 참조하는 문서입니다.

---

## 구현 시 주의사항 (실전 교훈)

### 1. Tailwind → 순수 CSS 변환 시 검증 필수

**상황:**
- MCP는 Tailwind 기반 코드 제공: `gap-[20px]`
- 실제 Figma는 row-gap과 column-gap이 다를 수 있음: `gap: 13px 20px`

**해결:**
```css
/* MCP 제공 */
gap-[20px]

/* 브라우저에서 확인 후 정확한 값 적용 */
gap: 13px 20px;  /* row-gap column-gap */
```

**중요:** MCP 데이터를 기반으로 구현 후, **브라우저 개발자 도구로 실제 computed style 확인** 필수

---

### 2. box-sizing: border-box 올바르게 사용

**핵심 원리:**
`box-sizing: border-box`는 **명시적 height가 있어야** border가 높이에 포함됨

```css
/* ❌ height 없으면 border가 별도 추가됨 */
.button {
    box-sizing: border-box;
    border: 1px solid #000;
    padding: 6px 15px;
    /* height 없음 → content + padding + border = 최종 높이 */
}

/* ✅ height 명시하면 border가 높이에 포함됨 */
.button {
    box-sizing: border-box;
    height: 24px;  /* Figma에서 측정한 최종 높이 */
    border: 1px solid #000;
    padding: 6px 15px;
    /* 24px 안에 border + padding 포함 */
}
```

**교훈:** border가 있는 요소는 Figma에서 측정한 높이를 **명시적으로 지정**

---

### 3. Figma hug 속성 처리

**픽셀 정확도가 중요한 경우 hug도 고정값으로 구현**

```css
/* Figma에서 hug 결과: 24px */

/* ❌ height 미지정하면 border로 인해 틀어짐 */
.button {
    padding: 6px 15px;
    border: 1px solid #000;
}
/* → 실제 26px (border 추가됨) */

/* ✅ Figma가 계산한 최종 높이 명시 */
.button {
    height: 24px;
    padding: 6px 15px;
    border: 1px solid #000;
    box-sizing: border-box;
}
/* → 정확히 24px */
```

**적용 시기:** 대시보드처럼 고정 레이아웃이 필요한 경우

---

### 4. 고정 사이즈 임의 변경 금지

**원칙:**
Figma metadata에 명시된 **고정 사이즈는 그대로 구현**

```css
/* Figma metadata: 202px × 218px */

/* ❌ 임의 판단으로 변경 */
.container {
    width: fit-content;  /* "유연한게 더 좋겠지" */
}

/* ✅ Figma 그대로 */
.container {
    width: 202px;
    height: 218px;
}
```

**변경이 필요하다면:** 사용자에게 먼저 물어볼 것

---

### 5. 구현 후 시각적 검증 프로세스

**필수 체크:**

1. **브라우저 개발자 도구 확인**
   - Computed 탭에서 실제 width/height
   - gap, padding, border 값
   - box-sizing 적용 여부

2. **Figma 스크린샷과 비교**
   - `get_screenshot`으로 가져온 이미지와 나란히 비교
   - 정렬, 간격, 크기 일치 확인

3. **차이 발견 시**
   - 원인 분석 (gap? box-sizing? height?)
   - 즉시 수정 및 재검증

---

### 6. 스크린샷 비교 시 간격(Spacing) 세밀하게 검증

**문제:**
"전체적으로 비슷해 보인다"고 대충 비교하면 간격 차이를 놓침

**실수 사례:**
```
❌ 잘못된 비교:
- "색상 ✅, 폰트 ✅, 레이아웃 ✅" → 완료 선언
- 실제로는 헤더-컨텐츠 간격이 10px vs 4px로 달랐음
- 하단 여백도 달랐음 (height 350px vs 305px)

✅ 올바른 비교:
1. metadata 좌표값으로 정확한 gap 계산
   - group y=14, height=38 → 끝: y=52
   - container y=56 → 시작: y=56
   - gap = 56 - 52 = 4px
2. 전체 높이도 metadata에서 확인 (305px)
3. 스크린샷에서 상단/하단 여백 픽셀 단위로 확인
```

**해결책:**
```
1. metadata 먼저 분석
   - 각 요소의 x, y, width, height 확인
   - 요소 간 gap = 다음 요소 y - (현재 요소 y + height)

2. 스크린샷 비교 시 체크할 항목
   - 헤더와 첫 번째 컨텐츠 사이 간격
   - 섹션과 섹션 사이 간격
   - 상단/하단 여백
   - 좌우 padding

3. "비슷해 보인다" ≠ "일치한다"
   - 반드시 픽셀 단위로 검증
```

---

### 7. SVG 에셋 렌더링 문제 대응 (에셋 임의 대체 금지)

**문제:**
Figma MCP가 제공하는 SVG에는 `overflow="visible"` + `preserveAspectRatio="none"` 조합이 흔함.
이로 인해 브라우저에서 컨테이너 밖으로 넘치거나 비정상적으로 확대되는 렌더링 문제가 발생함.

**실수 사례:**
```
❌ "SVG가 깨지니까 CSS로 대체하겠습니다"
→ Figma 에셋은 원본이다. 렌더링 문제가 있다고 에셋 자체를 CSS로 바꾸는 것은 무책임한 방향.

✅ "CSS에서 크기/위치를 픽셀 단위로 명시하겠습니다"
→ 에셋은 그대로 두고, CSS로 올바르게 렌더링되도록 크기를 잡아주는 것이 정답.
```

**해결 방법:**
```css
/* ❌ 퍼센트 기반 inset → 브라우저마다 계산이 불안정 */
.icon img {
    position: absolute;
    inset: -83.33%;
}

/* ✅ 픽셀 단위 명시 → 정확한 렌더링 */
.icon img {
    position: absolute;
    width: 16px;     /* SVG viewBox 너비 */
    height: 16px;    /* SVG viewBox 높이 */
    top: -5px;       /* (viewBox - container) / 2 의 음수 */
    left: -5px;
    display: block;
}
```

**핵심 원칙:**
1. **Figma 에셋은 절대 임의 대체하지 않는다** - CSS 도형, 외부 아이콘 등으로 바꾸지 않음
2. **SVG viewBox 크기를 확인**하고 img에 해당 크기를 `width`/`height`로 명시
3. 글로우/그림자 필터가 있는 SVG는 `overflow: visible` 유지, 컨테이너 크기와 SVG viewBox 크기의 차이만큼 음수 `top`/`left`로 센터링
4. 필요시 부모에 `overflow: hidden` 추가하여 넘침 방지

---

## 정확한 변환 워크플로우

### 전체 프로세스 (필수 순서)

```
1. 사용자가 Figma 링크 제공
   └── node-id 추출 (예: 781-47496 → 781:47496)

2. MCP 도구 호출 (병렬 실행)
   ├── get_design_context (dirForAssetWrites 필수!)
   │   └── 에셋 자동 다운로드 + Tailwind 코드 반환
   └── get_screenshot
       └── Figma 원본 스크린샷 (비교 기준)

3. Tailwind → 순수 CSS 변환
   └── MCP가 제공한 값 그대로 사용 (추측 금지!)

4. HTML/CSS 파일 생성
   └── 에셋 경로는 ./assets/파일명.svg 형식

5. Playwright 스크린샷 캡처
   └── node로 실행: viewport를 Figma 프레임 크기와 동일하게

6. 시각적 비교
   ├── get_screenshot (원본)
   └── Playwright 스크린샷 (구현물)

7. 차이점 발견 시
   ├── MCP 데이터 다시 확인
   ├── CSS 수정 (추측 금지, 데이터 기반)
   └── 5-6 반복

8. 완료 판단
   └── 원본과 구현물이 시각적으로 일치할 때만 완료
```

### 실전 예시: 구간별 성능현황 컴포넌트

```
사용자: "https://www.figma.com/design/...?node-id=781-47496 구현해줘"

1. MCP 호출
   mcp__figma-desktop__get_design_context({
     nodeId: "781:47496",
     dirForAssetWrites: "./Static_Components/Component/performance-status/assets"
   })
   mcp__figma-desktop__get_screenshot({ nodeId: "781:47496" })

2. 에셋 확인
   ./assets/
   ├── 6e134c6c4f175a81f94018216584fd808a1b84b6.svg (아이콘)
   ├── 22d18fb2964a57ef7db9eaa50bd9135cbff48aa5.svg (실린더)
   └── ...

3. Tailwind → CSS 변환 (예시)
   Tailwind: "inset-[21.54%_50.24%_4.6%_0.53%]"
   CSS: top: 21.54%; right: 50.24%; bottom: 4.6%; left: 0.53%;

4. Playwright 스크린샷
   node -e "const { chromium } = require('playwright'); ..."
   viewport: { width: 524, height: 350 }  // Figma 프레임 크기

5. 비교 및 수정
   - get_screenshot과 Playwright 결과 비교
   - 차이점 있으면 MCP 데이터 확인 후 수정
   - 추측하지 않음!

6. 완료
   - 두 스크린샷이 시각적으로 일치
```

---

## Playwright (스크린샷)

### 개요

**Playwright**를 사용하여 구현 결과물의 스크린샷을 캡처하고 Figma 디자인과 비교합니다.

```
Figma 디자인 → 코드 구현 → Playwright 스크린샷 → Figma와 비교 → 수정
```

### 설치

```bash
npm install --save-dev playwright
```

### 스크린샷 캡처 (Node API 사용)

```javascript
// Windows에서 실행
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 524, height: 350 }  // Figma 프레임 크기와 동일하게 설정
  });
  await page.goto('http://localhost:3000/path/to/component.html');
  await page.screenshot({ path: './screenshots/component.png' });
  await browser.close();
  console.log('Screenshot saved');
})();
"
```

**중요**: viewport 크기를 Figma 프레임 크기와 동일하게 맞춰야 정확한 비교 가능

### 검증 워크플로우

```
1. Figma MCP: get_screenshot → 디자인 스크린샷 (원본)
2. Playwright: Node API → 구현 결과 스크린샷
3. 두 이미지 비교
4. 차이점 발견 시 수정 후 재캡처
```

### 스크린샷 저장 규칙

**컴포넌트별 폴더 구조** (권장):
```
Static_Components/Component/performance-status/
├── assets/                    # 에셋 (SVG, 이미지)
├── screenshots/               # 스크린샷
│   └── impl.png              # 구현물 스크린샷 (Playwright)
├── performance-status.html
└── performance-status.css
```

**참고**: Figma 원본 스크린샷(`get_screenshot`)은 파일로 저장할 수 없음.
비교 시 MCP `get_screenshot`을 호출하여 실시간으로 확인.

**루트 screenshots 폴더**: 임시 작업용 또는 전체 페이지 스크린샷용
```
./screenshots/
└── full_page.png           # 전체 페이지 (필요시)
```

### 트러블슈팅

| 문제 | 원인 | 해결 |
|------|------|------|
| 스크린샷이 빈 화면 | 로컬 서버 미실행 | `npm run serve` 실행 |
| 크기가 다름 | 뷰포트 설정 | Figma 프레임 크기와 맞추기 |
| 에셋 깨짐 | 경로 오류 | 상대 경로 확인 |
| 폰트 다름 | 시스템 폰트 | 웹폰트 적용 |

---

## Figma 활용 가이드

### 컴포넌트 간 관계 확인 방법

#### 1. 스마트 거리 측정 (Smart Selection)
Figma에서 컴포넌트를 선택한 후 마우스를 움직이면 측정 기능이 활성화됩니다.

**작동 방식**:
1. **Alt/Option 키를 누른 상태**로 마우스를 다른 요소 위로 이동
2. **자동으로 표시되는 측정값**:
   - 선택한 요소와의 거리 (픽셀 단위)
   - 정렬 가이드라인
   - 여백과 간격

**Pro Tip**: Dev Mode에서는 측정값이 자동으로 표시됨

**확인 가능한 정보**:
- **Spacing**: 요소 간 여백 (margin, padding)
- **Dimensions**: 너비, 높이 차이
- **Alignment**: 정렬 상태 (좌측, 중앙, 우측)
- **Position**: 상대적 좌표 값

#### 2. 중첩된 컴포넌트 선택 방법

Figma는 중첩된 요소들을 계층 구조로 관리합니다.

**선택 규칙**:
1. **부모 요소 우선 선택**
   - 첫 클릭: 가장 바깥쪽 부모 컨테이너 선택
   - 더블 클릭: 내부 자식 요소로 진입

2. **깊이 있는 선택**
   ```
   Frame (1st click)
   └── Group (2nd click/double-click)
       └── Text (3rd click/double-click)
   ```

3. **단축키 활용**
   - `Cmd/Ctrl + 클릭`: 깊은 요소 직접 선택
   - `Enter`: 선택된 그룹 내부로 진입
   - `Shift + Enter`: 부모 레벨로 나가기

---

## 추가 리소스

- [Figma Dev Mode MCP 공식 문서](https://help.figma.com/hc/ko/articles/32132100833559)
- [MCP 프로토콜 문서](https://modelcontextprotocol.io)

## 팁

1. **항상 Figma Desktop 앱 먼저 실행**
2. **파일을 미리 열어두기**
3. **정확한 node-id 또는 링크 제공**
4. **원하는 프레임워크 명시** (React/Vue/HTML 등)
5. **get_screenshot로 시각적 확인** (정확도 향상)
