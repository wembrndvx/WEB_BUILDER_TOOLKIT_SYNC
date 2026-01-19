/**
 * TaskList - 태스크 목록 테이블
 *
 * 기능:
 * 1. Tabulator로 태스크 목록 표시
 * 2. 상태/우선순위 뱃지 표시
 * 3. 진행률 프로그레스 바 표시
 * 4. 행 클릭 - 외부 이벤트 (@taskClicked)
 *
 * 데이터 흐름:
 * - GlobalDataPublisher의 'tasks' topic 구독 → 테이블 렌더링
 */

const { subscribe } = GlobalDataPublisher;
const { each, go } = fx;

// ======================
// SUBSCRIPTIONS
// ======================

this.subscriptions = {
    'tasks': ['renderTable']
};

// ======================
// STATE
// ======================

this._tableInstance = null;

// ======================
// TABLE CONFIG
// ======================

this.tableConfig = {
    layout: 'fitColumns',
    height: '100%',
    placeholder: 'No tasks found',
    selectable: 1,
    columns: [
        { title: 'ID', field: 'id', width: 100, headerSort: true },
        { title: 'Title', field: 'title', widthGrow: 2, headerSort: true },
        { title: 'Type', field: 'type', width: 120, headerSort: true, formatter: typeFormatter },
        { title: 'Status', field: 'status', width: 120, headerSort: true, formatter: statusFormatter },
        { title: 'Priority', field: 'priority', width: 100, headerSort: true, formatter: priorityFormatter },
        { title: 'Assignee', field: 'assignee', width: 100, headerSort: true },
        { title: 'Progress', field: 'progress', width: 140, headerSort: true, formatter: progressFormatter }
    ]
};

// ======================
// BINDINGS
// ======================

this.renderTable = renderTable.bind(this);

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
// INIT TABLE
// ======================

initTable.call(this);

// ======================
// FORMATTERS
// ======================

function statusFormatter(cell) {
    const value = cell.getValue();
    const labels = {
        pending: 'Pending',
        in_progress: 'In Progress',
        completed: 'Completed',
        failed: 'Failed'
    };
    return `<span class="status-badge" data-status="${value}">${labels[value] || value}</span>`;
}

function priorityFormatter(cell) {
    const value = cell.getValue();
    const labels = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical'
    };
    return `<span class="priority-badge" data-priority="${value}">${labels[value] || value}</span>`;
}

function typeFormatter(cell) {
    const value = cell.getValue();
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function progressFormatter(cell) {
    const value = cell.getValue();
    return `
        <div class="progress-cell">
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${value}%"></div>
            </div>
            <span class="progress-text">${value}%</span>
        </div>
    `;
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
        const task = row.getData();
        Weventbus.emit('@taskClicked', {
            event: { task },
            data: task,
            targetInstance: ctx
        });
    });
}

// ======================
// RENDER FUNCTIONS
// ======================

function renderTable({ response }) {
    const { data, meta } = response;
    if (!data) return;

    // Update count
    const countEl = this.appendElement.querySelector('.count-value');
    if (countEl) {
        countEl.textContent = meta?.total ?? data.length;
    }

    // Update table
    if (this._tableInstance) {
        this._tableInstance.setData(data);
    }

    console.log('[TaskList] Table rendered:', meta);
}

console.log('[TaskList] Registered');
