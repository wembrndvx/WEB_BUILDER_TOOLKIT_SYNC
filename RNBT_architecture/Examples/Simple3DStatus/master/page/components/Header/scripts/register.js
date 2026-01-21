/**
 * Master - Header Component - register.js
 *
 * 책임:
 * - 사용자 정보 표시
 * - 사용자 메뉴 이벤트 발행
 *
 * Subscribes to: userInfo
 * Events: @userMenuClicked
 */

const { subscribe } = GlobalDataPublisher;
const { bindEvents } = Wkit;

// ======================
// CONFIG (Field Config 패턴)
// ======================

const config = {
    fields: [
        { key: 'name', selector: '.user-name' },
        { key: 'role', selector: '.user-role' },
        { key: 'avatar', selector: '.user-avatar', attr: 'src' }
    ]
};

// ======================
// BINDINGS
// ======================

this.renderUserInfo = renderUserInfo.bind(this, config);

// ======================
// SUBSCRIPTIONS
// ======================

this.subscriptions = {
    userInfo: ['renderUserInfo']
};

fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, fnList]) =>
        fx.each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

// ======================
// EVENT BINDING
// ======================

this.customEvents = {
    click: {
        '.user-menu-btn': '@userMenuClicked'
    }
};

bindEvents(this, this.customEvents);

console.log('[Header] Registered');

// ======================
// RENDER FUNCTIONS
// ======================

function renderUserInfo(config, { response }) {
    const { data } = response;
    if (!data) return;

    fx.go(
        config.fields,
        fx.each(({ key, selector, attr }) => {
            const el = this.appendElement.querySelector(selector);
            if (!el) return;

            const value = data[key];
            if (attr) {
                el.setAttribute(attr, value ?? '');
            } else {
                el.textContent = value;
            }
        })
    );

    console.log('[Header] User info rendered:', data.name);
}
