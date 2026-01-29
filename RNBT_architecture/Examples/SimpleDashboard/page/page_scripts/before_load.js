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
    tableData: { category: 'all' },
    chartData: { period: '7d' }
};

// ======================
// EVENT BUS HANDLERS
// ======================

this.pageEventBusHandlers = {
    /**
     * StatsCards 카드 클릭 이벤트
     */
    '@cardClicked': ({ event }) => {
        const card = event.target.closest('[data-stat-key]');
        const statKey = card?.dataset?.statKey;
        console.log('[Page] Card clicked:', statKey);
    },

    /**
     * DataTable 행 클릭 이벤트
     */
    '@rowClicked': ({ event, data }) => {
        console.log('[Page] Table row clicked:', data);
    },

    /**
     * DataTable 필터 변경 이벤트
     */
    '@filterChanged': ({ event }) => {
        const category = event.target.value;
        console.log('[Page] Filter changed:', category);

        this.currentParams.tableData = { category };

        GlobalDataPublisher.fetchAndPublish(
            'tableData',
            this,
            this.currentParams.tableData
        );
    },

    /**
     * TrendChart 기간 변경 이벤트
     */
    '@periodChanged': ({ event }) => {
        const period = event.target.value;
        console.log('[Page] Period changed:', period);

        this.currentParams.chartData = { period };

        GlobalDataPublisher.fetchAndPublish(
            'chartData',
            this,
            this.currentParams.chartData
        );
    }
};

onEventBusHandlers(this.pageEventBusHandlers);

console.log('[Page] before_load - Event handlers registered');
