# ECO 다국어(i18n) 설계 명세

> **구현 상태**: Mock 서버에 자산 데이터 다국어 적용 완료

---

## 1. 기본 원칙

### 서버 중심 다국어 (자산 데이터만)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  자산 데이터는 서버에서 다국어 처리                               │
│                                                                  │
│  - 클라이언트가 locale 파라미터 전달                             │
│  - 서버가 해당 locale에 맞는 자산 이름/라벨 반환                  │
│  - UI 텍스트는 클라이언트에서 하드코딩 유지                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 범위

| 구분 | 다국어 적용 | 비고 |
|------|------------|------|
| 자산 이름 | O | `name` 필드 |
| 타입 라벨 | O | `typeLabel` 필드 추가 |
| 상태 라벨 | O | `statusLabel` 필드 추가 |
| 노드 경로 | O | `nodePath` 번역됨 |
| UI 텍스트 | X | 클라이언트 하드코딩 유지 |

---

## 2. 지원 언어

```
GET /api/i18n/locales
```

```json
{
  "data": {
    "available": [
      { "code": "ko", "name": "한국어", "default": true },
      { "code": "en", "name": "English" },
      { "code": "ja", "name": "日本語" }
    ],
    "default": "ko"
  }
}
```

---

## 3. API 사용법

### Query Parameter 방식

모든 Hierarchy API에 `locale` 파라미터 추가:

```
GET /api/hierarchy?depth=2&locale=ko
GET /api/hierarchy?depth=2&locale=en
GET /api/hierarchy/:nodeId/children?locale=ja
GET /api/hierarchy/:nodeId/assets?locale=en
```

### 응답 구조 변화

**기존 (locale 없음)**

```json
{
  "data": {
    "id": "building-001",
    "name": "본관",
    "type": "building",
    "status": "normal"
  }
}
```

**다국어 적용 후 (locale=en)**

```json
{
  "data": {
    "id": "building-001",
    "name": "Main Building",
    "type": "building",
    "typeLabel": "Building",
    "status": "normal",
    "statusLabel": "Normal"
  },
  "meta": {
    "locale": "en"
  }
}
```

---

## 4. API별 다국어 적용

### GET /api/hierarchy?depth=n&locale=ko

트리 구조 전체에 다국어 적용:

```json
{
  "data": {
    "title": "ECO 자산 관리",
    "items": [
      {
        "id": "building-001",
        "name": "Main Building",
        "type": "building",
        "typeLabel": "Building",
        "statusLabel": "Normal",
        "children": [...]
      }
    ]
  },
  "meta": { "locale": "en" }
}
```

### GET /api/hierarchy/:nodeId/children?locale=ko

Lazy Loading 시에도 동일하게 적용:

```json
{
  "data": {
    "parentId": "building-001",
    "children": [
      {
        "id": "floor-001-01",
        "name": "1st Floor",
        "typeLabel": "Floor",
        "statusLabel": "Warning"
      }
    ]
  },
  "meta": { "locale": "en" }
}
```

### GET /api/hierarchy/:nodeId/assets?locale=ko

테이블 데이터 + nodePath 번역:

```json
{
  "data": {
    "nodeId": "room-001-01-01",
    "nodeName": "Server Room A",
    "nodePath": "Main Building > 1st Floor > Server Room A",
    "nodeType": "room",
    "nodeTypeLabel": "Room",
    "assets": [
      {
        "id": "server-001",
        "name": "Server 001",
        "type": "server",
        "typeLabel": "Server",
        "status": "normal",
        "statusLabel": "Normal"
      }
    ]
  },
  "meta": { "locale": "en" }
}
```

---

## 5. 번역 데이터

### 자산 이름 (일부)

| ID | ko | en | ja |
|----|----|----|-----|
| building-001 | 본관 | Main Building | 本館 |
| building-002 | 별관 A | Annex A | 別館A |
| floor-001-01 | 1층 | 1st Floor | 1階 |
| room-001-01-01 | 서버실 A | Server Room A | サーバールームA |

### 타입 라벨

| type | ko | en | ja |
|------|----|----|-----|
| building | 건물 | Building | ビル |
| floor | 층 | Floor | フロア |
| room | 방 | Room | 部屋 |
| rack | 랙 | Rack | ラック |
| server | 서버 | Server | サーバー |
| ups | UPS | UPS | UPS |
| pdu | PDU | PDU | PDU |
| crac | 항온항습기 | CRAC | 空調機 |
| sensor | 센서 | Sensor | センサー |

### 상태 라벨

| status | ko | en | ja |
|--------|----|----|-----|
| normal | 정상 | Normal | 正常 |
| warning | 경고 | Warning | 警告 |
| critical | 위험 | Critical | 危険 |

---

## 6. 클라이언트 적용 가이드

### preview.html에서 테스트

```javascript
// 기본값 (한국어)
fetchHierarchy(2).then(renderTree);

// 영어로 변경
fetchHierarchy(2, 'en').then(renderTree);

// API 함수 수정 예시
function fetchHierarchy(depth = 2, locale = 'ko') {
    return fetch(`${API_BASE}/hierarchy?depth=${depth}&locale=${locale}`)
        .then(res => res.json())
        .then(data => ({ response: data }));
}
```

### 테이블에서 typeLabel 사용

```javascript
// 컬럼 정의에서 typeLabel 활용
columns: [
    { title: 'Type', field: 'typeLabel', widthGrow: 1 },
    { title: 'Status', field: 'statusLabel', widthGrow: 1 }
]
```

---

## 7. 구현 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| Mock 서버 i18n API | ✅ 완료 | `/api/i18n/locales` |
| Hierarchy API locale 파라미터 | ✅ 완료 | 모든 Hierarchy API |
| 자산 이름 번역 | ✅ 완료 | 주요 공간(건물/층/방) |
| typeLabel/statusLabel | ✅ 완료 | 모든 자산에 추가 |
| nodePath 번역 | ✅ 완료 | 경로도 번역됨 |
| preview.html 적용 | ⬜ 미적용 | 클라이언트 수정 필요 |
| register.js 적용 | ⬜ 미적용 | 클라이언트 수정 필요 |

---

## 8. 향후 계획

### 클라이언트 적용 시

1. locale 상태 관리 추가 (`window.APP_LOCALE` 또는 GlobalDataPublisher)
2. API 호출 시 locale 파라미터 전달
3. 테이블 컬럼에서 `typeLabel`, `statusLabel` 사용
4. locale 변경 시 데이터 재요청

### UI 텍스트 다국어 (선택적)

현재 UI 텍스트는 하드코딩 유지. 필요 시 별도 API 추가 가능:

```
GET /api/i18n/ui?locale=ko&component=AssetList
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-14 | 초안 작성 - 다국어 설계 명세 |
| 2026-01-14 | Mock 서버 구현 완료 - 자산 데이터 다국어 적용 |
