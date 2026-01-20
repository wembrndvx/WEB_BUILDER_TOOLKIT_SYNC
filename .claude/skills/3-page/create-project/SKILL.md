---
name: create-project
description: RNBT 아키텍처 패턴에 맞는 완전한 대시보드 페이지를 생성합니다. Master/Page 레이어, 여러 컴포넌트, Mock 서버, datasetList.json을 포함합니다.
---

# RNBT 프로젝트 생성

Master/Page 레이어, 컴포넌트, Mock 서버, datasetList.json을 포함한 완전한 프로젝트를 생성합니다.

> 기본 원칙은 [RNBT_architecture/README.md](/RNBT_architecture/README.md) 참조

---

## ⚠️ 작업 전 필수 확인

**코드 작성 전 반드시 다음 파일들을 Read 도구로 읽으세요.**
**이전에 읽었더라도 매번 다시 읽어야 합니다 - 캐싱하거나 생략하지 마세요.**

1. [/RNBT_architecture/README.md](/RNBT_architecture/README.md) - 아키텍처 이해
2. [/.claude/guides/CODING_STYLE.md](/.claude/guides/CODING_STYLE.md) - 코딩 스타일

---

## 출력 구조

```
Examples/[project_name]/
├── mock_server/                    # Express API 서버
│   ├── server.js
│   └── package.json
│
├── master/page/                    # MASTER 레이어 (앱 전역)
│   ├── page_scripts/
│   │   ├── before_load.js
│   │   ├── loaded.js
│   │   └── before_unload.js
│   ├── page_styles/container.css
│   └── components/
│       ├── Header/
│       └── Sidebar/
│
├── page/                           # PAGE 레이어 (페이지별)
│   ├── page_scripts/
│   │   ├── before_load.js
│   │   ├── loaded.js
│   │   └── before_unload.js
│   ├── page_styles/container.css
│   └── components/
│
├── datasetList.json
├── preview.html
└── README.md
```

---

## Master vs Page 레이어

| 레이어 | 범위 | 용도 | 예시 |
|--------|------|------|------|
| **Master** | 앱 전역 | 공통 UI, 네비게이션 | Header, Sidebar |
| **Page** | 페이지별 | 페이지 고유 콘텐츠 | StatsCards, DataTable, Chart |

### `this` 공유

Master와 Page는 **동일한 `this` 인스턴스를 공유**합니다.

```javascript
// Page loaded.js에서 초기화
this.currentParams = {};

// Master before_load.js에서 접근/수정 가능
this.currentParams.tasks = { ...filters };
```

- Master와 Page는 별도 레이어지만 하나의 페이지 인스턴스
- Page에서 초기화한 상태를 Master에서 직접 수정 가능
- 이벤트 핸들러는 등록 시점이 아닌 실행 시점에 `this` 참조

---

## 라이프사이클 흐름

```
[페이지 로드]
  MASTER before_load
    ↓
  PAGE before_load
    ↓
  컴포넌트 register (MASTER + PAGE 모두)
    ↓
  리소스 로딩 → 컴포넌트 completed
    ↓
  PAGE loaded
    ↓
  MASTER loaded

[페이지 언로드]
  MASTER before_unload
    ↓
  PAGE before_unload
    ↓
  컴포넌트 beforeDestroy (MASTER + PAGE 모두)
```

---

## 이벤트 처리 원칙

**질문: "이 동작의 결과를 페이지가 알아야 하는가?"**

| 답변 | 처리 방식 | 예시 |
|------|----------|------|
| 아니오 | `_internalHandlers` | Clear, Toggle |
| 예 | `customEvents` | 필터 변경, 행 선택 |
| 둘 다 | 둘 다 | 노드 클릭 → 선택 표시 + 상세 요청 |

---

## 금지 사항

- ❌ datasetList.json 형식 임의 변경
- ❌ 생성/정리 불일치
- ❌ 라이프사이클 순서 위반
- ❌ `function(response)` 사용 → `function({ response })` 필수

---

## 관련 자료

| 참조 | 위치 |
|------|------|
| 컴포넌트 생성 | [/.claude/skills/2-component/create-standard-component/SKILL.md](/.claude/skills/2-component/create-standard-component/SKILL.md) |
| 예제 | [/RNBT_architecture/Examples/SimpleDashboard/](/RNBT_architecture/Examples/SimpleDashboard/) |
