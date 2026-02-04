# ECO (Energy & Cooling Operations) Dashboard

데이터센터 전력/냉방 장비 모니터링 대시보드

---

## 프로젝트 구조

```
ECO/
├── API_SPEC.md           # API 명세
├── datasetList.json      # 데이터셋 정의
├── README.md             # 이 문서
├── mock_server/          # Express 기반 Mock Server
│   ├── server.js
│   └── package.json
└── page/
    ├── components/       # 4개 3D 팝업 컴포넌트
    │   ├── UPS/          # 무정전 전원장치
    │   ├── PDU/          # 분전반
    │   ├── CRAC/         # 항온항습기
    │   └── TempHumiditySensor/  # 온습도 센서
    └── page_scripts/
        ├── before_load.js
        ├── loaded.js
        └── before_unload.js
```

---

## 컴포넌트 개요

| 컴포넌트 | 역할 | 주요 기능 |
|----------|------|----------|
| **UPS** | 무정전 전원장치 | 전력현황 4카드, 입/출력 트렌드 차트 (3탭) |
| **PDU** | 분전반 | 기본정보, 트렌드 차트 (5탭) |
| **CRAC** | 항온항습기 | 온습도 카드, 상태 인디케이터 6개, 트렌드 차트 |
| **TempHumiditySensor** | 온습도 센서 | 온습도 카드, 트렌드 차트 |

모든 컴포넌트는 `this.config` 패턴으로 설정을 통합 관리합니다.

---

## Mock Server 실행

```bash
cd ECO/mock_server
npm install
npm start  # http://localhost:4004
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 초안 작성 |
| 2026-01-26 | Asset API v1 전면 개편 |
| 2026-02-04 | README.md 간소화 |
