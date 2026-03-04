# ActionPanelComponent - 데이터 Fetch 개선 계획

## 배경

`ActionPanelComponent`는 대시보드의 "온습도현황" / "온도분포도" 토글 기능을 담당한다.
3D 레이어의 모든 자산을 순회하며 자산별로 `metricLatest` API를 개별 호출한 뒤,
온습도 라벨(CSS2DObject) 또는 히트맵을 렌더링한다.

**제약**: 벌크 API가 없고, 자산별 개별 API(`metricLatest`)만 존재한다.

### 현재 흐름

```
makeIterator(threeLayer) → 대상 자산 수집
→ targets.map(fetchData) → Promise.all
→ 전체 응답 완료 후 일괄 렌더링
```

### 현재 구조의 문제점

| # | 문제 | 영향 |
|---|------|------|
| 1 | `Promise.all` 일괄 대기 | 가장 느린 자산 1개가 전체 렌더링을 지연 |
| 2 | 동시 요청 수 무제한 | 자산 수 증가 시 서버 부하, 클라이언트 메모리 스파이크 |
| 3 | 탭 OFF→ON 시 항상 전체 재요청 | 이전 데이터가 있어도 로딩 상태로 빈 화면 |

---

## 개선 항목

### 1. 점진적 렌더링 (Progressive Rendering)

**목표**: 각 자산의 응답이 도착하는 즉시 라벨/히트맵에 반영

**현재**:
```
[fetch A]──────┐
[fetch B]────┐ │
[fetch C]──┐ │ │
           └─┴─┴→ Promise.all → 일괄 렌더링
```

**개선 후**:
```
[fetch A]──→ 즉시 라벨 A 렌더
[fetch B]────→ 즉시 라벨 B 렌더
[fetch C]──────→ 즉시 라벨 C 렌더 + 히트맵 누적 갱신
```

**변경 범위**:
- `fetchAndRenderLabels()` — 초기 로드
- `refreshAllActiveData()` — 주기적 갱신

**구현 방향**:
- `Promise.all` 제거
- 각 `fetchData().then()` 내부에서 즉시 `updateOrCreateLabel` 호출
- 히트맵은 `_pendingHeatmapPoints` 배열에 누적, 모든 fetch 완료 시 `updateHeatmapWithData` 1회 호출
  - (히트맵은 전체 포인트가 모여야 의미 있으므로 점진적 적용 불가)
- 완료 카운터(`settled count === total`)로 로딩 UI 해제 시점 판단

**히트맵 갱신 타이밍 상세**:
```
fetch 완료마다:
  1. humidity 라벨 → 즉시 렌더
  2. heatmapPoint → _pendingHeatmapPoints에 push
  3. settledCount++
  4. if (settledCount === totalCount):
       → updateHeatmapWithData(_pendingHeatmapPoints)
       → 로딩 UI 해제
```

**주의사항**:
- `refreshAllActiveData`에서 humidity만 활성인 경우: 점진적 렌더만으로 충분
- temperature만 활성인 경우: 전체 완료 대기 후 히트맵 갱신 (기존과 동일 타이밍)
- 둘 다 활성인 경우: 라벨은 즉시, 히트맵은 전체 완료 후

---

### 2. 동시성 제한 (Concurrency Limiter)

**목표**: 동시 fetch 수를 제한하여 서버 부하와 클라이언트 메모리 스파이크 방지

**구현 방향**:
- 유틸 함수 `promisePool(tasks, concurrency)` 작성
- `concurrency` 기본값: 6
- 각 task는 `() => fetchData(...)` 형태의 팩토리 함수
- 1순위(점진적 렌더링)와 결합: 각 task 완료 시 즉시 콜백 실행

**promisePool 시그니처**:
```js
/**
 * @param {Array<() => Promise<T>>} tasks - 실행할 비동기 작업 팩토리 배열
 * @param {number} concurrency - 최대 동시 실행 수
 * @param {function(T, number): void} onSettled - 각 작업 완료 시 콜백 (결과, 인덱스)
 * @returns {Promise<void>} 모든 작업 완료 시 resolve
 */
function promisePool(tasks, concurrency, onSettled)
```

**적용 위치**:
- `fetchAndRenderLabels()` 내부의 `targets.map(fetchData)` 대체
- `refreshAllActiveData()` 내부의 `targets.map(fetchData)` 대체

**배치 위치**:
- `ActionPanelComponent.js` 내부 `_onViewerReady` 스코프의 로컬 함수로 정의
- 다른 ECO 컴포넌트에서도 필요해지면 추후 `Wkit` 또는 공통 유틸로 승격

---

### 3. Stale-While-Revalidate 캐시

**목표**: 탭 OFF→ON 전환 시 이전 데이터를 즉시 표시, 백그라운드에서 최신 데이터 갱신

**구현 방향**:
- `deactivateDataLabels()`에서 `_dataLabels`를 삭제하지 않고 **숨김 처리**
  - `css2dObject.visible = false` (Three.js CSS2DObject 지원)
- `activateDataLabels()`에서:
  1. 기존 `_dataLabels`가 있으면 → `visible = true`로 즉시 복원 (로딩 없음)
  2. 백그라운드에서 `fetchAndRenderLabels` 실행 → 최신 데이터로 텍스트 갱신
- 히트맵도 동일: OFF 시 `visible = false`, ON 시 즉시 복원 + 백그라운드 갱신

**변경 범위**:
- `deactivateDataLabels()` — 삭제 → 숨김으로 변경
- `activateDataLabels()` — 캐시 존재 시 즉시 표시 로직 추가
- `deactivateHeatmap()` / `activateHeatmap()` — 동일 패턴 적용
- `_onViewerDestroy()` — 기존대로 완전 삭제 (메모리 해제)

**주의사항**:
- 자산이 추가/제거된 경우 캐시가 stale할 수 있음
  → 백그라운드 갱신에서 새 자산은 추가, 제거된 자산의 라벨은 정리

---

## 구현 순서

```
Phase 1: 점진적 렌더링 + 동시성 제한
─────────────────────────────────────
- promisePool 유틸 함수 작성
- fetchAndRenderLabels → promisePool + onSettled 즉시 렌더 방식으로 교체
- refreshAllActiveData → 동일 패턴 적용
- 히트맵은 전체 완료 후 1회 갱신 유지

Phase 2: Stale-While-Revalidate
───────────────────────────────
- deactivate 시 숨김 처리로 변경
- activate 시 캐시 즉시 복원 + 백그라운드 갱신
- 자산 변동 대응 로직 추가

Phase 3: (선택) promisePool 공통화
──────────────────────────────────
- 다른 ECO 컴포넌트에서 동일 패턴 필요 시 Wkit 유틸로 승격
```

---

## 타이머 사이클 구조

### 현재 동작 방식

`ensureDataTimer`는 `setInterval`이 아닌 **`setTimeout` 체이닝** 방식이다.
이는 RNBT-1394에서 `setInterval`로 요청이 누적되는 버그를 수정한 결과물이다.

```
scheduleNext = function () {
  setTimeout(function () {
    refreshAllActiveData().finally(scheduleNext);   // ← 완료 후 다음 예약
  }, _refreshInterval);
};
```

### 타이밍 특성

```
[사이클 1: fetch ~5초] → [대기 30초] → [사이클 2: fetch ~5초] → [대기 30초] → ...

실제 주기: ~35초            실제 주기: ~35초
```

- `_refreshInterval`(기본 30초)은 **사이클 간 휴식 시간**이다 (사이클 시작 간격이 아님)
- `.finally(scheduleNext)`이므로 모든 fetch가 완료된 후에야 다음 대기가 시작됨
- fetch가 오래 걸리면 실제 주기는 `fetch 소요 시간 + _refreshInterval`

### 개선 적용 시에도 변경 없음

`promisePool`이 반환하는 Promise의 `.finally(scheduleNext)`는 동일하게 동작한다.
풀 내 모든 작업이 완료된 후 → 30초 대기 → 다음 사이클.

### _refreshInterval 최적값 가이드

`setTimeout` 체이닝이므로 간격을 줄여도 요청이 겹칠 위험은 없다.
다만 최적값은 **서버 측 센서 데이터 갱신 주기**에 맞추어야 한다.

```
서버 갱신 주기보다 짧게 설정 → 동일 데이터 중복 조회 (낭비)
서버 갱신 주기보다 길게 설정 → 실시간성 저하
서버 갱신 주기와 동일       → 최적
```

| 서버 갱신 주기 | _refreshInterval 권장값 | 비고 |
|---------------|------------------------|------|
| 5초           | 5000~10000             | 실시간 모니터링 |
| 30초          | 30000                  | 현재 기본값, 적절 |
| 60초          | 60000                  | 현재 30초는 절반이 중복 조회 |

**확인 필요**: 현재 서버의 센서 데이터 갱신 주기 → 이에 맞춰 기본값 조정 검토

---

## 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `ActionPanelComponent.js` | fetchAndRenderLabels, refreshAllActiveData, activate/deactivate 로직 |
| 기타 ECO 컴포넌트 | 없음 (Phase 3 전까지) |

## 비변경 사항

- HTML/CSS 템플릿: 변경 없음
- 외부 API 인터페이스: 변경 없음 (개별 metricLatest 호출 유지)
- 타이머 구조 (ensureDataTimer / stopDataTimerIfIdle): 변경 없음
- HeatmapMixin 인터페이스: 변경 없음
