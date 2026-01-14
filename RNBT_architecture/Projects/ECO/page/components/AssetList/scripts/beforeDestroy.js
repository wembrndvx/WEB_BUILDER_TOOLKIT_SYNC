/**
 * AssetList - Destroy Script
 *
 * 정리 대상:
 * 1. 외부 이벤트 (customEvents - bindEvents로 등록)
 * 2. 내부 이벤트 (_internalHandlers - addEventListener로 등록)
 * 3. GlobalDataPublisher 구독 해제
 * 4. Tabulator 인스턴스
 * 5. 상태 초기화
 */

const { removeCustomEvents } = Wkit;
const { unsubscribe } = GlobalDataPublisher;
const { each } = fx;

// ======================
// 1. 외부 이벤트 해제 (bindEvents로 등록된 것)
// ======================
if (this.customEvents) {
    removeCustomEvents(this, this.customEvents);
    this.customEvents = null;
}

// ======================
// 2. 내부 이벤트 해제 (addEventListener로 등록된 것)
// ======================
if (this._internalHandlers) {
    const root = this.appendElement;

    // 테이블 관련
    root.querySelector('.search-input')?.removeEventListener('input', this._internalHandlers.searchInput);
    root.querySelector('.type-filter')?.removeEventListener('change', this._internalHandlers.typeChange);
    root.querySelector('.status-filter')?.removeEventListener('change', this._internalHandlers.statusChange);

    // 트리 관련
    root.querySelector('.tree-search-input')?.removeEventListener('input', this._internalHandlers.treeSearchInput);
    root.querySelector('.btn-expand-all')?.removeEventListener('click', this._internalHandlers.expandAll);
    root.querySelector('.btn-collapse-all')?.removeEventListener('click', this._internalHandlers.collapseAll);
    root.querySelector('.tree-container')?.removeEventListener('click', this._internalHandlers.treeClick);

    // 리사이저
    root.querySelector('.pane-resizer')?.removeEventListener('mousedown', this._internalHandlers.resizerMouseDown);

    this._internalHandlers = null;
}

// ======================
// 3. GlobalDataPublisher 구독 해제
// ======================
if (this.subscriptions) {
    fx.go(
        Object.keys(this.subscriptions),
        each(topic => unsubscribe(topic, this))
    );
    this.subscriptions = null;
}

// ======================
// 4. Tabulator 정리
// ======================
if (this._tableInstance) {
    this._tableInstance.destroy();
    this._tableInstance = null;
}

// ======================
// 5. 상태 초기화
// ======================
this._treeData = null;
this._expandedNodes = null;
this._loadedNodes = null;
this._selectedNodeId = null;
this._allAssets = null;
this._searchTerm = null;
this._treeSearchTerm = null;
this._typeFilter = null;
this._statusFilter = null;

console.log('[AssetList] Destroyed - tree, table, subscriptions, events cleaned up');
