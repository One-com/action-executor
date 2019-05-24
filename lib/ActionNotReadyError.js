/**
 * When executing an action recieving this error
 * indicates that the action is not able to get
 * a lock on all the objects it is interacting
 * with. Executing the action again will always
 * safe.
 */
function ActionNotReadyError() {}
ActionNotReadyError.prototype = new Error();

module.exports = ActionNotReadyError;
