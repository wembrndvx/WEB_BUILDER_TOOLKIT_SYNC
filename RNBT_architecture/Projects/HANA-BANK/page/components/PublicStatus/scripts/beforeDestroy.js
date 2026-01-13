/**
 * PublicStatus Component - beforeDestroy.js
 */

const { unsubscribe } = GlobalDataPublisher;

// ==================
// UNSUBSCRIBE
// ==================

if (this.subscriptions) {
    fx.go(
        Object.entries(this.subscriptions),
        fx.each(([topic, _]) => unsubscribe(topic, this))
    );
    this.subscriptions = null;
}

// ==================
// DISPOSE ECHARTS
// ==================

if (this.chartInstance) {
    this.chartInstance.dispose();
    this.chartInstance = null;
}

// ==================
// CLEAR REFERENCES
// ==================

this.renderData = null;
this.renderChart = null;

console.log('[PublicStatus] Destroyed');
