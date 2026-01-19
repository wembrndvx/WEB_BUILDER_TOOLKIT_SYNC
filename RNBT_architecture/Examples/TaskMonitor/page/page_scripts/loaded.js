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

this.globalDataMappings = [
    {
        topic: 'tasks',
        datasetInfo: {
            datasetName: 'tasksApi',
            param: { status: 'all', priority: 'all', type: 'all', assignee: 'all' }
        },
        refreshInterval: 10000
    },
    {
        topic: 'statusSummary',
        datasetInfo: {
            datasetName: 'statusApi',
            param: {}
        },
        refreshInterval: 15000
    },
    {
        topic: 'activity',
        datasetInfo: {
            datasetName: 'activityApi',
            param: { limit: 10 }
        },
        refreshInterval: 8000
    }
];

// ======================
// INITIALIZATION
// ======================

fx.go(
    this.globalDataMappings,
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
        this.globalDataMappings,
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
