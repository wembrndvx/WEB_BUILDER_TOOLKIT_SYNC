/**
 * Master - before_unload.js
 *
 * 호출 시점: 앱 종료 직전
 *
 * 책임:
 * - 이벤트 핸들러 해제
 * - 데이터 매핑 해제
 * - 메모리 정리
 */

const { offEventBusHandlers } = Wkit;
const { each } = fx;

// ======================
// CLEANUP
// ======================

if (this.masterEventBusHandlers) {
    offEventBusHandlers(this.masterEventBusHandlers);
    this.masterEventBusHandlers = null;
}

if (this.masterDataMappings) {
    fx.go(
        this.masterDataMappings,
        each(({ topic }) => GlobalDataPublisher.unregisterMapping(topic))
    );
    this.masterDataMappings = null;
}

console.log('[Master] before_unload - Cleanup completed');
