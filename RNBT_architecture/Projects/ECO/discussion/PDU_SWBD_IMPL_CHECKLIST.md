# PDU / SWBD 구현 체크리스트

현재 구현과 POPUP_SPEC을 비교하여 미구현/차이점 정리.

---

## PDU (분전반)

### 현재 구현 vs SPEC 비교

| 항목 | SPEC 요구사항 | 현재 구현 | 상태 |
|------|--------------|----------|------|
| 섹션 구성 | 2개 (기본정보 + 트렌드) | 2개 (기본정보 + 트렌드) | ✅ |
| 트렌드 탭 수 | 4탭 | 5탭 | ⚠️ |
| 전압 탭 | 평균 전압 (단일) | `DIST.V_LN_AVG` (단일) | ✅ |
| 전류 탭 | 평균 전류 (단일) | `DIST.CURRENT_AVG_A` (단일) | ✅ |
| **전력사용량 탭** | **금일/전일 비교 (2라인)** | 단일 라인 | ❌ |
| 주파수 탭 | 입력주파수 (단일) | `DIST.FREQUENCY_HZ` (단일) | ✅ |
| energy 탭 | (SPEC에 없음) | `DIST.ACTIVE_ENERGY_SUM_KWH` | ⚠️ 추가됨 |

### ❌ 미구현: 전력사용량 금일/전일 비교

**SPEC 요구사항** (PDU_POPUP_SPEC.md 라인 91, 111):
```
| 전력사용량 | 금일, 전일 | kW | DIST.ACTIVE_POWER_TOTAL_KW |
```

**현재 구현** (register.js 라인 131):
```javascript
power: { metricCode: 'DIST.ACTIVE_POWER_TOTAL_KW', label: '합계 전력', ... }
// → 단일 라인만 표시, 금일/전일 비교 없음
```

### 수정 필요 사항

#### 1. config 수정
```javascript
// 현재
power: { metricCode: 'DIST.ACTIVE_POWER_TOTAL_KW', label: '합계 전력', ... }

// 수정 후
power: {
  metricCode: 'DIST.ACTIVE_POWER_TOTAL_KW',
  label: '전력사용량',
  unit: 'kW',
  comparison: true,  // 금일/전일 비교 플래그
  series: {
    today: { label: '금일', color: '#3b82f6' },
    yesterday: { label: '전일', color: '#94a3b8' },
  }
}
```

#### 2. fetchTrendData 수정
- [ ] `comparison: true`인 탭은 **2회 fetch** (금일 + 전일)
- [ ] 시간 계산: 금일 00:00~현재, 전일 00:00~23:59

#### 3. renderTrendChart 수정
- [ ] `comparison: true`인 탭: 시리즈 2개 (금일, 전일)
- [ ] X축: 시간만 (0시~23시), 날짜 제외

#### 4. 기타
- [ ] energy 탭 유지 여부 결정 (SPEC에 없음)
- [ ] 탭 라벨 정리: "합계 전력" → "전력사용량"

---

## SWBD (수배전반)

### 현재 상태: **미구현**

SWBD 컴포넌트 폴더 없음.

### SPEC 요구사항 (SWBD_POPUP_SPEC.md)

| 항목 | SPEC 요구사항 |
|------|--------------|
| 섹션 구성 | 2개 (기본정보 + 트렌드) |
| 트렌드 탭 | 4탭 (전압/전류/주파수/유효전력) |
| 전압 탭 | `SWBD.VOLTAGE_V` (단일) |
| 전류 탭 | `SWBD.CURRENT_A` (단일) |
| 주파수 탭 | `SWBD.FREQUENCY_HZ` (단일) |
| **유효전력 탭** | **금일/월평균 비교 (2라인)** |

### PDU와의 차이점

| 항목 | PDU | SWBD |
|------|-----|------|
| 메트릭 prefix | `DIST.*` | `SWBD.*` |
| 비교 탭 | 전력사용량 (금일/전일) | 유효전력 (금일/**월평균**) |
| 월평균 계산 | 불필요 | **필요** (복잡) |

### 구현 계획

1. PDU 코드 복사 → SWBD 폴더 생성
2. config 수정 (메트릭 코드: `DIST.*` → `SWBD.*`)
3. 유효전력 탭 금일/월평균 로직 구현
   - 월평균: 해당 월 1일~현재까지 시간대별 평균

---

## 구현 우선순위

### Phase 1: PDU 전력사용량 금일/전일 비교
- [ ] config에 `comparison` 플래그 추가
- [ ] fetchTrendData에 2회 fetch 로직
- [ ] renderTrendChart에 2시리즈 처리
- [ ] preview.html 테스트

### Phase 2: SWBD 신규 구현
- [ ] PDU 기반 SWBD 컴포넌트 생성
- [ ] 메트릭 코드 변경
- [ ] 유효전력 금일/월평균 로직

---

## 참고: 금일/전일 시간 계산 로직

```javascript
// 금일: 오늘 00:00 ~ 현재
const now = new Date();
const todayStart = new Date(now);
todayStart.setHours(0, 0, 0, 0);

const todayFrom = todayStart.toISOString();
const todayTo = now.toISOString();

// 전일: 어제 00:00 ~ 어제 23:59
const yesterdayStart = new Date(todayStart);
yesterdayStart.setDate(yesterdayStart.getDate() - 1);

const yesterdayEnd = new Date(todayStart);
yesterdayEnd.setTime(yesterdayEnd.getTime() - 1); // 오늘 00:00 - 1ms = 어제 23:59:59.999

const yesterdayFrom = yesterdayStart.toISOString();
const yesterdayTo = yesterdayEnd.toISOString();
```

---

*작성일: 2026-02-04*
