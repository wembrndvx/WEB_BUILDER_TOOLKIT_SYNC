/**
 * Master - before_load.js
 *
 * 호출 시점: 앱 시작 직후, Master 컴포넌트들이 초기화되기 전
 *
 * 책임:
 * - Master 레벨 이벤트 버스 핸들러 등록
 * - 앱 전역 설정 초기화
 */

const { onEventBusHandlers } = Wkit;

// ======================
// EVENT BUS HANDLERS
// ======================

this.masterEventBusHandlers = {
    /**
     * 사용자 메뉴 클릭 이벤트
     */
    '@userMenuClicked': ({ event }) => {
        console.log('[Master] User menu clicked');
        // 확장 포인트: 드롭다운 메뉴 표시 등
    },

    /**
     * 네비게이션 아이템 클릭 이벤트
     */
    '@navItemClicked': ({ event }) => {
        const navItem = event.target.closest('[data-menu-id]');
        const menuId = navItem?.dataset?.menuId;
        console.log('[Master] Navigation clicked:', menuId);
        // 확장 포인트: 페이지 이동 처리
    }
};

onEventBusHandlers(this.masterEventBusHandlers);

console.log('[Master] before_load - Event handlers registered');
