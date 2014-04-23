(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.com = root.com || {};
        root.com.one = root.com.one || {};
        root.com.one.actionUtils = factory();
    }
}(this, function () {
    var util = {};

    /**
     * Return a copy of the object only containing the whitelisted properties.
     */
    util.pick = function (obj, keys) {
        var copy = {};
        if (obj) {
            if (!Array.isArray(keys)) {
                var args = Array.prototype.slice.call(arguments, 1);
                keys = [].concat(args);
            }
            keys.forEach(function (key) {
                if (key in obj) copy[key] = obj[key];
            });
        }
        return copy;
    };

    /**
     * Extend a given object with all the properties in passed-in object(s).
     */
    util.extend = function (obj) {
        var args = Array.prototype.slice.call(arguments, 1);
        args.forEach(function (source) {
            if (source) {
                for (var prop in source) {
                    obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };

    return util;
}));
