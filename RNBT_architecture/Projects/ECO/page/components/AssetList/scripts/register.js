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
const { bindEvents, fetchData } = Wkit;
const { each, go, map, filter, find } = fx;

initComponent.call(this);

function initComponent() {
    // ======================
    // 1. SUBSCRIPTIONS
    // ======================
    this.subscriptions = {
        'hierarchy': ['renderTree'],
        'hierarchyAssets': ['renderTable'],
        'hierarchyChildren': ['appendChildren'],
        'locale': ['setLocale']
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
    this._locale = 'ko'; // 현재 locale (ko, en, ja)
    this._uiTexts = null; // UI i18n 텍스트
    this._uiTextsCache = {}; // locale별 캐시

    // ======================
    // 3. TABLE CONFIG
    // ======================
    this.tableConfig = {
        layout: 'fitColumns',
        height: '100%',
        placeholder: 'Select a location from the tree',
        selectable: 1,
        // Pagination
        pagination: true,
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100, 200],
        paginationCounter: 'rows',
        columns: [
            { title: 'ID', field: 'id', widthGrow: 1, headerSort: true },
            { title: 'Name', field: 'name', widthGrow: 2, headerSort: true },
            { title: 'Type', field: 'typeLabel', widthGrow: 1, headerSort: true, formatter: typeFormatter },
            { title: 'Status', field: 'statusLabel', widthGrow: 1, headerSort: true, formatter: statusFormatter }
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
    this.setLocale = setLocale.bind(this);
    this.loadUITexts = loadUITexts.bind(this);
    this.applyUITexts = applyUITexts.bind(this);

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

    // ======================
    // 10. INIT UI I18N
    // ======================
    this.loadUITexts(this._locale).then(texts => {
        if (texts) this.applyUITexts(texts);
    });

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
    const row = cell.getRow().getData();
    const value = cell.getValue();
    return `<span class="type-badge" data-type="${row.type}">${value}</span>`;
}

function statusFormatter(cell) {
    const row = cell.getRow().getData();
    const value = cell.getValue();
    return `<span class="status-badge" data-status="${row.status}">${value}</span>`;
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
        map(item => createTreeNode.call(this, item, normalized)),
        filter(nodeEl => nodeEl),
        each(nodeEl => rootEl.appendChild(nodeEl))
    );
}

function createTreeNode(item, searchTerm) {
    const { id, type, children = [], hasChildren: apiHasChildren } = item;
    // hasChildren: API에서 제공된 값이 있으면 사용, 없으면 children 배열로 판단
    const hasChildren = apiHasChildren !== undefined ? apiHasChildren : children.length > 0;
    const hasLoadedChildren = children.length > 0;
    const isExpanded = this._expandedNodes.has(id);
    const isSelected = this._selectedNodeId === id;
    const needsLazyLoad = hasChildren && !hasLoadedChildren && !this._loadedNodes.has(id);

    // 검색 필터
    const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
    const hasMatchingDescendants = hasLoadedChildren && checkDescendants(children, searchTerm);

    if (searchTerm && !matchesSearch && !hasMatchingDescendants) {
        return null;
    }

    // li 요소 생성
    const li = document.createElement('li');
    li.className = 'tree-node';
    li.dataset.nodeId = id;
    li.dataset.nodeType = type;
    li.dataset.hasChildren = hasChildren;
    li.dataset.needsLazyLoad = needsLazyLoad;

    // node-content 생성 (분리된 함수)
    const content = createNodeContent(item, { isSelected, isExpanded, hasChildren });
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
                map(child => createTreeNode.call(this, child, searchTerm)),
                filter(childEl => childEl),
                each(childEl => childrenUl.appendChild(childEl))
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

/**
 * 트리 노드의 content 영역 생성
 * - toggle, icon, label, count, status 요소 포함
 */
function createNodeContent(item, { isSelected, isExpanded, hasChildren }) {
    const { name, type, status, assetCount } = item;

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

    // Count (room만)
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

    return content;
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
            // Lazy Loading 요청 이벤트 발행 (locale 포함)
            Weventbus.emit('@hierarchyChildrenRequested', {
                event: { assetId: nodeId, locale: this._locale },
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
        event: { assetId: nodeId, node, locale: this._locale },
        targetInstance: this
    });
}

/**
 * Expand All - 모든 노드를 재귀적으로 로드하며 확장
 * Lazy Loading 환경에서도 동작
 */
async function expandAll() {
    if (!this._treeData) return;

    // 로딩 표시
    const expandBtn = this.appendElement.querySelector('.btn-expand-all');
    if (expandBtn) {
        expandBtn.disabled = true;
        expandBtn.textContent = '...';
    }

    try {
        // 재귀적으로 모든 노드 로드 및 확장
        await expandAllRecursive.call(this, this._treeData);

        // 트리 재렌더링
        renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);
        console.log('[AssetList] Expand All completed');
    } catch (error) {
        console.error('[AssetList] Expand All failed:', error);
    } finally {
        // 버튼 복구
        if (expandBtn) {
            expandBtn.disabled = false;
            expandBtn.textContent = '▼';
        }
    }
}

/**
 * 재귀적으로 모든 노드 확장 및 children 로드
 */
async function expandAllRecursive(items) {
    if (!items || items.length === 0) return;

    const loadPromises = [];

    for (const item of items) {
        const { id, hasChildren, children = [] } = item;
        const needsChildren = hasChildren && children.length === 0;

        // 확장 상태 추가
        if (hasChildren || children.length > 0) {
            this._expandedNodes.add(id);
        }

        // Lazy Loading 필요한 경우 API 호출
        if (needsChildren && !this._loadedNodes.has(id)) {
            const promise = loadChildrenForNode.call(this, item)
                .then(() => {
                    // 로드된 children도 재귀적으로 확장
                    if (item.children && item.children.length > 0) {
                        return expandAllRecursive.call(this, item.children);
                    }
                });
            loadPromises.push(promise);
        } else if (children.length > 0) {
            // 이미 로드된 children 재귀 확장
            loadPromises.push(expandAllRecursive.call(this, children));
        }
    }

    await Promise.all(loadPromises);
}

/**
 * 단일 노드의 children 로드
 */
async function loadChildrenForNode(node) {
    try {
        const result = await fetchData(this.page, 'hierarchyChildren', {
            assetId: node.id,
            locale: this._locale
        });

        const data = result?.response?.data;
        if (data && data.children) {
            node.children = data.children;
            this._loadedNodes.add(node.id);
        }
    } catch (error) {
        console.error(`[AssetList] Failed to load children for ${node.id}:`, error);
    }
}

function collapseAll() {
    this._expandedNodes.clear();
    if (this._treeData) {
        renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);
    }
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

    const { assetPath, assets = [], summary } = data;

    // 선택 노드 정보 업데이트
    const pathEl = this.appendElement.querySelector('.node-path');
    const countEl = this.appendElement.querySelector('.selected-node-info .node-count');
    if (pathEl) pathEl.textContent = assetPath || '전체 자산';
    if (countEl) countEl.textContent = `${assets.length}개`;

    this._allAssets = assets;
    applyFilters.call(this);

    console.log('[AssetList] Table rendered:', summary);
}

function applyFilters() {
    const searchTerm = this._searchTerm.toLowerCase();
    const typeFilter = this._typeFilter;
    const statusFilter = this._statusFilter;

    const matchesSearch = asset => !searchTerm ||
        asset.name.toLowerCase().includes(searchTerm) ||
        asset.id.toLowerCase().includes(searchTerm);
    const matchesType = asset => typeFilter === 'all' || asset.type === typeFilter;
    const matchesStatus = asset => statusFilter === 'all' || asset.status === statusFilter;

    const filtered = go(
        this._allAssets,
        filter(matchesSearch),
        filter(matchesType),
        filter(matchesStatus)
    );

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

/**
 * locale 변경 시 호출 (GlobalDataPublisher 'locale' topic 구독)
 * @param {{ response: { data: { locale: string } } }} param
 */
function setLocale({ response }) {
    const { data } = response;
    if (!data || !data.locale) return;

    this._locale = data.locale;
    console.log('[AssetList] Locale changed:', this._locale);

    // UI 텍스트 업데이트
    this.loadUITexts(this._locale).then(texts => {
        if (texts) this.applyUITexts(texts);
    });

    // 트리 상태 초기화 후 재로드 요청 이벤트 발행
    this._expandedNodes.clear();
    this._loadedNodes.clear();

    Weventbus.emit('@localeChanged', {
        event: { locale: this._locale },
        targetInstance: this
    });
}

// ======================
// ROW CLICK HANDLER
// ======================

/**
 * 지원하는 자산 타입별 API 매핑
 * key: 자산 타입 (API 응답의 type 필드)
 * value: datasetList.json의 dataset name
 */
const ASSET_TYPE_API_MAP = {
    ups: 'ups',
    pdu: 'pdu',
    crac: 'crac',
    sensor: 'sensor'
};

// ASSET_TYPE_FIELDS 하드코딩 제거
// API 응답의 fields 배열을 직접 사용하도록 변경됨

/**
 * 테이블 행 클릭 시 자산 타입별 API 호출 및 Modal 표시
 * API 응답의 fields 배열을 직접 사용 (하드코딩 제거)
 */
async function onRowClick(asset) {
    const { id, type, name } = asset;
    const datasetName = ASSET_TYPE_API_MAP[type];

    // 이벤트 발행 (기존 동작 유지)
    Weventbus.emit('@assetSelected', {
        event: { asset },
        targetInstance: this
    });

    // Modal 열기 (로딩 상태)
    showModal.call(this, { asset, loading: true });

    // 지원하지 않는 타입
    if (!datasetName) {
        showModal.call(this, { asset, noApi: true });
        console.warn(`[AssetList] No API available for asset type: "${type}" (${name})`);
        return;
    }

    // 타입별 API 호출 (locale 파라미터 추가)
    try {
        console.log(`[AssetList] Fetching ${datasetName} API for: ${id} (locale: ${this._locale})`);
        const result = await fetchData(this.page, datasetName, {
            assetId: id,
            locale: this._locale
        });
        const data = result?.response?.data;

        if (data) {
            console.log(`[AssetList] ${type.toUpperCase()} data:`, data);

            // Modal에 데이터 표시 (API 응답의 fields 배열 사용)
            showModal.call(this, { asset, detail: data });
        }
    } catch (error) {
        console.error(`[AssetList] Failed to fetch ${datasetName} API for ${id}:`, error);
        showModal.call(this, { asset, error: true });
    }
}

// ======================
// MODAL
// ======================

/**
 * Modal 표시
 */
function showModal({ asset, detail, loading, noApi, error }) {
    const modal = this.appendElement.querySelector('.asset-modal');
    if (!modal) return;

    const { id, name, type, typeLabel, status, statusLabel } = asset;

    // 헤더 업데이트 (API 응답의 typeLabel, statusLabel 우선 사용)
    const displayTypeLabel = detail?.typeLabel || typeLabel || type;
    const displayStatusLabel = detail?.statusLabel || statusLabel || status;
    const displayStatus = detail?.status || status;

    modal.querySelector('.modal-title').textContent = detail?.name || name || id;
    modal.querySelector('.modal-subtitle').textContent = `${displayTypeLabel} · ${id}`;
    const statusEl = modal.querySelector('.modal-status');
    statusEl.textContent = displayStatusLabel;
    statusEl.dataset.status = displayStatus;

    // 바디 업데이트 (분리된 함수)
    const grid = modal.querySelector('.modal-info-grid');
    renderModalBody(grid, { loading, noApi, error, detail, displayTypeLabel });

    // Modal 표시
    modal.hidden = false;

    // 닫기 이벤트 (한 번만 등록)
    if (!this._modalCloseHandler) {
        this._modalCloseHandler = (e) => {
            if (e.target.closest('.modal-close-btn') || e.target.classList.contains('modal-overlay')) {
                hideModal.call(this);
            }
        };
        modal.addEventListener('click', this._modalCloseHandler);
    }
}

/**
 * Modal 바디 렌더링
 * - 상태(loading, noApi, error, detail)에 따라 다른 내용 표시
 */
function renderModalBody(grid, { loading, noApi, error, detail, displayTypeLabel }) {
    if (loading) {
        grid.innerHTML = '<div class="modal-loading"></div>';
        return;
    }

    if (noApi) {
        grid.innerHTML = `
            <div class="modal-no-api wide">
                <div class="modal-no-api-icon">📋</div>
                <div class="modal-no-api-text">No detailed API available for "${displayTypeLabel}"</div>
            </div>
        `;
        return;
    }

    if (error) {
        grid.innerHTML = `
            <div class="modal-no-api wide">
                <div class="modal-no-api-icon">⚠️</div>
                <div class="modal-no-api-text">Failed to load data</div>
            </div>
        `;
        return;
    }

    if (detail) {
        grid.innerHTML = renderFieldsGrid(detail.fields);
    }
}

/**
 * fields 배열을 HTML 그리드로 변환
 * - order 순으로 정렬
 * - valueLabel 또는 value + unit 표시
 */
function renderFieldsGrid(fields) {
    if (!fields || fields.length === 0) {
        return `
            <div class="modal-no-api wide">
                <div class="modal-no-api-icon">📋</div>
                <div class="modal-no-api-text">No field data available</div>
            </div>
        `;
    }

    return go(
        fields,
        arr => [...arr].sort((a, b) => (a.order || 0) - (b.order || 0)),
        map(({ label, value, unit, valueLabel }) => {
            const displayValue = valueLabel ? valueLabel : (unit ? `${value}${unit}` : value);
            return `
                <div class="modal-info-item">
                    <div class="modal-info-label">${label}</div>
                    <div class="modal-info-value">${displayValue ?? '-'}</div>
                </div>
            `;
        }),
        arr => arr.join('')
    );
}

/**
 * Modal 닫기
 */
function hideModal() {
    const modal = this.appendElement.querySelector('.asset-modal');
    if (modal) {
        modal.hidden = true;
    }
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

// ======================
// UI I18N
// ======================

/**
 * UI 텍스트 JSON 로드
 * @param {string} locale - 언어 코드 (ko, en, ja)
 * @returns {Promise<Object|null>} i18n JSON 객체
 */
async function loadUITexts(locale = 'ko') {
    if (this._uiTextsCache[locale]) {
        return this._uiTextsCache[locale];
    }

    try {
        // 컴포넌트 기준 상대 경로로 i18n JSON 로드
        const basePath = this.componentPath || '';
        const res = await fetch(`${basePath}i18n/${locale}.json`);
        const json = await res.json();
        this._uiTextsCache[locale] = json;
        this._uiTexts = json;
        return json;
    } catch (error) {
        console.error('[AssetList] Failed to load UI texts:', error);
        // fallback to en (default)
        if (locale !== 'en' && this._uiTextsCache['en']) {
            return this._uiTextsCache['en'];
        }
        // 캐시에 en도 없으면 기본 영문 텍스트 반환
        return getDefaultUITexts();
    }
}

/**
 * 기본 UI 텍스트 (영문)
 * i18n JSON 로드 실패 시 fallback
 */
function getDefaultUITexts() {
    return {
        panel: { title: 'Asset List' },
        tree: {
            title: 'Hierarchy',
            searchPlaceholder: 'Search hierarchy...',
            expandAll: 'Expand All',
            collapseAll: 'Collapse All'
        },
        table: {
            defaultPath: 'All Assets',
            searchPlaceholder: 'Search by name or ID...',
            columns: { id: 'ID', name: 'Name', type: 'Type', status: 'Status' },
            placeholder: 'Select a location from the tree'
        },
        filter: { allTypes: 'All Types', allStatus: 'All Status' },
        status: { normal: 'Normal', warning: 'Warning', critical: 'Critical' },
        footer: { total: 'Total:', count: '{count}' },
        actions: { refresh: 'Refresh' }
    };
}

/**
 * UI 텍스트 적용
 * @param {Object} texts - i18n JSON 객체
 */
function applyUITexts(texts) {
    if (!texts) return;

    const root = this.appendElement;
    this._uiTexts = texts;

    // data-i18n 속성으로 텍스트 적용
    go(
        root.querySelectorAll('[data-i18n]'),
        each(el => {
            const value = getNestedValue(texts, el.dataset.i18n);
            if (value) el.textContent = value;
        })
    );

    // data-i18n-placeholder 속성으로 placeholder 적용
    go(
        root.querySelectorAll('[data-i18n-placeholder]'),
        each(el => {
            const value = getNestedValue(texts, el.dataset.i18nPlaceholder);
            if (value) el.placeholder = value;
        })
    );

    // data-i18n-title 속성으로 title 적용
    go(
        root.querySelectorAll('[data-i18n-title]'),
        each(el => {
            const value = getNestedValue(texts, el.dataset.i18nTitle);
            if (value) el.title = value;
        })
    );

    // 테이블 컬럼 헤더 업데이트
    if (this._tableInstance && texts.table?.columns) {
        updateTableColumns.call(this, texts);
    }

    // 테이블 placeholder 업데이트
    if (this._tableInstance && texts.table?.placeholder) {
        this.tableConfig.placeholder = texts.table.placeholder;
    }

    console.log('[AssetList] UI texts applied:', this._locale);
}

/**
 * 테이블 컬럼 헤더 업데이트
 */
function updateTableColumns(texts) {
    if (!this._tableInstance) return;

    const columnTitleMap = {
        id: texts.table.columns.id,
        name: texts.table.columns.name,
        typeLabel: texts.table.columns.type,
        statusLabel: texts.table.columns.status
    };

    const columns = this._tableInstance.getColumnDefinitions();
    go(
        columns,
        each(col => {
            if (columnTitleMap[col.field]) {
                col.title = columnTitleMap[col.field];
            }
        })
    );
    this._tableInstance.setColumns(columns);
}

/**
 * 중첩 객체에서 점 표기법 키로 값 가져오기
 * @param {Object} obj - 객체
 * @param {string} key - 점 표기법 키 (예: "panel.title")
 */
function getNestedValue(obj, key) {
    return key.split('.').reduce((o, k) => o?.[k], obj);
}
