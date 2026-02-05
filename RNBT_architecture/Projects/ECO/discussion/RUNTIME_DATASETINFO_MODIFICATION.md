# 런타임에서 datasetInfo 수정 가이드

## 개요

컴포넌트 초기화 시 `this.datasetInfo`에 데이터셋 정보가 정의된다. 런타임에서 API 파라미터를 변경하려면 이 배열을 직접 수정해야 한다.

> **주의**: `this.config.api.trendParams`를 수정해도 이미 생성된 `datasetInfo`에는 반영되지 않는다.
> 자세한 내용은 [JS_REFERENCE_AND_ASSIGNMENT.md](./JS_REFERENCE_AND_ASSIGNMENT.md) 참조.

---

## datasetInfo 구조

```javascript
// UPS register.js 예시 (리팩토링 후)
const { datasetNames, api } = this.config;
const baseParam = { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey, locale: this._locale };

this.datasetInfo = [
  { datasetName: datasetNames.assetDetail, param: { ...baseParam }, render: ['renderBasicInfo'] },
  { datasetName: datasetNames.metricLatest, param: { ...baseParam }, render: ['renderPowerStatus'] },
  { datasetName: datasetNames.metricHistory, param: { ...baseParam, ...api.trendParams }, render: ['renderTrendChart'] },
];

// api.trendParams 구조
api: {
  trendHistory: '/api/v1/mhs/l',
  trendParams: {
    interval: '1h',
    timeRange: 24 * 60 * 60 * 1000,  // 24시간 (ms)
    metricCodes: ['UPS.INPUT_A_AVG', 'UPS.OUTPUT_A_AVG', ...],
    statsKeys: ['avg'],
  },
}
```

> **참고**: `timeFrom`, `timeTo`는 param에 포함되지 않고 `fetchTrendData`에서 `timeRange` 기반으로 동적 계산된다.

| 필드 | 설명 |
|------|------|
| `datasetName` | 호출할 데이터셋 이름 |
| `param` | API 요청 파라미터 |
| `render` | 응답 수신 후 호출할 렌더링 함수 목록 |

---

## 런타임에서 파라미터 변경하기

### 중요: 트렌드 파라미터 vs 기본 파라미터

리팩토링된 구조에서 파라미터는 두 곳에서 관리됩니다:

| 파라미터 종류 | 저장 위치 | 수정 방법 |
|--------------|----------|----------|
| 트렌드 관련 (timeRange, interval, metricCodes, statsKeys) | `this.config.api.trendParams` | `api.trendParams` 직접 수정 |
| 기본 정보 (assetKey, baseUrl, locale) | `this.datasetInfo[].param` | `datasetInfo[].param` 또는 내부 상태 변수 수정 |

> **주의**: `datasetInfo`의 `param`은 초기화 시 spread 연산자로 **복사**된 값입니다.
> `api.trendParams`를 수정해도 이미 복사된 `param`에는 반영되지 않고,
> 반대로 `param`을 수정해도 `api.trendParams`에는 영향이 없습니다.

### 1. 트렌드 파라미터 변경 (권장)

`fetchTrendData`는 `this.config.api.trendParams`를 직접 사용하므로, 트렌드 관련 파라미터는 여기서 수정해야 합니다.

```javascript
const { api } = this.config;

// 단일 값 변경
api.trendParams.interval = '5m';

// 배열 값 변경
api.trendParams.metricCodes = ['UPS.BATT_PCT', 'UPS.LOAD_PCT'];

// 여러 값 한번에 변경
Object.assign(api.trendParams, {
  interval: '15m',
  timeRange: 1 * 60 * 60 * 1000,  // 1시간
  metricCodes: ['UPS.INPUT_V_AVG'],
  statsKeys: ['avg', 'max', 'min'],
});
```

### 2. 기본 파라미터 변경 (datasetInfo.param)

assetKey, baseUrl, locale 등 기본 파라미터는 `datasetInfo[].param`에서 직접 수정합니다.

```javascript
const { datasetNames } = this.config;

// 특정 datasetInfo 찾기
const trendInfo = this.datasetInfo.find(
  d => d.datasetName === datasetNames.metricHistory
);

// 또는 인덱스로 접근 (구조가 고정된 경우)
const trendInfo = this.datasetInfo[2];

if (trendInfo) {
  // 기본 파라미터 수정
  trendInfo.param.assetKey = 'NEW_ASSET_KEY';
}
```

---

## 실전 예시: UPS 트렌드 차트 파라미터 변경

### 시나리오: 사용자가 시간 범위를 1시간으로 변경

```javascript
// 외부에서 호출하는 public method
function setTrendTimeRange(timeRange) {
  const { api } = this.config;

  // api.trendParams 수정 (fetchTrendData가 이 값을 사용)
  api.trendParams.timeRange = timeRange;

  // 변경된 파라미터로 데이터 재요청
  fetchTrendData.call(this);
}

// 사용
this.setTrendTimeRange(1 * 60 * 60 * 1000);  // 1시간
```

### 시나리오: 특정 메트릭만 조회하도록 변경

```javascript
function setTrendMetrics(metricCodes) {
  const { api } = this.config;

  // api.trendParams 수정
  api.trendParams.metricCodes = metricCodes;

  // 변경된 파라미터로 데이터 재요청
  fetchTrendData.call(this);
}

// 사용: 전압만 조회
this.setTrendMetrics(['UPS.INPUT_V_AVG', 'UPS.OUTPUT_V_AVG']);
```

### 시나리오: assetKey 변경 (다른 장비 조회)

assetKey는 기본 파라미터이므로 `datasetInfo[].param`에서 수정합니다.

```javascript
function switchAsset(newAssetKey) {
  // 내부 상태 업데이트
  this._defaultAssetKey = newAssetKey;

  // 모든 datasetInfo의 assetKey 업데이트
  this.datasetInfo.forEach(info => {
    if (info.param.assetKey !== undefined) {
      info.param.assetKey = newAssetKey;
    }
  });

  // 팝업이 열려있으면 새 데이터로 갱신
  if (this._popupVisible) {
    this.showDetail();
  }
}
```

---

## 헬퍼 함수 패턴

자주 사용한다면 헬퍼 함수로 추출:

```javascript
// 트렌드 파라미터 업데이트 헬퍼
function updateTrendParams(updates) {
  const { api } = this.config;
  Object.assign(api.trendParams, updates);
}

// datasetInfo 조회 헬퍼
function getDatasetInfo(datasetName) {
  return this.datasetInfo.find(d => d.datasetName === datasetName);
}

// 기본 param 업데이트 헬퍼 (assetKey, baseUrl, locale 등)
function updateDatasetParam(datasetName, updates) {
  const info = this.datasetInfo.find(d => d.datasetName === datasetName);
  if (info) {
    Object.assign(info.param, updates);
  }
  return info;
}

// 사용 예시
// 트렌드 파라미터 변경
this.updateTrendParams({
  interval: '5m',
  metricCodes: ['UPS.BATT_PCT'],
});
fetchTrendData.call(this);

// 기본 파라미터 변경 (전체 datasetInfo)
this.datasetInfo.forEach(info => {
  info.param.assetKey = 'NEW_ASSET_KEY';
});
```

---

## 주의사항

1. **트렌드 파라미터는 api.trendParams에서 수정**
   ```javascript
   // ❌ 잘못된 패턴: datasetInfo.param 수정 (fetchTrendData가 사용하지 않음)
   trendInfo.param.timeRange = 3600000;

   // ✅ 올바른 패턴: api.trendParams 수정
   this.config.api.trendParams.timeRange = 3600000;
   ```

2. **객체 자체를 교체하지 않기**
   ```javascript
   // ❌ 피해야 할 패턴: 다른 속성 유실
   trendInfo.param = { assetKey: 'NEW_KEY' };
   api.trendParams = { timeRange: 3600000 };

   // ✅ 권장: 기존 객체 유지하며 필요한 값만 수정
   trendInfo.param.assetKey = 'NEW_KEY';
   api.trendParams.timeRange = 3600000;
   // 또는
   Object.assign(api.trendParams, { timeRange: 3600000 });
   ```

3. **수정 후 데이터 재요청 필요**
   - 파라미터만 바꾸면 화면에 반영되지 않음
   - `fetchData()` 또는 `fetchTrendData()` 재호출 필요

4. **spread 복사로 인한 독립성 이해**
   ```javascript
   // 초기화 시 spread로 복사됨
   this.datasetInfo = [
     { param: { ...baseParam, ...api.trendParams }, ... }
   ];

   // 이후 api.trendParams를 수정해도 이미 복사된 param에는 영향 없음
   // 반대로 param을 수정해도 api.trendParams에는 영향 없음
   ```

---

## 요약

| 작업 | 방법 |
|------|------|
| 트렌드 파라미터 수정 | `this.config.api.trendParams.key = value` |
| 기본 파라미터 수정 | `datasetInfo[].param.key = value` |
| 여러 값 수정 | `Object.assign(targetObject, { ... })` |
| 데이터 갱신 | 수정 후 `fetchData()` 또는 `fetchTrendData()` 재호출 |
| datasetInfo 찾기 | `this.datasetInfo.find(d => d.datasetName === name)` |

### 파라미터 분류

| 파라미터 | 수정 위치 | 사용처 |
|---------|----------|--------|
| `timeRange`, `interval`, `metricCodes`, `statsKeys` | `api.trendParams` | `fetchTrendData` |
| `assetKey`, `baseUrl`, `locale` | `datasetInfo[].param` | 모든 fetch 함수 |
