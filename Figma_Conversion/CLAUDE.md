# Figma → Code 변환 프로젝트

## 프로젝트 구조

```
Figma_Conversion/
├── CLAUDE.md                   # 이 문서 (핵심 원칙)
├── Static_Components/          # 변환된 HTML/CSS 결과물
│   └── [프로젝트명]/
│       └── [컴포넌트명]/
│           ├── assets/         # SVG, 이미지 에셋
│           ├── screenshots/    # 구현물 스크린샷 (impl.png)
│           ├── [name].html
│           └── [name].css
├── package.json                # 의존성 (playwright)
└── node_modules/
```

---

## 핵심 원칙

### 추측 금지 (가장 중요!)

**절대 원칙**: Figma MCP가 제공하는 정확한 데이터가 있으면 **절대 추측하지 않는다**.

```
❌ 잘못된 접근:
- "이 정도면 비슷해 보이니까 완료"
- "대충 이 값이면 맞겠지"
- CSS 값을 "추측"해서 조정

✅ 올바른 접근:
- get_screenshot → 이것이 유일한 원본
- get_design_context → 이것이 정확한 구조와 수치
- Tailwind 클래스를 CSS로 변환할 때 값 그대로 사용
- 시각적 차이가 있으면 MCP 데이터 다시 확인
```

### Figma 값 그대로 사용

- Figma metadata에 명시된 **고정 사이즈는 그대로 구현** (임의 변경 금지)
- 에셋은 Figma에서 제공된 것만 사용 (외부 아이콘, CSS 도형으로 대체 금지)
- 변경이 필요하면 사용자에게 먼저 확인

### 에셋 임의 대체 금지

- Figma 에셋은 원본이다 — SVG 렌더링 문제가 있어도 CSS로 대체하지 않는다
- 에셋은 그대로 두고, CSS로 올바르게 렌더링되도록 크기를 잡아준다

---

## 컨테이너 구조 패턴

**Figma 선택 요소 = 컨테이너**

```html
<div id="component-container">
  <!-- Figma 내부 구조 그대로 -->
</div>
```

```css
#component-container {
    width: 524px;   /* Figma 선택 요소 크기 그대로 */
    height: 350px;
    overflow: auto; /* 동적 렌더링 대응 - 유일한 추가 */
}
```

1. **Figma 크기 그대로 사용** — 컨테이너 크기 = Figma 선택 요소 크기
2. **Figma 스타일 그대로 구현** — 내부 요소를 임의로 100%로 변경하지 않음
3. **overflow: auto만 추가** — 동적 렌더링 대응을 위한 유일한 추가 속성

---

## 구현 완료 체크리스트

- [ ] 전체 컨테이너 width/height가 metadata와 일치
- [ ] gap 값 정확 (row-gap ≠ column-gap 체크)
- [ ] 헤더-컨텐츠 간격이 metadata 좌표와 일치 (y값 계산)
- [ ] 상단/하단 여백이 원본과 일치
- [ ] border 있는 요소에 height 명시 + box-sizing: border-box
- [ ] 고정 사이즈를 임의로 변경하지 않음
- [ ] SVG 에셋이 올바른 크기로 렌더링됨 (img에 픽셀 단위 width/height 명시)
- [ ] SVG 에셋을 CSS나 외부 아이콘으로 임의 대체하지 않음
- [ ] Playwright 스크린샷으로 Figma 원본과 **픽셀 단위로** 비교 완료

---

## 상세 가이드 참조

| 문서 | 내용 |
|------|------|
| [/.claude/guides/FIGMA_MCP_GUIDE.md](/.claude/guides/FIGMA_MCP_GUIDE.md) | MCP 서버 설정, 도구 사용법, 에셋 다운로드 규칙, dirForAssetWrites |
| [/.claude/guides/FIGMA_IMPLEMENTATION_GUIDE.md](/.claude/guides/FIGMA_IMPLEMENTATION_GUIDE.md) | 구현 주의사항 7개, 변환 워크플로우, Playwright 검증, Figma 활용 팁 |
| [/Figma_Conversion/PUBLISHING_COMPONENT_STRUCTURE.md](/Figma_Conversion/PUBLISHING_COMPONENT_STRUCTURE.md) | 컴포넌트 자산 구조 가이드 |
