# 런타임에서 datasetInfo 수정 가이드

## 개요

컴포넌트 초기화 시 `this.datasetInfo`에 데이터셋 정보가 정의된다. 런타임에서 API 파라미터를 변경하려면 이 배열을 직접 수정해야 한다.

> **주의**: `this.config.api.trendParams`를 수정해도 이미 생성된 `datasetInfo`에는 반영되지 않는다.
> 자세한 내용은 [JS_REFERENCE_AND_ASSIGNMENT.md](./JS_REFERENCE_AND_ASSIGNMENT.md) 참조.

---

## datasetInfo 구조

```javascript
// UPS register.js 예시
this.datasetInfo = [
  {
    datasetName: 'assetDetailUnified',
    param: { baseUrl, assetKey, locale: 'ko' },
    render: ['renderBasicInfo']
  },
  {
    datasetName: 'metricLatest',
    param: { baseUrl, assetKey },
    render: ['renderPowerStatus']
  },
  {
    datasetName: 'metricHistoryStats',
    param: {
      baseUrl,
      assetKey,
      interval: '1h',
      metricCodes: ['UPS.INPUT_A_AVG', 'UPS.OUTPUT_A_AVG', ...],
      statsKeys: ['avg'],
      timeFrom: null,
      timeTo: null,
    },
    render: ['renderTrendChart'],
  },
];
```

| 필드 | 설명 |
|------|------|
| `datasetName` | 호출할 데이터셋 이름 |
| `param` | API 요청 파라미터 |
| `render` | 응답 수신 후 호출할 렌더링 함수 목록 |

---

## 런타임에서 파라미터 변경하기

### 1. 특정 datasetInfo 찾기

```javascript
const { datasetNames } = this.config;

// 방법 1: datasetName으로 찾기
const trendInfo = this.datasetInfo.find(
  d => d.datasetName === datasetNames.metricHistory
);

// 방법 2: 인덱스로 접근 (구조가 고정된 경우)
const trendInfo = this.datasetInfo[2];
```

### 2. param 수정하기

```javascript
if (trendInfo) {
  // 단일 값 변경
  trendInfo.param.interval = '5m';

  // 배열 값 변경
  trendInfo.param.metricCodes = ['UPS.BATT_PCT', 'UPS.LOAD_PCT'];

  // 여러 값 한번에 변경
  Object.assign(trendInfo.param, {
    interval: '15m',
    metricCodes: ['UPS.INPUT_V_AVG'],
    statsKeys: ['avg', 'max', 'min'],
  });
}
```

---

## 실전 예시: UPS 트렌드 차트 파라미터 변경

### 시나리오: 사용자가 시간 범위를 1시간으로 변경

```javascript
// 외부에서 호출하는 public method
function setTrendTimeRange(timeRangeMs) {
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );

  if (!trendInfo) {
    console.warn('[UPS] metricHistory datasetInfo not found');
    return;
  }

  // param 수정
  trendInfo.param.timeRange = timeRangeMs;

  // 변경된 파라미터로 데이터 재요청
  fetchTrendData.call(this);
}

// 사용
this.setTrendTimeRange(1 * 60 * 60 * 1000);  // 1시간
```

### 시나리오: 특정 메트릭만 조회하도록 변경

```javascript
function setTrendMetrics(metricCodes) {
  const { datasetNames } = this.config;
  const trendInfo = this.datasetInfo.find(
    d => d.datasetName === datasetNames.metricHistory
  );

  if (!trendInfo) return;

  trendInfo.param.metricCodes = metricCodes;
  fetchTrendData.call(this);
}

// 사용: 전압만 조회
this.setTrendMetrics(['UPS.INPUT_V_AVG', 'UPS.OUTPUT_V_AVG']);
```

### 시나리오: assetKey 변경 (다른 장비 조회)

```javascript
function switchAsset(newAssetKey) {
  // 모든 datasetInfo의 assetKey 업데이트
  this.datasetInfo.forEach(info => {
    if (info.param.assetKey !== undefined) {
      info.param.assetKey = newAssetKey;
    }
  });

  // 내부 상태도 업데이트
  this._defaultAssetKey = newAssetKey;

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
// datasetInfo 조회 헬퍼
function getDatasetInfo(datasetName) {
  return this.datasetInfo.find(d => d.datasetName === datasetName);
}

// param 업데이트 헬퍼
function updateDatasetParam(datasetName, updates) {
  const info = this.datasetInfo.find(d => d.datasetName === datasetName);
  if (info) {
    Object.assign(info.param, updates);
  }
  return info;
}

// 사용
this.updateDatasetParam(datasetNames.metricHistory, {
  interval: '5m',
  metricCodes: ['UPS.BATT_PCT'],
});
```

---

## 주의사항

1. **datasetInfo를 찾지 못할 경우 대비**
   ```javascript
   const info = this.datasetInfo.find(...);
   if (!info) {
     console.warn('datasetInfo not found');
     return;
   }
   ```

2. **param 객체 자체를 교체하지 않기**
   ```javascript
   // ❌ 피해야 할 패턴: render 배열 등 다른 속성 유실
   trendInfo.param = { metricCodes: [...] };

   // ✅ 권장: 기존 param 유지하며 필요한 값만 수정
   trendInfo.param.metricCodes = [...];
   // 또는
   Object.assign(trendInfo.param, { metricCodes: [...] });
   ```

3. **수정 후 데이터 재요청 필요**
   - param만 바꾸면 화면에 반영되지 않음
   - `fetchData()` 또는 `fetchTrendData()` 재호출 필요

---

## 요약

| 작업 | 방법 |
|------|------|
| datasetInfo 찾기 | `this.datasetInfo.find(d => d.datasetName === name)` |
| 단일 값 수정 | `info.param.key = value` |
| 여러 값 수정 | `Object.assign(info.param, { ... })` |
| 데이터 갱신 | 수정 후 fetch 함수 재호출 |
