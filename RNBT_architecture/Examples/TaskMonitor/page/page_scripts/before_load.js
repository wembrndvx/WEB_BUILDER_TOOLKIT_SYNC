/**
 * Page - before_load.js
 *
 * 호출 시점: 페이지 진입 직후, Page 컴포넌트들이 초기화되기 전
 *
 * 책임:
 * - Page 레벨 이벤트 버스 핸들러 등록
 * - 현재 파라미터 상태 초기화
 */

const { onEventBusHandlers } = Wkit;

// ======================
// CURRENT PARAMS STATE
// ======================

this.currentParams = {
    tasks: { status: 'all', priority: 'all', type: 'all', assignee: 'all' },
    activity: { limit: 10 }
};

// ======================
// EVENT BUS HANDLERS
// ======================

this.eventBusHandlers = {
    /**
     * Sidebar 필터 적용 이벤트
     */
    '@filterApplied': ({ event }) => {
        const { filters } = event;
        console.log('[Page] Filter applied:', filters);

        this.currentParams.tasks = { ...filters };

        GlobalDataPublisher.fetchAndPublish(
            'tasks',
            this,
            this.currentParams.tasks
        );
    },

    /**
     * Sidebar 필터 리셋 이벤트
     */
    '@filterReset': () => {
        console.log('[Page] Filter reset');

        this.currentParams.tasks = {
            status: 'all',
            priority: 'all',
            type: 'all',
            assignee: 'all'
        };

        GlobalDataPublisher.fetchAndPublish(
            'tasks',
            this,
            this.currentParams.tasks
        );
    },

    /**
     * TaskList 행 클릭 이벤트
     */
    '@taskClicked': ({ event, data }) => {
        console.log('[Page] Task clicked:', data);
    },

    /**
     * Header 전체 새로고침 이벤트
     */
    '@forceRefresh': () => {
        console.log('[Page] Force refresh triggered');

        // 모든 topic 재발행
        GlobalDataPublisher.fetchAndPublish('tasks', this, this.currentParams.tasks);
        GlobalDataPublisher.fetchAndPublish('statusSummary', this);
        GlobalDataPublisher.fetchAndPublish('activity', this, this.currentParams.activity);
    }
};

onEventBusHandlers(this.eventBusHandlers);

console.log('[Page] before_load - Event handlers registered');
