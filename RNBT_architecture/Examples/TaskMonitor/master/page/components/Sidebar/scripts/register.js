/**
 * Sidebar - 필터 옵션 UI
 *
 * 기능:
 * 1. 필터 옵션 표시 (status, priority, type, assignee)
 * 2. Apply Filters 버튼 - 외부 이벤트 (@filterApplied)
 * 3. Reset 버튼 - 필터 초기화
 *
 * 데이터 흐름:
 * - GlobalDataPublisher의 'filters' topic 구독 → 셀렉트 옵션 렌더링
 */

const { subscribe } = GlobalDataPublisher;
const { bindEvents } = Wkit;
const { each, go } = fx;

// ======================
// STATE
// ======================

this._currentFilters = {
    status: 'all',
    priority: 'all',
    type: 'all',
    assignee: 'all'
};

this._internalHandlers = {};

// ======================
// SUBSCRIPTIONS
// ======================

this.subscriptions = {
    'filters': ['renderFilters']
};

// ======================
// BINDINGS
// ======================

this.renderFilters = renderFilters.bind(this);

// ======================
// SUBSCRIBE
// ======================

go(
    Object.entries(this.subscriptions),
    each(([topic, fnList]) =>
        each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// ======================
// CUSTOM EVENTS
// ======================

this.customEvents = {
    click: {
        '.btn-apply': '@filterApplied',
        '.btn-reset': '@filterReset'
    }
};

bindEvents(this, this.customEvents);

// ======================
// INTERNAL HANDLERS
// ======================

setupInternalHandlers.call(this);

function setupInternalHandlers() {
    const root = this.appendElement;
    const ctx = this;

    // 셀렉트 변경 시 내부 상태 업데이트
    this._internalHandlers.selectChange = (e) => {
        const filterType = e.target.dataset.filter;
        if (filterType) {
            ctx._currentFilters[filterType] = e.target.value;
        }
    };

    // Reset 클릭 시 필터 초기화
    this._internalHandlers.reset = () => {
        ctx._currentFilters = {
            status: 'all',
            priority: 'all',
            type: 'all',
            assignee: 'all'
        };

        // 셀렉트 UI 초기화
        root.querySelectorAll('.filter-select').forEach(select => {
            select.value = 'all';
        });
    };

    // 이벤트 등록
    root.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', this._internalHandlers.selectChange);
    });

    root.querySelector('.btn-reset')?.addEventListener('click', this._internalHandlers.reset);
}

// customEvents 핸들러에서 현재 필터를 이벤트에 포함하도록 수정
const originalEmit = Weventbus.emit;
const ctx = this;

// btn-apply 클릭 시 현재 필터 상태를 함께 전달
this._internalHandlers.applyClick = () => {
    Weventbus.emit('@filterApplied', {
        event: { filters: { ...ctx._currentFilters } },
        targetInstance: ctx
    });
};

this.appendElement.querySelector('.btn-apply')?.addEventListener('click', this._internalHandlers.applyClick);

// ======================
// RENDER FUNCTIONS
// ======================

function renderFilters({ response }) {
    const { data } = response;
    if (!data) return;

    const root = this.appendElement;

    // Status options
    populateSelect(root.querySelector('[data-filter="status"]'), data.statuses);

    // Priority options
    populateSelect(root.querySelector('[data-filter="priority"]'), data.priorities);

    // Type options
    populateSelect(root.querySelector('[data-filter="type"]'), data.types);

    // Assignee options
    populateSelect(root.querySelector('[data-filter="assignee"]'), data.assignees);

    console.log('[Sidebar] Filters rendered');
}

function populateSelect(selectEl, options) {
    if (!selectEl || !options) return;

    selectEl.innerHTML = options.map(opt =>
        `<option value="${opt.value}">${opt.label}</option>`
    ).join('');
}

console.log('[Sidebar] Registered');
