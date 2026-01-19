/**
 * Header - 앱 정보 및 상태 표시
 *
 * 기능:
 * 1. 앱 이름, 버전 표시
 * 2. 서버 상태 표시 (healthy/unhealthy)
 * 3. 전체 태스크 수, 활성 태스크 수 표시
 * 4. 새로고침 버튼 - 외부 이벤트 (@refreshAllClicked)
 *
 * 데이터 흐름:
 * - GlobalDataPublisher의 'appInfo' topic 구독 → 렌더링
 */

const { subscribe } = GlobalDataPublisher;
const { bindEvents } = Wkit;
const { each, go } = fx;

// ======================
// SUBSCRIPTIONS
// ======================

this.subscriptions = {
    'appInfo': ['renderAppInfo']
};

// ======================
// BINDINGS
// ======================

this.renderAppInfo = renderAppInfo.bind(this);

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
        '.btn-refresh': '@refreshAllClicked'
    }
};

bindEvents(this, this.customEvents);

// ======================
// RENDER FUNCTIONS
// ======================

function renderAppInfo({ response }) {
    const { data } = response;
    if (!data) return;

    const root = this.appendElement;

    // App version
    const versionEl = root.querySelector('.app-version');
    if (versionEl) versionEl.textContent = `v${data.version}`;

    // Server status
    const statusDot = root.querySelector('.status-dot');
    const statusText = root.querySelector('.status-text');
    if (statusDot && statusText) {
        const isHealthy = data.serverStatus === 'healthy';
        statusDot.classList.toggle('healthy', isHealthy);
        statusText.textContent = isHealthy ? 'Connected' : 'Disconnected';
    }

    // Task summary
    const totalEl = root.querySelector('.total-tasks');
    const activeEl = root.querySelector('.active-tasks');
    if (totalEl) totalEl.textContent = data.totalTasks;
    if (activeEl) activeEl.textContent = data.activeTasks;

    // Last sync
    const syncEl = root.querySelector('.last-sync');
    if (syncEl && data.lastSync) {
        const date = new Date(data.lastSync);
        syncEl.textContent = `Last sync: ${date.toLocaleTimeString()}`;
    }

    console.log('[Header] App info rendered');
}

console.log('[Header] Registered');
