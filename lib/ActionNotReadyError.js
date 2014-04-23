(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.com = root.com || {};
        root.com.one = root.com.one || {};
        root.com.one.ActionNotReadyError = factory();
    }
}(this, function () {
    /**
     * When executing an action recieving this error
     * indicates that the action is not able to get
     * a lock on all the objects it is interacting
     * with. Executing the action again will always
     * safe.
     */
    function ActionNotReadyError() { }
    ActionNotReadyError.prototype = new Error();
    return ActionNotReadyError;
}));
