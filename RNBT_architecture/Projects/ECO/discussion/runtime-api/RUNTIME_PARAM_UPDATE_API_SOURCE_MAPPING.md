# Runtime Parameter Update API — 소스 매핑

이 문서는 런타임 API 호출이 **소스 코드에서 어떤 경로를 거쳐** API 요청과 차트 렌더링에 반영되는지를 추적한다.

> 참고: 메서드 시그니처와 파라미터는 [RUNTIME_PARAM_UPDATE_API.md](RUNTIME_PARAM_UPDATE_API.md)를 참조.

---

## 1. 전체 실행 흐름

```
updateXxxTabMetric() 호출
  │
  ├─ ① config 객체 변경       chart.tabs[tab].metricCode = 새 코드
  ├─ ② statsKeyMap 등록        api.statsKeyMap[새 코드] = statsKey
  ├─ ③ rebuildMetricCodes()    param.metricCodes 배열 재구축
  │
  └─ (호출 완료 — 여기까지가 API의 역할)

           ... showDetail() 호출 시 ...

fetchDatasetAndRender()
  │
  ├─ ④ param.metricCodes로 서버 요청   POST /api/v1/mhs/l
  ├─ ⑤ 응답 수신                        [{ metricCode, statsBody: { avg, sum, ... } }]
  │
  └─ renderTrendChart()
       │
       ├─ ⑥ statsKeyMap으로 집계값 선택  statsBody[statsKey]
       └─ ⑦ scale 적용 후 차트 표시     raw * scale
```

핵심: API 호출은 **①②③ config 변경만** 수행한다. 실제 fetch와 render는 이후 `showDetail()` 호출 시 변경된 config를 읽어서 자연스럽게 반영된다.

---

## 2. rebuildMetricCodes() — 동기화 허브

Category B 메서드가 metricCode를 변경하면, **param.metricCodes 배열**도 같이 바뀌어야 서버에 올바른 메트릭을 요청한다. 이 동기화를 담당하는 함수가 `rebuildMetricCodes()`이다.

### 2.1 동작 원리

```javascript
function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;                          // ← 배열 비우기 (참조 유지)

  // config에 등록된 모든 메트릭 코드를 다시 수집
  Object.values(this.config.chart.tabs).forEach((tab) => {
    if (tab.metricCode && !codes.includes(tab.metricCode))
      codes.push(tab.metricCode);
  });
}
```

`codes.length = 0`은 **같은 배열 참조를 유지**하면서 내용만 비운다. `datasetInfo.param.metricCodes`와 `trendInfo.param.metricCodes`가 **같은 배열 객체**이므로, 여기서 변경하면 이후 fetch 시 자동 반영된다.

### 2.2 컴포넌트별 3가지 패턴

| 패턴 | 컴포넌트 | config 구조 | rebuild 대상 |
|------|---------|------------|------------|
| **A. Dual-code** | UPS | `chart.tabs[tab].inputCode` + `.outputCode` | 탭당 2개 코드 수집 |
| **B. Single-tab** | SWBD, PDU | `chart.tabs[tab].metricCode` | 탭당 1개 코드 수집 |
| **C. Series** | CRAC, SENSOR | `chart.series[name].metricCode` | 시리즈당 1개 코드 수집 |

#### 패턴 A: UPS (Dual-code)

```
UPS/scripts/register.js:843-852
```

```javascript
function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { tabs } = this.config.chart;
  Object.values(tabs).forEach((tab) => {
    if (tab.inputCode && !codes.includes(tab.inputCode))
      codes.push(tab.inputCode);         // 입력 코드
    if (tab.outputCode && !codes.includes(tab.outputCode))
      codes.push(tab.outputCode);        // 출력 코드
  });
}
```

UPS는 탭마다 입력/출력 2개 메트릭을 사용하므로, 3개 탭 × 2 = 최대 6개 코드가 수집된다.

#### 패턴 B: SWBD, PDU (Single-tab)

```
SWBD/scripts/register.js:838-846
PDU/scripts/register.js:1108-1116
```

```javascript
function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { tabs } = this.config.chart;
  Object.values(tabs).forEach((tab) => {
    if (tab.metricCode && !codes.includes(tab.metricCode))
      codes.push(tab.metricCode);
  });
}
```

탭당 1개 코드. SWBD 4탭 = 4개, PDU 4탭 = 4개.

#### 패턴 C: CRAC, SENSOR (Series)

```
CRAC/scripts/register.js:785-793
TempHumiditySensor/scripts/register.js:782-790
```

```javascript
function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { series } = this.config.chart;       // ← tabs가 아닌 series
  Object.values(series).forEach((s) => {
    if (s.metricCode && !codes.includes(s.metricCode))
      codes.push(s.metricCode);
  });
}
```

CRAC/SENSOR는 탭 없이 온도+습도 2개 시리즈를 하나의 차트에 표시한다. `chart.series`에서 코드를 수집한다.

---

## 3. 변경된 metricCode가 API 요청에 반영되는 경로

### 3.1 param 객체의 참조 구조

```javascript
// initComponent() 시점에 생성
this.datasetInfo = [
  ...,
  {
    datasetName: 'metricHistoryStats',
    param: {
      metricCodes: ['SWBD.VOLTAGE_V', 'SWBD.CURRENT_A', ...],  // ← 이 배열
      statsKeys: [],
      interval: '1h',
      timeRange: 86400000,
      apiEndpoint: '/api/v1/mhs/l',
    },
    render: ['renderTrendChart'],
    refreshInterval: 5000,
  },
];
```

`rebuildMetricCodes()`가 받는 `trendInfo`는 이 datasetInfo 항목의 **직접 참조**이다:

```javascript
// updateSwbdTabMetric() 내부
const trendInfo = this.datasetInfo.find(
  (d) => d.datasetName === datasetNames.metricHistory
);
// trendInfo.param.metricCodes === this.datasetInfo[1].param.metricCodes (같은 객체)

rebuildMetricCodes.call(this, trendInfo);
// → trendInfo.param.metricCodes 내용 변경
// → this.datasetInfo[1].param.metricCodes도 동일하게 변경됨 (같은 참조)
```

### 3.2 fetchDatasetAndRender()에서 param 사용

```
SWBD/scripts/register.js — fetchDatasetAndRender 흐름
```

```javascript
function fetchDatasetAndRender(d) {
  const { datasetName, param, render } = d;
  //                    ↑ param은 datasetInfo[n].param 그 자체

  // 시계열 데이터셋이면 시간 범위 계산
  if (datasetName === this.config.datasetNames.metricHistory) {
    const now = new Date();
    param.timeFrom = formatLocalDate(new Date(now - param.timeRange));
    param.timeTo = formatLocalDate(now);
  }

  // 서버 요청 — param.metricCodes가 요청 본문에 포함됨
  fetchData(this.page, datasetName, param).then((response) => {
    this._trendData = response.data;
    render.forEach((fn) => this[fn]({ response }));
  });
}
```

**요청 본문에 포함되는 핵심 필드:**

```javascript
{
  metricCodes: ['SWBD.VOLTAGE_V', ...],   // ← rebuildMetricCodes()가 갱신한 배열
  interval: '1h',                          // ← updateTrendParams()로 변경 가능
  timeFrom: '2026-02-13 10:30:00',        // ← timeRange 기반 계산
  timeTo: '2026-02-14 10:30:00',
  apiEndpoint: '/api/v1/mhs/l',           // ← updateTrendParams()로 변경 가능
  assetKey: 'SWBD-001',                   // ← updateGlobalParams()로 변경 가능
}
```

---

## 4. statsKeyMap이 렌더링에서 소비되는 지점

### 4.1 API 응답 구조

서버는 각 시간대별로 **여러 집계값**을 함께 반환한다:

```json
{
  "time": "2026-02-14 10:00",
  "metricCode": "SWBD.VOLTAGE_V",
  "statsBody": {
    "avg": 240.5,
    "min": 238.0,
    "max": 242.0,
    "sum": 962.0
  }
}
```

### 4.2 statsKeyMap으로 집계값 선택

renderTrendChart()에서 시계열 데이터를 가공할 때, statsKeyMap이 **어떤 집계값을 사용할지** 결정한다:

```
SWBD/scripts/register.js — renderTrendChart 내부
```

```javascript
const timeMap = fx.reduce(
  (acc, row) => {
    const time = row[timeKey];
    if (!acc[time]) acc[time] = {};

    // ★ 여기서 statsKeyMap 소비
    const statsKey = this.config.api.statsKeyMap[row.metricCode];
    acc[time][row.metricCode] = statsKey
      ? row.statsBody?.[statsKey] ?? null    // statsBody.avg 또는 .sum 추출
      : null;

    return acc;
  },
  {},
  tabData
);
```

**예시:**

```
statsKeyMap = { 'SWBD.VOLTAGE_V': 'avg' }

row = { metricCode: 'SWBD.VOLTAGE_V', statsBody: { avg: 240.5, sum: 962.0 } }

→ statsKey = 'avg'
→ timeMap['10:00']['SWBD.VOLTAGE_V'] = 240.5   (avg 선택)
```

**만약 statsKey를 'sum'으로 변경했다면:**

```
statsKeyMap = { 'SWBD.VOLTAGE_V': 'sum' }

→ timeMap['10:00']['SWBD.VOLTAGE_V'] = 962.0   (sum 선택)
```

같은 API 응답에서 **다른 집계값이 추출**된다.

### 4.3 statsKeyMap이 갱신되는 시점

Category B 메서드 내부에서 metricCode와 함께 등록된다:

```javascript
// updateSwbdTabMetric() 내부
if (metricCode !== undefined) {
  tab.metricCode = metricCode;
  this.config.api.statsKeyMap[metricCode] = statsKey;   // ★ 여기서 등록
}
```

**metricCode 변경 시 statsKey를 필수로 요구**하는 이유가 여기 있다 — statsKeyMap에 새 코드를 등록하지 않으면, 렌더링 시 `statsKeyMap[newCode]`가 `undefined`가 되어 데이터를 추출할 수 없다.

```javascript
// 이것이 validate 규칙의 근거
if (metricCode !== undefined && statsKey === undefined) {
  console.warn(`metricCode 변경 시 statsKey 필수`);
  return;   // 변경 거부
}
```

---

## 5. scale이 적용되는 지점

scale은 **서버에서 받은 원시값을 표시 직전에 변환**한다. fetch 시점이 아니라 render 시점에 적용된다.

### 5.1 차트에서의 scale 적용

```
SWBD/scripts/register.js — renderTrendChart 내부
```

```javascript
const values = fx.go(
  times,
  fx.map((t) => {
    const raw = timeMap[t]?.[tabConfig.metricCode];
    return raw != null
      ? +(raw * tabConfig.scale).toFixed(2)    // ★ scale 적용
      : null;
  })
);
```

**예시:**

```
raw = 2405 (서버 원시값, DeciVolt)
scale = 0.1

→ 2405 * 0.1 = 240.5V (표시값)
```

### 5.2 상태카드에서의 scale 적용

UPS의 powerStatus 카드:

```
UPS/scripts/register.js — renderPowerStatus 내부
```

```javascript
function updatePowerCard(ctx, selectors, metricMap, key, cfg) {
  const rawValue = cfg.metricCode ? metricMap[cfg.metricCode] : undefined;

  if (rawValue != null) {
    valueEl.textContent = (rawValue * cfg.scale).toFixed(1);   // ★ scale 적용
  }
}
```

### 5.3 scale이 변경 가능한 API

| Category | 메서드 | scale 변경 |
|----------|--------|:--------:|
| B (차트) | `updateSwbdTabMetric(tab, { scale })` | O |
| B (차트) | `updatePduTabMetric(tab, { scale })` | O |
| B (시리즈) | `updateCracSeriesMetric(series, { scale })` | O |
| B (시리즈) | `updateSensorSeriesMetric(series, { scale })` | O |
| E (상태카드) | `updateUpsStatusMetric(key, { scale })` | O |
| E (상태카드) | `updateCracStatusMetric(key, { scale })` | O |
| E (상태카드) | `updateSensorStatusMetric(key, { scale })` | O |

> 참고: UPS의 Category B(`updateUpsTabMetric`)는 scale 파라미터를 받지 않는다. UPS 차트의 scale은 metricConfig.json의 DERIVED 메트릭 정의에서 관리된다.

---

## 6. End-to-End 추적 예시

### 시나리오: SWBD 전압 탭의 집계 방식을 avg → max로 변경

**초기 상태:**

```javascript
// config.chart.tabs
voltage: {
  metricCode: 'SWBD.VOLTAGE_V',
  label: '전압',
  unit: 'V',
  color: '#3b82f6',
  scale: 1.0,
}

// config.api.statsKeyMap
{ 'SWBD.VOLTAGE_V': 'avg', ... }

// datasetInfo[1].param.metricCodes
['SWBD.VOLTAGE_V', 'SWBD.CURRENT_A', 'SWBD.FREQUENCY_HZ', 'SWBD.ACTIVE_POWER_KW']
```

### ① API 호출

```javascript
component.updateSwbdTabMetric('voltage', {
  metricCode: 'SWBD.VOLTAGE_V',   // 동일 코드 유지
  statsKey: 'max',                 // avg → max 변경
});
```

### ② updateSwbdTabMetric() 실행

```
SWBD/scripts/register.js:806-836
```

```javascript
function updateSwbdTabMetric(tabName, options) {
  const tab = chart.tabs['voltage'];       // ← tab 객체 참조

  const { metricCode, statsKey } = options;

  // validate: metricCode + statsKey 쌍 검증
  // metricCode !== undefined && statsKey !== undefined → 통과

  // config 갱신
  tab.metricCode = 'SWBD.VOLTAGE_V';                        // 동일값 (변경 없음)
  this.config.api.statsKeyMap['SWBD.VOLTAGE_V'] = 'max';    // ★ avg → max

  // metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);
}
```

**변경 후 상태:**

```javascript
// config.api.statsKeyMap
{ 'SWBD.VOLTAGE_V': 'max', ... }   // ★ 변경됨

// datasetInfo[1].param.metricCodes — 동일 (코드 자체는 안 바뀜)
['SWBD.VOLTAGE_V', 'SWBD.CURRENT_A', 'SWBD.FREQUENCY_HZ', 'SWBD.ACTIVE_POWER_KW']
```

### ③ showDetail() → fetchDatasetAndRender()

```javascript
fetchData(this.page, 'metricHistoryStats', {
  metricCodes: ['SWBD.VOLTAGE_V', ...],   // 서버에 요청
  ...
});
```

### ④ 서버 응답

```json
[
  {
    "time": "2026-02-14 10:00",
    "metricCode": "SWBD.VOLTAGE_V",
    "statsBody": { "avg": 240.5, "min": 238.0, "max": 242.0 }
  }
]
```

### ⑤ renderTrendChart() — statsKeyMap 소비

```javascript
const statsKey = this.config.api.statsKeyMap['SWBD.VOLTAGE_V'];
// statsKey = 'max'                    ★ avg가 아닌 max

acc[time]['SWBD.VOLTAGE_V'] = row.statsBody['max'];
// = 242.0                            ★ 240.5(avg)가 아닌 242.0(max)
```

### ⑥ scale 적용 후 차트 표시

```javascript
const raw = 242.0;
const displayed = +(raw * 1.0).toFixed(2);   // = 242.0
// 차트에 242.0V 표시
```

### 결과

```
변경 전: 차트에 240.5V (avg)
변경 후: 차트에 242.0V (max)

소스 변경: 없음
API 호출: updateSwbdTabMetric('voltage', { metricCode: 'SWBD.VOLTAGE_V', statsKey: 'max' })
```

---

## 7. UPS Dual-code 추적 예시

UPS는 탭당 입력/출력 2개 메트릭을 사용하므로, 추적 경로가 다르다.

### 시나리오: 전류 탭을 역률 탭으로 교체

### ① API 호출

```javascript
component.updateUpsTabMetric('current', {
  inputCode: 'UPS.INPUT_PF',
  outputCode: 'UPS.OUTPUT_PF',
  statsKey: 'avg',
  label: '역률',
  unit: 'PF',
});
```

### ② updateUpsTabMetric() 실행

```
UPS/scripts/register.js:809-841
```

```javascript
const tab = chart.tabs['current'];

// config 갱신
tab.inputCode = 'UPS.INPUT_PF';                           // ★ 교체
tab.outputCode = 'UPS.OUTPUT_PF';                          // ★ 교체
this.config.api.statsKeyMap['UPS.INPUT_PF'] = 'avg';       // ★ 등록
this.config.api.statsKeyMap['UPS.OUTPUT_PF'] = 'avg';      // ★ 등록
tab.label = '역률';                                        // ★ 표시명
tab.unit = 'PF';                                           // ★ 단위

rebuildMetricCodes.call(this, trendInfo);
```

### ③ rebuildMetricCodes() — UPS 패턴

```
UPS/scripts/register.js:843-852
```

```javascript
codes.length = 0;

Object.values(tabs).forEach((tab) => {
  codes.push(tab.inputCode);     // 'UPS.INPUT_PF'  (교체됨)
  codes.push(tab.outputCode);    // 'UPS.OUTPUT_PF' (교체됨)
  // voltage, frequency 탭의 코드도 동일하게 수집
});

// 결과:
// ['UPS.INPUT_PF', 'UPS.OUTPUT_PF',
//  'UPS.INPUT_V_AVG', 'UPS.OUTPUT_V_AVG',
//  'UPS.INPUT_F_AVG', 'UPS.OUTPUT_F_AVG']
//
// 기존 INPUT_A_SUM, OUTPUT_A_SUM은 사라짐
```

### ④ 서버 응답 → 렌더링

```javascript
// renderTrendChart()
const tabConfig = tabs['current'];
// tabConfig = { inputCode: 'UPS.INPUT_PF', outputCode: 'UPS.OUTPUT_PF', label: '역률', unit: 'PF' }

const tabMetricCodes = [tabConfig.inputCode, tabConfig.outputCode];
// = ['UPS.INPUT_PF', 'UPS.OUTPUT_PF']

// 입력 라인: UPS.INPUT_PF 데이터
// 출력 라인: UPS.OUTPUT_PF 데이터
// 탭 제목: '역률'
// Y축 단위: 'PF'
```

### 결과

```
변경 전: 'current' 탭 → "입/출력 전류" (A), INPUT_A_SUM / OUTPUT_A_SUM
변경 후: 'current' 탭 → "역률" (PF), INPUT_PF / OUTPUT_PF

내부 키 'current'는 그대로지만, 표출 정보가 완전히 교체됨
```

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [RUNTIME_PARAM_UPDATE_API_PURPOSE.md](RUNTIME_PARAM_UPDATE_API_PURPOSE.md) | 이 API의 목적과 설계 철학 |
| [RUNTIME_PARAM_UPDATE_API.md](RUNTIME_PARAM_UPDATE_API.md) | 메서드별 상세 설계 |
| [RUNTIME_PARAM_UPDATE_API_TEST_RESULTS.md](RUNTIME_PARAM_UPDATE_API_TEST_RESULTS.md) | 130개 테스트 결과 |

---

*최종 업데이트: 2026-02-14*
