/**
 * StatusChart - 상태별 파이 차트
 *
 * 기능:
 * 1. ECharts 파이 차트로 상태 분포 표시
 * 2. 실시간 데이터 갱신
 *
 * 데이터 흐름:
 * - GlobalDataPublisher의 'statusSummary' topic 구독 → 차트 렌더링
 */

const { subscribe } = GlobalDataPublisher;
const { each, go } = fx;

// ======================
// SUBSCRIPTIONS
// ======================

this.subscriptions = {
    'statusSummary': ['renderChart']
};

// ======================
// STATE
// ======================

this._chartInstance = null;

// ======================
// CHART CONFIG
// ======================

this.chartConfig = {
    optionBuilder: getChartOption
};

// ======================
// BINDINGS
// ======================

this.renderChart = renderChart.bind(this, this.chartConfig);

// ======================
// SUBSCRIBE
// ======================

go(
    Object.entries(this.subscriptions),
    each(([topic, fnList]) =>
        each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// ======================
// INIT CHART
// ======================

initChart.call(this);

// ======================
// CHART INITIALIZATION
// ======================

function initChart() {
    const container = this.appendElement.querySelector('.chart-container');
    if (!container) return;

    this._chartInstance = echarts.init(container);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
        this._chartInstance?.resize();
    });
    resizeObserver.observe(container);
    this._resizeObserver = resizeObserver;
}

// ======================
// OPTION BUILDER
// ======================

function getChartOption(data) {
    return {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            right: 20,
            top: 'center',
            itemWidth: 12,
            itemHeight: 12,
            textStyle: {
                fontSize: 13,
                color: '#64748b'
            }
        },
        series: [
            {
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['35%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: false
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                },
                data: data.byStatus.map(item => ({
                    name: item.name,
                    value: item.value,
                    itemStyle: { color: item.color }
                }))
            }
        ]
    };
}

// ======================
// RENDER FUNCTIONS
// ======================

function renderChart(config, { response }) {
    const { data } = response;
    if (!data) return;

    const { optionBuilder } = config;

    // Update total count
    const totalEl = this.appendElement.querySelector('.total-count strong');
    if (totalEl) {
        totalEl.textContent = data.total;
    }

    // Update chart
    if (this._chartInstance) {
        const option = optionBuilder(data);
        this._chartInstance.setOption(option, true);
    }

    console.log('[StatusChart] Chart rendered');
}

console.log('[StatusChart] Registered');
