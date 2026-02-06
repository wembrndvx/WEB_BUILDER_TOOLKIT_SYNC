# Runtime Parameter Update API 설계

## 개요

ECO 컴포넌트(UPS, PDU, CRAC, TempHumiditySensor)의 런타임 파라미터를 안전하게 변경하기 위한 **Public API** 설계 문서.

현재 런타임 수정은 내부 구조(datasetInfo, config)를 직접 조작해야 하며, 특히 metricCode 변경 시 3곳 동기화가 필요하다([RUNTIME_DATASETINFO_MODIFICATION.md](./RUNTIME_DATASETINFO_MODIFICATION.md) 참조). 이를 단일 메서드 호출로 캡슐화한다.

### 설계 원칙

1. **컴포넌트별 메서드** — 각 컴포넌트의 config 구조에 맞는 전용 메서드
2. **부분 업데이트** — 인자로 넘긴 값만 변경, `undefined` = 변경 없음
3. **자동 동기화** — 메서드 내부에서 관련 설정 일괄 수정 + 자동 재요청
4. **외부에서 내부 구조를 몰라도 되는 인터페이스**

---

## 현재 파라미터 전체 맵

### datasetInfo[].param의 구성

```
param = {
  // ── baseParam (전 데이터셋 공통) ──
  baseUrl:      '10.23.128.140:8811',     // API 서버 주소
  assetKey:     'ASSET_001',              // 대상 장비 식별자
  locale:       'ko',                     // 언어

  // ── trendParams (metricHistory 전용, 스프레드로 복사됨) ──
  interval:     '1h',                     // 집계 간격
  timeRange:    86400000,                 // 시간 범위 (ms)
  metricCodes:  ['UPS.INPUT_V_AVG', ...], // 요청 메트릭 목록
  statsKeys:    [],                       // (현재 미사용)
  timeField:    'time',                   // 시간 필드명
  apiEndpoint:  '/api/v1/mhs/l',          // API 경로

  // ── 동적 생성 (fetch 직전 계산) ──
  timeFrom:     '2026-02-06 00:00:00',    // timeRange로부터 계산
  timeTo:       '2026-02-06 23:59:59',    // 현재 시각
}
```

### config에서 렌더링 시 참조하는 설정

```
config.api.statsKeyMap     — metricCode → statsKey 매핑 (값 추출)
config.chart.tabs          — 탭별 metricCode 필터 (UPS, PDU)
config.chart.series        — 시리즈별 metricCode 필터 (CRAC, Sensor)
```

### datasetInfo 메타 정보

```
datasetInfo[].refreshInterval  — 자동 갱신 주기 (ms, 0 = 1회성)
datasetInfo[].render           — 렌더링 함수 목록
datasetInfo[]._intervalId      — setInterval ID (내부 관리)
```

---

## 파라미터 카테고리

변경 시 동기화 범위에 따라 4개 카테고리로 분류한다.

### Category A: Trend Fetch 파라미터 (param만 수정)

| 파라미터 | 설명 | 현재 기본값 |
|----------|------|------------|
| `timeRange` | 조회 시간 범위 (ms) | `86400000` (24h) |
| `interval` | 집계 간격 | `'1h'` |
| `apiEndpoint` | API 엔드포인트 | `'/api/v1/mhs/l'` |
| `timeField` | 시간 필드명 | `'time'` |

**수정 범위**: `datasetInfo[metricHistory].param`만 수정 → `fetchDatasetAndRender` 호출

**동기화 불필요**: 렌더링 로직에 영향 없음 (같은 metricCode, 다른 범위/간격)

### Category B: 메트릭 파라미터 (3곳 동기화)

| 설정 위치 | 역할 |
|-----------|------|
| `param.metricCodes` | API에 어떤 메트릭을 요청할지 |
| `config.chart.tabs[]` / `config.chart.series[]` | 응답에서 어떤 메트릭을 필터할지 |
| `config.api.statsKeyMap` | 필터된 데이터에서 어떤 값을 추출할지 |

**수정 범위**: 3곳 모두 수정 → `param.metricCodes`는 chart config에서 재구축 → `fetchDatasetAndRender` 호출

**컴포넌트별 chart config 구조 차이**:

| 컴포넌트 | chart config | metricCode 위치 |
|----------|-------------|----------------|
| UPS | `chart.tabs[tabName]` | `.inputCode` / `.outputCode` (쌍) |
| PDU | `chart.tabs[tabName]` | `.metricCode` (단일) |
| CRAC | `chart.series[name]` | `.metricCode` (단일) |
| Sensor | `chart.series[name]` | `.metricCode` (단일) |

### Category C: 글로벌 파라미터 (전체 데이터셋)

| 파라미터 | 설명 |
|----------|------|
| `assetKey` | 대상 장비 변경 |
| `baseUrl` | API 서버 변경 |
| `locale` | 언어 변경 |

**수정 범위**: **모든** `datasetInfo[].param` + 내부 상태(`this._defaultAssetKey` 등) 수정 → 전체 재요청

### Category D: 갱신 제어

| 파라미터 | 설명 |
|----------|------|
| `refreshInterval` | 자동 갱신 주기 변경 |

**수정 범위**: `datasetInfo[].refreshInterval` 수정 → 기존 `setInterval` 중지 → 새 주기로 재시작

---

## API 메서드 설계

### 1. `updateTrendParams(options)` — Category A

모든 컴포넌트 공통. fetch 파라미터만 변경한다.

```javascript
/**
 * 트렌드 차트의 fetch 파라미터를 변경한다.
 * 변경 후 자동으로 데이터를 재요청한다.
 *
 * @param {Object} options
 * @param {number}  [options.timeRange]    - 조회 시간 범위 (ms)
 * @param {string}  [options.interval]     - 집계 간격 ('1h', '5m', '15m', ...)
 * @param {string}  [options.apiEndpoint]  - API 엔드포인트 경로
 * @param {string}  [options.timeField]    - 시간 필드명
 */
function updateTrendParams(options) {
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  // 전달된 값만 업데이트
  const { timeRange, interval, apiEndpoint, timeField } = options;
  if (timeRange !== undefined)   trendInfo.param.timeRange = timeRange;
  if (interval !== undefined)    trendInfo.param.interval = interval;
  if (apiEndpoint !== undefined) trendInfo.param.apiEndpoint = apiEndpoint;
  if (timeField !== undefined)   trendInfo.param.timeField = timeField;

  fetchDatasetAndRender.call(this, trendInfo);
}
```

**사용 예시**:
```javascript
// 시간 범위를 1시간으로, 간격을 5분으로 변경
this.updateTrendParams({ timeRange: 3600000, interval: '5m' });

// 간격만 변경 (나머지는 유지)
this.updateTrendParams({ interval: '15m' });
```

---

### 2. `updateTabMetrics(tabName, options)` — Category B (UPS)

UPS 전용. 탭의 입/출력 metricCode 쌍을 변경한다.

```javascript
/**
 * 특정 탭의 메트릭을 변경한다.
 * inputCode/outputCode + statsKey를 함께 전달해야 한다.
 * 변경 후 param.metricCodes를 chart config에서 재구축하고 자동 재요청한다.
 *
 * @param {string} tabName - 탭 이름 ('current', 'voltage', 'frequency')
 * @param {Object} options
 * @param {string} [options.inputCode]  - 입력 metricCode
 * @param {string} [options.outputCode] - 출력 metricCode
 * @param {string} [options.statsKey]   - 통계 키 ('avg', 'sum', 'max', ...)
 */
function updateTabMetrics(tabName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const tab = chart.tabs[tabName];
  if (!tab) return;

  const { inputCode, outputCode, statsKey } = options;

  // ② chart.tabs 업데이트
  if (inputCode !== undefined)  tab.inputCode = inputCode;
  if (outputCode !== undefined) tab.outputCode = outputCode;

  // ③ statsKeyMap 업데이트 (변경된 코드에 대해서만)
  if (statsKey !== undefined) {
    if (inputCode !== undefined)  this.config.api.statsKeyMap[inputCode] = statsKey;
    if (outputCode !== undefined) this.config.api.statsKeyMap[outputCode] = statsKey;
  }

  // ① param.metricCodes — chart config 전체에서 재구축
  rebuildMetricCodes.call(this, trendInfo);

  fetchDatasetAndRender.call(this, trendInfo);
}
```

**UPS의 `rebuildMetricCodes` 구현**:

```javascript
function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;  // 참조 유지하며 비우기

  const { tabs } = this.config.chart;
  Object.values(tabs).forEach(tab => {
    if (tab.inputCode && !codes.includes(tab.inputCode))   codes.push(tab.inputCode);
    if (tab.outputCode && !codes.includes(tab.outputCode)) codes.push(tab.outputCode);
  });
}
```

**사용 예시**:
```javascript
// voltage 탭을 다른 메트릭으로 교체
this.updateTabMetrics('voltage', {
  inputCode: 'UPS.BATT_V_IN',
  outputCode: 'UPS.BATT_V_OUT',
  statsKey: 'avg',
});

// current 탭의 statsKey만 변경 (metricCode 유지)
this.updateTabMetrics('current', { statsKey: 'max' });
```

---

### 3. `updateTabMetrics(tabName, options)` — Category B (PDU)

PDU 전용. 탭의 단일 metricCode를 변경한다.

```javascript
/**
 * 특정 탭의 메트릭을 변경한다.
 * PDU는 탭당 단일 metricCode 구조.
 *
 * @param {string} tabName - 탭 이름 ('voltage', 'current', 'power', 'frequency')
 * @param {Object} options
 * @param {string} [options.metricCode] - 메트릭 코드
 * @param {string} [options.statsKey]   - 통계 키
 */
function updateTabMetrics(tabName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const tab = chart.tabs[tabName];
  if (!tab) return;

  const { metricCode, statsKey } = options;

  // ② chart.tabs 업데이트
  if (metricCode !== undefined) tab.metricCode = metricCode;

  // ③ statsKeyMap 업데이트
  if (statsKey !== undefined && metricCode !== undefined) {
    this.config.api.statsKeyMap[metricCode] = statsKey;
  } else if (statsKey !== undefined) {
    // metricCode 미변경 시 기존 코드의 statsKey만 변경
    this.config.api.statsKeyMap[tab.metricCode] = statsKey;
  }

  // ① param.metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);

  fetchDatasetAndRender.call(this, trendInfo);
}
```

**PDU의 `rebuildMetricCodes` 구현**:

```javascript
function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { tabs } = this.config.chart;
  Object.values(tabs).forEach(tab => {
    if (tab.metricCode && !codes.includes(tab.metricCode)) codes.push(tab.metricCode);
  });
}
```

**사용 예시**:
```javascript
// voltage 탭을 다른 메트릭으로 교체
this.updateTabMetrics('voltage', {
  metricCode: 'DIST.V_LL_AVG',
  statsKey: 'avg',
});
```

---

### 4. `updateSeriesMetric(seriesName, options)` — Category B (CRAC, Sensor)

CRAC / TempHumiditySensor 전용. 고정 시리즈의 metricCode를 변경한다.

```javascript
/**
 * 특정 시리즈의 메트릭을 변경한다.
 *
 * @param {string} seriesName - 시리즈 이름 ('temp', 'humidity')
 * @param {Object} options
 * @param {string} [options.metricCode] - 메트릭 코드
 * @param {string} [options.statsKey]   - 통계 키
 * @param {number} [options.scale]      - 값 배율
 */
function updateSeriesMetric(seriesName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const seriesConfig = chart.series[seriesName];
  if (!seriesConfig) return;

  const { metricCode, statsKey, scale } = options;

  // ② chart.series 업데이트
  if (metricCode !== undefined) seriesConfig.metricCode = metricCode;
  if (scale !== undefined)      seriesConfig.scale = scale;

  // ③ statsKeyMap 업데이트
  if (statsKey !== undefined && metricCode !== undefined) {
    this.config.api.statsKeyMap[metricCode] = statsKey;
  } else if (statsKey !== undefined) {
    this.config.api.statsKeyMap[seriesConfig.metricCode] = statsKey;
  }

  // ① param.metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);

  fetchDatasetAndRender.call(this, trendInfo);
}
```

**CRAC/Sensor의 `rebuildMetricCodes` 구현**:

```javascript
function rebuildMetricCodes(trendInfo) {
  const codes = trendInfo.param.metricCodes;
  codes.length = 0;

  const { series } = this.config.chart;
  Object.values(series).forEach(s => {
    if (s.metricCode && !codes.includes(s.metricCode)) codes.push(s.metricCode);
  });
}
```

**사용 예시**:
```javascript
// CRAC: temp 시리즈를 급기온도에서 환기온도로 변경
this.updateSeriesMetric('temp', {
  metricCode: 'CRAC.SUPPLY_TEMP_C',
  statsKey: 'avg',
  scale: 0.1,
});

// Sensor: humidity 시리즈의 statsKey만 변경
this.updateSeriesMetric('humidity', { statsKey: 'max' });
```

---

### 5. `switchAsset(assetKey)` — Category C

모든 컴포넌트 공통. 대상 장비를 전환한다.

```javascript
/**
 * 다른 장비로 전환한다.
 * 모든 데이터셋의 param.assetKey를 변경하고 전체 재요청한다.
 *
 * @param {string} assetKey - 새 장비 식별자
 */
function switchAsset(assetKey) {
  if (!assetKey) return;

  // 내부 상태 업데이트
  this._defaultAssetKey = assetKey;

  // 모든 데이터셋의 param.assetKey 변경
  this.datasetInfo.forEach(d => {
    d.param.assetKey = assetKey;
  });

  // 전체 재요청 (showDetail과 동일한 흐름)
  this.stopRefresh();
  fx.go(
    this.datasetInfo,
    fx.each(d => fetchDatasetAndRender.call(this, d))
  );

  // 갱신 주기 재시작
  fx.go(
    this.datasetInfo,
    fx.filter(d => d.refreshInterval > 0),
    fx.each(d => {
      d._intervalId = setInterval(
        () => fetchDatasetAndRender.call(this, d),
        d.refreshInterval
      );
    })
  );
}
```

**사용 예시**:
```javascript
// 다른 UPS 장비로 전환
this.switchAsset('UPS_RACK_B_002');
```

---

### 6. `updateRefreshInterval(datasetName, interval)` — Category D

모든 컴포넌트 공통. 특정 데이터셋의 갱신 주기를 변경한다.

```javascript
/**
 * 특정 데이터셋의 자동 갱신 주기를 변경한다.
 *
 * @param {string} datasetName - 데이터셋 이름 ('metricHistoryStats', 'metricLatest', ...)
 * @param {number} interval    - 새 갱신 주기 (ms, 0 = 갱신 중지)
 */
function updateRefreshInterval(datasetName, interval) {
  const target = this.datasetInfo.find(d => d.datasetName === datasetName);
  if (!target) return;

  // 기존 interval 정리
  if (target._intervalId) {
    clearInterval(target._intervalId);
    target._intervalId = null;
  }

  target.refreshInterval = interval;

  // 새 interval 설정 (0이면 갱신 중지)
  if (interval > 0) {
    target._intervalId = setInterval(
      () => fetchDatasetAndRender.call(this, target),
      interval
    );
  }
}
```

**사용 예시**:
```javascript
// 트렌드 차트 갱신 주기를 10초로 변경
this.updateRefreshInterval('metricHistoryStats', 10000);

// 전력현황 카드 갱신 중지
this.updateRefreshInterval('metricLatest', 0);
```

---

## 메서드 요약

### 공통 메서드 (4개 컴포넌트 모두)

| 메서드 | Category | 설명 |
|--------|----------|------|
| `updateTrendParams(options)` | A | fetch 파라미터 변경 (timeRange, interval 등) |
| `switchAsset(assetKey)` | C | 대상 장비 전환 |
| `updateRefreshInterval(name, ms)` | D | 자동 갱신 주기 변경 |

### 컴포넌트별 메서드

| 컴포넌트 | 메서드 | Category | 인자 |
|----------|--------|----------|------|
| UPS | `updateTabMetrics(tab, opts)` | B | `{ inputCode, outputCode, statsKey }` |
| PDU | `updateTabMetrics(tab, opts)` | B | `{ metricCode, statsKey }` |
| CRAC | `updateSeriesMetric(series, opts)` | B | `{ metricCode, statsKey, scale }` |
| Sensor | `updateSeriesMetric(series, opts)` | B | `{ metricCode, statsKey, scale }` |

---

## 내부 동작 흐름

### Category A: `updateTrendParams`

```
updateTrendParams({ timeRange, interval })
  │
  ├─ trendInfo.param.timeRange = timeRange
  ├─ trendInfo.param.interval = interval
  │
  └─ fetchDatasetAndRender(trendInfo)
```

### Category B: `updateTabMetrics` / `updateSeriesMetric`

```
updateTabMetrics('voltage', { inputCode, outputCode, statsKey })
  │
  ├─ ② chart.tabs.voltage.inputCode = inputCode
  ├─ ② chart.tabs.voltage.outputCode = outputCode
  │
  ├─ ③ statsKeyMap[inputCode] = statsKey
  ├─ ③ statsKeyMap[outputCode] = statsKey
  │
  ├─ ① rebuildMetricCodes(trendInfo)
  │     └─ codes.length = 0
  │     └─ tabs 전체 순회 → codes.push(...)
  │
  └─ fetchDatasetAndRender(trendInfo)
```

### Category C: `switchAsset`

```
switchAsset('ASSET_002')
  │
  ├─ this._defaultAssetKey = 'ASSET_002'
  │
  ├─ datasetInfo[0].param.assetKey = 'ASSET_002'  (assetDetail)
  ├─ datasetInfo[1].param.assetKey = 'ASSET_002'  (metricLatest)
  ├─ datasetInfo[2].param.assetKey = 'ASSET_002'  (metricHistory)
  │
  ├─ stopRefresh()
  ├─ fetchDatasetAndRender(all)
  └─ setInterval 재설정
```

### Category D: `updateRefreshInterval`

```
updateRefreshInterval('metricHistoryStats', 10000)
  │
  ├─ clearInterval(target._intervalId)
  ├─ target.refreshInterval = 10000
  └─ target._intervalId = setInterval(..., 10000)
```

---

## statsKeyMap 정리 전략

### 문제: 미사용 statsKeyMap 항목

metricCode를 변경하면 이전 코드의 statsKeyMap 항목이 남는다:

```javascript
// 변경 전
statsKeyMap = { 'UPS.INPUT_V_AVG': 'avg', 'UPS.OUTPUT_V_AVG': 'avg' }

// voltage 탭을 'UPS.BATT_V_IN' / 'UPS.BATT_V_OUT'으로 변경 후
statsKeyMap = {
  'UPS.INPUT_V_AVG': 'avg',     // ← 더 이상 사용 안 됨
  'UPS.OUTPUT_V_AVG': 'avg',    // ← 더 이상 사용 안 됨
  'UPS.BATT_V_IN': 'avg',      // ← 새로 추가됨
  'UPS.BATT_V_OUT': 'avg',     // ← 새로 추가됨
}
```

### 선택지

| 방식 | 장점 | 단점 |
|------|------|------|
| **A. 미사용 항목 그대로 둠** | 구현 단순 | 메모리 누수 (미미), 혼란 가능 |
| **B. `rebuildMetricCodes` 후 정리** | 깔끔함 | 다른 곳에서 참조 시 문제 |
| **C. statsKeyMap도 chart config에서 재구축** | 완전 동기화 | chart config에 statsKey 정보 필요 |

### 권장: 방식 A (미사용 항목 유지)

- statsKeyMap에 여분의 키가 있어도 **동작에 영향 없음** (사용하지 않는 키는 무시됨)
- renderTrendChart는 chart config에서 필터한 metricCode에 대해서만 statsKeyMap을 참조
- 정리가 필요한 경우 `rebuildStatsKeyMap` 유틸리티를 별도 제공 가능

---

## 제약사항 및 주의사항

### 1. metricCode와 statsKey는 쌍으로 전달

```javascript
// ❌ statsKey 없이 metricCode만 변경 → 해당 메트릭의 값이 null
this.updateTabMetrics('voltage', { inputCode: 'UPS.NEW_METRIC' });

// ✅ statsKey 함께 전달
this.updateTabMetrics('voltage', {
  inputCode: 'UPS.NEW_METRIC',
  statsKey: 'avg',
});
```

> **예외**: 이미 statsKeyMap에 해당 코드가 등록되어 있는 경우 (예: 다른 탭에서 동일 코드를 사용 중)는 statsKey 생략 가능

### 2. PDU comparison 탭의 특수성

PDU의 `power` 탭은 `comparison: true` 플래그가 있어 금일/전일 비교 fetch를 수행한다. metricCode를 변경해도 comparison 로직 자체는 유지된다.

```javascript
// power 탭의 metricCode 변경 — comparison 패턴은 유지됨
this.updateTabMetrics('power', {
  metricCode: 'DIST.REACTIVE_POWER_TOTAL_KVAR',
  statsKey: 'avg',
});
```

### 3. 탭 전환과의 관계

`updateTabMetrics`는 현재 보고 있는 탭과 관계없이 config를 변경한다. 변경 후 `fetchDatasetAndRender`가 호출되면 **현재 `_activeTab`에 해당하는 데이터만 렌더링**된다.

따라서:
- 현재 보고 있는 탭의 메트릭을 변경하면 → 즉시 차트 갱신
- 다른 탭의 메트릭을 변경하면 → 해당 탭으로 전환 시 변경된 데이터 표시

### 4. switchAsset은 UI 상태도 초기화해야 할 수 있음

장비 전환 시 이전 장비의 데이터가 일시적으로 표시될 수 있다. 필요에 따라 `switchAsset` 내부에서 캐시 초기화를 추가할 수 있다:

```javascript
// switchAsset 내부에 추가 가능
this._trendData = null;
this._trendDataComparison = null;  // PDU 전용
```

---

## 바인딩 위치

각 메서드는 `initComponent` 내 "6. Public Methods" 섹션에 바인딩한다:

```javascript
// 6. Public Methods
this.showDetail = showDetail.bind(this);
this.hideDetail = hideDetail.bind(this);
this.stopRefresh = stopRefresh.bind(this);

// Runtime Parameter Update API
this.updateTrendParams = updateTrendParams.bind(this);
this.updateTabMetrics = updateTabMetrics.bind(this);     // UPS, PDU
// this.updateSeriesMetric = updateSeriesMetric.bind(this); // CRAC, Sensor
this.switchAsset = switchAsset.bind(this);
this.updateRefreshInterval = updateRefreshInterval.bind(this);
```

---

## 향후 확장 가능성

### statsKeyMap을 chart config에 통합

현재 statsKey는 `config.api.statsKeyMap`에 별도 관리된다. 향후 chart config에 직접 포함하면 2곳 관리로 줄일 수 있다:

```javascript
// 현재: 분리
chart: {
  tabs: {
    voltage: { inputCode: 'UPS.INPUT_V_AVG', outputCode: 'UPS.OUTPUT_V_AVG' },
  },
},
api: {
  statsKeyMap: { 'UPS.INPUT_V_AVG': 'avg', 'UPS.OUTPUT_V_AVG': 'avg' },
}

// 향후: 통합
chart: {
  tabs: {
    voltage: {
      inputCode: 'UPS.INPUT_V_AVG', inputStatsKey: 'avg',
      outputCode: 'UPS.OUTPUT_V_AVG', outputStatsKey: 'avg',
    },
  },
}
```

이 경우 `rebuildStatsKeyMap`도 chart config에서 재구축할 수 있어 완전한 단일 소스가 된다.

### 복합 업데이트 (여러 Category 동시)

여러 카테고리를 한 번에 변경하는 경우 fetch를 중복 호출하지 않도록 배치 업데이트 패턴을 고려할 수 있다:

```javascript
// 현재: 각각 fetch 발생 (2회)
this.updateTrendParams({ timeRange: 3600000 });
this.updateTabMetrics('voltage', { inputCode: 'UPS.NEW', statsKey: 'avg' });

// 향후: 배치 업데이트 (1회만 fetch)
this.batchUpdate(update => {
  update.trendParams({ timeRange: 3600000 });
  update.tabMetrics('voltage', { inputCode: 'UPS.NEW', statsKey: 'avg' });
});
```

이는 현재 단계에서는 불필요하지만, 사용 패턴이 복잡해지면 고려할 수 있다.

---

*최종 업데이트: 2026-02-06 — 초안 작성*
