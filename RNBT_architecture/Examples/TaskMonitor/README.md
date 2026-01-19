# TaskMonitor

RNBT 아키텍처 패턴을 따르는 실시간 태스크 모니터링 대시보드입니다.

## 구조

```
TaskMonitor/
├── mock_server/                    # Express API 서버
│   ├── server.js
│   └── package.json
│
├── master/                         # MASTER 레이어 (앱 전역)
│   └── page/
│       ├── page_scripts/
│       │   ├── before_load.js
│       │   ├── loaded.js
│       │   └── before_unload.js
│       ├── page_styles/container.css
│       └── components/
│           ├── Header/             # 앱 정보 및 상태 헤더
│           └── Sidebar/            # 필터 옵션 사이드바
│
├── page/                           # PAGE 레이어 (페이지별)
│   ├── page_scripts/
│   │   ├── before_load.js
│   │   ├── loaded.js
│   │   └── before_unload.js
│   ├── page_styles/container.css
│   └── components/
│       ├── TaskList/               # 태스크 목록 테이블 (Tabulator)
│       ├── StatusChart/            # 상태 분포 파이차트 (ECharts)
│       └── ActivityLog/            # 최근 활동 로그
│
├── datasetList.json                # API 엔드포인트 정의
├── preview.html                    # 전체 대시보드 프리뷰
└── README.md
```

## 실행 방법

### 1. Mock Server 실행

```bash
cd mock_server
npm install
npm start
```

서버가 http://localhost:3004 에서 실행됩니다.

### 2. Preview 확인

`preview.html`을 브라우저에서 열거나, 로컬 서버로 실행합니다:

```bash
# 프로젝트 루트에서
npx serve .
```

## API 엔드포인트

| Endpoint | Layer | Component | 설명 |
|----------|-------|-----------|------|
| GET /api/app-info | MASTER | Header | 앱 정보 및 상태 |
| GET /api/filters | MASTER | Sidebar | 필터 옵션 목록 |
| GET /api/tasks | PAGE | TaskList | 태스크 목록 (필터링 가능) |
| GET /api/status | PAGE | StatusChart | 상태별 분포 요약 |
| GET /api/activity | PAGE | ActivityLog | 최근 활동 로그 |

### Query Parameters

**GET /api/tasks**
- `status`: all, pending, in_progress, completed, failed
- `priority`: all, low, medium, high, critical
- `type`: all, development, design, testing, deployment, review
- `assignee`: all, alice, bob, charlie, diana, eve

**GET /api/activity**
- `limit`: 반환할 활동 수 (기본값: 10)

## 컴포넌트 패턴

### Header - 앱 정보 표시

```javascript
// appInfo topic 구독
this.subscriptions = {
    'appInfo': ['renderAppInfo']
};

// 새로고침 버튼 이벤트
this.customEvents = {
    click: { '.btn-refresh': '@refreshAllClicked' }
};
```

### Sidebar - 필터 UI

```javascript
// 내부 상태로 필터 관리
this._currentFilters = {
    status: 'all',
    priority: 'all',
    type: 'all',
    assignee: 'all'
};

// Apply 클릭 시 이벤트 발행
Weventbus.emit('@filterApplied', {
    event: { filters: this._currentFilters },
    targetInstance: this
});
```

### TaskList - Tabulator 테이블

```javascript
// tasks topic 구독
this.subscriptions = {
    'tasks': ['renderTable']
};

// 테이블 설정
this.tableConfig = {
    layout: 'fitColumns',
    columns: [
        { title: 'ID', field: 'id', ... },
        { title: 'Status', field: 'status', formatter: statusFormatter }
    ]
};
```

### StatusChart - ECharts 파이 차트

```javascript
// statusSummary topic 구독
this.subscriptions = {
    'statusSummary': ['renderChart']
};

// Chart Config 패턴
this.chartConfig = {
    optionBuilder: getChartOption
};
```

### ActivityLog - 활동 목록

```javascript
// activity topic 구독
this.subscriptions = {
    'activity': ['renderActivity']
};

// 액션별 메시지 포맷
const ACTION_MESSAGES = {
    created: (item) => `${item.user} created ${item.taskId}`,
    completed: (item) => `${item.user} completed ${item.taskId}`
};
```

## 라이프사이클

```
앱 시작
  ↓
[MASTER] before_load.js     → 이벤트 핸들러 등록
  ↓
[MASTER] 컴포넌트 register   → Header, Sidebar 초기화
  ↓
[MASTER] loaded.js          → appInfo, filters 발행
  ↓
페이지 진입
  ↓
[PAGE] before_load.js       → 필터 이벤트 핸들러, currentParams 초기화
  ↓
[PAGE] 컴포넌트 register     → TaskList, StatusChart, ActivityLog 초기화
  ↓
[PAGE] loaded.js            → tasks, statusSummary, activity 발행 + interval 시작
  ↓
페이지 이탈
  ↓
[PAGE] before_unload.js     → interval 정지, 이벤트 해제, 매핑 해제
  ↓
[PAGE] 컴포넌트 beforeDestroy → 리소스 정리
```

## 이벤트 흐름

| 이벤트 | 발생 위치 | 처리 위치 | 동작 |
|--------|----------|----------|------|
| @refreshAllClicked | Header | Master | 전체 새로고침 트리거 |
| @filterApplied | Sidebar | Page | 필터 적용 → tasks 재발행 |
| @filterReset | Sidebar | Page | 필터 초기화 → tasks 재발행 |
| @taskClicked | TaskList | Page | 태스크 클릭 로깅 |
| @forceRefresh | Master | Page | 모든 topic 재발행 |

## 자동 갱신

| Topic | Interval | 설명 |
|-------|----------|------|
| tasks | 10초 | 태스크 목록 |
| statusSummary | 15초 | 상태 분포 차트 |
| activity | 8초 | 활동 로그 |

## 특징

- **필터링**: Sidebar에서 status, priority, type, assignee로 필터링
- **실시간 갱신**: 컴포넌트별 독립적인 갱신 주기
- **상태 시각화**: 파이 차트로 상태 분포 표시
- **활동 추적**: 최근 활동 로그 실시간 업데이트
