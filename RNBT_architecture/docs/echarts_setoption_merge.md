# ECharts setOption 병합 모드 가이드

## 0. 배경

PopupMixin의 `updateChart`에서 탭 전환 시 이전 series가 남아 있는 버그가 발생했다.
원인은 ECharts의 기본 병합(merge) 동작이 series 배열을 **인덱스 기반으로 병합**하기 때문이다.

## 1. 문제 상황

```
유효전력 탭 (2개 series)        →   전압 탭 (1개 series)
├── series[0]: 금일 실선          ├── series[0]: 금일 실선  ← 정상 교체
└── series[1]: 전일 점선          └── series[1]: 전일 점선  ← 유령 잔류!
```

기본 `chart.setOption(option)`은 series 배열을 **merge**한다:
- 새 option에 series가 1개만 있으면 series[0]만 교체
- 기존 series[1]은 "건드리지 않음" → 이전 탭의 전일 데이터가 그대로 표시

## 2. ECharts setOption의 3가지 모드

### 2.1 기본 병합 (Default Merge)

```javascript
chart.setOption(option);
```

| 대상 | 동작 |
|------|------|
| 컴포넌트 배열 (series, xAxis[], yAxis[]) | 인덱스 기반 병합. 새 배열이 짧으면 나머지 유지 |
| 일반 속성 (legend.data, xAxis.data, yAxis.name) | 덮어쓰기 (overwrite) |
| 미지정 속성 | 기존 값 유지 |

**문제**: series 개수가 줄어드는 탭 전환에서 유령 series 발생.

### 2.2 전체 교체 (notMerge)

```javascript
chart.setOption(option, { notMerge: true });
// 또는 레거시 문법
chart.setOption(option, true);
```

- 모든 컴포넌트를 버리고 완전히 새로 생성
- dataZoom 위치, tooltip 상태, 애니메이션 전환 등 **모든 상태 손실**
- "다른 유형의 차트로 완전히 교체"할 때만 사용

### 2.3 선택적 교체 (replaceMerge) — ECharts 5+

```javascript
chart.setOption(option, { replaceMerge: ['series'] });
```

| 대상 | 동작 |
|------|------|
| replaceMerge에 지정된 컴포넌트 (series) | **완전 교체** — 새 option의 series로 대체 |
| 그 외 컴포넌트 (xAxis, yAxis, tooltip 등) | 기존 merge 동작 유지 |

**장점**:
- series 개수가 변해도 유령 series 없음
- tooltip, dataZoom 등 다른 상태는 보존
- 부드러운 애니메이션 전환 유지

## 3. 적용: PopupMixin.updateChart

### Before (버그)

```javascript
chart.setOption(option);
```

### After (수정)

```javascript
chart.setOption(option, { replaceMerge: ['series'] });
```

**파일**: `Utils/PopupMixin.js` → `applyEChartsMixin` → `instance.updateChart`

## 4. 컴포넌트 배열 vs 일반 속성 구분

ECharts에서 "컴포넌트 배열"과 "일반 속성"은 병합 방식이 다르다:

### 컴포넌트 배열 (인덱스 기반 병합)

series, xAxis, yAxis, dataZoom, visualMap 등 — 배열 내 각 항목이 독립적인 컴포넌트.

```javascript
// 기존: series[0], series[1] 존재
chart.setOption({ series: [newSeries0] });
// 결과: series[0] = newSeries0, series[1] = 기존 유지 ← 문제!
```

### 일반 속성 (덮어쓰기)

legend.data, xAxis.data, yAxis.name, tooltip.formatter 등 — 컴포넌트 내부의 속성.

```javascript
// 기존: legend.data = ['A', 'B']
chart.setOption({ legend: { data: ['C'] } });
// 결과: legend.data = ['C'] ← 완전 교체, 'B' 남지 않음
```

따라서 `replaceMerge: ['series']`만으로 탭 전환 시나리오는 충분히 해결된다.
legend.data나 xAxis.data 같은 일반 속성은 기본 merge에서도 덮어쓰기되기 때문이다.

## 5. 선택 가이드

| 시나리오 | 권장 모드 |
|----------|----------|
| 같은 series 구조, 데이터만 갱신 | 기본 merge |
| series 개수가 탭/모드에 따라 변함 | `replaceMerge: ['series']` |
| 차트 유형 자체가 변경 (bar → pie) | `notMerge: true` |

## 6. 참고

- [ECharts setOption 공식 문서](https://echarts.apache.org/en/api.html#echartsInstance.setOption)
- `replaceMerge`는 ECharts 5.0+에서 도입된 기능
- ECharts 4 이하에서는 `notMerge: true`가 유일한 대안
