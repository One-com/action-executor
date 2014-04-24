(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.com = root.com || {};
        root.com.one = root.com.one || {};
        root.com.one.ActionCancelledError = factory();
    }
}(this, function () {
    /**
     * When executing an action recieving this error
     * indicates that the action was cancelled.
     */
    function ActionCancelledError() {
    }

    ActionCancelledError.prototype = new Error();
    return ActionCancelledError;
}));
