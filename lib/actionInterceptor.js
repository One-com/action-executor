(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory(require('Failboat'), require('./ActionCancelledError'));
    } else if (typeof define === 'function' && define.amd) {
        define(['Failboat', './ActionCancelledError'], factory);
    } else {
        root.com = root.com || {};
        root.com.one = root.com.one || {};
        root.com.one.actionInterceptor = factory(root.com.one.Failboat, root.com.one.ActionCancelledError);
    }
}(this, function (Failboat, ActionCancelledError) {
    return function (action, args, next) {
        var err = args[0];
        if (err) {
            if (err instanceof ActionCancelledError) {
                Failboat.tag(err, 'CANCELLED');
            }

            Failboat.tag(err, action.name);
            err.action = action;
        }
        next();
    };
}));
