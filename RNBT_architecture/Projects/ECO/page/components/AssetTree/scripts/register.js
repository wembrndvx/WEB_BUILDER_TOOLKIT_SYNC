/**
 * AssetTree - 배치된 3D 장비의 위치 계층 트리 컴포넌트
 *
 * 기능:
 * 1. threeLayer에서 배치된 3D 인스턴스 수집
 * 2. 각 인스턴스의 setter.assetInfo.ancestorKeys로 위치 계층 구성
 * 3. ast/l API로 조상 자산 이름/타입 조회
 * 4. Building → Floor → Room → Equipment 트리 렌더링
 * 5. 장비 노드 클릭 시 해당 3D 인스턴스의 showDetail() 호출
 */

const { bindEvents, fetchData, makeIterator } = Wkit;

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. STATE
  // ======================
  this._baseUrl = wemb.configManager.assetApiUrl.replace(/^https?:\/\//, '');
  this._datasetName = 'assetList';
  this._assetCache = new Map();      // assetKey → { name, assetType, statusType }
  this._treeData = [];               // 렌더링용 트리 구조
  this._instanceMap = new Map();     // assetKey → 3D instance 참조 (클릭용)
  this._expandedNodes = new Set();
  this._searchTerm = '';
  this._internalHandlers = {};

  // ======================
  // 2. BINDINGS
  // ======================
  this.collectAndBuild = collectAndBuild.bind(this);
  this.renderTree = renderTree.bind(this);

  // ======================
  // 3. CUSTOM EVENTS
  // ======================
  this.customEvents = {
    click: {
      '.refresh-btn': '@refreshClicked',
    },
  };
  bindEvents(this, this.customEvents);

  // ======================
  // 4. INTERNAL HANDLERS
  // ======================
  setupInternalHandlers.call(this);

  // ======================
  // 5. INITIAL DATA COLLECTION
  // ======================
  this.collectAndBuild();

  console.log('[AssetTree] Registered');
}

// ======================
// DATA COLLECTION + TREE BUILD
// ======================

/**
 * 3D 인스턴스 수집 → 자산 조회 → 트리 빌드
 */
async function collectAndBuild() {
  const root = this.appendElement;
  const emptyEl = root.querySelector('.tree-empty');
  const containerEl = root.querySelector('.tree-container');

  // 1. threeLayer에서 배치된 3D 인스턴스 수집
  const iter = makeIterator(this.page, 'threeLayer');
  const placedItems = [];      // { assetKey, name, assetType, statusType, ancestorKeys, instance }
  const ancestorKeySet = new Set();

  for (const inst of iter) {
    const assetInfo = inst.setter?.assetInfo;
    if (!assetInfo || !assetInfo.assetKey) continue;

    const { assetKey, name, assetType, statusType, ancestorKeys } = assetInfo;
    if (!ancestorKeys || !Array.isArray(ancestorKeys)) continue;

    placedItems.push({ assetKey, name, assetType, statusType, ancestorKeys, instance: inst });
    this._instanceMap.set(assetKey, inst);

    // 조상 키 수집
    ancestorKeys.forEach((key) => ancestorKeySet.add(key));
  }

  console.log('[AssetTree] Placed items:', placedItems.length, '/ Unique ancestors:', ancestorKeySet.size);

  // 배치된 장비 없음
  if (placedItems.length === 0) {
    this._treeData = [];
    if (emptyEl) emptyEl.hidden = false;
    if (containerEl) containerEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (containerEl) containerEl.style.display = '';

  // 2. ast/l API로 전체 자산 조회 → 조상 이름/타입 매핑
  try {
    const result = await fetchData(this.page, this._datasetName, { baseUrl: this._baseUrl });
    const assets = result?.response?.data || [];

    assets.forEach((asset) => {
      this._assetCache.set(asset.assetKey, {
        name: asset.name,
        assetType: asset.assetType,
        statusType: asset.statusType,
      });
    });

    console.log('[AssetTree] Asset cache populated:', this._assetCache.size);
  } catch (error) {
    console.error('[AssetTree] Failed to fetch asset list:', error);
  }

  // 배치된 장비 자체도 캐시에 추가 (API에 없을 수 있으므로)
  placedItems.forEach(({ assetKey, name, assetType, statusType }) => {
    if (!this._assetCache.has(assetKey)) {
      this._assetCache.set(assetKey, { name, assetType, statusType });
    }
  });

  // 3. 트리 빌드
  buildTree.call(this, placedItems);
}

// ======================
// TREE BUILD
// ======================

/**
 * ancestorKeys를 사용하여 트리 구조 조립
 *
 * 각 배치 인스턴스의 경로:
 *   [...ancestorKeys, assetKey]
 *   예: ['building-001', 'floor-001', 'room-001', 'ups-001']
 *
 * 트리 노드 구조:
 *   { assetKey, name, assetType, statusType, isEquipment, children: [] }
 */
function buildTree(placedItems) {
  const rootMap = new Map(); // assetKey → node (루트 레벨)

  placedItems.forEach(({ assetKey, ancestorKeys }) => {
    const path = [...ancestorKeys, assetKey];
    let currentLevel = rootMap;

    path.forEach((key, idx) => {
      if (!currentLevel.has(key)) {
        const cached = this._assetCache.get(key);
        const isEquipment = idx === path.length - 1;

        currentLevel.set(key, {
          assetKey: key,
          name: cached?.name || key,
          assetType: cached?.assetType || (isEquipment ? 'EQUIPMENT' : 'LOCATION'),
          statusType: cached?.statusType || 'ACTIVE',
          isEquipment,
          children: new Map(),
        });
      }

      currentLevel = currentLevel.get(key).children;
    });
  });

  // Map → Array 변환 (재귀)
  function mapToArray(nodeMap) {
    const arr = [];
    nodeMap.forEach((node) => {
      const childArray = mapToArray(node.children);
      arr.push({
        assetKey: node.assetKey,
        name: node.name,
        assetType: node.assetType,
        statusType: node.statusType,
        isEquipment: node.isEquipment,
        children: childArray,
      });
    });
    // 이름순 정렬
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }

  this._treeData = mapToArray(rootMap);
  console.log('[AssetTree] Tree built:', this._treeData.length, 'root nodes');

  this.renderTree();
}

// ======================
// INTERNAL EVENT HANDLERS
// ======================

function setupInternalHandlers() {
  const root = this.appendElement;
  const ctx = this;

  this._internalHandlers = {
    treeClick: (e) => handleTreeClick.call(ctx, e),
    treeDblClick: (e) => handleTreeDblClick.call(ctx, e),
    searchInput: (e) => {
      ctx._searchTerm = e.target.value;
      ctx.renderTree();
    },
    refreshClick: () => {
      ctx._assetCache.clear();
      ctx._instanceMap.clear();
      ctx._expandedNodes.clear();
      ctx._treeData = [];
      ctx.collectAndBuild();
    },
  };

  const treeContainer = root.querySelector('.tree-container');
  if (treeContainer) treeContainer.addEventListener('click', this._internalHandlers.treeClick);
  if (treeContainer) treeContainer.addEventListener('dblclick', this._internalHandlers.treeDblClick);

  const searchInput = root.querySelector('.tree-search-input');
  if (searchInput) searchInput.addEventListener('input', this._internalHandlers.searchInput);

  const refreshBtn = root.querySelector('.refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', this._internalHandlers.refreshClick);
}

function handleTreeClick(e) {
  const nodeContent = e.target.closest('.node-content');
  if (!nodeContent) return;

  const nodeEl = nodeContent.closest('.tree-node');
  if (!nodeEl) return;

  const assetKey = nodeEl.dataset.nodeId;
  toggleNode.call(this, assetKey);
}

function handleTreeDblClick(e) {
  const nodeContent = e.target.closest('.node-content');
  if (!nodeContent) return;

  const nodeEl = nodeContent.closest('.tree-node');
  if (!nodeEl) return;

  if (nodeEl.dataset.isEquipment !== 'true') return;

  const assetKey = nodeEl.dataset.nodeId;
  handleEquipmentClick.call(this, assetKey);
}

function handleEquipmentClick(assetKey) {
  const inst = this._instanceMap.get(assetKey);
  if (inst && typeof inst.showDetail === 'function') {
    console.log('[AssetTree] showDetail() called for:', assetKey);
    inst.showDetail();
  } else {
    console.warn('[AssetTree] No showDetail() for:', assetKey);
  }
}

function toggleNode(assetKey) {
  if (this._expandedNodes.has(assetKey)) {
    this._expandedNodes.delete(assetKey);
  } else {
    this._expandedNodes.add(assetKey);
  }

  // 부분 업데이트: 해당 노드의 toggle/children만 변경
  const nodeEl = this.appendElement.querySelector(`[data-node-id="${assetKey}"]`);
  if (!nodeEl) return;

  const toggle = nodeEl.querySelector(':scope > .node-content > .node-toggle');
  const children = nodeEl.querySelector(':scope > .node-children');
  const isExpanded = this._expandedNodes.has(assetKey);

  if (toggle) toggle.classList.toggle('expanded', isExpanded);
  if (children) children.classList.toggle('expanded', isExpanded);
}

// ======================
// TREE RENDER
// ======================

function renderTree() {
  const rootEl = this.appendElement.querySelector('.tree-root');
  if (!rootEl) return;

  rootEl.innerHTML = '';
  const searchTerm = this._searchTerm.toLowerCase().trim();

  this._treeData.forEach((item) => {
    const nodeEl = createTreeNode.call(this, item, searchTerm);
    if (nodeEl) rootEl.appendChild(nodeEl);
  });
}

function createTreeNode(item, searchTerm) {
  const { assetKey, assetType, statusType, name, isEquipment, children = [] } = item;
  const hasChildren = children.length > 0;
  const isExpanded = this._expandedNodes.has(assetKey);

  // 검색 필터
  const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm);
  const hasMatchingDescendants = hasChildren && checkDescendants(children, searchTerm);

  if (searchTerm && !matchesSearch && !hasMatchingDescendants) {
    return null;
  }

  const li = document.createElement('li');
  li.className = 'tree-node';
  li.dataset.nodeId = assetKey;
  li.dataset.isEquipment = isEquipment;

  // Node Content
  const content = document.createElement('div');
  content.className = 'node-content';
  if (isEquipment) content.classList.add('equipment');

  // Toggle
  const toggle = document.createElement('span');
  toggle.className = 'node-toggle';
  if (hasChildren) {
    if (isExpanded) toggle.classList.add('expanded');
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

  // Child Count (컨테이너 노드만)
  if (hasChildren) {
    const count = document.createElement('span');
    count.className = 'node-child-count';
    count.textContent = `(${children.length})`;
    content.appendChild(count);
  }

  // Status Dot
  const statusDot = document.createElement('span');
  statusDot.className = `node-status ${statusTypeToDataAttr(statusType)}`;
  content.appendChild(statusDot);

  li.appendChild(content);

  // Children
  if (hasChildren) {
    const childrenUl = document.createElement('ul');
    childrenUl.className = 'node-children';
    if (isExpanded || (searchTerm && hasMatchingDescendants)) {
      childrenUl.classList.add('expanded');
    }

    children.forEach((child) => {
      const childEl = createTreeNode.call(this, child, searchTerm);
      if (childEl) childrenUl.appendChild(childEl);
    });

    li.appendChild(childrenUl);
  }

  return li;
}

function checkDescendants(children, searchTerm) {
  if (!searchTerm) return false;
  return children.some((child) => {
    if (child.name.toLowerCase().includes(searchTerm)) return true;
    return child.children && checkDescendants(child.children, searchTerm);
  });
}

// ======================
// HELPERS
// ======================

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
