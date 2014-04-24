/*global weknowhow, com, sinon, describe, it, beforeEach, afterEach*/
var unexpected = weknowhow.expect.clone();
unexpected.installPlugin(weknowhow.unexpectedSinon);

var ActionExecutor = com.one.ActionExecutor,
    ActionNotReadyError = com.one.ActionNotReadyError;

function createTestAction(index) {
    return {
        name: 'TestAction' + index,
        execute: sinon.stub(),
        toString: function () {
            return this.name;
        },
        inspect: function () {
            return this.toString();
        }
    };
}

function getArgumentList(spy) {
    var calls = [];
    for (var i = 0; i < spy.callCount; i += 1) {
        calls.push(spy.getCall(i));
    }
    return calls.map(function (call) {
        return call.args;
    });
}

describe('actions.ActionExecutor.enqueue', function () {
    var clock;
    var actionExecutor;
    var testAction0;
    var context = {};
    var expect = unexpected.clone()
        .addAssertion('emitted status events', function (expect, subject, expectedEvents) {
        expect(subject, 'was called times', expectedEvents.length);
        expect(getArgumentList(subject), 'to be an array whose items satisfy', function (args, index) {
            var expectedEvent = expectedEvents[index];
            var task = args[0];
            var status = args[1];
            expect(task.action.name, 'to be', expectedEvent.action);
            expect(status, 'to be', expectedEvent.status);
        });
    });

    beforeEach(function () { clock = sinon.useFakeTimers(); });
    afterEach(function () { clock.restore(); });

    beforeEach(function () {
        actionExecutor = new ActionExecutor({
            context: context,
            onStatusChange: sinon.spy(),
            shouldRetryOnError: function (err) {
                return err.status === 500 || err.status === 503;
            }
        });

        testAction0 = createTestAction(0);
    });

    describe('error handling', function () {
        it('fails when the given action is null', function () {
            expect(function () {
                actionExecutor.enqueue(null);
            }, 'to throw', /Expect actions to be objects/);
        });

        it('fails when the given action is not an object', function () {
            expect(function () {
                actionExecutor.enqueue(13);
            }, 'to throw', /Expect actions to be objects/);
        });

        it('fails when given an action that has no name', function () {
            expect(function () {
                actionExecutor.enqueue({});
            }, 'to throw', /Expect actions to have an unique name/);
        });

        it('fails when given an action that has no execute method', function () {
            expect(function () {
                actionExecutor.enqueue({ name: 'foo' });
            }, 'to throw', /Expect actions to have an execute method/);
        });
    });

    describe('when the action queue is empty', function () {
        it('calls the execute method on the action', function () {
            testAction0.execute.yields(null);
            var cb = sinon.spy();
            actionExecutor.enqueue(testAction0, cb);
            expect(cb, 'was called with', null);
            expect(actionExecutor.queue, 'to be empty');
        });
    });

    describe('when the action queue non-empty', function () {
        var tasks = [];
        beforeEach(function () {
            for (var i = 0; i < 4; i += 1) {
                tasks[i] = {
                    action: createTestAction(i),
                    callback: sinon.spy()
                };
                tasks[i].callback.displayName = 'callback' + i;
            }
        });
        function enqueueTasks() {
            tasks.forEach(function (task) {
                actionExecutor.enqueue(task.action, task.callback);
            });
        }

        it('tries to execute all actions in the queue', function () {
            enqueueTasks();
            expect(tasks, 'to be an array whose items satisfy', function (task) {
                expect(task.action.execute, 'was called with', context);
            });
        });

        it('executes actions that yeilds not-ready in the order they are ready', function () {
            tasks[0].action.execute.yields(null);
            tasks[1].action.execute.onCall(0).yields(new ActionNotReadyError());
            tasks[1].action.execute.onCall(1).yields(new ActionNotReadyError());
            tasks[1].action.execute.onCall(2).yields(null);
            tasks[2].action.execute.onCall(0).yields(new ActionNotReadyError());
            tasks[2].action.execute.onCall(1).yields(null);
            tasks[3].action.execute.yields(null);
            enqueueTasks();

            expect(tasks[0].action.execute, 'was called once');
            expect(tasks[1].action.execute, 'was called thrice');
            expect(tasks[2].action.execute, 'was called twice');
            expect(tasks[3].action.execute, 'was called once');

            expect([
                tasks[0].callback,
                tasks[3].callback,
                tasks[2].callback,
                tasks[1].callback
            ], 'given call order');
        });

        it('calls fires the emptyQueue event when the queue is empty', function () {
            var spy = sinon.spy();
            actionExecutor.onEmptyQueue = spy;
            tasks[0].action.execute.yields(null);
            // refresh here
            tasks[1].action.execute.onCall(0).yields(new ActionNotReadyError());
            tasks[1].action.execute.onCall(1).yields(new ActionNotReadyError());
            tasks[1].action.execute.onCall(2).yields(null);
            tasks[2].action.execute.onCall(0).yields(new ActionNotReadyError());
            tasks[2].action.execute.onCall(1).yields(null);
            tasks[3].action.execute.yields(null);
            // and refresh here

            enqueueTasks();
            expect(spy, 'was called twice');
        });

        describe('and an interceptor is specified', function () {
            it('the interceptor will be called before each callback provided to enqueue', function (done) {
                var data = {};
                var cb = sinon.spy();
                actionExecutor.interceptor = function (action, args, next) {
                    expect(action, 'to be', testAction0);
                    expect(args[1], 'to be', data);
                    expect(cb, 'was not called');
                    next();
                    expect(cb, 'was called');
                    done();
                };
                testAction0.execute.yields(null, data);
                actionExecutor.enqueue(testAction0, cb);
            });
        });

        describe('and an onStatusChange handler is specified', function () {
            it('the onStatusChange handler is called when the status of a task changes', function () {
                tasks[0].action.execute.yields(null);
                tasks[1].action.execute.onCall(0).yields(new ActionNotReadyError());
                tasks[1].action.execute.onCall(1).yields(new ActionNotReadyError());
                tasks[1].action.execute.onCall(2).yields(null);
                tasks[2].action.execute.onCall(0).yields(new ActionNotReadyError());
                tasks[2].action.execute.onCall(1).yields(null);
                tasks[3].action.execute.yields(null);
                enqueueTasks();

                expect(actionExecutor.onStatusChange, 'emitted status events', [
                    { action: 'TestAction0', status: 'running' },
                    { action: 'TestAction0', status: 'done' },
                    { action: 'TestAction1', status: 'running' },
                    { action: 'TestAction1', status: 'not ready' },
                    { action: 'TestAction2', status: 'running' },
                    { action: 'TestAction2', status: 'not ready' },
                    { action: 'TestAction3', status: 'running' },
                    { action: 'TestAction3', status: 'done' },
                    { action: 'TestAction1', status: 'running' },
                    { action: 'TestAction1', status: 'not ready' },
                    { action: 'TestAction2', status: 'running' },
                    { action: 'TestAction2', status: 'done' },
                    { action: 'TestAction1', status: 'running' },
                    { action: 'TestAction1', status: 'done' }
                ]);
            });
        });
    });

    describe('action retrying', function () {
        describe('on actions not having a retries property', function () {
            [500, 503].forEach(function (status) {
                describe('and a ' + status + ' error is recieved', function () {
                    beforeEach(function () {
                        testAction0.execute.yields({ status: status });
                    });
                    it('the action just fails without retrying', function () {
                        var spy = sinon.spy();
                        actionExecutor.enqueue(testAction0, spy);
                        expect(spy, 'was called with', { status: status});
                    });
                });
            });
        });

        describe('on actions having a retries property with value 2', function () {
            beforeEach(function () {
                testAction0.retries = 2;
            });

            describe('and a the first two attempts to execute the action fails with a 500 and a 503 error', function () {
                beforeEach(function () {
                    testAction0.execute.onCall(0).yields({ status: 500 });
                    testAction0.execute.onCall(1).yields({ status: 503 });
                    testAction0.execute.onCall(2).yields(null);
                });
                it('the callback is only called once', function () {
                    var spy = sinon.spy();
                    actionExecutor.enqueue(testAction0, spy);
                    clock.tick(377);
                    clock.tick(610);
                    expect(spy, 'was called');
                });
                it('the interceptor is called for every retry', function () {
                    var interceptionCount = 0;
                    actionExecutor.interceptor = function (action, args, next) {
                        interceptionCount += 1;
                        next();
                    };
                    actionExecutor.enqueue(testAction0, function () {});
                    clock.tick(377);
                    clock.tick(610);
                    expect(interceptionCount, 'to be', 3);
                });
                it('a status changed event is emitted for each retry', function () {
                    actionExecutor.enqueue(testAction0, function () {});

                    clock.tick(377);
                    clock.tick(610);

                    expect(actionExecutor.onStatusChange, 'emitted status events', [
                        { action: 'TestAction0', status: 'running' },
                        { action: 'TestAction0', status: 'queued for retrying' },
                        { action: 'TestAction0', status: 'retrying' },
                        { action: 'TestAction0', status: 'running' },
                        { action: 'TestAction0', status: 'queued for retrying' },
                        { action: 'TestAction0', status: 'retrying' },
                        { action: 'TestAction0', status: 'running' },
                        { action: 'TestAction0', status: 'done' }
                    ]);
                });
                describe('and you have two actions running concurrently', function () {
                    var testAction1;
                    beforeEach(function () {
                        testAction1 = createTestAction(1);
                        testAction1.retries = 2;
                        testAction1.execute.onCall(0).yields({ status: 500 });
                        testAction1.execute.onCall(1).yields({ status: 503 });
                        testAction1.execute.onCall(2).yields(null);
                    });

                    it('a status changed event is emitted for each retry', function () {
                        actionExecutor.enqueue(testAction0, function () {});
                        clock.tick(200);
                        actionExecutor.enqueue(testAction1, function () {});
                        clock.tick(177); // TestAction0 retry
                        clock.tick(200); // TestAction1 retry

                        clock.tick(410); // TestAction0 retry
                        clock.tick(210); // TestAction1 retry

                        expect(actionExecutor.onStatusChange, 'emitted status events', [
                            { action: 'TestAction0', status: 'running' },
                            { action: 'TestAction0', status: 'queued for retrying' },
                            { action: 'TestAction1', status: 'running' },
                            { action: 'TestAction1', status: 'queued for retrying' },
                            { action: 'TestAction0', status: 'retrying' },
                            { action: 'TestAction0', status: 'running' },
                            { action: 'TestAction0', status: 'queued for retrying' },
                            { action: 'TestAction1', status: 'retrying' },
                            { action: 'TestAction1', status: 'running' },
                            { action: 'TestAction1', status: 'queued for retrying' },
                            { action: 'TestAction0', status: 'retrying' },
                            { action: 'TestAction0', status: 'running' },
                            { action: 'TestAction0', status: 'done' },
                            { action: 'TestAction1', status: 'retrying' },
                            { action: 'TestAction1', status: 'running' },
                            { action: 'TestAction1', status: 'done' }
                        ]);
                    });
                });
            });

            describe('and a error is recieved more times that the action can be retried', function () {
                beforeEach(function () {
                    testAction0.execute.onCall(0).yields({ status: 503 });
                    testAction0.execute.onCall(1).yields({ status: 503 });
                    testAction0.execute.onCall(2).yields({ status: 500 });
                    testAction0.execute.onCall(3).yields({ status: 503 });
                });
                it('the action fails with the last error', function (done) {
                    actionExecutor.enqueue(testAction0, function (err) {
                        expect(err, 'to equal', { status: 500 });
                        done();
                    });
                    clock.tick(377);
                    clock.tick(610);
                });
            });
        });
    });
});
