# AssetList 코드 흐름 문서

## 전체 구조

```
preview.html
├── 1. HTML 구조 (라인 1-106)
├── 2. Mock 데이터 & API (라인 109-518) - 첫 번째 <script>
└── 3. 렌더링 로직 (라인 521-959) - 두 번째 <script>
```

---

## 1. 초기화 흐름 (window.onload)

```
window.onload (라인 953-959)
    │
    ├─→ initTable()          → Tabulator 테이블 초기화
    ├─→ setupResizer()       → 패널 리사이저 설정
    ├─→ setupEventHandlers() → 이벤트 핸들러 등록
    │
    └─→ fetchHierarchy(1)    → 초기 트리 데이터 로드 (depth=1)
            │
            └─→ .then(renderTree) → 트리 렌더링
```

---

## 2. 데이터 구조

### 핵심 원칙: 모든 것은 자산(Asset)

```javascript
{
    id: "building-001",
    name: "본관",
    type: "building",
    canHaveChildren: true,   // true = 컨테이너 (하위 가질 수 있음)
    hasChildren: true,       // Lazy Loading 판단용
    parentId: null,
    status: "warning",
    children: [...]          // 하위 자산들
}
```

### 자산 유형 분류

| 분류 | 유형 | canHaveChildren |
|------|------|-----------------|
| 공간 계층 | building, floor, room | true |
| 장비 컨테이너 | rack, cabinet, pdu(Main) | true |
| 말단 자산 | server, storage, switch, router, ups, crac, sensor, circuit, pdu | false |

---

## 3. Mock API 흐름 (Promise 기반)

```
┌─────────────────────────────────────────────────────────────────┐
│  fetchHierarchy(depth)                                          │
│  └─→ 300ms 지연 후 { response: { data: {...} } } 반환            │
│                                                                 │
│  fetchNodeChildren(nodeId)  ← Lazy Loading용                    │
│  └─→ 특정 노드의 직속 children만 반환                             │
│                                                                 │
│  fetchNodeAssets(nodeId)    ← Table 표시용                       │
│  └─→ 노드 하위의 모든 자산 재귀 수집                               │
└─────────────────────────────────────────────────────────────────┘
```

### API 응답 구조

register.js와 동일한 `{ response: { data: {...} } }` 구조 사용:

**fetchHierarchy 응답 (트리용)**
```javascript
{
    response: {
        data: {
            title: "ECO 자산 관리",
            items: [...],
            summary: { depth: 1 }
        }
    }
}
```

**fetchNodeChildren 응답 (Lazy Loading용)**
```javascript
{
    response: {
        data: {
            parentId: "building-001",
            children: [...]
        }
    }
}
```

**fetchNodeAssets 응답 (테이블용)**
```javascript
{
    response: {
        data: {
            nodeId: "room-001-01-01",
            nodePath: "본관 > 1층 > 서버실 A",
            assets: [...],
            summary: { total: 10, byStatus: {...} }
        }
    }
}
```

---

## 4. 트리 렌더링 흐름

```
renderTree({ response })     ← API 응답 구조 그대로 받음
    │
    ├─→ treeData = data.items  (상태 저장)
    │
    └─→ renderTreeNodes(items, searchTerm)
            │
            └─→ items.forEach → createTreeNode(item)
                    │
                    ├─→ <li class="tree-node">
                    │       <div class="node-content">
                    │           <span class="node-toggle">▶</span>
                    │           <span class="node-icon" data-type="building">
                    │           <span class="node-label">본관</span>
                    │           <span class="node-status warning">
                    │       </div>
                    │       <ul class="node-children">  ← 재귀 호출
                    │           ...
                    │       </ul>
                    │   </li>
                    │
                    └─→ hasChildren && !hasLoadedChildren
                            → "Loading..." placeholder 표시
```

### 트리 노드 DOM 구조

```html
<li class="tree-node" data-node-id="building-001" data-node-type="building">
    <div class="node-content">
        <span class="node-toggle expanded">▶</span>
        <span class="node-icon" data-type="building"></span>
        <span class="node-label">본관</span>
        <span class="node-status warning"></span>
    </div>
    <ul class="node-children expanded">
        <!-- 자식 노드들 -->
    </ul>
</li>
```

---

## 5. 사용자 인터랙션 흐름

### A. 트리 노드 클릭 (토글)

```
.tree-container click (이벤트 위임)
    │
    ├─→ .node-toggle 클릭?
    │       │
    │       └─→ toggleNode(nodeId, nodeEl)
    │               │
    │               ├─→ expandedNodes.add(nodeId)
    │               │
    │               ├─→ needsLazyLoad?
    │               │       │
    │               │       └─→ fetchNodeChildren(nodeId)
    │               │               │
    │               │               └─→ .then(appendChildren)
    │               │                       │
    │               │                       ├─→ addChildrenToNode() (데이터 갱신)
    │               │                       ├─→ loadedNodes.add(parentId)
    │               │                       └─→ renderTreeNodes() (재렌더링)
    │               │
    │               └─→ updateNodeVisuals() (CSS 토글)
    │
    └─→ 그 외 클릭?
            │
            └─→ selectNode(nodeId)
                    │
                    ├─→ selectedNodeId = nodeId
                    ├─→ CSS .selected 클래스 토글
                    │
                    └─→ fetchNodeAssets(nodeId)
                            │
                            └─→ .then(renderTable)
```

### B. 노드 선택 → 테이블 렌더링

```
selectNode(nodeId)
    │
    └─→ fetchNodeAssets(nodeId)
            │
            └─→ renderTable({ response })
                    │
                    ├─→ nodePath 표시 ("본관 > 1층 > 서버실 A")
                    ├─→ allAssets = assets (상태 저장)
                    │
                    └─→ applyFilters()
                            │
                            ├─→ searchTerm 필터
                            ├─→ typeFilter 필터
                            ├─→ statusFilter 필터
                            │
                            └─→ tableInstance.setData(filtered)
```

---

## 6. 상태 관리

```javascript
// 라인 526-535
let treeData = null;           // 현재 트리 데이터
let expandedNodes = new Set(); // 펼쳐진 노드 ID 집합
let loadedNodes = new Set();   // Lazy Loading 완료된 노드 ID
let selectedNodeId = null;     // 현재 선택된 노드
let allAssets = [];            // 테이블에 표시할 자산 목록
let searchTerm = '';           // 테이블 검색어
let treeSearchTerm = '';       // 트리 검색어
let typeFilter = 'all';        // 유형 필터
let statusFilter = 'all';      // 상태 필터
let tableInstance = null;      // Tabulator 인스턴스
```

---

## 7. Lazy Loading 동작 원리

```
초기 로드: depth=1 (Building만)
    │
    ├─→ Building [hasChildren=true, children=[]]
    │       └─→ "Loading..." placeholder
    │
    └─→ 사용자가 ▶ 클릭
            │
            └─→ fetchNodeChildren("building-001")
                    │
                    └─→ Floor들 반환 [hasChildren=true, children=[]]
                            │
                            └─→ 트리 재렌더링
                                    │
                                    └─→ 사용자가 Floor ▶ 클릭
                                            │
                                            └─→ ... (반복)
```

### Lazy Loading 판단 조건

```javascript
const needsLazyLoad = hasChildren && !hasLoadedChildren && !loadedNodes.has(id);
```

- `hasChildren`: API에서 true로 제공 (하위 자산 존재)
- `hasLoadedChildren`: children 배열에 데이터가 있는지
- `loadedNodes`: 이미 로드한 노드 추적

---

## 8. 검색/필터 흐름

### 트리 검색

```
.tree-search-input input
    │
    └─→ treeSearchTerm = value
            │
            └─→ renderTreeNodes(treeData, treeSearchTerm)
                    │
                    └─→ createTreeNode에서 matchesSearch 판단
                            → 매칭 안되면 null 반환 (렌더링 안함)
```

### 테이블 검색/필터

```
.search-input input / .type-filter change / .status-filter change
    │
    └─→ searchTerm/typeFilter/statusFilter 업데이트
            │
            └─→ applyFilters()
                    │
                    └─→ allAssets.filter(...) → tableInstance.setData()
```

---

## 9. 이벤트 핸들러 목록

| 요소 | 이벤트 | 핸들러 |
|------|--------|--------|
| `.tree-container` | click | 이벤트 위임 → toggleNode / selectNode |
| `.tree-search-input` | input | 트리 검색 → renderTreeNodes |
| `.btn-expand-all` | click | expandAll() |
| `.btn-collapse-all` | click | collapseAll() |
| `.search-input` | input | 테이블 검색 → applyFilters |
| `.type-filter` | change | 유형 필터 → applyFilters |
| `.status-filter` | change | 상태 필터 → applyFilters |
| `.refresh-btn` | click | fetchHierarchy(1) → renderTree |
| `.pane-resizer` | mousedown/move/up | 패널 리사이즈 |

---

## 10. register.js와의 차이점

| 항목 | preview.html | register.js |
|------|--------------|-------------|
| API 호출 | Promise (fetchHierarchy 등) | GlobalDataPublisher 구독 |
| 이벤트 발행 | console.log | Weventbus.emit |
| 상태 관리 | 전역 변수 (let) | this._ 프리픽스 |
| 초기화 | window.onload | initComponent() |

### 응답 구조 동일

```javascript
// preview.html과 register.js 모두 동일한 구조 사용
{ response: { data: { ... } } }
```

---

## 11. 파일 구조

```
AssetList/
├── views/
│   └── component.html    # HTML 템플릿
├── styles/
│   └── component.css     # 스타일 (CSS Nesting)
├── scripts/
│   └── register.js       # 런타임 컴포넌트 로직
├── preview.html          # 독립 실행 테스트 파일
└── codeflow.md           # 이 문서
```
