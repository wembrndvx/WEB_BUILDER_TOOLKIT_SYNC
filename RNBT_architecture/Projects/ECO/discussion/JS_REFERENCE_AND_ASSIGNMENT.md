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

## 실제 사례: datasetInfo 패턴

### 문제 상황

```javascript
// 초기화 시점
this.datasetInfo = [
  {
    datasetName: 'metricHistory',
    param: {
      metricCodes: api.trendParams.metricCodes,  // 주소 복사
    },
    render: ['renderTrendChart'],
  },
];

// 런타임에서 변경 시도
this.config.api.trendParams.metricCodes = ['NEW_CODE'];  // ❌ 효과 없음
```

`datasetInfo`는 생성 시점의 주소를 유지하므로, 새 배열을 할당해도 반영되지 않는다.

### 해결 방법

**방법 1: 배열 내용만 수정 (참조 유지)**
```javascript
const codes = this.config.api.trendParams.metricCodes;
codes.length = 0;
codes.push(...newCodes);
```

**방법 2: datasetInfo를 직접 수정**
```javascript
const historyDataset = this.datasetInfo.find(
  d => d.datasetName === 'metricHistory'
);
historyDataset.param.metricCodes = newCodes;
```

**방법 3: datasetInfo 재생성**
```javascript
this.datasetInfo = this._createDatasetInfo();
```

---

## 요약

| 동작 | 코드 예시 | 참조 |
|------|----------|------|
| 새 값 할당 | `arr = []` | ❌ 끊김 |
| 배열 비우기 | `arr.length = 0` | ✅ 유지 |
| 요소 추가/제거 | `arr.push()`, `arr.splice()` | ✅ 유지 |
| 요소 수정 | `arr[0] = 'x'` | ✅ 유지 |

**핵심**: `=`로 새 값을 할당하면 참조가 끊어진다. 참조를 유지하려면 기존 객체/배열의 **내용**을 수정해야 한다.
