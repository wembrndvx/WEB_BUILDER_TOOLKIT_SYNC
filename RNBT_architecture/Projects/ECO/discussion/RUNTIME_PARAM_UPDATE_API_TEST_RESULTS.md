# Runtime Parameter Update API — Test Results

테스트 실행일: 2026-02-09
테스트 파일: `test-runtime-param-api.html`

## 요약

| 항목 | 값 |
|------|---:|
| **Total** | 58 |
| **Pass** | 58 |
| **Fail** | 0 |

---

## Category A: `updateTrendParams` — 28 tests (4 components x 7)

모든 컴포넌트(UPS, PDU, CRAC, Sensor) 공통. fetch 파라미터만 변경한다.

### A-1. timeRange만 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateTrendParams({ timeRange: 3600000 });
```

**검증**:
- `trendInfo.param.timeRange === 3600000`
- `trendInfo.param.interval === '1h'` (기존값 유지)

---

### A-2. interval만 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateTrendParams({ interval: '5m' });
```

**검증**:
- `trendInfo.param.interval === '5m'`
- `trendInfo.param.timeRange === 86400000` (기존값 유지)

---

### A-3. apiEndpoint만 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateTrendParams({ apiEndpoint: '/api/v2/mhs/l' });
```

**검증**:
- `trendInfo.param.apiEndpoint === '/api/v2/mhs/l'`

---

### A-4. timeField만 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateTrendParams({ timeField: 'eventedAt' });
```

**검증**:
- `trendInfo.param.timeField === 'eventedAt'`

---

### A-5. 복수 파라미터 동시 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateTrendParams({
  timeRange: 7200000,
  interval: '15m',
  apiEndpoint: '/api/v3',
  timeField: 'ts',
});
```

**검증**:
- `trendInfo.param.timeRange === 7200000`
- `trendInfo.param.interval === '15m'`
- `trendInfo.param.apiEndpoint === '/api/v3'`
- `trendInfo.param.timeField === 'ts'`

---

### A-6. undefined 전달 시 기존값 유지

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateTrendParams({});
```

**검증**:
- 모든 param 필드가 호출 전과 동일

---

### A-7. trendInfo 없을 때 에러 없이 무시

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
// metricHistoryStats 데이터셋 제거 후 호출
ctx.datasetInfo = ctx.datasetInfo.filter(
  d => d.datasetName !== ctx.config.datasetNames.metricHistory
);
ctx.updateTrendParams({ timeRange: 999 });
```

**검증**:
- 에러 없이 함수 종료

---

## Category B-1: `updateUpsTabMetric` — 8 tests (UPS 전용)

UPS 전용. 탭의 입/출력 metricCode 쌍을 변경한다.

### B-1-1. inputCode + outputCode + statsKey → 3곳 동기화

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('voltage', {
  inputCode: 'UPS.BATT_V_IN',
  outputCode: 'UPS.BATT_V_OUT',
  statsKey: 'avg',
});
```

**검증**:
- `tabs.voltage.inputCode === 'UPS.BATT_V_IN'`
- `tabs.voltage.outputCode === 'UPS.BATT_V_OUT'`
- `statsKeyMap['UPS.BATT_V_IN'] === 'avg'`
- `statsKeyMap['UPS.BATT_V_OUT'] === 'avg'`
- `metricCodes` 에 `'UPS.BATT_V_IN'`, `'UPS.BATT_V_OUT'` 포함

---

### B-1-2. inputCode만 + statsKey → inputCode만 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('voltage', {
  inputCode: 'UPS.NEW_INPUT',
  statsKey: 'max',
});
```

**검증**:
- `tabs.voltage.inputCode === 'UPS.NEW_INPUT'`
- `tabs.voltage.outputCode === 'UPS.OUTPUT_V_AVG'` (기존값 유지)
- `statsKeyMap['UPS.NEW_INPUT'] === 'max'`

---

### B-1-3. outputCode만 + statsKey → outputCode만 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('current', {
  outputCode: 'UPS.NEW_OUTPUT',
  statsKey: 'sum',
});
```

**검증**:
- `tabs.current.outputCode === 'UPS.NEW_OUTPUT'`
- `tabs.current.inputCode === 'UPS.INPUT_A_SUM'` (기존값 유지)
- `statsKeyMap['UPS.NEW_OUTPUT'] === 'sum'`

---

### B-1-4. label만 변경 (statsKey 불필요)

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('voltage', { label: '배터리 전압' });
```

**검증**:
- `tabs.voltage.label === '배터리 전압'`
- `tabs.voltage.inputCode` 기존값 유지

---

### B-1-5. unit만 변경 (statsKey 불필요)

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('frequency', { unit: 'kHz' });
```

**검증**:
- `tabs.frequency.unit === 'kHz'`

---

### B-1-6. metricCode 변경 + statsKey 누락 → warn + 무시

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('voltage', {
  inputCode: 'UPS.SHOULD_NOT_APPLY',
});
// ❌ statsKey 누락
```

**검증**:
- `console.warn` 에 `'[updateUpsTabMetric]'` 포함
- `tabs.voltage.inputCode` 변경 안 됨 (기존값 유지)

---

### B-1-7. 존재하지 않는 tabName → 무시

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('nonexistent', { label: 'test' });
```

**검증**:
- 에러 없이 함수 종료

---

### B-1-8. rebuildMetricCodes 후 metricCodes 정확성

| Component | Result |
|-----------|--------|
| UPS | PASS |

```javascript
ctx.updateUpsTabMetric('voltage', {
  inputCode: 'UPS.NEW_V_IN',
  outputCode: 'UPS.NEW_V_OUT',
  statsKey: 'avg',
});
```

**검증**:
- `metricCodes.length === 6` (3탭 x 2코드)
- `'UPS.NEW_V_IN'` 포함, `'UPS.NEW_V_OUT'` 포함
- `'UPS.INPUT_V_AVG'` 제거됨, `'UPS.OUTPUT_V_AVG'` 제거됨
- `'UPS.INPUT_A_SUM'` 유지 (current 탭)
- `'UPS.INPUT_F_AVG'` 유지 (frequency 탭)

---

## Category B-2: `updatePduTabMetric` — 8 tests (PDU 전용)

PDU 전용. 탭의 단일 metricCode를 변경한다.

### B-2-1. metricCode + statsKey → 3곳 동기화

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('voltage', {
  metricCode: 'DIST.V_LL_AVG',
  statsKey: 'avg',
});
```

**검증**:
- `tabs.voltage.metricCode === 'DIST.V_LL_AVG'`
- `statsKeyMap['DIST.V_LL_AVG'] === 'avg'`
- `metricCodes` 에 `'DIST.V_LL_AVG'` 포함
- `metricCodes` 에 `'DIST.V_LN_AVG'` 제거됨

---

### B-2-2. label만 변경

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('voltage', { label: '선간 전압' });
```

**검증**:
- `tabs.voltage.label === '선간 전압'`
- `tabs.voltage.metricCode === 'DIST.V_LN_AVG'` (기존값 유지)

---

### B-2-3. unit만 변경

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('current', { unit: 'mA' });
```

**검증**:
- `tabs.current.unit === 'mA'`

---

### B-2-4. color만 변경

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('voltage', { color: '#ff0000' });
```

**검증**:
- `tabs.voltage.color === '#ff0000'`

---

### B-2-5. scale만 변경

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('power', { scale: 0.001 });
```

**검증**:
- `tabs.power.scale === 0.001`

---

### B-2-6. metricCode 변경 + statsKey 누락 → warn + 무시

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('voltage', {
  metricCode: 'DIST.SHOULD_NOT',
});
// ❌ statsKey 누락
```

**검증**:
- `console.warn` 에 `'[updatePduTabMetric]'` 포함
- `tabs.voltage.metricCode` 변경 안 됨

---

### B-2-7. 존재하지 않는 tabName → 무시

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('nonexistent', { label: 'test' });
```

**검증**:
- 에러 없이 함수 종료

---

### B-2-8. comparison 탭(power) metricCode 변경 → comparison 유지

| Component | Result |
|-----------|--------|
| PDU | PASS |

```javascript
ctx.updatePduTabMetric('power', {
  metricCode: 'DIST.REACTIVE_POWER',
  statsKey: 'avg',
});
```

**검증**:
- `tabs.power.metricCode === 'DIST.REACTIVE_POWER'`
- `tabs.power.comparison === true` (유지)
- `tabs.power.series.today.label === '금일'` (유지)

---

## Category B-3: `updateCracSeriesMetric` — 5 tests (CRAC 전용)

CRAC 전용. 고정 시리즈의 metricCode를 변경한다.

### B-3-1. metricCode + statsKey → 3곳 동기화

| Component | Result |
|-----------|--------|
| CRAC | PASS |

```javascript
ctx.updateCracSeriesMetric('temp', {
  metricCode: 'CRAC.SUPPLY_TEMP',
  statsKey: 'avg',
});
```

**검증**:
- `series.temp.metricCode === 'CRAC.SUPPLY_TEMP'`
- `statsKeyMap['CRAC.SUPPLY_TEMP'] === 'avg'`
- `metricCodes` 에 `'CRAC.SUPPLY_TEMP'` 포함
- `metricCodes` 에 `'CRAC.RETURN_TEMP'` 제거됨

---

### B-3-2. scale만 변경

| Component | Result |
|-----------|--------|
| CRAC | PASS |

```javascript
ctx.updateCracSeriesMetric('temp', { scale: 1.0 });
```

**검증**:
- `series.temp.scale === 1.0`
- `series.temp.metricCode === 'CRAC.RETURN_TEMP'` (기존값 유지)

---

### B-3-3. label만 변경

| Component | Result |
|-----------|--------|
| CRAC | PASS |

```javascript
ctx.updateCracSeriesMetric('humidity', { label: '상대습도' });
```

**검증**:
- `series.humidity.label === '상대습도'`

---

### B-3-4. metricCode 변경 + statsKey 누락 → warn + 무시

| Component | Result |
|-----------|--------|
| CRAC | PASS |

```javascript
ctx.updateCracSeriesMetric('temp', {
  metricCode: 'CRAC.SHOULD_NOT',
});
// ❌ statsKey 누락
```

**검증**:
- `console.warn` 에 `'[updateCracSeriesMetric]'` 포함
- `series.temp.metricCode` 변경 안 됨

---

### B-3-5. 존재하지 않는 seriesName → 무시

| Component | Result |
|-----------|--------|
| CRAC | PASS |

```javascript
ctx.updateCracSeriesMetric('nonexistent', { label: 'test' });
```

**검증**:
- 에러 없이 함수 종료

---

## Category B-4: `updateSensorSeriesMetric` — 5 tests (Sensor 전용)

TempHumiditySensor 전용. 고정 시리즈의 metricCode를 변경한다.

### B-4-1. metricCode + statsKey → 3곳 동기화

| Component | Result |
|-----------|--------|
| Sensor | PASS |

```javascript
ctx.updateSensorSeriesMetric('temp', {
  metricCode: 'SENSOR.TEMP_EXT',
  statsKey: 'max',
});
```

**검증**:
- `series.temp.metricCode === 'SENSOR.TEMP_EXT'`
- `statsKeyMap['SENSOR.TEMP_EXT'] === 'max'`
- `metricCodes` 에 `'SENSOR.TEMP_EXT'` 포함
- `metricCodes` 에 `'SENSOR.TEMP'` 제거됨

---

### B-4-2. scale만 변경

| Component | Result |
|-----------|--------|
| Sensor | PASS |

```javascript
ctx.updateSensorSeriesMetric('humidity', { scale: 0.01 });
```

**검증**:
- `series.humidity.scale === 0.01`
- `series.humidity.metricCode === 'SENSOR.HUMIDITY'` (기존값 유지)

---

### B-4-3. label만 변경

| Component | Result |
|-----------|--------|
| Sensor | PASS |

```javascript
ctx.updateSensorSeriesMetric('temp', { label: '외기온도' });
```

**검증**:
- `series.temp.label === '외기온도'`

---

### B-4-4. metricCode 변경 + statsKey 누락 → warn + 무시

| Component | Result |
|-----------|--------|
| Sensor | PASS |

```javascript
ctx.updateSensorSeriesMetric('temp', {
  metricCode: 'SENSOR.SHOULD_NOT',
});
// ❌ statsKey 누락
```

**검증**:
- `console.warn` 에 `'[updateSensorSeriesMetric]'` 포함
- `series.temp.metricCode` 변경 안 됨

---

### B-4-5. 존재하지 않는 seriesName → 무시

| Component | Result |
|-----------|--------|
| Sensor | PASS |

```javascript
ctx.updateSensorSeriesMetric('nonexistent', { label: 'test' });
```

**검증**:
- 에러 없이 함수 종료

---

## Category C: `updateGlobalParams` — 20 tests (4 components x 5)

모든 컴포넌트 공통. 글로벌 파라미터(assetKey, baseUrl, locale)를 변경한다.

### C-1. assetKey만 변경 → 내부상태 + 전체 datasetInfo

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateGlobalParams({ assetKey: 'NEW_ASSET' });
```

**검증**:
- `ctx._defaultAssetKey === 'NEW_ASSET'`
- 모든 `datasetInfo[i].param.assetKey === 'NEW_ASSET'`
- `ctx._baseUrl === '10.23.128.140:8811'` (기존값 유지)
- `ctx._locale === 'ko'` (기존값 유지)

---

### C-2. baseUrl만 변경 → 내부상태 + 전체 datasetInfo

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateGlobalParams({ baseUrl: '192.168.1.100:9090' });
```

**검증**:
- `ctx._baseUrl === '192.168.1.100:9090'`
- 모든 `datasetInfo[i].param.baseUrl === '192.168.1.100:9090'`
- `ctx._defaultAssetKey` 기존값 유지

---

### C-3. locale만 변경 → 내부상태 + 전체 datasetInfo

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateGlobalParams({ locale: 'en' });
```

**검증**:
- `ctx._locale === 'en'`
- 모든 `datasetInfo[i].param.locale === 'en'`

---

### C-4. 3개 동시 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateGlobalParams({
  assetKey: 'ALL_NEW',
  baseUrl: '10.0.0.1:8080',
  locale: 'ja',
});
```

**검증**:
- `ctx._defaultAssetKey === 'ALL_NEW'`
- `ctx._baseUrl === '10.0.0.1:8080'`
- `ctx._locale === 'ja'`
- 모든 `datasetInfo[i].param` 에 3개 값 모두 반영

---

### C-5. undefined 전달 시 기존값 유지

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateGlobalParams({});
```

**검증**:
- `ctx._defaultAssetKey` 기존값 유지
- `ctx._baseUrl` 기존값 유지
- `ctx._locale` 기존값 유지

---

## Category D: `updateRefreshInterval` — 12 tests (4 components x 3)

모든 컴포넌트 공통. 특정 데이터셋의 갱신 주기를 변경한다.

### D-1. 유효한 datasetName → refreshInterval 변경

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateRefreshInterval('metricHistoryStats', 10000);
```

**검증**:
- `target.refreshInterval === 10000`

---

### D-2. interval = 0 → 갱신 중지

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateRefreshInterval('metricHistoryStats', 0);
```

**검증**:
- `target.refreshInterval === 0`

---

### D-3. 존재하지 않는 datasetName → 무시

| Component | Result |
|-----------|--------|
| UPS | PASS |
| PDU | PASS |
| CRAC | PASS |
| Sensor | PASS |

```javascript
ctx.updateRefreshInterval('nonExistentDataset', 9999);
```

**검증**:
- 에러 없이 함수 종료

---

*테스트 실행 파일: `test-runtime-param-api.html`*
*최종 업데이트: 2026-02-09*
