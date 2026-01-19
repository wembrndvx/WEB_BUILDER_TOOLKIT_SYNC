/**
 * ActivityLog - Destroy Script
 */

const { unsubscribe } = GlobalDataPublisher;
const { each } = fx;

// ======================
// SUBSCRIPTION CLEANUP
// ======================

if (this.subscriptions) {
    fx.go(
        Object.keys(this.subscriptions),
        each(topic => unsubscribe(topic, this))
    );
    this.subscriptions = null;
}

// ======================
// HANDLER CLEANUP
// ======================

this.renderActivity = null;

console.log('[ActivityLog] Destroyed');
