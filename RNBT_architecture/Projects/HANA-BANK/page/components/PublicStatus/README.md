# PublicStatus

Public 현황 대시보드 카드 - 금일건수와 전일/금일 비교 라인 차트를 표시합니다.

## 데이터 구조

```javascript
{
    TBD_todayCount: 248,                    // 금일건수
    TBD_timestamps: ['08:00', '09:00', ...], // X축 시간 레이블
    TBD_yesterday: [150, 280, 350, ...],    // 전일 데이터
    TBD_today: [120, 220, 380, ...]         // 금일 데이터
}
```

## 구독 (Subscriptions)

| Topic | 함수 | 설명 |
|-------|------|------|
| `TBD_publicStatus` | `renderData` | 금일건수 렌더링 |
| `TBD_publicStatus` | `renderChart` | ECharts 라인 차트 렌더링 |

## 발행 이벤트 (Events)

없음

## 차트 구성 (ECharts)

### 시리즈

| 시리즈 | 색상 | 설명 |
|--------|------|------|
| 전일 | `#038c8c` | 전일 데이터 라인 |
| 금일 | `#5bdcc6` | 금일 데이터 라인 |

### Y축 설정

- 최소값: 0
- 최대값: 800
- 간격: 200

### 스타일

- 라인: smooth curve, 2px width
- 그리드: 가로선만 표시 (rgba(255, 255, 255, 0.1))
- 툴팁: 반투명 녹색 배경

## 컨테이너 크기

- 너비: 610px
- 높이: 324px

## 파일 구조

```
PublicStatus/
├── assets/
│   ├── title-icon.svg      # 타이틀 아이콘
│   └── divider-line.svg    # 구분선
├── views/component.html
├── styles/component.css
├── scripts/
│   ├── register.js         # ECharts 초기화 + 렌더링
│   └── beforeDestroy.js    # ECharts dispose 포함
├── preview.html            # ECharts CDN 포함 테스트
└── README.md
```

## TBD 항목

API 연동 시 다음 필드명을 실제 API 응답에 맞게 변경:

- `TBD_publicStatus` → 실제 topic명
- `TBD_todayCount` → 실제 필드명
- `TBD_timestamps` → 실제 필드명
- `TBD_yesterday` → 실제 필드명
- `TBD_today` → 실제 필드명
