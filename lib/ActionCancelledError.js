/**
 * When executing an action recieving this error
 * indicates that the action was cancelled.
 */
function ActionCancelledError() {
}
ActionCancelledError.prototype = new Error();

module.exports = ActionCancelledError;
