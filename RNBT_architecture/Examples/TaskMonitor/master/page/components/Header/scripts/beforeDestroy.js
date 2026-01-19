/**
 * Header - Destroy Script
 */

const { removeCustomEvents } = Wkit;
const { unsubscribe } = GlobalDataPublisher;
const { each } = fx;

// ======================
// CUSTOM EVENTS CLEANUP
// ======================

if (this.customEvents) {
    removeCustomEvents(this, this.customEvents);
    this.customEvents = null;
}

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

this.renderAppInfo = null;

console.log('[Header] Destroyed');
