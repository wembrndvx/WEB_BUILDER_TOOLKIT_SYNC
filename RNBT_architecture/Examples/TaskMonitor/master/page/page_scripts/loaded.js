/**
 * Master - loaded.js
 *
 * 호출 시점: Master 컴포넌트들이 모두 초기화된 후
 *
 * 책임:
 * - Master 레벨 데이터 매핑 등록
 * - 초기 데이터 발행
 */

const { each } = fx;

// ======================
// DATA MAPPINGS
// ======================

this.globalDataMappings = [
    {
        topic: 'appInfo',
        datasetInfo: {
            datasetName: 'appInfoApi',
            param: {}
        }
    },
    {
        topic: 'filters',
        datasetInfo: {
            datasetName: 'filtersApi',
            param: {}
        }
    }
];

// ======================
// INITIALIZATION
// ======================

fx.go(
    this.globalDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) =>
        GlobalDataPublisher.fetchAndPublish(topic, this)
            .catch(err => console.error(`[fetchAndPublish:${topic}]`, err))
    )
);

console.log('[Master] loaded - Data mappings registered, initial data published');
