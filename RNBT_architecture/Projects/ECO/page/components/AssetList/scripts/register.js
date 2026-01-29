/**
 * AssetList - 계층형 자산 목록 컴포넌트 (Asset API v1)
 *
 * 기능:
 * 1. 트리뷰로 자산 계층 표시 (Asset + Relation 데이터로 구성)
 * 2. 선택한 노드의 하위 자산 목록을 테이블로 표시
 * 3. 검색 및 필터링
 * 4. 새로고침 버튼 - 외부 이벤트 (@refreshClicked)
 * 5. 행 클릭 - 외부 이벤트 (@assetSelected) + assetDetail API 호출
 *
 * 데이터 흐름:
 * - GlobalDataPublisher의 'assetList' topic 구독 → 자산 목록 저장
 * - GlobalDataPublisher의 'relationList' topic 구독 → 관계 목록으로 트리 구성
 */

const { subscribe } = GlobalDataPublisher;
const { bindEvents, fetchData } = Wkit;
const { each, go, map, filter } = fx;

const BASE_URL = 'http://10.23.128.140:8811';

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. SUBSCRIPTIONS (Asset API v1)
  // ======================
  this.subscriptions = {
    assetList: ['onAssetListReceived'],
    relationList: ['onRelationListReceived'],
  };

  // ======================
  // 2. STATE
  // ======================
  // 캐시 구조 (AssetTreePanel 방식)
  this._cache = {
    assets: new Map(),      // assetKey → Asset (전체 자산 캐시)
    children: new Set(),    // 자식이 있는 assetKey 집합 (toAssetKey로 등록된 자산)
    childKeys: new Set(),   // 자식인 assetKey 집합 (fromAssetKey로 등록된 자산)
    parent: new Map(),      // childKey → parentKey (부모 찾기용)
    loading: new Set(),     // 로딩 중인 노드
  };

  this._treeData = [];         // 루트 노드만 (Lazy Loading)
  this._expandedNodes = new Set();
  this._selectedNodeId = null;
  this._filteredAssets = [];   // 선택된 노드 하위 자산
  this._searchTerm = '';
  this._treeSearchTerm = '';
  this._typeFilter = 'all';
  this._statusFilter = 'all';
  this._tableInstance = null;
  this._internalHandlers = {};
  this._dataReady = { assets: false, relations: false };

  // ======================
  // 3. TABLE CONFIG
  // ======================
  this.tableConfig = {
    layout: 'fitColumns',
    height: '100%',
    placeholder: 'Select a location from the tree',
    selectable: 1,
    pagination: true,
    paginationSize: 50,
    paginationSizeSelector: [25, 50, 100, 200],
    paginationCounter: 'rows',
    columns: [
      { title: 'Key', field: 'assetKey', widthGrow: 1, headerSort: true },
      { title: 'Name', field: 'name', widthGrow: 2, headerSort: true },
      { title: 'Type', field: 'assetType', widthGrow: 1, headerSort: true, formatter: typeFormatter },
      { title: 'Status', field: 'statusType', widthGrow: 1, headerSort: true, formatter: statusFormatter },
    ],
  };

  // ======================
  // 4. BINDINGS
  // ======================
  this.onAssetListReceived = onAssetListReceived.bind(this);
  this.onRelationListReceived = onRelationListReceived.bind(this);
  this.buildTree = buildTree.bind(this);
  this.renderTree = renderTree.bind(this);
  this.renderTable = renderTable.bind(this);
  this.toggleNode = toggleNode.bind(this);
  this.selectNode = selectNode.bind(this);
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
      each((fn) => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
  );

  // ======================
  // 6. CUSTOM EVENTS
  // ======================
  this.customEvents = {
    click: {
      '.refresh-btn': '@refreshClicked',
    },
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

  console.log('[AssetList] Registered - Asset API v1 mode');
}

// ======================
// DATA HANDLERS (Asset API v1)
// ======================

/**
 * assetList 데이터 수신 → assetsCache에 저장
 */
function onAssetListReceived({ response }) {
  const { data } = response;
  if (!data) return;

  // assetsCache에 저장
  data.forEach((asset) => {
    this._cache.assets.set(asset.assetKey, asset);
  });

  this._dataReady.assets = true;
  console.log('[AssetList] Assets cached:', this._cache.assets.size);

  // 두 데이터가 모두 준비되면 트리 빌드
  if (this._dataReady.assets && this._dataReady.relations) {
    this.buildTree();
  }
}

/**
 * relationList 데이터 수신 (LOCATED_IN만) → childrenCache, parentCache에 저장
 */
function onRelationListReceived({ response }) {
  const { data } = response;
  if (!data) return;

  // childKeys: fromAssetKey 집합 (누군가의 자식인 자산)
  // children: toAssetKey 집합 (자식이 있는 자산)
  // parent: childKey → parentKey
  data.forEach(({ fromAssetKey, toAssetKey }) => {
    this._cache.childKeys.add(fromAssetKey);
    this._cache.children.add(toAssetKey);
    this._cache.parent.set(fromAssetKey, toAssetKey);
  });

  this._dataReady.relations = true;
  console.log('[AssetList] Relations processed:', data.length, '/ Children nodes:', this._cache.children.size);

  // 두 데이터가 모두 준비되면 트리 빌드
  if (this._dataReady.assets && this._dataReady.relations) {
    this.buildTree();
  }
}

// ======================
// TREE BUILD (Asset + Relation)
// ======================

/**
 * 트리 구조 빌드 (Lazy Loading 방식)
 * - 루트 노드만 초기 렌더링
 * - 자식 존재 여부는 childrenCache로 판별
 */
function buildTree() {
  const { _cache: cache } = this;

  // 루트 노드: childKeys에 포함되지 않은 자산 (아무도 자신을 자식으로 가리키지 않음)
  const rootNodes = [];
  cache.assets.forEach((asset, assetKey) => {
    if (!cache.childKeys.has(assetKey)) {
      // hasChildren: toAssetKey로 등록된 적 있으면 자식 존재
      const hasChildren = cache.children.has(assetKey);
      rootNodes.push({
        ...asset,
        hasChildren,
        children: [],  // Lazy Loading - 확장 시 로드
        loaded: false,
      });
    }
  });

  // 이름순 정렬
  rootNodes.sort((a, b) => a.name.localeCompare(b.name));

  this._treeData = rootNodes;
  console.log('[AssetList] Tree built (Lazy):', rootNodes.length, 'root nodes');

  // 트리 렌더링
  this.renderTree();
}

// ======================
// INTERNAL EVENT HANDLERS
// ======================

function setupInternalHandlers() {
  const root = this.appendElement;
  const ctx = this;

  this._internalHandlers = {
    searchInput: (e) => ctx.search(e.target.value),
    typeChange: (e) => ctx.filterByType(e.target.value),
    statusChange: (e) => ctx.filterByStatus(e.target.value),
    treeSearchInput: (e) => {
      ctx._treeSearchTerm = e.target.value;
      if (ctx._treeData) {
        renderTreeNodes.call(ctx, ctx._treeData, ctx._treeSearchTerm);
      }
    },
    collapseAll: () => ctx.collapseAll(),
    treeClick: (e) => handleTreeClick.call(ctx, e),
  };

  const bindings = [
    ['.search-input', 'input', 'searchInput'],
    ['.type-filter', 'change', 'typeChange'],
    ['.status-filter', 'change', 'statusChange'],
    ['.tree-search-input', 'input', 'treeSearchInput'],
    ['.btn-collapse-all', 'click', 'collapseAll'],
    ['.tree-container', 'click', 'treeClick'],
  ];

  go(
    bindings,
    each(([selector, event, handler]) => {
      const el = root.querySelector(selector);
      if (el) el.addEventListener(event, this._internalHandlers[handler]);
    })
  );
}

function handleTreeClick(e) {
  const nodeContent = e.target.closest('.node-content');
  if (!nodeContent) return;

  const nodeEl = nodeContent.closest('.tree-node');
  if (!nodeEl) return;

  const nodeId = nodeEl.dataset.nodeId;
  const toggle = nodeContent.querySelector('.node-toggle');
  const isToggleClick = e.target.closest('.node-toggle') && !toggle.classList.contains('leaf');

  if (isToggleClick) {
    this.toggleNode(nodeId, nodeEl);
  } else {
    this.selectNode(nodeId);
  }
}

// ======================
// FORMATTERS
// ======================

function typeFormatter(cell) {
  const value = cell.getValue();
  return `<span class="type-badge" data-type="${value.toLowerCase()}">${value}</span>`;
}

function statusFormatter(cell) {
  const value = cell.getValue();
  const label = statusTypeToLabel(value);
  return `<span class="status-badge" data-status="${statusTypeToDataAttr(value)}">${label}</span>`;
}

function statusTypeToLabel(statusType) {
  const labels = {
    ACTIVE: 'Normal',
    WARNING: 'Warning',
    CRITICAL: 'Critical',
    INACTIVE: 'Inactive',
    MAINTENANCE: 'Maintenance',
  };
  return labels[statusType] || statusType;
}

function statusTypeToDataAttr(statusType) {
  const map = {
    ACTIVE: 'normal',
    WARNING: 'warning',
    CRITICAL: 'critical',
    INACTIVE: 'inactive',
    MAINTENANCE: 'maintenance',
  };
  return map[statusType] || 'normal';
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

function renderTree() {
  if (!this._treeData) return;
  renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);
}

function renderTreeNodes(items, searchTerm = '') {
  const rootEl = this.appendElement.querySelector('.tree-root');
  if (!rootEl) return;

  rootEl.innerHTML = '';
  const normalized = searchTerm.toLowerCase().trim();

  go(
    items,
    map((item) => createTreeNode.call(this, item, normalized)),
    filter((nodeEl) => nodeEl),
    each((nodeEl) => rootEl.appendChild(nodeEl))
  );
}

function createTreeNode(item, searchTerm) {
  const { assetKey, assetType, hasChildren = false, children = [], loaded = false } = item;
  const isExpanded = this._expandedNodes.has(assetKey);
  const isSelected = this._selectedNodeId === assetKey;
  const isLoading = this._cache.loading.has(assetKey);

  // 검색 필터 (로드된 자식만 검색 가능)
  const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
  const hasMatchingDescendants = loaded && children.length > 0 && checkDescendants(children, searchTerm);

  if (searchTerm && !matchesSearch && !hasMatchingDescendants) {
    return null;
  }

  const li = document.createElement('li');
  li.className = 'tree-node';
  li.dataset.nodeId = assetKey;
  li.dataset.nodeType = assetType;
  li.dataset.hasChildren = hasChildren;

  const content = createNodeContent(item, { isSelected, isExpanded, hasChildren, isLoading });
  li.appendChild(content);

  // 자식 컨테이너 (hasChildren이면 생성, loaded된 경우만 렌더링)
  if (hasChildren) {
    const childrenUl = document.createElement('ul');
    childrenUl.className = 'node-children';
    if (isExpanded || (searchTerm && hasMatchingDescendants)) {
      childrenUl.classList.add('expanded');
    }

    if (loaded && children.length > 0) {
      // 로드된 자식 렌더링
      go(
        children,
        map((child) => createTreeNode.call(this, child, searchTerm)),
        filter((childEl) => childEl),
        each((childEl) => childrenUl.appendChild(childEl))
      );
    } else if (isLoading) {
      // 로딩 중 표시
      const loadingEl = document.createElement('li');
      loadingEl.className = 'tree-node-loading';
      loadingEl.innerHTML = '<span class="loading-spinner"></span> Loading...';
      childrenUl.appendChild(loadingEl);
    }

    li.appendChild(childrenUl);
  }

  return li;
}

function createNodeContent(item, { isSelected, isExpanded, hasChildren, isLoading }) {
  const { name, assetType, statusType, children = [], loaded = false } = item;

  const content = document.createElement('div');
  content.className = 'node-content';
  if (isSelected) content.classList.add('selected');

  // Toggle
  const toggle = document.createElement('span');
  toggle.className = 'node-toggle';
  if (hasChildren) {
    if (isLoading) {
      toggle.innerHTML = '<span class="loading-spinner-small"></span>';
    } else {
      toggle.textContent = '▶';
      if (isExpanded) toggle.classList.add('expanded');
    }
  } else {
    toggle.classList.add('leaf');
  }

  // Icon
  const icon = document.createElement('span');
  icon.className = 'node-icon';
  icon.dataset.type = assetType.toLowerCase();

  // Label
  const label = document.createElement('span');
  label.className = 'node-label';
  label.textContent = name;

  content.appendChild(toggle);
  content.appendChild(icon);
  content.appendChild(label);

  // Count (로드된 경우만 표시)
  if (hasChildren && loaded && children.length > 0) {
    const count = document.createElement('span');
    count.className = 'node-asset-count';
    count.textContent = `(${children.length})`;
    content.appendChild(count);
  }

  // Status indicator
  const statusDot = document.createElement('span');
  statusDot.className = `node-status ${statusTypeToDataAttr(statusType)}`;
  content.appendChild(statusDot);

  return content;
}

function checkDescendants(children, searchTerm) {
  if (!searchTerm) return false;
  return children.some((child) => {
    if (child.name.toLowerCase().includes(searchTerm)) return true;
    return child.children && checkDescendants(child.children, searchTerm);
  });
}

// ======================
// NODE ACTIONS
// ======================

/**
 * 노드 토글 (Lazy Loading)
 * - 확장 시 자식이 로드되지 않았으면 API 호출
 */
async function toggleNode(nodeId) {
  const { _cache: cache, _expandedNodes: expanded } = this;

  // 접기
  if (expanded.has(nodeId)) {
    expanded.delete(nodeId);
    updateNodeVisuals.call(this, nodeId);
    return;
  }

  // 펼치기
  expanded.add(nodeId);

  // 노드 찾기
  const node = findNodeByKey(this._treeData, nodeId);
  if (!node) {
    updateNodeVisuals.call(this, nodeId);
    return;
  }

  // 이미 로드됨
  if (node.loaded) {
    updateNodeVisuals.call(this, nodeId);
    return;
  }

  // 자식 없음
  if (!node.hasChildren) {
    updateNodeVisuals.call(this, nodeId);
    return;
  }

  // Lazy Loading 시작
  cache.loading.add(nodeId);
  updateNodeVisuals.call(this, nodeId);

  try {
    // Relation API로 자식 관계 조회 (toAssetKey = 현재 노드)
    const relResult = await fetchData(this.page, 'relationChildren', {
      baseUrl: BASE_URL,
      toAssetKey: nodeId,
      relationType: 'LOCATED_IN',
    });
    const relations = relResult?.response?.data || [];
    console.log(`[AssetList] Children relations for ${nodeId}:`, relations.length);

    // 자식 assetKey 추출
    const childKeys = relations.map((r) => r.fromAssetKey);

    // 캐시에서 자식 자산 정보 가져오기
    const children = childKeys
      .map((key) => {
        const asset = cache.assets.get(key);
        if (!asset) return null;
        return {
          ...asset,
          hasChildren: cache.children.has(key),
          children: [],
          loaded: false,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    // 노드에 자식 추가
    node.children = children;
    node.loaded = true;

    console.log(`[AssetList] Children loaded for ${nodeId}:`, children.length);
  } catch (error) {
    console.error(`[AssetList] Failed to load children for ${nodeId}:`, error);
  } finally {
    cache.loading.delete(nodeId);
  }

  // 트리 재렌더링 (해당 노드만)
  renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);
}

function selectNode(nodeId) {
  const prev = this.appendElement.querySelector('.node-content.selected');
  if (prev) prev.classList.remove('selected');

  this._selectedNodeId = nodeId;

  const nodeEl = this.appendElement.querySelector(`[data-node-id="${nodeId}"] > .node-content`);
  if (nodeEl) nodeEl.classList.add('selected');

  // 선택한 노드의 하위 모든 자산 가져오기
  const node = findNodeByKey(this._treeData, nodeId);
  if (node) {
    const descendants = getDescendantAssets(node);
    this._filteredAssets = descendants;
    this.renderTable();
  }

  // 이벤트 발행
  Weventbus.emit('@assetNodeSelected', {
    event: { assetKey: nodeId, node },
    targetInstance: this,
  });
}

function collapseAll() {
  this._expandedNodes.clear();
  if (this._treeData) {
    renderTreeNodes.call(this, this._treeData, this._treeSearchTerm);
  }
}

/**
 * 트리에서 assetKey로 노드 검색
 */
function findNodeByKey(items, assetKey) {
  if (!items) return null;

  for (const item of items) {
    if (item.assetKey === assetKey) return item;
    if (item.children) {
      const found = findNodeByKey(item.children, assetKey);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 노드의 모든 하위 자산 가져오기 (자기 자신 포함)
 */
function getDescendantAssets(node) {
  const result = [node];
  if (node.children) {
    node.children.forEach((child) => {
      result.push(...getDescendantAssets(child));
    });
  }
  return result;
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

function renderTable() {
  const pathEl = this.appendElement.querySelector('.node-path');
  const countEl = this.appendElement.querySelector('.selected-node-info .node-count');

  if (this._selectedNodeId) {
    const node = findNodeByKey(this._treeData, this._selectedNodeId);
    if (pathEl) pathEl.textContent = node?.name || this._selectedNodeId;
    if (countEl) countEl.textContent = `${this._filteredAssets.length}개`;
  } else {
    if (pathEl) pathEl.textContent = '전체 자산';
    if (countEl) countEl.textContent = `${this._cache.assets.size}개`;
  }

  applyFilters.call(this);
}

function applyFilters() {
  const searchTerm = this._searchTerm.toLowerCase();
  const typeFilter = this._typeFilter;
  const statusFilter = this._statusFilter;

  // 전체 자산은 캐시에서 배열로 변환
  const allAssets = Array.from(this._cache.assets.values());
  const sourceData = this._selectedNodeId ? this._filteredAssets : allAssets;

  const matchesSearch = (asset) =>
    !searchTerm ||
    asset.name.toLowerCase().includes(searchTerm) ||
    asset.assetKey.toLowerCase().includes(searchTerm);
  const matchesType = (asset) => typeFilter === 'all' || asset.assetType.toLowerCase() === typeFilter;
  const matchesStatus = (asset) => statusFilter === 'all' || statusTypeToDataAttr(asset.statusType) === statusFilter;

  const filtered = go(sourceData, filter(matchesSearch), filter(matchesType), filter(matchesStatus));

  if (this._tableInstance) {
    this._tableInstance.setData(filtered);
  }

  updateCount.call(this, filtered.length);
}

function updateCount(count) {
  const countEl = this.appendElement.querySelector('.count-value');
  if (countEl) {
    countEl.textContent = count !== undefined ? count : this._cache.assets.size;
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
// ROW CLICK HANDLER (Asset API v1)
// ======================

/**
 * 테이블 행 클릭 시 assetDetail API 호출 및 Modal 표시
 */
async function onRowClick(asset) {
  const { assetKey, name, assetType } = asset;

  // 이벤트 발행
  Weventbus.emit('@assetSelected', {
    event: { asset },
    targetInstance: this,
  });

  // Modal 열기 (로딩 상태)
  showModal.call(this, { asset, loading: true });

  // assetDetailUnified API 호출 (통합 API: asset + properties)
  try {
    console.log(`[AssetList] Fetching assetDetailUnified for: ${assetKey}`);
    const result = await fetchData(this.page, 'assetDetailUnified', { baseUrl: BASE_URL, assetKey, locale: 'ko' });
    const data = result?.response?.data;

    if (data && data.asset) {
      console.log(`[AssetList] Asset detail (unified):`, data);
      showModal.call(this, { asset: data.asset, properties: data.properties || [] });
    } else {
      showModal.call(this, { asset, error: true });
    }
  } catch (error) {
    console.error(`[AssetList] Failed to fetch assetDetailUnified for ${assetKey}:`, error);
    showModal.call(this, { asset, error: true });
  }
}

// ======================
// MODAL
// ======================

function showModal({ asset, properties, loading, error }) {
  const modal = this.appendElement.querySelector('.asset-modal');
  if (!modal) return;

  const { assetKey, name, assetType, statusType } = asset;

  // 헤더 업데이트
  modal.querySelector('.modal-title').textContent = name || assetKey;
  modal.querySelector('.modal-subtitle').textContent = `${assetType} · ${assetKey}`;
  const statusEl = modal.querySelector('.modal-status');
  statusEl.textContent = statusTypeToLabel(statusType);
  statusEl.dataset.status = statusTypeToDataAttr(statusType);

  // 바디 업데이트
  const grid = modal.querySelector('.modal-info-grid');
  renderModalBody(grid, { loading, error, properties });

  // Modal 표시
  modal.hidden = false;

  // 닫기 이벤트
  if (!this._modalCloseHandler) {
    this._modalCloseHandler = (e) => {
      if (e.target.closest('.modal-close-btn') || e.target.classList.contains('modal-overlay')) {
        hideModal.call(this);
      }
    };
    modal.addEventListener('click', this._modalCloseHandler);
  }
}

function renderModalBody(grid, { loading, error, properties }) {
  if (loading) {
    grid.innerHTML = '<div class="modal-loading"></div>';
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

  if (properties && properties.length > 0) {
    grid.innerHTML = renderPropertiesGrid(properties);
  } else {
    grid.innerHTML = `
      <div class="modal-no-api wide">
        <div class="modal-no-api-text">No properties available</div>
      </div>
    `;
  }
}

/**
 * 통합 API properties[] 배열을 HTML 그리드로 변환
 */
function renderPropertiesGrid(properties) {
  // displayOrder로 정렬
  const sortedProperties = [...properties].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return sortedProperties
    .map(({ label, value, helpText }) => {
      return `
        <div class="modal-info-item" title="${helpText || ''}">
          <div class="modal-info-label">${label}</div>
          <div class="modal-info-value">${value ?? '-'}</div>
        </div>
      `;
    })
    .join('');
}

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
  this._internalHandlers.resizerMouseDown = onMouseDown;
}
