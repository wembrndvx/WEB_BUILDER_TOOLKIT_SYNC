# JavaScript 참조와 할당: 주소 복사의 이해

## 개요

JavaScript에서 객체나 배열을 변수에 할당할 때, "참조가 연결된다"고 표현하지만 실제 동작은 **생성 시점에 주소값이 복사**되는 것이다. 이 차이를 이해하지 못하면 런타임에서 값을 변경해도 반영되지 않는 문제가 발생한다.

---

## 핵심 개념

### 참조는 "연결"이 아니라 "주소 복사"

```javascript
const original = { metricCodes: ['A', 'B', 'C'] };
const copied = original.metricCodes;  // 주소값 복사
```

이 시점에서 `copied`와 `original.metricCodes`는 **같은 배열의 주소**를 갖는다.

```
original.metricCodes ──┬──▶ ['A', 'B', 'C']  (주소: 0x1234)
copied ────────────────┘
```

---

## 두 가지 시나리오

### 시나리오 1: `=` 할당으로 새 값 지정 (참조 끊김)

```javascript
original.metricCodes = ['X', 'Y'];  // 새로운 배열 할당
```

결과:
```
original.metricCodes ──▶ ['X', 'Y']      (주소: 0x5678) ← 새 배열
copied ────────────────▶ ['A', 'B', 'C']  (주소: 0x1234) ← 원래 배열 그대로
```

**`copied`는 여전히 원래 배열을 가리킨다.** `=` 할당은 주소를 새로 지정하는 것이므로 기존 참조가 끊어진다.

### 시나리오 2: 배열 내용만 수정 (참조 유지)

```javascript
original.metricCodes.length = 0;        // 배열 비우기
original.metricCodes.push('X', 'Y');    // 새 값 추가
```

결과:
```
original.metricCodes ──┬──▶ ['X', 'Y']  (주소: 0x1234) ← 같은 배열, 내용만 변경
copied ────────────────┘
```

**`copied`도 변경된 내용을 본다.** 같은 주소를 공유하기 때문이다.

---

## 실제 사례: datasetInfo의 스프레드 초기화 패턴

### 현재 코드 구조

ECO 컴포넌트(UPS, CRAC, TempHumiditySensor, PDU)는 스프레드 연산자로 datasetInfo를 초기화한다:

```javascript
const { datasetNames, api } = this.config;
const baseParam = { baseUrl: this._baseUrl, assetKey: this._defaultAssetKey, locale: this._locale };

this.datasetInfo = [
  { datasetName: datasetNames.assetDetail,  param: { ...baseParam }, render: ['renderBasicInfo'],   refreshInterval: 0 },
  { datasetName: datasetNames.metricLatest, param: { ...baseParam }, render: ['renderPowerStatus'], refreshInterval: 5000 },
  { datasetName: datasetNames.metricHistory, param: { ...baseParam, ...api.trendParams, apiEndpoint: api.trendHistory }, render: ['renderTrendChart'], refreshInterval: 5000 },
];
```

### 스프레드의 얕은 복사 특성

`{ ...api.trendParams }`는 **얕은 복사(shallow copy)**다. 1단계 프로퍼티만 복사되며, 값의 타입에 따라 동작이 다르다:

```javascript
// api.trendParams 원본
api.trendParams = {
  metricCodes: ['UPS.INPUT_V_AVG', 'UPS.INPUT_A_SUM'],  // 배열 (참조 타입)
  statsKeys: [],                                          // 배열 (참조 타입)
  timeRange: 3600000,                                     // 숫자 (원시 타입)
  timeField: 'metricDt',                                  // 문자열 (원시 타입)
};
```

스프레드 후 `param` 객체의 상태:

```
param.timeRange ──────▶ 3600000              (독립 복사본, 원본과 무관)
param.timeField ──────▶ 'metricDt'           (독립 복사본, 원본과 무관)
param.metricCodes ──┬──▶ ['UPS.INPUT_V_AVG', 'UPS.INPUT_A_SUM']  (공유)
api.trendParams.metricCodes ──┘
param.statsKeys ────┬──▶ []                                       (공유)
api.trendParams.statsKeys ────┘
```

**원시 타입** (숫자, 문자열, boolean): 값이 복사되므로 원본과 독립적
**참조 타입** (배열, 객체): 주소가 복사되므로 원본과 **같은 인스턴스를 공유**

### 이것이 중요한 이유

런타임에서 `api.trendParams.metricCodes`를 `=`로 새 배열에 할당하면:

```javascript
// ❌ 효과 없음 — param.metricCodes는 여전히 원래 배열을 가리킴
this.config.api.trendParams.metricCodes = ['NEW_CODE'];
```

```
param.metricCodes ──────────────▶ ['UPS.INPUT_V_AVG', ...]  (원래 배열)
api.trendParams.metricCodes ──▶ ['NEW_CODE']                (새 배열, 참조 끊김)
```

반면 **내용을 직접 수정**하면 param에도 반영된다:

```javascript
// ✅ param.metricCodes에도 반영됨 — 같은 배열 인스턴스를 수정
const codes = this.config.api.trendParams.metricCodes;
codes.length = 0;
codes.push('NEW_CODE');
```

### 해결 방법

**방법 1: 배열 내용만 수정 (참조 유지)**
```javascript
const codes = this.config.api.trendParams.metricCodes;
codes.length = 0;
codes.push(...newCodes);
```

**방법 2: datasetInfo.param을 직접 수정**
```javascript
const trendInfo = this.datasetInfo.find(
  d => d.datasetName === datasetNames.metricHistory
);
trendInfo.param.metricCodes = newCodes;
```

> **참고**: 방법 2를 사용하면 `api.trendParams.metricCodes`와의 공유가 끊어진다.
> 이후 `api.trendParams`를 참조하는 다른 로직이 있다면 양쪽 모두 업데이트해야 한다.
> `config.api.statsKeyMap`도 별도 설정이므로 metricCode를 변경할 경우 동기화 필요.
> 상세한 수정 가이드는 [RUNTIME_DATASETINFO_MODIFICATION.md](./RUNTIME_DATASETINFO_MODIFICATION.md) 참조.

---

## 요약

| 동작 | 코드 예시 | 참조 |
|------|----------|------|
| 새 값 할당 | `arr = []` | ❌ 끊김 |
| 배열 비우기 | `arr.length = 0` | ✅ 유지 |
| 요소 추가/제거 | `arr.push()`, `arr.splice()` | ✅ 유지 |
| 요소 수정 | `arr[0] = 'x'` | ✅ 유지 |
| 스프레드 복사 | `{ ...obj }` | 1단계만 복사 (얕은 복사) |

**핵심**: `=`로 새 값을 할당하면 참조가 끊어진다. 참조를 유지하려면 기존 객체/배열의 **내용**을 수정해야 한다. 스프레드 연산자(`...`)는 얕은 복사이므로, 중첩된 배열/객체는 여전히 원본과 참조를 공유한다.
