/**
 * Page - loaded.js (3D)
 *
 * 호출 시점: Page 컴포넌트들이 모두 초기화된 후
 *
 * 책임:
 * - Page 레벨 데이터 매핑 등록
 * - 장비 상태 데이터 발행
 * - 자동 갱신 인터벌 시작
 */

const { each } = fx;

// ======================
// DATA MAPPINGS
// ======================

this.pageDataMappings = [
    {
        topic: 'equipmentStatus',
        datasetInfo: {
            datasetName: 'simple3DStatus_equipmentStatusApi',
            param: {}
        },
        refreshInterval: 5000  // 5초마다 상태 갱신
    }
];

// ======================
// PARAM MANAGEMENT
// ======================

this.currentParams = {};
this.currentParams.equipmentStatus = {};

// ======================
// INITIALIZATION
// ======================

fx.go(
    this.pageDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) => {
        const params = this.currentParams?.[topic] || {};
        GlobalDataPublisher.fetchAndPublish(topic, this, params)
            .catch(err => console.error(`[fetchAndPublish:${topic}]`, err));
    })
);

// ======================
// INTERVAL MANAGEMENT
// ======================

this.refreshIntervals = this.refreshIntervals || {};

this.startAllIntervals = () => {
    fx.go(
        this.pageDataMappings,
        each(({ topic, refreshInterval }) => {
            if (refreshInterval) {
                this.refreshIntervals[topic] = setInterval(() => {
                    const params = this.currentParams?.[topic] || {};
                    GlobalDataPublisher.fetchAndPublish(topic, this, params)
                        .catch(err => console.error(`[fetchAndPublish:${topic}]`, err));
                }, refreshInterval);
            }
        })
    );
    console.log('[Page] Auto-refresh intervals started');
};

this.stopAllIntervals = () => {
    fx.go(
        Object.values(this.refreshIntervals || {}),
        each(clearInterval)
    );
    console.log('[Page] Auto-refresh intervals stopped');
};

this.startAllIntervals();

console.log('[Page] loaded - Equipment status data mapping registered, intervals started');
