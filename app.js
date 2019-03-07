import $ from "jquery"

new Vue({
    el: ".app",
    data: {
        activeTab: "dashboard"
    },
    methods: {
        isActiveTab(tabId) {
            return this.activeTab === tabId
        },
        setActiveTab(tabId) {
            this.activeTab = tabId
        }
    }
})

const list = mdc.list.MDCList.attachTo(document.querySelector('.mdc-list'))
list.wrapFocus = true
mdc.autoInit()

const storage = require('node-persist')
storage.init( /* options ... */ )

$.each($(".mdc-icon-button[data-mdc-auto-init='MDCRipple']"), (_, obj) => {
    obj.MDCRipple.unbounded = true
})

$(".scan--directory-helper").change(() => {
    $(".scan--directory").get(0).MDCTextField.value = $(".scan--directory-helper").get(0).files[0].path
})

$(".scan--directory-choose").click(() => {
    $(".scan--directory-helper").click()
})
