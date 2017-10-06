/*
* Utility class to help with commands
*/
const userMembership = require('../users/UserMembership.js'); 
const userStats = require('../users/UserStats.js');
const auditRecordsDAO = require('../dynamo/AuditRecordsDAO.js');
const botConfig = require('../s3/BotConfig.js');
const logger = require('../logging/logger.js');
const queueManager = require('../queue/QueueManager.js');



function replyUnauthorized(message, requiredRole) {
	message.reply('You are unauthorized to use that command. Required role: ' + requiredRole);
}

// called from !join and !testjoin
const joinCommand = function(message, authorTag, userDiscordId, classArg, discordClient) {
	const requiredRole = 'user';
	if (userMembership.isAuthorized(authorTag, requiredRole)) {
		console.log('called joinCommand for authorTag: ' + authorTag + ' and classArg: ' + classArg);
		const userName = authorTag;
		const discordChannelName = message.channel.name;
		const matchRole = classEnum[classArg];
		if (queueManager.isPlayerInQueue(userName, discordChannelName)) {
			message.reply('user ' + userName + ' already exists in the queue, please !leave first before joining again');
		}
		else {
			queueManager.addPlayerToQueue(userName, userDiscordId, discordChannelName, matchRole)
				.then((data) => {
					message.reply('successfully added user ' + userName + ' to queue.');
					// check if we can make a match
					const matchObj = queueManager.checkForMatch(discordChannelName);
					if (matchObj != null) {
						// WE HAVE A MATCH!
						queueManager.startMatch(matchObj, discordClient);
					}
					queueManager.testStartMatch(discordClient); // REMOVE THIS LATER
				})
				.catch((err) => {
					logger.log('ERROR', 'Failed to add player to queue, exception:', err);
					message.reply('ERROR: Failed to add player to queue. Please report to admin with timestamp.');
				});
		}
	}
	else {
		replyUnauthorized(message, requiredRole);
		logger.logUnauthorized(message.author, requiredRole, "join");
	}
}

const classEnum = {
	'h': 'healer',
	't': 'tank',
	'm': 'melee',
	'r': 'ranged'
}

const isClass = function(classStr) {
	return classEnum[classStr] != undefined && classEnum[classStr] != null;
}



module.exports = {
		joinCommand: joinCommand,
		isClass: isClass
}