/**
 * ActivityLog - 최근 활동 로그
 *
 * 기능:
 * 1. 최근 활동 목록 표시
 * 2. 액션별 아이콘/색상 구분
 * 3. 실시간 업데이트
 *
 * 데이터 흐름:
 * - GlobalDataPublisher의 'activity' topic 구독 → 로그 렌더링
 */

const { subscribe } = GlobalDataPublisher;
const { each, go } = fx;

// ======================
// SUBSCRIPTIONS
// ======================

this.subscriptions = {
    'activity': ['renderActivity']
};

// ======================
// CONFIG
// ======================

const ACTION_ICONS = {
    created: '+',
    updated: '↻',
    completed: '✓',
    assigned: '→',
    commented: '💬'
};

const ACTION_MESSAGES = {
    created: (item) => `<span class="user-name">${item.user}</span> created <span class="task-id">${item.taskId}</span>`,
    updated: (item) => `<span class="user-name">${item.user}</span> updated <span class="task-id">${item.taskId}</span>`,
    completed: (item) => `<span class="user-name">${item.user}</span> completed <span class="task-id">${item.taskId}</span>`,
    assigned: (item) => `<span class="task-id">${item.taskId}</span> assigned to <span class="user-name">${item.user}</span>`,
    commented: (item) => `<span class="user-name">${item.user}</span> commented on <span class="task-id">${item.taskId}</span>`
};

// ======================
// BINDINGS
// ======================

this.renderActivity = renderActivity.bind(this);

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
// RENDER FUNCTIONS
// ======================

function renderActivity({ response }) {
    const { data, meta } = response;
    if (!data) return;

    const root = this.appendElement;

    // Update count
    const countEl = root.querySelector('.count-value');
    if (countEl) {
        countEl.textContent = meta?.count ?? data.length;
    }

    // Render log items
    const listEl = root.querySelector('.log-list');
    if (!listEl) return;

    listEl.innerHTML = data.map(item => {
        const icon = ACTION_ICONS[item.action] || '•';
        const message = ACTION_MESSAGES[item.action]?.(item) || `${item.user} ${item.action} ${item.taskId}`;
        const time = formatRelativeTime(item.timestamp);

        return `
            <div class="log-item">
                <div class="log-icon" data-action="${item.action}">${icon}</div>
                <div class="log-content">
                    <div class="log-message">${message}</div>
                    <div class="log-time">${time}</div>
                </div>
            </div>
        `;
    }).join('');

    console.log('[ActivityLog] Activity rendered:', meta);
}

function formatRelativeTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return time.toLocaleDateString();
}

console.log('[ActivityLog] Registered');
