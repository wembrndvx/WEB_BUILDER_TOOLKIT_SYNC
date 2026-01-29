/**
 * Master - loaded.js
 *
 * 호출 시점: Master 컴포넌트들이 모두 초기화된 후
 *
 * 책임:
 * - Master 레벨 데이터 매핑 등록
 * - 초기 데이터 발행 (userInfo, menuList)
 */

const { each } = fx;

// ======================
// DATA MAPPINGS
// ======================

this.masterDataMappings = [
    {
        topic: 'userInfo',
        datasetInfo: {
            datasetName: 'simpleDashboard_userApi',
            param: {}
        }
    },
    {
        topic: 'menuList',
        datasetInfo: {
            datasetName: 'simpleDashboard_menuApi',
            param: {}
        }
    }
];

// ======================
// INITIALIZATION
// ======================

fx.go(
    this.masterDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) => {
        GlobalDataPublisher.fetchAndPublish(topic, this, {});
    })
);

console.log('[Master] loaded - Data mappings registered, initial data published');
