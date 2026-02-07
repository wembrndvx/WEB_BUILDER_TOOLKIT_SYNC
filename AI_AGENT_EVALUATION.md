# WEB_BUILDER_TOOLKIT 프로젝트 분석: AI Agent 관점의 모던성 및 효율성 평가

---

## 1. 최종 판단

이 프로젝트는 AI Agent 활용 관점에서 **매우 모던하고 효율적으로 설계**되어 있습니다.

특히 Claude Code의 Skills, Guides, CLAUDE.md, MCP 통합 등 **"AI가 작업하기 위한 인프라"**를 체계적으로 구축한 점이 돋보입니다.

다만, 전통적 소프트웨어 엔지니어링 관점의 일부 요소(CI/CD, 린터, 타입 시스템 등)는 부재합니다. 이것이 의도적 선택인지 아닌지에 따라 개선 여지가 있습니다.

---

## 2. 사고분석 과정 (Reasoning Trace)

### Phase 1: 프로젝트 구조 인식 — "이 프로젝트는 무엇인가?"

탐색 시작 시 가장 먼저 확인한 것은 **디렉토리 레이아웃**과 **루트 문서들**입니다.

```
WEB_BUILDER_TOOLKIT/
├── .claude/           ← 즉시 주목: AI Agent 전용 설정 디렉토리
│   ├── guides/        ← 코딩 스타일 가이드
│   ├── skills/        ← 6개의 자동화 스킬 정의
│   └── settings.local.json
├── CLAUDE.md          ← 루트 레벨 AI 행동 지침
├── Figma_Conversion/  ← Phase 1: 정적 퍼블리싱
│   └── .claude/settings.local.json  ← 하위 디렉토리별 독립 설정
└── RNBT_architecture/ ← Phase 2: 동적 런타임
    └── .claude/settings.local.json
```

**첫 번째 관찰**: `.claude/` 디렉토리가 루트에도 있고, 각 하위 프로젝트에도 있다. 이것은 **다중 레벨 AI 컨텍스트 관리**를 의미합니다. 일반적인 프로젝트에서는 루트에 하나만 두는 경우가 대부분입니다.

**판단 근거**: Claude Code는 현재 작업 디렉토리 기준으로 가장 가까운 `CLAUDE.md`와 `.claude/settings.local.json`을 참조합니다. 이 프로젝트는 **스코프별 컨텍스트 격리**를 의도적으로 설계한 것입니다.

---

### Phase 2: Skills 시스템 분석 — "AI에게 어떤 작업을 시키는가?"

`.claude/skills/` 디렉토리 구조가 가장 핵심적인 발견이었습니다.

```
.claude/skills/
├── README.md                              ← 워크플로우 맵
├── 1-figma/                               ← 단계 1
│   ├── figma-to-html/SKILL.md
│   └── figma-to-inline-svg/SKILL.md
├── 2-component/                           ← 단계 2
│   ├── create-standard-component/SKILL.md
│   ├── create-symbol-state-component/SKILL.md
│   └── create-component-with-popup/SKILL.md
└── 3-page/                                ← 단계 3
    └── create-project/SKILL.md
```

**두 번째 관찰**: 디렉토리가 **번호로 시작**합니다 (`1-`, `2-`, `3-`). 이것은 단순한 정리가 아니라 **파이프라인의 실행 순서**를 디렉토리 구조로 인코딩한 것입니다.

**파이프라인 재구성**:

```
Figma 디자인
  │
  ▼ [1-figma] figma-to-html 또는 figma-to-inline-svg
  │
  정적 HTML/CSS
  │
  ▼ [2-component] create-standard/symbol-state/popup-component
  │
  동적 컴포넌트 (register.js + beforeDestroy.js)
  │
  ▼ [3-page] create-project
  │
  완전한 프로젝트 (Master/Page/Mock서버/datasetList.json)
```

**판단 근거**: 각 SKILL.md는 다음을 포함합니다:

1. **"작업 전 필수 확인"** 섹션 — AI가 매번 특정 문서를 re-read하도록 강제
2. **입력/출력 명세** — 이전 스킬의 출력이 다음 스킬의 입력
3. **금지 사항과 체크리스트** — 환각(hallucination) 방지 규칙
4. **"다음 단계"** 안내 — 스킬 체이닝 가이드

이것은 사실상 **AI Agent를 위한 CI/CD 파이프라인**입니다. 코드가 아닌 문서로 파이프라인을 정의하되, 실행 주체가 인간이 아닌 AI Agent라는 점이 모던합니다.

---

### Phase 3: 문서 아키텍처 분석 — "AI의 지식 기반은 어떻게 구성되었는가?"

문서를 계층별로 정리하면 다음과 같은 구조가 드러납니다:

```
[행동 규칙 계층]
├── 루트 CLAUDE.md         → AI의 "성격"과 "태도" 정의
│   - 추측 금지, 스크린샷 꼼꼼히 확인, 함수 존재 확인 후 사용
│   - 사용자 피드백 맹신 금지, Git 충돌 임의 해결 금지
│
├── Figma_Conversion/CLAUDE.md → Figma MCP 작업 규칙
│   - 851줄의 상세 가이드
│   - MCP 도구별 사용법, 에셋 다운로드 규칙
│
└── RNBT_architecture/CLAUDE.md → 런타임 작업 규칙
    - "절대 서두르지 않는다", "확인 없이 완료라 말하지 않는다"

[지식 계층]
├── .claude/guides/CODING_STYLE.md  → 코딩 스타일 (534줄)
│   - 함수형 vs 명령형 판단 기준
│   - 안티패턴과 권장 패턴
│   - CSS 원칙 (px, Flexbox)
│
├── RNBT_architecture/README.md     → 아키텍처 설계서 (1,357줄)
│   - 컴포넌트 라이프사이클
│   - Page-Component 역할 분리
│   - 기본 JS 템플릿
│
└── RNBT_architecture/docs/         → 19개의 API 레퍼런스
    - WKIT_API.md, WEVENTBUS_API.md, FX_API.md 등

[참조 구현 계층]
├── RNBT_architecture/Examples/     → 3개의 예제 프로젝트
│   - SimpleDashboard, Simple3DStatus, TaskMonitor
│
├── RNBT_architecture/Components/   → 3개의 완성된 컴포넌트
│   - LogViewer, AssetTree, EventStatus
│
└── RNBT_architecture/Projects/     → 4개의 실제 프로젝트
    - ECO, HANA_BANK_HIT_Dev, HANA-BANK, Symbol_Test
```

**세 번째 관찰**: 문서가 **3가지 역할**로 분리되어 있습니다.

| 계층 | 역할 | AI Agent에게 의미 |
|------|------|-------------------|
| 행동 규칙 | AI가 "어떻게" 행동할지 | System Prompt 확장 |
| 지식 | AI가 "무엇을" 알아야 하는지 | RAG의 Knowledge Base |
| 참조 구현 | AI가 "무엇을 참고"할지 | Few-shot Examples |

**판단 근거**: 이 3계층 구조는 우연이 아닙니다. SKILL.md의 "작업 전 필수 확인" 섹션이 매번 정확히 이 3가지를 re-read하도록 강제합니다:

```markdown
## 작업 전 필수 확인
1. /RNBT_architecture/README.md - 아키텍처 이해        ← 지식
2. /.claude/guides/CODING_STYLE.md - 코딩 스타일       ← 행동 규칙
3. 기존 컴포넌트 패턴 확인 - LogViewer 등               ← 참조 구현
```

이것은 사실상 **매 작업마다 RAG(Retrieval-Augmented Generation)를 수동으로 수행**하는 것과 동일합니다. AI의 컨텍스트 윈도우가 리셋되더라도 항상 올바른 지식 기반에서 시작하도록 보장합니다.

---

### Phase 4: 환각 방지 메커니즘 분석 — "AI의 실수를 어떻게 막는가?"

이 프로젝트에서 가장 인상적인 부분은 **AI Agent의 알려진 약점에 대한 방어 체계**입니다.

```
[환각 방지 규칙들]

1. "추측 금지 원칙" (루트 CLAUDE.md)
   → AI가 MCP 데이터 없이 CSS 값을 "추측"하는 것을 금지

2. "함수 존재 확인 후 사용" (루트 CLAUDE.md)
   → AI가 존재하지 않는 함수명을 만들어내는 것을 방지
   → grep으로 확인하는 패턴까지 명시

3. "스크린샷 어림짐작 금지" (루트 CLAUDE.md)
   → AI가 시각적 결과를 대충 "문제없다"고 넘기는 것을 방지

4. "사용자 피드백 검증" (루트 CLAUDE.md)
   → AI가 사용자 말을 무조건 따르는 sycophancy를 방지

5. "매번 다시 읽어야 합니다" (각 SKILL.md)
   → 컨텍스트 스태일(stale) 문제 방지
```

**네 번째 관찰**: 이 규칙들은 LLM의 알려진 실패 모드(failure modes)를 하나하나 겨냥합니다:

| LLM 실패 모드 | 프로젝트의 방어 | 위치 |
|---------------|----------------|------|
| Hallucination (환각) | "추측 금지", 데이터 기반만 허용 | CLAUDE.md, SKILL.md |
| Sycophancy (아부) | 사용자가 "안된다"해도 직접 확인 | CLAUDE.md |
| Stale Context | "매번 다시 읽어야 합니다" | SKILL.md |
| Lazy Evaluation | 스크린샷 픽셀 비교 강제 | figma-to-html SKILL.md |
| Over-confidence | "완료라 말하기 전 반드시 검증" | RNBT CLAUDE.md |
| Function Hallucination | grep으로 함수 존재 확인 강제 | CLAUDE.md |

**판단 근거**: 이 수준의 방어 체계는 AI Agent와 **상당 기간 실제 작업을 해본 경험**에서 나온 것입니다. 각 규칙이 추상적 원칙이 아니라 **구체적인 실패 사례에 대한 대응**으로 작성되어 있습니다.

---

### Phase 5: 검증 루프 분석 — "결과의 품질을 어떻게 보장하는가?"

```
[시각적 검증 루프]

Figma MCP get_screenshot()   ←── 원본 (Ground Truth)
        │
        ▼ 비교
Playwright 스크린샷 캡처     ←── 구현물
        │
        ├─ 일치 → 완료
        └─ 불일치 → MCP 데이터 재확인 → CSS 수정 → 다시 캡처 → 비교
```

**다섯 번째 관찰**: 이것은 사실상 **자율 피드백 루프(autonomous feedback loop)**입니다. AI Agent가:

1. MCP로 디자인 데이터를 가져오고
2. HTML/CSS를 생성하고
3. Playwright로 스크린샷을 찍고
4. 원본과 비교하고
5. 차이가 있으면 스스로 수정

이 루프는 **사람의 개입 없이** AI가 반복 실행할 수 있습니다. 외부 도구(Figma MCP + Playwright)를 검증 오라클(oracle)로 활용한 설계입니다.

---

### Phase 6: 부족한 점 분석 — "전통적 엔지니어링 관점에서 빠진 것은?"

```
[부재 요소]

- CI/CD 파이프라인 (.github/workflows/)
  → Skills가 CI/CD 역할을 일부 대체하지만, 자동화된 게이트는 없음

- 린터/포매터 (.eslintrc, .prettierrc)
  → CODING_STYLE.md가 규칙을 정의하지만, 기계적 강제가 없음

- 타입 시스템 (tsconfig.json)
  → 순수 JavaScript, 타입 안전성 없음

- 번들러/빌드 시스템 (webpack, vite)
  → 스크립트 태그 직접 로드 방식

- 패키지 관리 통합 (monorepo 도구)
  → Figma_Conversion과 RNBT_architecture가 독립적 package.json

- 환경 변수 관리 (.env)
  → 설정값이 코드에 직접 포함
```

**여섯 번째 관찰**: 이 부재 요소들이 **결함인지 의도적 선택인지**를 판단해야 합니다.

**의도적 선택으로 해석되는 근거**:

- 이 프로젝트의 런타임은 **RENOBIT 웹 빌더 플랫폼** 위에서 동작합니다
- 컴포넌트는 빌더의 `innerHTML`로 주입되므로 **번들링이 불필요**합니다
- `Utils/` 파일들은 플랫폼이 전역으로 제공하는 라이브러리입니다
- TypeScript 컴파일이 빌더 런타임과 호환되지 않을 수 있습니다

**그럼에도 개선 가능한 부분**:

- **ESLint/Prettier**: AI가 아닌 사람이 수정할 때도 일관성 보장
- **GitHub Actions**: Skills 실행 결과를 자동 검증하는 워크플로우
- **JSDoc**: TypeScript 없이도 IDE 자동완성 + AI 컨텍스트 향상

---

## 3. 종합 평가 매트릭스

| 평가 항목 | 점수 | 근거 |
|-----------|------|------|
| Skills 파이프라인 | ★★★★★ | 6개 스킬의 번호 기반 체이닝 |
| 컨텍스트 관리 | ★★★★★ | 3레벨 CLAUDE.md + 스킬별 re-read |
| 환각 방지 | ★★★★★ | 6가지 LLM 실패 모드 방어 |
| 자율 검증 루프 | ★★★★☆ | MCP + Playwright 비교 (자동화 부족) |
| 문서화 | ★★★★★ | 30+ 마크다운, 1,357줄 아키텍처 문서 |
| 참조 구현 | ★★★★☆ | 3 예제 + 4 프로젝트 (테스트 부족) |
| MCP 통합 | ★★★★★ | Figma MCP로 디자인 데이터 직접 접근 |
| 권한 관리 | ★★★★☆ | 다중 레벨 settings.local.json |
| 코딩 가이드라인 | ★★★★★ | 안티패턴 + 권장패턴 + 실전 카탈로그 |
| CI/CD 자동화 | ★★☆☆☆ | 부재 - Skills가 부분 대체 |
| 코드 품질 도구 | ★★☆☆☆ | 린터/포매터/타입 없음 |
| 테스트 인프라 | ★★★☆☆ | 프레임워크 있으나 커버리지 낮음 |
| **종합** | **8/10** | **AI Agent 관점 탁월, 전통 도구 보완 필요** |

---

## 4. 결론: 이 프로젝트가 모던한 이유와 그렇지 않은 이유

### 모던한 이유 (AI-First Development)

1. **"AI가 일하는 환경"을 설계했다**
   - 대부분의 프로젝트: 사람이 코드를 쓰고, AI에게 물어본다
   - 이 프로젝트: AI가 코드를 쓰고, 문서가 AI의 행동을 제어한다

2. **Skills = 재현 가능한 AI 워크플로우**
   - 사람이 매번 프롬프트를 작성하는 대신
   - 표준화된 SKILL.md가 일관된 결과를 보장

3. **문서 = AI의 장기 기억**
   - README, API docs, Examples가 RAG 역할
   - "매번 다시 읽어야 합니다"가 기억 일관성 보장

4. **MCP 통합 = AI의 감각 기관**
   - Figma MCP로 디자인을 "볼" 수 있고
   - Playwright로 결과를 "확인"할 수 있음

### 보완하면 더 좋을 점

1. **Skills 실행 결과 자동 검증** (GitHub Actions)
   - 스크린샷 비교를 CI에서 자동 실행

2. **ESLint + Prettier**
   - AI가 생성한 코드의 기계적 일관성 보장

3. **JSDoc 타입 어노테이션**
   - TypeScript 없이도 IDE + AI 양쪽에서 타입 정보 활용

4. **테스트 커버리지 확대**
   - 현재 mock 기반 3개 테스트 → 각 Utils 함수의 단위 테스트

---

*평가일: 2026-02-07*
*평가 도구: Claude Code (Opus 4.6)*
