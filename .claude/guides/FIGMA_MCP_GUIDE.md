# Figma MCP 가이드

> 이 문서는 Figma MCP 서버 설정, 도구 사용법, 에셋 관리 규칙을 다룹니다.
> Skill이 작업 전 Read로 참조하는 문서입니다.

---

## 초기 설정 가이드

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

## Figma MCP 서버란?

**MCP (Model Context Protocol) 서버**는 Claude가 Figma 디자인 정보에 직접 접근할 수 있게 해주는 다리입니다.

```
Figma 디자인 ←→ MCP 서버 ←→ Claude Code ←→ HTML/CSS 코드
```

### 왜 필요한가요?
- ❌ **수동 작업 없이**: 크기, 색상, 간격을 일일이 측정할 필요 없음
- ✅ **정확한 구현**: Figma 디자인의 정확한 수치를 그대로 사용
- ⚡ **빠른 개발**: 디자인 → 코드 변환 시간 80% 단축

---

## 작동 원리

### 1. Figma 링크 제공 시
```
사용자: "이 링크 구현해줘"
https://www.figma.com/design/VNqtXrH6ydqcDgYBsVFLbg/...?node-id=25-1393&m=dev
         ↓
Claude가 node-id 추출: "25-1393" (또는 "25:1393")
         ↓
MCP 도구 호출
  - get_design_context("25:1393")  → 구조, 수치, 코드, 에셋
  - get_screenshot("25:1393")      → 디자인 스크린샷
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

## 제공 도구

MCP 서버가 Claude에게 제공하는 **2가지 핵심 도구**:

| 도구 이름 | 역할 | 입력 | 출력 |
|----------|------|------|------|
| **get_design_context** | 디자인 구조, 수치, 코드, 에셋 다운로드 | nodeId, dirForAssetWrites 등 | 레이아웃 정보 + HTML/CSS + 에셋 파일 |
| **get_screenshot** | 디자인 스크린샷 (시각 비교 기준) | nodeId | PNG 이미지 |

### 도구 사용 예시

```javascript
// Claude가 내부적으로 이렇게 호출합니다
mcp__figma-desktop__get_design_context({
  nodeId: "25:1393",
  clientLanguages: "html,css",
  clientFrameworks: "vanilla",
  dirForAssetWrites: "./assets"
})
// → 디자인 구조, 수치, 코드, 에셋 자동 다운로드

mcp__figma-desktop__get_screenshot({ nodeId: "25:1393" })
// → 실제 디자인 스크린샷 (비교용)
```

---

## 사용 방법

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

## 중요한 사항

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

## MCP 규칙

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
