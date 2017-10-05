/**
 * Logging utility class
 */

// some logging here
const logUnauthorized = function(author, requiredRole, commandName) {
	console.log('User ' + author.tag + ' attempted to use command ' + commandName + ' but does not meet role requirement: ' + requiredRole);
}

const log = function(logLevel, message, exception) {
	const timestamp = (new Date()).toTimeString();
	console.log(timestamp + ' -> ' + logLevel + ': ' + message);
	console.log(exception);
}

// public methods
module.exports = {
		logUnauthorized: logUnauthorized,
		log: log
}