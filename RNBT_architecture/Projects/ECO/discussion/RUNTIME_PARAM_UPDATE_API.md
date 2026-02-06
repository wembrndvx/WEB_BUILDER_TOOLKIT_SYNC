# Runtime Parameter Update API 설계

## 개요

ECO 컴포넌트(UPS, PDU, CRAC, TempHumiditySensor)의 런타임 파라미터를 안전하게 변경하기 위한 **Public API** 설계 문서.

현재 런타임 수정은 내부 구조(datasetInfo, config)를 직접 조작해야 하며, 특히 metricCode 변경 시 3곳 동기화가 필요하다. 이를 단일 메서드 호출로 캡슐화한다.

### 설계 원칙

1. **컴포넌트별 메서드** — 각 컴포넌트의 config 구조에 맞는 전용 메서드
2. **부분 업데이트** — 인자로 넘긴 값만 변경, `undefined` = 변경 없음
3. **자동 동기화** — 메서드 내부에서 관련 설정(param, chart config, statsKeyMap) 일괄 수정
4. **외부에서 내부 구조를 몰라도 되는 인터페이스**
5. **metricCode ↔ statsKey 강제 쌍** — metricCode 변경 시 statsKey 누락하면 경고 후 무시

### 사용 시점: 등록 시 전용 (config setter)

이 API는 **`initComponent` 직후, `showDetail()` 호출 전**에 사용하는 설정 변경 메서드다. 팝업이 열린 상태에서 호출하지 않는다.

```
initComponent()
  │
  ├─ this.config 초기화
  ├─ this.datasetInfo 생성
  │
  ├─ update API로 config 변경 ← 여기서 호출
  │     this.updateTrendParams({ timeRange: 3600000 });
  │     this.updateUpsTabMetric('voltage', { ... });
  │
  └─ 이후 showDetail() 호출 시 변경된 config로 fetch/render
```

따라서 메서드 내부에 **`fetchDatasetAndRender` 호출이 없다**. 설정만 변경하면 `showDetail()` → `fetchDatasetAndRender` 흐름에서 자연스럽게 반영된다.

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

**수정 범위**: `datasetInfo[metricHistory].param`만 수정

**동기화 불필요**: 렌더링 로직에 영향 없음 (같은 metricCode, 다른 범위/간격)

### Category B: 메트릭 파라미터 (3곳 동기화)

| 설정 위치 | 역할 |
|-----------|------|
| `param.metricCodes` | API에 어떤 메트릭을 요청할지 |
| `config.chart.tabs[]` / `config.chart.series[]` | 응답에서 어떤 메트릭을 필터할지 |
| `config.api.statsKeyMap` | 필터된 데이터에서 어떤 값을 추출할지 |

**수정 범위**: 3곳 모두 수정 → `param.metricCodes`는 chart config에서 재구축

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

**수정 범위**: **모든** `datasetInfo[].param` + 내부 상태(`this._defaultAssetKey` 등) 수정

### Category D: 갱신 제어

| 파라미터 | 설명 |
|----------|------|
| `refreshInterval` | 자동 갱신 주기 변경 |

**수정 범위**: `datasetInfo[].refreshInterval` 수정

---

## API 메서드 설계

### 1. `updateTrendParams(options)` — Category A

모든 컴포넌트 공통. fetch 파라미터만 변경한다.

```javascript
/**
 * 트렌드 차트의 fetch 파라미터를 변경한다.
 * showDetail() 호출 시 변경된 값으로 fetch된다.
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

### 2. `updateUpsTabMetric(tabName, options)` — Category B (UPS)

UPS 전용. 탭의 입/출력 metricCode 쌍을 변경한다.

```javascript
/**
 * UPS 탭의 입/출력 메트릭을 변경한다.
 * metricCode 변경 시 statsKey 필수 — 누락하면 경고 후 무시.
 * 변경 후 param.metricCodes를 chart config에서 재구축한다.
 *
 * @param {string} tabName - 탭 이름 ('current', 'voltage', 'frequency')
 * @param {Object} options
 * @param {string} [options.inputCode]  - 입력 metricCode (변경 시 statsKey 필수)
 * @param {string} [options.outputCode] - 출력 metricCode (변경 시 statsKey 필수)
 * @param {string} [options.statsKey]   - 통계 키 ('avg', 'sum', 'max', ...)
 * @param {string} [options.label]      - 탭 표시 라벨
 * @param {string} [options.unit]       - 단위 ('A', 'V', 'Hz', ...)
 */
function updateUpsTabMetric(tabName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const tab = chart.tabs[tabName];
  if (!tab) return;

  const { inputCode, outputCode, statsKey, label, unit } = options;

  // metricCode 변경 시 statsKey 필수 검증
  if ((inputCode !== undefined || outputCode !== undefined) && statsKey === undefined) {
    console.warn(`[updateUpsTabMetric] metricCode 변경 시 statsKey 필수 (tab: ${tabName})`);
    return;
  }

  // ② chart.tabs 업데이트 + ③ statsKeyMap 업데이트
  if (inputCode !== undefined) {
    tab.inputCode = inputCode;
    this.config.api.statsKeyMap[inputCode] = statsKey;
  }
  if (outputCode !== undefined) {
    tab.outputCode = outputCode;
    this.config.api.statsKeyMap[outputCode] = statsKey;
  }

  // UI 필드 업데이트
  if (label !== undefined) tab.label = label;
  if (unit !== undefined)  tab.unit = unit;

  // ① param.metricCodes — chart config 전체에서 재구축
  rebuildMetricCodes.call(this, trendInfo);
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
// voltage 탭을 배터리 전압으로 교체 (metricCode + statsKey + label + unit)
this.updateUpsTabMetric('voltage', {
  inputCode: 'UPS.BATT_V_IN',
  outputCode: 'UPS.BATT_V_OUT',
  statsKey: 'avg',
  label: '입/출력 배터리전압',
  unit: 'V',
});

// label만 변경 (metricCode 유지 — statsKey 불필요)
this.updateUpsTabMetric('current', { label: '입/출력 전류 (피크)' });
```

---

### 3. `updatePduTabMetric(tabName, options)` — Category B (PDU)

PDU 전용. 탭의 단일 metricCode를 변경한다.

```javascript
/**
 * PDU 탭의 메트릭을 변경한다.
 * metricCode 변경 시 statsKey 필수 — 누락하면 경고 후 무시.
 * PDU는 탭당 단일 metricCode 구조.
 *
 * @param {string} tabName - 탭 이름 ('voltage', 'current', 'power', 'frequency')
 * @param {Object} options
 * @param {string} [options.metricCode] - 메트릭 코드 (변경 시 statsKey 필수)
 * @param {string} [options.statsKey]   - 통계 키
 * @param {string} [options.label]      - 탭 표시 라벨
 * @param {string} [options.unit]       - 단위 ('V', 'A', 'kW', 'Hz', ...)
 * @param {string} [options.color]      - 차트 색상
 * @param {number} [options.scale]      - 값 배율
 */
function updatePduTabMetric(tabName, options) {
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const tab = chart.tabs[tabName];
  if (!tab) return;

  const { metricCode, statsKey, label, unit, color, scale } = options;

  // metricCode 변경 시 statsKey 필수 검증
  if (metricCode !== undefined && statsKey === undefined) {
    console.warn(`[updatePduTabMetric] metricCode 변경 시 statsKey 필수 (tab: ${tabName})`);
    return;
  }

  // ② chart.tabs 업데이트 + ③ statsKeyMap 업데이트
  if (metricCode !== undefined) {
    tab.metricCode = metricCode;
    this.config.api.statsKeyMap[metricCode] = statsKey;
  }

  // UI 필드 업데이트
  if (label !== undefined) tab.label = label;
  if (unit !== undefined)  tab.unit = unit;
  if (color !== undefined) tab.color = color;
  if (scale !== undefined) tab.scale = scale;

  // ① param.metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);
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
// voltage 탭을 선간전압으로 교체
this.updatePduTabMetric('voltage', {
  metricCode: 'DIST.V_LL_AVG',
  statsKey: 'avg',
  label: '선간 전압',
  unit: 'V',
});

// label만 변경 (metricCode 유지 — statsKey 불필요)
this.updatePduTabMetric('power', { label: '유효 전력' });
```

---

### 4. `updateCracSeriesMetric(seriesName, options)` / `updateSensorSeriesMetric(seriesName, options)` — Category B

CRAC / TempHumiditySensor 각각 전용. 고정 시리즈의 metricCode를 변경한다. 내부 구현은 동일하며, 자산 타입별로 분리한다.

```javascript
/**
 * CRAC(또는 Sensor) 시리즈의 메트릭을 변경한다.
 * metricCode 변경 시 statsKey 필수 — 누락하면 경고 후 무시.
 *
 * @param {string} seriesName - 시리즈 이름 ('temp', 'humidity')
 * @param {Object} options
 * @param {string} [options.metricCode] - 메트릭 코드 (변경 시 statsKey 필수)
 * @param {string} [options.statsKey]   - 통계 키
 * @param {number} [options.scale]      - 값 배율
 * @param {string} [options.label]      - 시리즈 표시 라벨
 */
function updateCracSeriesMetric(seriesName, options) {  // Sensor는 updateSensorSeriesMetric
  const { datasetNames, chart } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );
  if (!trendInfo) return;

  const seriesConfig = chart.series[seriesName];
  if (!seriesConfig) return;

  const { metricCode, statsKey, scale, label } = options;

  // metricCode 변경 시 statsKey 필수 검증
  if (metricCode !== undefined && statsKey === undefined) {
    console.warn(`[updateCracSeriesMetric] metricCode 변경 시 statsKey 필수 (series: ${seriesName})`);
    return;
  }

  // ② chart.series 업데이트 + ③ statsKeyMap 업데이트
  if (metricCode !== undefined) {
    seriesConfig.metricCode = metricCode;
    this.config.api.statsKeyMap[metricCode] = statsKey;
  }

  // UI 필드 업데이트
  if (scale !== undefined) seriesConfig.scale = scale;
  if (label !== undefined) seriesConfig.label = label;

  // ① param.metricCodes 재구축
  rebuildMetricCodes.call(this, trendInfo);
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
// CRAC: temp 시리즈를 환기온도로 변경
this.updateCracSeriesMetric('temp', {
  metricCode: 'CRAC.RETURN_TEMP_C',
  statsKey: 'avg',
  scale: 0.1,
  label: '환기온도',
});

// Sensor: scale만 변경 (metricCode 유지 — statsKey 불필요)
this.updateSensorSeriesMetric('humidity', { scale: 0.01 });
```

---

### 5. `updateGlobalParams(options)` — Category C

모든 컴포넌트 공통. 글로벌 파라미터(assetKey, baseUrl, locale)를 변경한다.

```javascript
/**
 * 글로벌 파라미터를 변경한다.
 * 모든 데이터셋의 param에 적용된다.
 * showDetail() 호출 시 변경된 값으로 전체 fetch된다.
 *
 * @param {Object} options
 * @param {string} [options.assetKey] - 대상 장비 식별자
 * @param {string} [options.baseUrl]  - API 서버 주소
 * @param {string} [options.locale]   - 언어 ('ko', 'en', ...)
 */
function updateGlobalParams(options) {
  const { assetKey, baseUrl, locale } = options;

  // 내부 상태 업데이트
  if (assetKey !== undefined) {
    this._defaultAssetKey = assetKey;
  }

  // 모든 데이터셋의 param 변경
  this.datasetInfo.forEach(d => {
    if (assetKey !== undefined) d.param.assetKey = assetKey;
    if (baseUrl !== undefined)  d.param.baseUrl = baseUrl;
    if (locale !== undefined)   d.param.locale = locale;
  });
}
```

**사용 예시**:
```javascript
// 장비만 변경 (기존 switchAsset과 동일)
this.updateGlobalParams({ assetKey: 'UPS_RACK_B_002' });

// 서버 + 장비 변경
this.updateGlobalParams({ baseUrl: '10.23.128.150:8811', assetKey: 'UPS_NEW' });

// 언어만 변경
this.updateGlobalParams({ locale: 'en' });
```

---

### 6. `updateRefreshInterval(datasetName, interval)` — Category D

모든 컴포넌트 공통. 특정 데이터셋의 갱신 주기를 변경한다.

```javascript
/**
 * 특정 데이터셋의 자동 갱신 주기를 변경한다.
 * showDetail() 호출 시 이 값으로 setInterval이 설정된다.
 *
 * @param {string} datasetName - 데이터셋 이름 ('metricHistoryStats', 'metricLatest', ...)
 * @param {number} interval    - 새 갱신 주기 (ms, 0 = 갱신 중지)
 */
function updateRefreshInterval(datasetName, interval) {
  const target = this.datasetInfo.find(d => d.datasetName === datasetName);
  if (!target) return;

  target.refreshInterval = interval;
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
| `updateGlobalParams(options)` | C | 글로벌 파라미터 변경 (assetKey, baseUrl, locale) |
| `updateRefreshInterval(name, ms)` | D | 자동 갱신 주기 변경 |

### 컴포넌트별 메서드

| 컴포넌트 | 메서드 | Category | 인자 |
|----------|--------|----------|------|
| UPS | `updateUpsTabMetric(tab, opts)` | B | `{ inputCode, outputCode, statsKey, label, unit }` |
| PDU | `updatePduTabMetric(tab, opts)` | B | `{ metricCode, statsKey, label, unit, color, scale }` |
| CRAC | `updateCracSeriesMetric(series, opts)` | B | `{ metricCode, statsKey, scale, label }` |
| Sensor | `updateSensorSeriesMetric(series, opts)` | B | `{ metricCode, statsKey, scale, label }` |

---

## 내부 동작 흐름

### Category A: `updateTrendParams`

```
updateTrendParams({ timeRange, interval })
  │
  ├─ trendInfo.param.timeRange = timeRange
  └─ trendInfo.param.interval = interval
```

### Category B: `updateUpsTabMetric` / `updatePduTabMetric` / `update[Crac|Sensor]SeriesMetric`

```
updateUpsTabMetric('voltage', { inputCode, outputCode, statsKey, label, unit })
  │
  ├─ metricCode 변경 시 statsKey 필수 검증 (없으면 return)
  │
  ├─ ②③ inputCode 변경 + statsKeyMap[inputCode] = statsKey
  ├─ ②③ outputCode 변경 + statsKeyMap[outputCode] = statsKey
  │
  ├─ UI: label, unit 업데이트
  │
  └─ ① rebuildMetricCodes(trendInfo)
        └─ codes.length = 0
        └─ tabs 전체 순회 → codes.push(...)
```

### Category C: `updateGlobalParams`

```
updateGlobalParams({ assetKey: 'ASSET_002', baseUrl: '10.23.128.150:8811' })
  │
  ├─ this._defaultAssetKey = 'ASSET_002'
  │
  ├─ datasetInfo[0].param.assetKey = 'ASSET_002'  (assetDetail)
  ├─ datasetInfo[0].param.baseUrl = '10.23.128.150:8811'
  │
  ├─ datasetInfo[1].param.assetKey = 'ASSET_002'  (metricLatest)
  ├─ datasetInfo[1].param.baseUrl = '10.23.128.150:8811'
  │
  ├─ datasetInfo[2].param.assetKey = 'ASSET_002'  (metricHistory)
  └─ datasetInfo[2].param.baseUrl = '10.23.128.150:8811'
```

### Category D: `updateRefreshInterval`

```
updateRefreshInterval('metricHistoryStats', 10000)
  │
  └─ target.refreshInterval = 10000
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

### 1. metricCode 변경 시 statsKey 필수 (코드에서 강제)

metricCode를 변경하면서 statsKey를 누락하면 **경고 후 전체 호출이 무시**된다. statsKeyMap에 매핑이 없는 metricCode는 렌더링 시 `null`을 반환하므로, 이를 코드 레벨에서 방지한다.

```javascript
// ❌ statsKey 누락 → console.warn 출력 후 return (아무 것도 변경되지 않음)
this.updateUpsTabMetric('voltage', { inputCode: 'UPS.NEW_METRIC' });

// ✅ metricCode + statsKey 쌍으로 전달
this.updateUpsTabMetric('voltage', {
  inputCode: 'UPS.NEW_METRIC',
  outputCode: 'UPS.NEW_OUT',
  statsKey: 'avg',
});

// ✅ metricCode 없이 UI 필드만 변경 — statsKey 불필요
this.updateUpsTabMetric('voltage', { label: '배터리 전압', unit: 'V' });
```

### 2. PDU comparison 탭의 특수성

PDU의 `power` 탭은 `comparison: true` 플래그가 있어 금일/전일 비교 fetch를 수행한다. metricCode를 변경해도 comparison 로직 자체는 유지된다.

```javascript
// power 탭의 metricCode 변경 — comparison 패턴은 유지됨
this.updatePduTabMetric('power', {
  metricCode: 'DIST.REACTIVE_POWER_TOTAL_KVAR',
  statsKey: 'avg',
});
```

### 3. tabName / seriesName은 HTML에서 정의

탭 버튼은 HTML 템플릿에서 `data-tab` 속성으로 정의되며, 버튼 텍스트는 비어있다:

```html
<!-- UPS component.html -->
<button class="tab-btn" data-tab="current"></button>
<button class="tab-btn active" data-tab="voltage"></button>
<button class="tab-btn" data-tab="frequency"></button>
```

JS가 `renderInitialLabels`에서 `config.chart.tabs[tabKey].label`을 `btn.textContent`에 채운다:

```javascript
Object.entries(chart.tabs).forEach(([tabKey, cfg]) => {
  const btn = query(`.tab-btn[data-tab="${tabKey}"]`);
  btn.textContent = cfg.label;  // config에서 라벨 주입
});
```

따라서 `data-tab` 속성값(= `tabName`)은 JS config의 `tabs` 객체 key와 **1:1 매칭되는 식별자**이며, 이 API의 첫 번째 인자로 사용된다.

| 변경 사항 | HTML 수정 필요? | API로 충분? |
|-----------|:---------------:|:-----------:|
| 탭 **label/unit/metricCode** 변경 | 불필요 | O |
| 탭 **추가** | **필요** (`<button data-tab="newTab">` 추가) | X |
| 탭 **삭제** | **필요** (해당 `<button>` 제거) | X |
| 탭 **key 변경** (예: `voltage` → `battery`) | **필요** (`data-tab` 값 + config key 양쪽) | X |

> **결론**: 이 API는 **기존 HTML에 정의된 탭의 내용(label, unit, metricCode 등)을 변경**하는 용도다. 탭 자체의 추가/삭제/키 변경은 HTML 수정이 필요하다.

### 4. 등록 시 전용 — 런타임 호출 금지

이 API는 `initComponent` 직후, `showDetail()` 호출 전에만 사용한다. 팝업이 열린 상태(데이터가 fetch되고 setInterval이 동작 중인 상태)에서는 호출하지 않는다.

```javascript
// ✅ 올바른 사용
initComponent(assetInfo, container);
this.updateTrendParams({ timeRange: 3600000 });
this.updateUpsTabMetric('voltage', { inputCode: 'UPS.NEW', statsKey: 'avg' });
// ... 이후 showDetail() 호출

// ❌ 잘못된 사용 — 이미 showDetail() 이후
showDetail();
this.updateTrendParams({ timeRange: 3600000 });  // setInterval/fetch와 충돌 가능
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
this.updateUpsTabMetric = updateUpsTabMetric.bind(this);           // UPS
// this.updatePduTabMetric = updatePduTabMetric.bind(this);       // PDU
// this.updateCracSeriesMetric = updateCracSeriesMetric.bind(this);     // CRAC
// this.updateSensorSeriesMetric = updateSensorSeriesMetric.bind(this); // Sensor
this.updateGlobalParams = updateGlobalParams.bind(this);
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

### 현황카드 API 검토

현재 API는 **트렌드 차트(metricHistory)** 관련만 다룬다. 현황카드(UPS 전력현황, CRAC/Sensor 상태카드)는 3곳 동기화가 불필요하지만, `scale` 등의 프로퍼티 변경을 위해 API를 제공할지 검토 필요.

| 컴포넌트 | config 위치 | 프로퍼티 | API 필요성 |
|----------|------------|---------|-----------|
| UPS | `powerStatus.metrics[key]` | `metricCode`, `scale` | 검토 |
| CRAC | `statusCards.metrics[key]` | `metricCode`, `scale` | 검토 |
| Sensor | `statusCards.metrics[key]` | `metricCode`, `label`, `unit`, `color`, `scale`, `targetValue` | 검토 |

**현황카드가 API 없이도 되는 이유**:
- `metricLatest` API는 자산의 전체 메트릭을 반환 → `param.metricCodes` 없음
- `statsKeyMap` 불필요 → 동기화할 곳이 config 1곳뿐
- 직접 수정해도 실수 여지가 적음: `this.config.powerStatus.metrics.batterySoc.scale = 0.1`

**그래도 API가 있으면 나은 이유**:
- 내부 config 구조를 몰라도 되는 일관된 인터페이스
- 차트 API와 동일한 패턴으로 사용 가능

---

*최종 업데이트: 2026-02-07 — switchAsset → updateGlobalParams로 변경 (Category C 정의와 일치)*
