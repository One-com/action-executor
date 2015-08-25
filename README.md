# ActionExecutor

The action executor is capable of coordinating the execution of multiple
asynchronous actions. In situations where you do latency compensation you have a
high risk of race conditions. To avoid the race conditions you can use locking
to serialize execution of actions that touches state shared between the actions.
You decide the granularity of the locking, the action executor provides you with
a way to signal that an action can't be started because it can get the proper
locks.

In addition to handling coordination the action executor also supply retrying
with exponential backoff and action life cycle hooks. 

## Installation

### Node

Install it with NPM or add it to your `package.json`:

```
$ npm install @one.com/action-executor
```

Then:

```js
var ActionExecutor = require('@one.com/action-executor');
```

### Browser

Include `ActionNotReadyError` and `ActionExecutor.js`.

```html
<script src="ActionNotReadyError.js"></script>
<script src="ActionExecutor.js"></script>
```

this will expose the `ActionExecutor` constructor under the following namespace:

```js
var ActionExecutor = com.one.ActionExecutor;
```

### RequireJS

Include the library with RequireJS the following way:

```js
require.config({
    paths: {
        ActionExecutor: 'path/to/com.one-action-executor/lib/ActionExecutor.js'
    }
});

define(['ActionExecutor'], function (ActionExecutor) {
   // Your code
});
```

## Proposed architecture

You are of cause free to build the architecture you like on top of the action
executor, but the architecture we use and recommend is unidirectional and
therefore makes the application easier to understand. The following diagram
shows the flow through the application.

        .--------state change triggers view update------.
        |                                               |
        v    ___________              __________        |
    .------. \          \  .--------. \         \   .-------.
    | View |  ) executes ) | Action |  ) Updates )  | State |
    '------' /__________/  '--------' /_________/   '-------'
                                |
                              Calls
                                |
                                v
                           .---------.
                           | Backend |
                           '---------'


## Example

I think the functionality is best explained by an example.

Let's start by creating a new action executor:

```js
var actionExecutor = new ActionExecutor({
    context: {
       backend: backend,
       state: state
    }
});
```

The given context is supplied to the action when it is being executed. In this
case the actions will be able to talk to the backend and update the application
state that in turn will be reflected in the views. 

Let's say we have an application state that contains a list of persons that we
want to update. We can make a new action for that:

```js
function RefreshPersonListAction() {}
RefreshPersonListAction.prototype.name = 'RefreshPersonListAction';
RefreshPersonListAction.prototype.execute(function (context, cb) {
    var persons = context.state.persons;
    var backend = context.backend;

    backend.loadPersonList(function (err, data) {
        if (!err) {
            persons.all = data.persons;
            persons.emit('updated');
        }
        cb(err);
    });
});
```

This action can be queue for execution the following way by the action executor:

```js
actionExecutor.enqueue(new RefreshPersonListAction());
```

### Locking

If we want to introduce another action that will be able to delete a given
person but we don't want to wait for the server to respond before updating the
person list, then we have a coordination problem. To solve this problem we
introduce locking on the persons list. We need to introduce locking in all
actions that updates the person list. If the action can't get the lock, it will
yield an `ActionNotReadyError`.

Let's start with the `RefreshPersonListAction`:

```js
function RefreshPersonListAction() {}
RefreshPersonListAction.prototype.name = 'RefreshPersonListAction';
RefreshPersonListAction.prototype.execute(function (context, cb) {
    var persons = context.state.persons;
    var backend = context.backend;

    if (persons.busy) {
       return cb(new ActionNotReadyError());
    }

    persons.busy = true;
    backend.loadPersonList(function (err, data) {
        persons.busy = false;
        if (!err) {
            persons.all = data.persons;
            persons.emit('updated');
        }
        cb(err);
    });
});
```

Now we introduce the `DeletePersonAction`:

```js
function DeletePersonAction(options) {
    this.person = options.person;
}
DeletePersonAction.prototype.name = 'DeletePersonAction';
DeletePersonAction.prototype.execute(function (context, cb) {
    var state = context.state;
    var backend = context.backend;
    var persons = state.persons;
    var person = this.person;

    if (persons.busy) {
       return cb(new ActionNotReadyError());
    }

    persons.busy = true;

    var index = persons.indexOf(person);
    if (index === -1) {
        return cb();
    }

    persons.all.splice(index, 1);
    persons.emit('updated');
    backend.deletePerson(person.id, function (err, data) {
        state.persons.busy = false;
        cb(err);
    });
});
```

If we enqueue both a `RefreshPersonListAction` and a `DeletePersonAction` at the
same time. The execution will be serialized on the person list. That means the
`DeletePersonAction` will wait for the `RefreshPersonListAction` to finish.

### Retrying

As the `RefreshPersonListAction` just uses HTTP GET it should be idempotent and
can therefore be retried. We can configure the action executor to retry on HTTP
503 errors the following way:

```js
actionExecutor.shouldRetryOnError = function (err) {
   return err.status === 503;
};
```

Then to enable retrying of the `RefreshPersonListAction` you do the following:

```js
RefreshPersonListAction.prototype.retries = 3;
```

### Intercepting actions

In some cases you want to intercept execution of actions. It could be for
logging or because you wanted to tag error instances for routing.

Here is an example where we are tagging the errors yielded by the action with
the action name using [Failboat](https://github.com/One-com/failboat):

```js
actionExecutor.interceptor = function (action, args, next) {
    var err = args[0];
    if (err) {
        Failboat.tag(err, action.name);
    }
    next();
};
```

Notice: that the interceptor runs after the action has been executed and
receives the arguments yielded to the callback by the action.

`interceptor` can also be specified in the constructor.

### Action status change events

Let's say we wanted to log the status of the actions being executed. We can do
that by overriding the `onStatusChange` method on the action executor:

```js
actionExecutor.onStatusChange = function (task, status, err) {
    var errorMessage = err && err.message && ' error: ' + err.message;
    console.log(task.action.name + ' ' + status + errorMessage || ''));
};
```

You will get something like the following log output:

```
DeletePersonAction running
RefreshFoldersAction running
RefreshFoldersAction not ready
DeletePersonAction done
RefreshFoldersAction running
RefreshFoldersAction queued for retrying error: 503 service unavailable
RefreshFoldersAction retrying
RefreshFoldersAction running
RefreshFoldersAction done
```

`onStatusChange` can also be specified in the constructor.

### Empty action queue event

In some situations it makes sense to do some stuff when the action executor is
idle. If you need that you can listen for the empty queue event the following
way:

```js
actionExecutor.onEmptyQueue = function () {
    // do some stuff
}
```

`onEmptyQueue` can also be specified in the constructor.
