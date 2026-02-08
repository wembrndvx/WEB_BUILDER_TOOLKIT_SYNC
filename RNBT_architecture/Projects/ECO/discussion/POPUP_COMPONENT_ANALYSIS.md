# ECO 팝업 컴포넌트 분석 (2026-02-08)

## 대상 컴포넌트

| 컴포넌트 | 역할 | 섹션 구성 |
|----------|------|-----------|
| UPS | UPS 상세 팝업 | 기본정보 + 전력현황(4카드) + 입출력추이(3탭 차트) |
| PDU | 분전반 상세 팝업 | 기본정보 + 전력추이현황(4탭 차트, 금일/전일 비교) |
| CRAC | 항온항습기 상세 팝업 | 기본정보 + 상태정보(2카드) + 인디케이터(6dot) + 온습도차트 |
| TempHumiditySensor | 온습도 센서 상세 팝업 | 기본정보 + 실시간 측정값(2카드) + 온습도차트 |

---

## 패턴 분화: Group A vs Group B

register.js 코딩 스타일이 2개 그룹으로 분화되어 있음.

### Group A: UPS + CRAC

```javascript
// statusMap 구조
statusMap: {
    labels: { ACTIVE: '정상운영', WARNING: '주의', ... },
    dataAttrs: { ACTIVE: 'normal', WARNING: 'warning', ... },
    defaultDataAttr: 'normal',
}

// fetchModelVendorChain
fetchModelVendorChain.call(this, asset, chainConfig, ctx);

// renderField (구조분해 파라미터)
function renderField(ctx, data, { key, selector, transform, dataAttr, fallback }) { ... }

// onPopupCreated 순서
renderInitialLabels → createChart → bindPopupEvents
```

### Group B: PDU + TempHumiditySensor

```javascript
// statusMap 구조
statusMap: {
    ACTIVE: { label: '정상운영', dataAttr: 'normal' },
    WARNING: { label: '주의', dataAttr: 'warning' },
    DEFAULT: { label: '알수없음', dataAttr: 'normal' },
}

// fetchModelVendorChain
fetchModelVendorChain(ctx, asset, chainConfig);

// renderField (객체 파라미터)
function renderField(ctx, data, field) { ... }  // field = { key, selector, ... }

// onPopupCreated 순서
createChart → bindPopupEvents → renderInitialLabels
```

### 분화 판단

이 차이들은 **같은 기능의 다른 구현**이지 도메인 요구사항 차이가 아님.
코드 생성 시점에 따라 자연스럽게 분화된 것으로 추정.
두 패턴 모두 정상 작동하며, 기존 컴포넌트는 수정하지 않음.

**SKILL에 반영할 사항**: 정답 패턴을 하나로 지정하여 신규 생성 시 일관성 확보.
→ Group B 패턴 채택 권장 (statusMap이 더 직관적, 함수 시그니처가 명확)

---

## 도메인별 정당한 차이

각 팝업이 서로 다른 장비를 표현하므로 다음 차이는 정당함.

| 항목 | UPS | PDU | CRAC | Sensor |
|------|-----|-----|------|--------|
| 메트릭 카드 | 전력현황 4카드 | 없음 | 온습도 2카드 | 온습도 2카드 |
| 차트 탭 | 3탭 (전류/전압/주파수) | 4탭 (전압/전류/전력/주파수) | 없음 (단일 차트) | 없음 (단일 차트) |
| 차트 타입 | 입/출력 2시리즈 라인 | 단일 라인 + 금일/전일 비교 | 바+라인 복합 (듀얼 Y축) | 바+라인 복합 (듀얼 Y축) |
| 인디케이터 | 없음 | 없음 | 6개 BOOL dot | 없음 |
| 범례 | 입/출력 범례 | 없음 | 없음 | 없음 |
| 캐시 | `_trendData` | `_trendData` + `_trendDataComparison` | 없음 | 없음 |

---

## 수정한 불일치 (2026-02-08)

### 1. PDU orphan energy 탭 제거

- **문제**: HTML에 5번째 `data-tab="energy"` 버튼이 있었으나 JS config에는 4개 탭만 정의
- **수정**: HTML에서 energy 버튼 제거, JS 주석 "5탭" → "4탭" 수정

### 2. info-section 구조 통일

- **문제**: UPS/Sensor는 `section-header("기본정보")` + `info-content` 래퍼가 있었으나, PDU/CRAC는 없었음
- **기준**: UPS/Sensor 패턴 (모든 section에 header가 있는 것이 일관적)
- **수정**: PDU/CRAC에 `section-header` + `info-content` 래퍼 추가, CSS 셀렉터 동기화

| 컴포넌트 | 수정 전 HTML | 수정 후 HTML | CSS 변경 |
|----------|-------------|-------------|----------|
| PDU | `info-section > info-layout` | `info-section > section-header + info-content > info-layout` | `.info-section` → `.info-section .info-content` |
| CRAC | `info-section > info-layout` | `info-section > section-header + info-content > info-layout` | `.info-section` → `.info-section .info-content` |

### 3. Sensor `<tbody>` 래퍼 추가

- **문제**: UPS/PDU/CRAC는 info-table에 `<tbody>` 래퍼가 있었으나 Sensor는 없었음
- **수정**: Sensor의 info-table에 `<tbody>` 추가

### 4. codeflow.md 전체 삭제

- **문제**: 5개 컴포넌트의 docs/codeflow.md가 코드 변경과 동기화되지 않음 (PDU에 Tabulator 참조 잔존 등)
- **판단**: 코드가 곧 문서. 별도 마크다운은 동기화 혼선만 초래
- **수정**: UPS, PDU, CRAC, TempHumiditySensor, AssetList의 codeflow.md를 git rm

### 5. UPS/CRAC register.js → Group B 패턴 통일

- **문제**: UPS/CRAC(Group A)와 PDU/Sensor(Group B)가 같은 기능을 다른 패턴으로 구현
- **판단**: 기능 차이 없으므로 하나로 통일 (Group B 채택)
- **변경 항목**:

| 항목 | Group A (수정 전) | Group B (수정 후) |
|------|-------------------|-------------------|
| statusMap | `{ labels: {}, dataAttrs: {} }` | `{ ACTIVE: { label, dataAttr }, DEFAULT: {} }` |
| statusTypeToLabel | `this.config.statusMap.labels[statusType]` | `statusMap[statusType].label` |
| renderField | `(ctx, data, { key, selector, ... })` 구조분해 | `(ctx, data, field)` 객체 |
| fetchModelVendorChain | `.call(this, assetModelKey, chain, datasetNames)` | `(ctx, asset, chainConfig)` + `fx.go` |
| onPopupCreated | `renderInitialLabels` → `createChart` → `bindPopupEvents` | `createChart` → `bindPopupEvents` → `renderInitialLabels` |
| renderInitialLabels 호출 | `renderInitialLabels.call(this)` | `this.renderInitialLabels()` (bind됨) |

### 6. SKILL 문서 통일

- Tabulator 참조 제거 (`applyTabulatorMixin`, PDU 설명)
- statusMap 예시 → Group B 스타일로 교체
- renderField 예시 → `(ctx, data, field)` 시그니처로 교체
- onPopupCreated 순서 → `createChart → bindPopupEvents → renderInitialLabels`
- TempHumiditySensor 참조 추가

---

## 수정하지 않은 사항 (현상 유지)

- CSS 클래스 접두사 차이 (.ups-name vs .pdu-name): Shadow DOM이므로 정당
- 각 컴포넌트 고유 섹션 (인디케이터, 범례, 금일/전일 비교 등): 도메인 요구사항
