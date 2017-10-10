/*
* Utility class to help with commands
*/
const userMembership = require('../users/UserMembership.js'); 
const userStats = require('../users/UserStats.js');
const auditRecordsDAO = require('../dynamo/AuditRecordsDAO.js');
const botConfig = require('../s3/BotConfig.js');
const logger = require('../logging/logger.js');
const queueManager = require('../queue/QueueManager.js');



const replyUnauthorized = function(message, requiredRole) {
	message.reply('You are unauthorized to use that command. You may be timed-out or missing the required role: ' + requiredRole);
}

// called from !join and !testjoin
const joinCommand = function(message, authorTag, userDiscordId, classArg, discordClient) {
	const requiredRole = 'user';
	if (userMembership.isAuthorized(authorTag, requiredRole)) {
		if (queueManager.isUserInGameUnreported(authorTag)) {
			message.reply('user ' + authorTag + ' cannot join another game until the previous game is reported.');
		}
		else {
			console.log('called joinCommand for authorTag: ' + authorTag + ' and classArg: ' + classArg);
			const userName = authorTag;
			const discordChannelName = message.channel.name;
			const matchRole = classEnum[classArg];
			if (queueManager.isPlayerInQueue(userName, discordChannelName)) {
				message.reply('user ' + userName + ' already exists in the queue, please !leave first before joining again');
			}
			else if (queueManager.isUserInSpecQueue(userName, discordChannelName)) {
				message.reply('user ' + userName + ' already exists in the spectator queue, please !leave first before joining again');
			}
			else {
				queueManager.addPlayerToQueue(userName, userDiscordId, discordChannelName, matchRole)
					.then((data) => {
						message.reply('successfully added user ' + userName + ' to queue. ' + queueManager.getQueueFriendly(message.channel.name));
						// check if we can make a match
						const matchObj = queueManager.checkForMatch(discordChannelName);
						if (matchObj != null) {
							// WE HAVE A MATCH!
							//queueManager.startMatch(matchObj, discordClient);
							queueManager.sendReadyChecks(matchObj, discordClient);
						}
						//queueManager.testStartMatch(discordClient); // REMOVE THIS LATER
						//queueManager.testSendReadyChecks(discordClient); // REMOVE THIS LATER
					})
					.catch((err) => {
						logger.log('ERROR', 'Failed to add player to queue, exception:', err);
						message.reply('ERROR: Failed to add player to queue. Please report to admin with timestamp.');
					});
			}
		}
	}
	else {
		replyUnauthorized(message, requiredRole);
		logger.logUnauthorized(message.author, requiredRole, "join");
	}
}

// TODO:
const readyCommand = function(message, authorTag, discordClient) {
	const requiredRole = 'user';
	if (userMembership.isAuthorized(authorTag, requiredRole)) {
		console.log('called readyCommand for authorTag: ' + authorTag);
		const finalMatchObjWrapper = queueManager.confirmUserReady(authorTag);
		if (finalMatchObjWrapper != null) {
			console.log('match found for user ' + authorTag);
			queueManager.checkMatchReady(finalMatchObjWrapper, discordClient);
			message.reply('successfully readied for the match!');
		}
		else {
			console.log('no match found for user ' + authorTag);
			// confirmUserReady returned null which means no match was found for this user, send message saying so
			// TODO
		}
	}
	else {
		replyUnauthorized(message, requiredRole);
		logger.logUnauthorized(message.author, requiredRole, "ready");
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

// Boolean function which returns true if the message is not from a DM channel
const isNotDM = function(message) {
	return true;
}

const reportMatch = function(message, authorTag, winBool) {
	// if user is in a match reply to the user and thank the for reporting a win
	const requiredRole = 'user';
	if (userMembership.isAuthorized(authorTag, requiredRole)) {
		if (queueManager.reportMatch(authorTag, winBool)) {
			message.reply('thank you for reporting your match.');
			queueManager.checkMatchCompleteWithUser(message, authorTag);
		}
		else {
			message.reply('ERROR: No games found for user: ' + authorTag);
		}
	}
	else {
		replyUnauthorized(message, requiredRole);
		logger.logUnauthorized(message.author, requiredRole, "ready");
	}
}

// returns user tag for the first mention
const getUserFromMentions = function(message) {
	return new Promise((resolve, reject) => {
		message.mentions.users.forEach(function(element) {
			resolve(element.tag);
		});
		resolve(null);
	});
}

// Returns formatted string of user's stats
const formatUserStats = function(userStatsPlayerObj) {
	let ft = '';
	for (let role in userStatsPlayerObj) {
		for (let datacenter in userStatsPlayerObj[role].mmrDatacenterMap) {
			const mmr = userStatsPlayerObj[role].mmrDatacenterMap[datacenter].rating;
			const wr = getWinRate(userStatsPlayerObj[role].mmrDatacenterMap[datacenter]);
			ft = ft + role + '  |  ' + datacenter + '  |  ' + mmr + ' (MMR)  |  ' + wr + '% winrate\n';
		}
	}
	return ft;
}

function getWinRate(datacenterObj) {
	if (datacenterObj.total_games == 0) {
		return 0;
	}
	else {
		return Math.round((datacenterObj.total_won/datacenterObj.total_games)*100);
	}
}

const getStats = function(username, userObjForDM) {
	const requiredRole = 'user';
	if (userMembership.isAuthorized(username, requiredRole)) {
		const player = userStats.getPlayer(username);
		let messageText = 'Hello ' + username + ', here are your stats:';
		messageText = messageText + '\n' + formatUserStats(player);
		userObjForDM.createDM()
			.then((dmChannel) => {
				dmChannel.send(messageText);
			})
			.catch((err) => {
				console.log(err);
			});
	}
	else {
		replyUnauthorized(message, requiredRole);
		logger.logUnauthorized(message.author, requiredRole, "stats");
	}
}

// removes specified user from all queues
const leaveQueue = function(message, username) {
	const requiredRole = 'user';
	if (userMembership.isAuthorized(username, requiredRole)) {
		queueManager.removePlayerFromQueues(username);
		message.reply('user ' + username + ' has been removed from all queues.');
	}
	else {
		replyUnauthorized(message, requiredRole);
		logger.logUnauthorized(message.author, requiredRole, "leave");
	}
}

module.exports = {
		joinCommand: joinCommand,
		isClass: isClass,
		readyCommand: readyCommand,
		isNotDM: isNotDM,
		reportMatch: reportMatch,
		replyUnauthorized: replyUnauthorized,
		getUserFromMentions: getUserFromMentions,
		formatUserStats: formatUserStats,
		getStats: getStats,
		leaveQueue: leaveQueue
}