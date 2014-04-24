(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory(require('./ActionNotReadyError'));
    } else if (typeof define === 'function' && define.amd) {
        define(['./ActionNotReadyError'], factory);
    } else {
        root.com = root.com || {};
        root.com.one = root.com.one || {};
        root.com.one.ActionExecutor = factory(root.com.one.ActionNotReadyError);
    }
}(this, function (ActionNotReadyError) {
    function ActionExecutor(options) {
        var that = this;

        that.onEmptyQueue = options.onEmptyQueue;
        that.onStatusChange = options.onStatusChange;
        that.shouldRetryOnError = options.shouldRetryOnError;
        that.interceptor = options.interceptor;
        that.context = options.context;

        that.queue = [];
    }

    ActionExecutor.prototype.setTaskStatus = function (task, status) {
        task.status = status;
        if (this.onStatusChange) {
            this.onStatusChange.apply(this, arguments);
        }
    };

    ActionExecutor.prototype.executeQueuedActions = function () {
        var that = this;
        // Remove finished tasks
        this.queue = this.queue.filter(function (task) {
            return task.status !== 'done' && task.status !== 'failed';
        });

        if (this.queue.length === 0 && this.onEmptyQueue) {
            this.onEmptyQueue();
        }

        // Restart tasks that yielded
        this.queue.filter(function (task) {
            return task.status === 'not ready' || task.status === 'retrying';
        }).forEach(function (task) {
            that.execute(task);
        });
    };

    ActionExecutor.prototype.shouldRetryOnError = function (err) {
        return err.status === 503;
    };

    ActionExecutor.prototype.shouldRetry = function (task, err) {
        return err && typeof task.retries === 'number' && task.retries > 0 &&
            this.shouldRetryOnError(err);
    };

    ActionExecutor.prototype.intercept = function (task, args, cb) {
        if (this.interceptor) {
            this.interceptor.call(null, task.action, args, cb);
        } else {
            cb();
        }
    };

    ActionExecutor.prototype.callTaskCallback = function (task, args, cb) {
        if (task.callback) {
            this.intercept(task, args, function () {
                task.callback.apply(null, args);
                cb();
            });
        } else {
            cb();
        }
    };

    function fib(n) {
        var i;
        var fibTable = [];

        fibTable[0] = 0;
        fibTable[1] = 1;
        for (i = 2; i <= n; i += 1) {
            fibTable[i] = fibTable[i - 2] + fibTable[i - 1];
        }
        return fibTable[n];
    }


    ActionExecutor.prototype.queueForRetryTask = function (task, err) {
        var that = this;
        var retriesLeft = task.action.retries - task.retries;
        var timeout = fib(retriesLeft + 14);
        this.setTaskStatus(task, 'queued for retrying', err);
        task.retries -= 1;
        setTimeout(function () {
            that.setTaskStatus(task, 'retrying');
            that.executeQueuedActions();
        }, timeout);
    };

    ActionExecutor.prototype.execute = function (task) {
        var that = this;
        this.setTaskStatus(task, 'running');

        task.action.execute(this.context, function (err) {
            var args = Array.prototype.slice.call(arguments);
            if (err instanceof ActionNotReadyError) {
                that.setTaskStatus(task, 'not ready');
            } else if (that.shouldRetry(task, err)) {
                that.intercept(task, args, function () {
                    that.queueForRetryTask(task, err);
                    that.executeQueuedActions();
                });
            } else {
                that.callTaskCallback(task, args, function () {
                    if (err) {
                        that.setTaskStatus(task, 'failed', err);
                    } else {
                        that.setTaskStatus(task, 'done');
                    }

                    that.executeQueuedActions();
                });
            }
        });
    };

    ActionExecutor.prototype.validateAction = function (action) {
        if (action === null || typeof action !== 'object') {
            throw new Error('Expect actions to be objects. ' + action);
        }

        var name = action.name;
        if (typeof name !== 'string' || name.length === 0) {
            throw new Error('Expect actions to have an unique name. ' + action);
        }

        if (typeof action.execute !== 'function') {
            throw new Error('Expect actions to have an execute method. ' + action.name);
        }
    };

    ActionExecutor.prototype.enqueue = function (action, cb) {
        this.validateAction(action);
        var task = { action: action, callback: cb, retries: action.retries };
        this.queue.push(task);
        this.execute(task);
    };

    return ActionExecutor;
}));
