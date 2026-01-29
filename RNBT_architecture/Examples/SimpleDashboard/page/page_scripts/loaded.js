/**
 * Page - loaded.js
 *
 * 호출 시점: Page 컴포넌트들이 모두 초기화된 후
 *
 * 책임:
 * - Page 레벨 데이터 매핑 등록
 * - 초기 데이터 발행
 * - 자동 갱신 인터벌 시작
 */

const { each } = fx;

// ======================
// DATA MAPPINGS
// ======================

this.pageDataMappings = [
    {
        topic: 'stats',
        datasetInfo: {
            datasetName: 'simpleDashboard_statsApi',
            param: {}
        },
        refreshInterval: 10000
    },
    {
        topic: 'tableData',
        datasetInfo: {
            datasetName: 'simpleDashboard_tableApi',
            param: { category: 'all' }
        },
        refreshInterval: 30000
    },
    {
        topic: 'chartData',
        datasetInfo: {
            datasetName: 'simpleDashboard_chartApi',
            param: { period: '7d' }
        },
        refreshInterval: 15000
    }
];

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

this.refreshIntervals = {};

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

console.log('[Page] loaded - Data mappings registered, initial data published, intervals started');
