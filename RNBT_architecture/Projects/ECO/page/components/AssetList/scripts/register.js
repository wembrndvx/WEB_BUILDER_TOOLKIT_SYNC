/**
 * AssetList - 계층형 자산 목록 컴포넌트
 *
 * 기능:
 * 1. 트리뷰로 건물 > 층 > 방 계층 표시
 * 2. 선택한 노드의 자산 목록을 테이블로 표시
 * 3. 검색 및 필터링
 * 4. 새로고침 버튼 - 외부 이벤트 (@refreshClicked)
 * 5. 행 클릭 - 외부 이벤트 (@assetSelected)
 *
 * 데이터 흐름:
 * - GlobalDataPublisher의 'hierarchy' topic 구독 → 트리 렌더링
 * - GlobalDataPublisher의 'hierarchyAssets' topic 구독 → 테이블 렌더링
 */

const { subscribe } = GlobalDataPublisher;
const { bindEvents } = Wkit;
const { each, go } = fx;

initComponent.call(this);

function initComponent() {
    // ======================
    // 1. SUBSCRIPTIONS
    // ======================
    this.subscriptions = {
        'hierarchy': ['renderTree'],
        'hierarchyAssets': ['renderTable'],
        'hierarchyChildren': ['appendChildren']
    };

    // ======================
    // 2. STATE
    // ======================
    this._treeData = null;
    this._expandedNodes = new Set();
    this._loadedNodes = new Set(); // Lazy Loading된 노드 추적
    this._selectedNodeId = null;
    this._allAssets = [];
    this._searchTerm = '';
    this._treeSearchTerm = '';
    this._typeFilter = 'all';
    this._statusFilter = 'all';
    this._tableInstance = null;
    this._internalHandlers = {};

    // ======================
    // 3. TABLE CONFIG
    // ======================
    this.tableConfig = {
        layout: 'fitColumns',
        height: '100%',
        placeholder: 'Select a location from the tree',
        selectable: 1,
        columns: [
            { title: 'ID', field: 'id', widthGrow: 1, headerSort: true },
            { title: 'Name', field: 'name', widthGrow: 2, headerSort: true },
            { title: 'Type', field: 'type', widthGrow: 1, headerSort: true, formatter: typeFormatter },
            { title: 'Status', field: 'status', widthGrow: 1, headerSort: true, formatter: statusFormatter }
        ]
    };

    // ======================
    // 4. BINDINGS
    // ======================
    this.renderTree = renderTree.bind(this);
    this.renderTable = renderTable.bind(this);
    this.appendChildren = appendChildren.bind(this);
    this.toggleNode = toggleNode.bind(this);
    this.selectNode = selectNode.bind(this);
    this.expandAll = expandAll.bind(this);
    this.collapseAll = collapseAll.bind(this);
    this.search = search.bind(this);
    this.filterByType = filterByType.bind(this);
    this.filterByStatus = filterByStatus.bind(this);

    // ======================
    // 5. SUBSCRIBE
    // ======================
    go(
        Object.entries(this.subscriptions),
        each(([topic, fnList]) =>
            each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
        )
    );

    // ======================
    // 6. CUSTOM EVENTS
    // ======================
    this.customEvents = {
        click: {
            '.refresh-btn': '@refreshClicked'
        }
    };
    bindEvents(this, this.customEvents);

    // ======================
    // 7. INTERNAL HANDLERS
    // ======================
    setupInternalHandlers.call(this);

    // ======================
    // 8. INIT TABLE
    // ======================
    initTable.call(this);

    // ======================
    // 9. INIT RESIZER
    // ======================
    setupResizer.call(this);

    console.log('[AssetList] Registered - hierarchy tree view mode');
}

// ======================
// INTERNAL EVENT HANDLERS
// ======================
function setupInternalHandlers() {
    const root = this.appendElement;
    const ctx = this;

    // 테이블 검색 입력 핸들러
    this._internalHandlers.searchInput = (e) => ctx.search(e.target.value);

    // 타입 필터 핸들러
    this._internalHandlers.typeChange = (e) => ctx.filterByType(e.target.value);

    // 상태 필터 핸들러
    this._internalHandlers.statusChange = (e) => ctx.filterByStatus(e.target.value);

    // 트리 검색 핸들러
    this._internalHandlers.treeSearchInput = (e) => {
        ctx._treeSearchTerm = e.target.value;
        if (ctx._treeData) {
            renderTreeNodes.call(ctx, ctx._treeData, ctx._treeSearchTerm);
        }
    };

    // 전체 펼침 버튼
    this._internalHandlers.expandAll = () => ctx.expandAll();

    // 전체 접힘 버튼
    this._internalHandlers.collapseAll = () => ctx.collapseAll();

    // 트리 노드 클릭 (이벤트 위임)
    this._internalHandlers.treeClick = (e) => {
        const nodeContent = e.target.closest('.node-content');
        if (!nodeContent) return;

        const nodeEl = nodeContent.closest('.tree-node');
        if (!nodeEl) return;

        const nodeId = nodeEl.dataset.nodeId;
        const toggle = nodeContent.querySelector('.node-toggle');

        // 토글 영역 클릭 → 펼침/접힘
        if (e.target.closest('.node-toggle') && !toggle.classList.contains('leaf')) {
            ctx.toggleNode(nodeId, nodeEl);
        } else {
            // 나머지 영역 클릭 → 노드 선택
            ctx.selectNode(nodeId);
        }
    };

    // 이벤트 등록
    root.querySelector('.search-input')?.addEventListener('input', this._internalHandlers.searchInput);
    root.querySelector('.type-filter')?.addEventListener('change', this._internalHandlers.typeChange);
    root.querySelector('.status-filter')?.addEventListener('change', this._internalHandlers.statusChange);
    root.querySelector('.tree-search-input')?.addEventListener('input', this._internalHandlers.treeSearchInput);
    root.querySelector('.btn-expand-all')?.addEventListener('click', this._internalHandlers.expandAll);
    root.querySelector('.btn-collapse-all')?.addEventListener('click', this._internalHandlers.collapseAll);
    root.querySelector('.tree-container')?.addEventListener('click', this._internalHandlers.treeClick);
}

// ======================
// FORMATTERS
// ======================
function typeFormatter(cell) {
    const value = cell.getValue();
    return `<span class="type-badge" data-type="${value}">${value.toUpperCase()}</span>`;
}

function statusFormatter(cell) {
    const value = cell.getValue();
    return `<span class="status-badge" data-status="${value}">${value}</span>`;
}

// ======================
// TABLE INITIALIZATION
// ======================
function initTable() {
    const container = this.appendElement.querySelector('.table-container');
    if (!container) return;

    const uniqueId = `tabulator-${this.id}`;
    container.id = uniqueId;

    const ctx = this;

    this._tableInstance = new Tabulator(`#${uniqueId}`, this.tableConfig);

    this._tableInstance.on('rowClick', (_, row) => {
        const asset = row.getData();
        onRowClick.call(ctx, asset);
    });
}

// ======================
// TREE RENDER
// ======================
function renderTree({ response }) {
    const { data } = response;
    if (!data || !data.items) return;

    this._treeData = data.items;

    // 타이틀 업데이트
    const titleEl = this.appendElement.querySelector('.tree-title');
    if (titleEl && data.title) {
        titleEl.textContent = data.title;
    }

    renderTreeNodes.call(this, data.items, this._treeSearchTerm);

    console.log('[AssetList] Tree rendered:', data.summary);
}

/**
 * Lazy Loading으로 가져온 children을 트리에 추가
 */
function appendChildren({ response }) {
    const { data } = response;
    if (!data || !data.parentId) return;

    const { parentId, children } = data;

    // 트리 데이터에 children 추가
    addChildrenToNode.call(this, this._treeData, parentId, children);

    // 로딩 완료 표시
    this._loadedNodes.add(parentId);

    // 트리 재렌더링
    renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);

    console.log(`[AssetList] Lazy loaded ${children.length} children for ${parentId}`);
}

/**
 * 트리 데이터에서 특정 노드를 찾아 children 추가
 */
function addChildrenToNode(items, parentId, children) {
    if (!items) return false;

    for (const item of items) {
        if (item.id === parentId) {
            item.children = children;
            return true;
        }
        if (item.children && item.children.length > 0) {
            if (addChildrenToNode.call(this, item.children, parentId, children)) {
                return true;
            }
        }
    }
    return false;
}

function renderTreeNodes(items, searchTerm = '') {
    const rootEl = this.appendElement.querySelector('.tree-root');
    if (!rootEl) return;

    rootEl.innerHTML = '';
    const normalized = searchTerm.toLowerCase().trim();

    go(
        items,
        each(item => {
            const nodeEl = createTreeNode.call(this, item, normalized);
            if (nodeEl) rootEl.appendChild(nodeEl);
        })
    );
}

function createTreeNode(item, searchTerm) {
    const { id, name, type, status, children = [], hasChildren: apiHasChildren, assetCount } = item;
    // hasChildren: API에서 제공된 값이 있으면 사용, 없으면 children 배열로 판단
    const hasChildren = apiHasChildren !== undefined ? apiHasChildren : children.length > 0;
    const hasLoadedChildren = children.length > 0;
    const isExpanded = this._expandedNodes.has(id);
    const isSelected = this._selectedNodeId === id;
    const needsLazyLoad = hasChildren && !hasLoadedChildren && !this._loadedNodes.has(id);

    // 검색 필터
    const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm);
    const hasMatchingDescendants = hasLoadedChildren && checkDescendants(children, searchTerm);

    if (searchTerm && !matchesSearch && !hasMatchingDescendants) {
        return null;
    }

    const li = document.createElement('li');
    li.className = 'tree-node';
    li.dataset.nodeId = id;
    li.dataset.nodeType = type;
    li.dataset.hasChildren = hasChildren;
    li.dataset.needsLazyLoad = needsLazyLoad;

    // Node Content
    const content = document.createElement('div');
    content.className = 'node-content';
    if (isSelected) content.classList.add('selected');

    // Toggle
    const toggle = document.createElement('span');
    toggle.className = 'node-toggle';
    if (hasChildren) {
        toggle.textContent = '▶';
        if (isExpanded) toggle.classList.add('expanded');
    } else {
        toggle.classList.add('leaf');
    }

    // Icon
    const icon = document.createElement('span');
    icon.className = 'node-icon';
    icon.dataset.type = type;

    // Label
    const label = document.createElement('span');
    label.className = 'node-label';
    label.textContent = name;

    content.appendChild(toggle);
    content.appendChild(icon);
    content.appendChild(label);

    // Count (방에만 표시)
    if (type === 'room' && assetCount !== undefined) {
        const count = document.createElement('span');
        count.className = 'node-asset-count';
        count.textContent = `(${assetCount})`;
        content.appendChild(count);
    }

    // Status indicator
    const statusDot = document.createElement('span');
    statusDot.className = `node-status ${status}`;
    content.appendChild(statusDot);

    li.appendChild(content);

    // Children
    if (hasChildren) {
        const childrenUl = document.createElement('ul');
        childrenUl.className = 'node-children';
        if (isExpanded || (searchTerm && hasMatchingDescendants)) {
            childrenUl.classList.add('expanded');
        }

        // 로딩된 children이 있으면 렌더링
        if (hasLoadedChildren) {
            go(
                children,
                each(child => {
                    const childEl = createTreeNode.call(this, child, searchTerm);
                    if (childEl) childrenUl.appendChild(childEl);
                })
            );
        } else if (needsLazyLoad) {
            // Lazy Loading 필요한 경우 로딩 표시
            const loadingLi = document.createElement('li');
            loadingLi.className = 'tree-node loading-placeholder';
            loadingLi.innerHTML = '<span class="loading-text">Loading...</span>';
            childrenUl.appendChild(loadingLi);
        }

        li.appendChild(childrenUl);
    }

    return li;
}

function checkDescendants(children, searchTerm) {
    if (!searchTerm) return false;
    return children.some(child => {
        if (child.name.toLowerCase().includes(searchTerm)) return true;
        return child.children && checkDescendants(child.children, searchTerm);
    });
}

// ======================
// NODE ACTIONS
// ======================
function toggleNode(nodeId, nodeEl) {
    const isExpanding = !this._expandedNodes.has(nodeId);

    if (isExpanding) {
        this._expandedNodes.add(nodeId);

        // Lazy Loading 필요 여부 확인
        const needsLazyLoad = nodeEl?.dataset.needsLazyLoad === 'true';

        if (needsLazyLoad && !this._loadedNodes.has(nodeId)) {
            // Lazy Loading 요청 이벤트 발행
            Weventbus.emit('@hierarchyChildrenRequested', {
                event: { nodeId },
                targetInstance: this
            });
        }
    } else {
        this._expandedNodes.delete(nodeId);
    }

    updateNodeVisuals.call(this, nodeId);
}

function selectNode(nodeId) {
    const prev = this.appendElement.querySelector('.node-content.selected');
    if (prev) prev.classList.remove('selected');

    this._selectedNodeId = nodeId;

    const nodeEl = this.appendElement.querySelector(`[data-node-id="${nodeId}"] > .node-content`);
    if (nodeEl) nodeEl.classList.add('selected');

    // 페이지에 노드 선택 이벤트 발행 → 페이지가 hierarchyAssets 데이터 요청
    const node = findNodeById.call(this, nodeId);
    Weventbus.emit('@hierarchyNodeSelected', {
        event: { nodeId, node },
        targetInstance: this
    });
}

function expandAll() {
    collectAllNodeIds.call(this, this._treeData);
    if (this._treeData) {
        renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);
    }
}

function collapseAll() {
    this._expandedNodes.clear();
    if (this._treeData) {
        renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);
    }
}

function collectAllNodeIds(items) {
    if (!items) return;
    go(
        items,
        each(item => {
            if (item.children && item.children.length > 0) {
                this._expandedNodes.add(item.id);
                collectAllNodeIds.call(this, item.children);
            }
        })
    );
}

function findNodeById(nodeId) {
    function searchNode(items) {
        for (const item of items || []) {
            if (item.id === nodeId) return item;
            if (item.children) {
                const found = searchNode(item.children);
                if (found) return found;
            }
        }
        return null;
    }
    return searchNode(this._treeData);
}

function updateNodeVisuals(nodeId) {
    const nodeEl = this.appendElement.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeEl) return;

    const toggle = nodeEl.querySelector(':scope > .node-content > .node-toggle');
    const children = nodeEl.querySelector(':scope > .node-children');
    const isExpanded = this._expandedNodes.has(nodeId);

    if (toggle) toggle.classList.toggle('expanded', isExpanded);
    if (children) children.classList.toggle('expanded', isExpanded);
}

// ======================
// TABLE RENDER
// ======================
function renderTable({ response }) {
    const { data } = response;
    if (!data) return;

    const { nodePath, assets = [], summary } = data;

    // 선택 노드 정보 업데이트
    const pathEl = this.appendElement.querySelector('.node-path');
    const countEl = this.appendElement.querySelector('.selected-node-info .node-count');
    if (pathEl) pathEl.textContent = nodePath || '전체 자산';
    if (countEl) countEl.textContent = `${assets.length}개`;

    this._allAssets = assets;
    applyFilters.call(this);

    console.log('[AssetList] Table rendered:', summary);
}

function applyFilters() {
    const searchTerm = this._searchTerm.toLowerCase();
    const typeFilter = this._typeFilter;
    const statusFilter = this._statusFilter;

    const filtered = this._allAssets.filter(asset => {
        const matchesSearch = !searchTerm ||
            asset.name.toLowerCase().includes(searchTerm) ||
            asset.id.toLowerCase().includes(searchTerm);
        const matchesType = typeFilter === 'all' || asset.type === typeFilter;
        const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
    });

    if (this._tableInstance) {
        this._tableInstance.setData(filtered);
    }

    updateCount.call(this, filtered.length);
}

function updateCount(count) {
    const countEl = this.appendElement.querySelector('.count-value');
    if (countEl) {
        countEl.textContent = count !== undefined ? count : this._allAssets.length;
    }
}

// ======================
// PUBLIC METHODS
// ======================
function search(term) {
    this._searchTerm = term;
    applyFilters.call(this);
}

function filterByType(type) {
    this._typeFilter = type;
    applyFilters.call(this);
}

function filterByStatus(status) {
    this._statusFilter = status;
    applyFilters.call(this);
}

// ======================
// ROW CLICK HANDLER
// ======================
function onRowClick(asset) {
    Weventbus.emit('@assetSelected', {
        event: { asset },
        targetInstance: this
    });
}

// ======================
// RESIZER
// ======================
function setupResizer() {
    const root = this.appendElement;
    const resizer = root.querySelector('.pane-resizer');
    const treePane = root.querySelector('.tree-pane');

    if (!resizer || !treePane) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = treePane.offsetWidth;
        resizer.classList.add('dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isResizing) return;
        const diff = e.clientX - startX;
        const newWidth = Math.min(400, Math.max(200, startWidth + diff));
        treePane.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
        isResizing = false;
        resizer.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', onMouseDown);

    // 정리를 위해 저장
    this._internalHandlers.resizerMouseDown = onMouseDown;
}
