# Figma → Code 변환 프로젝트

## 📚 목차

### 기본 설정
1. [프로젝트 구조](#프로젝트-구조)
2. [초기 설정 가이드](#초기-설정-가이드)

### Figma MCP
3. [Figma MCP 서버란?](#figma-mcp-서버란)
4. [작동 원리](#작동-원리)
5. [제공 도구](#제공-도구)
6. [사용 방법](#사용-방법)
7. [MCP 규칙](#mcp-규칙) (에셋 자동 다운로드 포함)

### 구현 원칙
8. [컨테이너 구조 패턴](#컨테이너-구조-패턴) (런타임 주입용)
9. [구현 시 주의사항](#구현-시-주의사항-실전-교훈) (🚨 추측 금지 원칙)
10. [정확한 변환 워크플로우](#정확한-변환-워크플로우)

### 스크린샷 검증
11. [Playwright (스크린샷)](#playwright-스크린샷)

### 참고 자료
12. [Figma 활용 가이드](#figma-활용-가이드)

---

## 📁 프로젝트 구조

```
Figma_Conversion/
├── .claude/                    # Claude Code 설정
├── .vscode/                    # VS Code 설정
├── CLAUDE.md                   # 이 문서
├── Static_Components/          # 변환된 HTML/CSS 결과물
│   ├── [Figma-Project-Name]/   # Figma 프로젝트별 폴더
│   │   └── [component-name]/   # 컴포넌트별 폴더
│   │       ├── assets/         # SVG, 이미지 에셋
│   │       ├── screenshots/    # 구현물 스크린샷 (impl.png)
│   │       ├── [name].html
│   │       └── [name].css
│   └── sample_test/            # 테스트/샘플 컴포넌트
├── screenshots/                # 임시/전체 페이지 스크린샷
├── index.html                  # 메인 페이지
├── node_modules/               # npm 패키지
├── package.json                # 프로젝트 의존성
└── package-lock.json
```

### 예시: HANA_BANK_HIT_Dev 프로젝트
```
Static_Components/
├── HANA_BANK_HIT_Dev/          # Figma 프로젝트명
│   ├── performance-status/     # 구간별 성능현황 컴포넌트
│   │   ├── assets/
│   │   ├── screenshots/
│   │   ├── performance-status.html
│   │   └── performance-status.css
│   └── performance-status-v2/  # 주요 업무 현황 컴포넌트
│       ├── assets/
│       ├── screenshots/
│       ├── business-status.html
│       └── business-status.css
└── sample_test/                # 기존 테스트 컴포넌트
    ├── header/
    ├── group-left/
    └── Echarts/
```

### 핵심 설정 파일

#### `package.json` (의존성)
```json
{
  "scripts": {
    "serve": "npx serve . -l 3000"
  },
  "devDependencies": {
    "playwright": "^1.57.0"
  }
}
```

---

## 🔧 초기 설정 가이드

### 새 프로젝트에서 시작하기

```bash
# 1. 프로젝트 폴더 생성 및 이동
mkdir my-figma-project && cd my-figma-project

# 2. npm 초기화
npm init -y

# 3. Playwright 설치 (스크린샷용)
npm install --save-dev playwright

# 4. Figma MCP 서버 등록 (수동 등록 필요)
claude mcp add figma-desktop --transport http --url http://127.0.0.1:3845/mcp

# 5. 설정 확인
claude mcp list
```

### 기존 프로젝트 클론 시

```bash
# 1. 저장소 클론
git clone <repository-url>
cd Figma_Conversion

# 2. 의존성 설치
npm install

# 3. Figma MCP 서버 등록 (수동 등록 필요)
claude mcp add figma-desktop --transport http --url http://127.0.0.1:3845/mcp

# 4. MCP 서버 확인
claude mcp list
```

### 필수 조건 체크리스트

- [ ] **Figma Desktop 앱** 설치 및 실행 (웹 버전 ❌)
- [ ] **Figma Dev Mode** 활성화
- [ ] **Claude Code** 설치
- [ ] **npm 패키지** 설치 완료
- [ ] **Figma MCP 서버 등록** (`claude mcp add` 명령어로 수동 등록)

```bash
# Figma MCP 서버 등록
claude mcp add figma-desktop --transport http --url http://127.0.0.1:3845/mcp

# MCP 서버 상태 확인
claude mcp list

# 예상 결과:
# figma-desktop: ✓ Connected
```

---

## 🤔 Figma MCP 서버란?

**MCP (Model Context Protocol) 서버**는 Claude가 Figma 디자인 정보에 직접 접근할 수 있게 해주는 다리입니다.

```
Figma 디자인 ←→ MCP 서버 ←→ Claude Code ←→ HTML/CSS 코드
```

### 왜 필요한가요?
- ❌ **수동 작업 없이**: 크기, 색상, 간격을 일일이 측정할 필요 없음
- ✅ **정확한 구현**: Figma 디자인의 정확한 수치를 그대로 사용
- ⚡ **빠른 개발**: 디자인 → 코드 변환 시간 80% 단축

---

## 🔄 작동 원리

### 1. Figma 링크 제공 시
```
사용자: "이 링크 구현해줘"
https://www.figma.com/design/VNqtXrH6ydqcDgYBsVFLbg/...?node-id=25-1393&m=dev
         ↓
Claude가 node-id 추출: "25-1393" (또는 "25:1393")
         ↓
MCP 도구 호출
  - get_metadata("25:1393")  → 크기, 위치 정보
  - get_code("25:1393")      → HTML/CSS 코드
  - get_image("25:1393")     → 스크린샷
  - get_variable_defs()      → 디자인 토큰
         ↓
Figma Desktop 앱에서 데이터 반환
         ↓
Claude가 정확한 코드 생성
```

### 2. Figma에서 직접 선택 시
```
1. Figma Desktop 앱에서 요소 선택
2. Claude에게 "선택한 요소 구현해줘"
3. Claude가 자동으로 MCP 도구 호출
4. 코드 생성
```

---

## 🛠️ 제공 도구

MCP 서버가 Claude에게 제공하는 **4가지 핵심 도구**:

| 도구 이름 | 역할 | 입력 | 출력 예시 |
|----------|------|------|----------|
| **get_metadata** | 크기/위치 정보 | node-id | `{width: 1860, height: 75, x: 29, y: -1}` |
| **get_code** | 코드 생성 | node-id | HTML/CSS/React 코드 |
| **get_image** | 스크린샷 | node-id | PNG 이미지 (시각적 확인용) |
| **get_variable_defs** | 디자인 토큰 | - | 색상, 간격, 폰트 변수 |

### 도구 사용 예시

```javascript
// Claude가 내부적으로 이렇게 호출합니다
mcp__figma-dev-mode-mcp-server__get_metadata("25:1393")
// → { width: 1860, height: 430, x: 30, y: 66 }

mcp__figma-dev-mode-mcp-server__get_code("25:1393")
// → <div class="header">...</div> + CSS

mcp__figma-dev-mode-mcp-server__get_image("25:1393")
// → 실제 디자인 스크린샷 (비교용)

mcp__figma-dev-mode-mcp-server__get_variable_defs()
// → { colors: { primary: "#7b4bff" }, spacing: { gap: "20px" } }
```

---

## 💡 사용 방법

### 방법 1: Figma 링크 제공

```
사용자: "이 링크 구현해줘"
https://www.figma.com/design/.../node-id=25-1393
```

**Claude가 자동으로:**
1. node-id 추출 (25-1393)
2. 4가지 도구 모두 호출
3. 정확한 코드 생성

### 방법 2: Figma에서 직접 선택

```
1. Figma Desktop 앱 실행
2. 구현할 요소 선택 (클릭)
3. Claude에게 "선택한 요소 구현해줘"
```

**Claude가 자동으로:**
1. 현재 선택된 요소의 node-id 감지
2. MCP 도구 호출
3. 코드 생성

### 방법 3: 프레임워크 지정

```
사용자: "이 요소를 React로 구현해줘"
사용자: "Vue 컴포넌트로 만들어줘"
사용자: "일반 HTML/CSS로 만들어줘"
```

---

## ⚠️ 중요한 사항

### Figma Desktop 앱 필수!
```
✅ Figma Desktop 앱 실행 → MCP 작동
❌ Figma 웹 버전 → MCP 작동 안 함
```

### 파일이 열려있어야 함
```
✅ Figma Desktop에서 해당 파일 열림 → 데이터 접근 가능
❌ 파일 닫혀있음 → 데이터 접근 불가
```

### node-id 형식
```
Figma 링크: node-id=25-1393  (하이픈)
MCP 호출:   node-id="25:1393" (콜론)

→ Claude가 자동 변환하므로 신경 쓰지 않아도 됨
```

---

## 📋 MCP 규칙

### 에셋 사용 규칙
- ✅ **에셋 다운로드 필수**: MCP 서버가 `http://127.0.0.1:3845/...` 형태로 이미지/SVG를 제공하면 **반드시 다운로드**하여 프로젝트 내부에 저장
- ✅ **로컬 파일 경로 사용**: 다운로드한 에셋은 상대 경로로 참조 (예: `./assets/icon.svg`)
- ❌ **외부 아이콘 금지**: 새로운 아이콘 패키지를 가져오거나 추가하지 마세요
- ✅ **Figma 페이로드 사용**: 모든 에셋은 Figma에서 제공된 것만 사용
- ❌ **임의 생성 금지**: Figma에서 제공되지 않은 에셋을 임의로 만들지 마세요
- ❌ **로컬호스트 URL 직접 사용 금지**: `http://127.0.0.1:3845/...` URL을 HTML에 직접 사용하지 말고 반드시 다운로드

### 에셋 자동 다운로드 (dirForAssetWrites 파라미터)

**핵심**: `get_design_context` 호출 시 `dirForAssetWrites` 파라미터를 사용하면 에셋이 자동으로 다운로드됩니다.

```javascript
// ✅ 올바른 방법 - dirForAssetWrites로 에셋 자동 다운로드
mcp__figma-desktop__get_design_context({
  nodeId: "781:47496",
  clientLanguages: "html,css",
  clientFrameworks: "vanilla",
  dirForAssetWrites: "C:\\path\\to\\project\\assets"  // 에셋 저장 경로
})

// 결과: 에셋이 자동으로 지정된 폴더에 저장됨
// ./assets/6e134c6c4f175a81f94018216584fd808a1b84b6.svg
// ./assets/22d18fb2964a57ef7db9eaa50bd9135cbff48aa5.svg
// ...
```

**주의**: `dirForAssetWrites` 없이 호출하면 에러 발생:
```
"Path for asset writes as tool argument is required for write-to-disk option"
```

### 수동 에셋 다운로드 (대안)
```bash
# 1. MCP가 제공한 로컬호스트 URL 확인
http://127.0.0.1:3845/assets/icon.svg

# 2. curl 또는 WebFetch로 에셋 다운로드
curl -o ./assets/icon.svg http://127.0.0.1:3845/assets/icon.svg

# 3. 다운로드한 로컬 파일 경로로 코드 작성
<img src="./assets/icon.svg" alt="Icon" />
```

### 코드 생성 규칙
```javascript
// ✅ 올바른 방법 (다운로드 후 로컬 경로 사용)
<img src="./assets/icon.svg" alt="Icon" />
<img src="./images/logo.png" alt="Logo" />

// ❌ 잘못된 방법 (로컬호스트 URL 직접 사용)
<img src="http://127.0.0.1:3845/assets/icon.svg" alt="Icon" />

// ❌ 잘못된 방법 (외부 URL 사용)
<img src="https://example.com/icon.svg" alt="Icon" />

// ❌ 잘못된 방법 (존재하지 않는 임의 경로)
<img src="/assets/placeholder-icon.svg" alt="Icon" />
```

---

## 📦 컨테이너 구조 패턴

### 핵심 원칙

**Figma 선택 요소 = 컨테이너**

사용자가 Figma 링크를 제공하면, 선택된 요소의 가장 바깥이 컨테이너가 됩니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Figma 선택 요소 (524 × 350)                                         │
│       ↓                                                              │
│  #component-container {                                              │
│      width: 524px;   /* Figma 크기 그대로 */                          │
│      height: 350px;  /* Figma 크기 그대로 */                          │
│      overflow: auto; /* 동적 렌더링 대응 - 유일한 추가 */               │
│  }                                                                   │
│                                                                      │
│  내부 HTML/CSS는 Figma 스타일 그대로 구현                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 왜 이 구조인가?

웹 빌더는 컴포넌트마다 div 컨테이너를 기본 단위로 가집니다:
- Figma 선택 요소의 크기 = 컨테이너 크기
- 내부 요소 = innerHTML로 주입
- Figma 스타일을 그대로 유지해야 디자인 일관성 보장

### 구현 방법

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <style>
    /* 컨테이너: Figma 선택 요소 크기 */
    #component-container {
      width: 524px;
      height: 350px;
      overflow: auto;  /* 동적 렌더링 대응 */
    }

    /* 내부 요소: Figma 스타일 그대로 */
    #component-container .component-block {
      /* Figma에서 추출한 스타일 그대로 적용 */
      /* 임의로 width: 100%, height: 100% 변경하지 않음 */
    }
  </style>
</head>
<body>
  <div id="component-container">
    <div class="component-block">
      <!-- Figma 내부 구조 그대로 -->
    </div>
  </div>
</body>
</html>
```

### 주의사항

1. **Figma 크기 그대로 사용** - 컨테이너 크기 = Figma 선택 요소 크기
2. **Figma 스타일 그대로 구현** - 내부 요소를 임의로 100%로 변경하지 않음
3. **overflow: auto만 추가** - 동적 렌더링 대응을 위한 유일한 추가 속성
4. **스크린샷 검증 필수** - 구현 후 Figma 원본과 비교

---

## ⚙️ 구현 시 주의사항 (실전 교훈)

### 0. 🚨 추측 금지 원칙 (가장 중요!)

**절대 원칙**: Figma MCP가 제공하는 정확한 데이터가 있으면 **절대 추측하지 않는다**.

```
❌ 잘못된 접근:
- "이 정도면 비슷해 보이니까 완료"
- "대충 이 값이면 맞겠지"
- "임의로 저장한 파일이 원본일 거야"
- CSS 값을 "추측"해서 조정

✅ 올바른 접근:
- get_screenshot → 이것이 유일한 원본
- get_design_context → 이것이 정확한 구조와 수치
- Tailwind 클래스를 CSS로 변환할 때 값 그대로 사용
- 시각적 차이가 있으면 MCP 데이터 다시 확인
```

**원본 기준**:
1. `get_screenshot` = Figma 원본 스크린샷 (비교 기준)
2. `get_design_context` = 정확한 레이아웃, 수치, 색상
3. Playwright 스크린샷 = 구현 결과

**비교 방법**:
```
1. get_screenshot으로 Figma 원본 캡처
2. Playwright로 구현물 스크린샷 캡처
3. 두 이미지를 눈으로 직접 비교
4. 차이점 발견 시 → MCP 데이터 다시 확인 후 수정
5. 추측하지 말고 MCP가 제공한 값 그대로 적용
```

---

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

### 📊 구현 완료 체크리스트

- [ ] 전체 컨테이너 width/height가 metadata와 일치
- [ ] gap 값 정확 (row-gap ≠ column-gap 체크)
- [ ] **헤더-컨텐츠 간격이 metadata 좌표와 일치** (y값 계산)
- [ ] **상단/하단 여백이 원본과 일치**
- [ ] border 있는 요소에 height 명시 + box-sizing: border-box
- [ ] 고정 사이즈를 임의로 변경하지 않음
- [ ] 브라우저에서 실제 렌더링 결과 확인
- [ ] Figma 스크린샷과 **픽셀 단위로** 비교 완료
- [ ] SVG 에셋이 올바른 크기로 렌더링됨 (img에 픽셀 단위 width/height 명시)
- [ ] SVG 에셋을 CSS나 외부 아이콘으로 임의 대체하지 않음

---

## 🎯 정확한 변환 워크플로우

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

### Playwright 스크린샷 캡처 코드

```javascript
// Windows에서 실행
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 524, height: 350 }  // Figma 프레임 크기와 동일
  });
  await page.goto('http://localhost:3000/path/to/component.html');
  await page.screenshot({ path: './screenshots/component.png' });
  await browser.close();
  console.log('Screenshot saved');
})();
"
```

---

## 📚 추가 리소스

- [Figma Dev Mode MCP 공식 문서](https://help.figma.com/hc/ko/articles/32132100833559)
- [MCP 프로토콜 문서](https://modelcontextprotocol.io)

---

## 🤝 팁

1. **항상 Figma Desktop 앱 먼저 실행**
2. **파일을 미리 열어두기**
3. **정확한 node-id 또는 링크 제공**
4. **원하는 프레임워크 명시** (React/Vue/HTML 등)
5. **get_image로 시각적 확인** (정확도 향상)

이제 Figma 디자인을 Claude Code로 변환할 준비가 되었습니다! 🚀



## 🎓 Figma 활용 가이드

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

## 🎭 Playwright (스크린샷)

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