(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory(require('Failboat'));
    } else if (typeof define === 'function' && define.amd) {
        define(['Failboat'], factory);
    } else {
        root.com = root.com || {};
        root.com.one = root.com.one || {};
        root.com.one.ActionCancelledError = factory(root.com.one.Failboat);
    }
}(this, function (Failboat) {
    /**
     * When executing an action recieving this error
     * indicates that the action was cancelled.
     */
    function ActionCancelledError() {
        Failboat.tag(this, 'CANCELLED');
    }

    ActionCancelledError.prototype = new Error();
    return ActionCancelledError;
}));

