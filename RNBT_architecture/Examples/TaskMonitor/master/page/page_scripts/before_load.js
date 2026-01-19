/**
 * Master - before_load.js
 *
 * 호출 시점: 앱 시작 직후, Master 컴포넌트들이 초기화되기 전
 *
 * 책임:
 * - Master 레벨 이벤트 버스 핸들러 등록
 */

const { onEventBusHandlers } = Wkit;

// ======================
// EVENT BUS HANDLERS
// ======================

this.eventBusHandlers = {
    /**
     * Sidebar 필터 변경 이벤트
     * Master에서 받아 Page로 전달
     */
    '@filterApplied': ({ event }) => {
        console.log('[Master] Filter applied:', event.filters);
        // Page에서 이 이벤트를 구독하여 처리
    },

    /**
     * Header 새로고침 클릭
     */
    '@refreshAllClicked': () => {
        console.log('[Master] Refresh all clicked');
        Weventbus.emit('@forceRefresh', {});
    }
};

onEventBusHandlers(this.eventBusHandlers);

console.log('[Master] before_load - Event handlers registered');
