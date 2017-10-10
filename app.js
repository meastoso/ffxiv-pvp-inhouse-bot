const Discord = require('discord.js');
const client = new Discord.Client();
const userMembership = require('./users/UserMembership.js'); 
const userStats = require('./users/UserStats.js');
const auditRecordsDAO = require('./dynamo/AuditRecordsDAO.js');
const botConfig = require('./s3/BotConfig.js');
const logger = require('./logging/logger.js');
const commandHelper = require('./util/CommandHelper.js');
const queueManager = require('./queue/QueueManager.js');

//const botAppID = 'MzU3OTg2ODU2MjM3MDA2ODU4.DJyB2Q.7TqQN5W7Y1vEr5kp-_hXpAIUF2g';
const botAppID = 'MzY2MDkyNjY0ODQxNjk5MzMw.DLn2LQ.udWvmeDU8YvEVt-JC7uLmW1wIs8'; // THIS IS DEV BOT

const availableRoles = ['superadmin', 'admin', 'voucher', 'user'];

client.on('ready', () => {
  console.log('I am ready!');
});

/**
 * Current TODO LIST:
 * 
 * 	- Implement remaining non-queue/matchmaking commands
 * 		- (done) !data <user> (INCLUDE STATS FOR SUPERADMINS)
 * 		- (done) !queueinfo
 * 		- !move <user> <pos>
 * 		- (done) !remove <user>
 * 		- (done) !clear
 * 		- (done) !timeout <user> <min>
 * 
 * 			** ALL USER COMMANDS HERE: **
 * 		- (done) !showqueue
 * 		- (done) !lose / !win
 * 		- (done) !leave
 * 		- (done) !joinspec
 * 		- !joinrandom
 * 		- (done) !join
 * 		- (done) !stats
 * 
 * 	TODO:
 * 		- (done) add timeout to !readycheck
 * 		- (done) lock down queue when a game is in RCMQ
 * 		- (done) trigger checkMatch() when !readycheck fails
 * 		- (done) add timeout to !win/lose
 * 		- (done) remove players from queue who miss readycheck (when restoring in queue, may need to know which other queues they were in)
 * 		- review all error messages, format them, ensure they are useful for debugging, add extra messages we might need
 * 		- (done) pick the match-admin and send different message
 * 		- (done) for joinspec validate user isn't already queued for spec in that datacenter already to avoid duplicates
 * 		- (done) remove user from spec queue if called from leave/remove command
 * 		- (done) add datacenter to the messages about the match to users
 * 		- (done) provide a confirmation response for !ready and !joinspec
 * 		- (done) add hidden command to clear rcmq and matches array
 * 
 * 
 * Change Log deployed 10/7/2017 @ 2:00 PM EST:
 * 		- added ability to use @username mentions in non-test commands that have user as an argument
 * 			NOTE: This will NOT work for test commands, such as !testjoin, !testwin, !testready and !teststats
 * 		- added user stats for superadmins to !data
 * 		- FIXED: issue where total_won and total_games were not being incremented when match completes
 * 		- Added !stats and !teststats <user> commands
 * 		- Replaced message text with "KIHL" to "KIC"
 * 
 * Change Log deployed 10/7/2017 @ 4:00 PM EST:
 * 		- NEW: added !leave and !testleave <user> commands
 * 		- NEW: added !showqueue command (all registered users can execute this command)
 * 		- NEW: added admin-only command !queueinfo
 * 		- NEW: added admin-only command !remove <user>
 * 		- NEW: added admin-only command !clear
 * 
 * Change Log deployed 10/7/2017 @ 8:38 PM EST
 * 		- NEW: added !joinspec command to join as a spectator
 * 				NOTE: Spectator queue is affected by !leave and !remove as well as match-starting events
 * 
 *  Change Log deployed 10/8/2017 @ 2:00 AM EST
 * 		- NEW: added admin command !timeout <mins> <user>
 * 		- FIXED: Spectator messages sent to command user (previously hardcoded to meastoso)
 * 		- NEW: Added match-admin logic
 * 				INFO: user with highest role is selected as match-admin and sent a different message to create match in PF
 * 
 Deployed Updated version of the bot, changelog here:
 *  Change Log deployed 10/8/2017 @ x:00 PM EST
 *  	- NEW: Added expiration logic for !ready check
 *  			NOTE: After 1 minute, any players who did not !ready are removed from all queues and timed-out for 1 minute (amount subject to change)
 *  			NOTE: When a ready check fails, users are sent a PM from bot describing the outcome
 *  	- NEW: Added expiration logic for !win/!lose match reporting
 *  			NOTE: 5 minutes after the first person reports !win/!lose, the match will close if 5/8 is not met but no conflicting reports
 *  			NOTE: Once the match closes all players who did not report !win/!lose will be able to queue again
 *  	- FIXED: Added the name of the datacenter in readycheck and matchdetails PMs
 *  	- FIXED: Added a confirmation response for !ready and !joinspec
 *  	- FIXED: !showqueue now returns "NONE! Readying match..." when the queue is filled and this command is run
 */

// Helper function to reply when someone is unauthorized
function replyUnauthorized(message, requiredRole) {
	commandHelper.replyUnauthorized(message, requiredRole);
}

// Helper function used whenever a real command is used 
// by an authorized user the arguments are incorrect or missing
function replyInvalidUsage(message) {
	message.reply('Unable to process command: Invalid Usage. Please refer to user guide for command usage and examples.');
}

// Helper function to check if a string can be cast to a number
function isInteger(n) {
	return !isNaN(parseInt(n)) && isFinite(n);
}

// helper function for the !setrole command
function setUserRole(message, allowedRoles) {
	try {
		const args = message.content.split('!setrole ')[1];
		let newRole = '';
		let username = '';
		if (args.includes('user ')) {
			newRole = 'user';
			username = args.split('user ')[1];
		}
		else if (args.includes('voucher ')) {
			newRole = 'voucher';
			username = args.split('voucher ')[1];
		}
		else if (args.includes('superadmin ')) {
			newRole = 'superadmin';
			username = args.split('superadmin ')[1];
		}
		else if (args.includes('admin ')) {
			newRole = 'admin';
			username = args.split('admin ')[1];
		}
		commandHelper.getUserFromMentions(message)
			.then((mentionedUsername) => {
				if (mentionedUsername != null) {
					// the method found a user in mentions
					username = mentionedUsername;
				}
				const userTargetObj = userMembership.getUser(username);
				if (allowedRoles.includes(newRole) && userTargetObj != null) {
					// valid user and valid role
					userMembership.setUserRole(userTargetObj, newRole)
						.then((data) => {
							message.reply('Successfully set role ' + newRole + ' for user ' + userTargetObj.user_id);
						})
						.catch((err) => {
							message.reply("An error occurred trying to set role: " + newRole + " for user: " + userTargetObj.user_id + ". Please report this to meastoso");
						});
				}
				else {
					replyInvalidUsage(message);
				}
			})
			.catch((err) => {
				console.log(err);
				logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
			});
	}
	catch(err) {
		logger.log("ERROR", "Caught exception during setrole command:", err);
		replyInvalidUsage(message);
	}
}

function formatDate(dateString) {
	const parsedDate = new Date(dateString);
	const monthNames = [
	    "January", "February", "March",
	    "April", "May", "June", "July",
	    "August", "September", "October",
	    "November", "December"
	    ];

	const day = parsedDate.getDate();
	const monthIndex = parsedDate.getMonth();
	const year = parsedDate.getFullYear();

	return day + ' ' + monthNames[monthIndex] + ' ' + year;
}

/*
 * message.author.username = 'meastoso'
 * message.author.discriminator = '3957'
 * message.author.tag = 'meastoso#3957' 'kisada#8580'
 * message.channel.name = 'general'
 */
client.on('message', message => {
	if (message.content.startsWith('!')) { // only continue parsing message if it starts with '!'
		if (message.content === '!kisada') {
			const username = message.author.username;
			const discriminator = message.author.discriminator;
			const tag = message.author.tag; // NOTE: 
			const channelname = message.channel.name;
			console.log('user: ' + username);
			console.log('discriminator: ' + discriminator);
			console.log('tag: ' + tag);
			console.log('channel: ' + channelname);
			
			//****************************************
			// THIS IS HOW YOU SEND PRIVATE MESSAGES
			//****************************************
			/*message.author.createDM()
				.then((dmChannel) => {
					dmChannel.send('you sexy');
				})
				.catch((err) => {
					console.log(err);
				});*/
			
			message.reply('I AM LOOKING FOR GIRLFRIEND');
		}
		/*#########################################
		 *      !chris
		 #########################################*/
		if (message.content.startsWith('!chris') && message.author.tag == 'meastoso#3957') {	
			function doit(name, classArg) {
				commandHelper.joinCommand(message, name, message.author.id, classArg, client);
			}
			setTimeout(function() { doit('healer1#123', 'h') }, 1000);
			setTimeout(function() { doit('healer2#123', 'h') }, 2000);
			setTimeout(function() { doit('tank1#123', 't') }, 3000);
			setTimeout(function() { doit('tank2#123', 't') }, 4000);
			setTimeout(function() { doit('melee1#123', 'm') }, 5000);
			setTimeout(function() { doit('melee2#123', 'm') }, 6000);
			setTimeout(function() { doit('ranged1#123', 'r') }, 7000);
			setTimeout(function() { doit('ranged2#123', 'r') }, 8000);
			
		}
		/*#########################################
		 *      !andy
		 #########################################*/
		if (message.content.startsWith('!andy') && message.author.tag == 'meastoso#3957') {	
			function doit(name, classArg) {
				//commandHelper.joinCommand(message, name, message.author.id, classArg, client);
				commandHelper.readyCommand(message, name, client);
			}
			setTimeout(function() { doit('healer1#123', 'h') }, 1000);
			setTimeout(function() { doit('healer2#123', 'h') }, 2000);
			setTimeout(function() { doit('tank1#123', 't') }, 3000);
			setTimeout(function() { doit('tank2#123', 't') }, 4000);
			setTimeout(function() { doit('melee1#123', 'm') }, 5000);
			setTimeout(function() { doit('melee2#123', 'm') }, 6000);
			setTimeout(function() { doit('ranged1#123', 'r') }, 7000);
			setTimeout(function() { doit('ranged2#123', 'r') }, 8000);
			
		}
		/*#########################################
		 *      !join <h|t|m|r>
		 #########################################*/
		if (message.content.startsWith('!join ') && commandHelper.isNotDM(message)) {
			try {
				const authorTag = message.author.tag;
				const args = message.content.split('!join ')[1]; // should be just 1 letter
				if (commandHelper.isClass(args)) {
					const classArg = args;
					const userDiscordId = message.author.id;
					commandHelper.joinCommand(message, authorTag, userDiscordId, classArg, client);
				}
				else {
					replyInvalidUsage(message);
				}
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during join command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !testjoin <h|t|m|r> <user>
		 #########################################*/
		if (message.content.startsWith('!testjoin ') && botConfig.isTestMode && commandHelper.isNotDM(message)) {
			try {
				const args = message.content.split('!testjoin ')[1]; // should be just 1 letter
				const argsArr = args.split(''); // makes array of the chars in the string
				if (argsArr.length > 2 && commandHelper.isClass(argsArr[0]) && argsArr[1] == ' ') {
					const classArg = argsArr.shift(); // leaves index 0 for classArg
					argsArr.shift(); // get rid of space
					const authorTag = argsArr.join('').trim();
					const userDiscordId = message.author.id; // the actual author will get match ready PM
					commandHelper.joinCommand(message, authorTag, userDiscordId, classArg, client);
				}
				else {
					replyInvalidUsage(message);
				}
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during testjoin command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !ready
		 #########################################*/
		if (message.content.startsWith('!ready')) {			
			try {
				const authorTag = message.author.tag;
				const userDiscordId = message.author.id;
				commandHelper.readyCommand(message, authorTag, client);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during ready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !testready <user>
		 #########################################*/
		if (message.content.startsWith('!testready ') && botConfig.isTestMode) {
			try {
				const username = message.content.split('!testready ')[1];
				const authorTag = username;
				const userDiscordId = message.author.id;
				commandHelper.readyCommand(message, authorTag, client);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during testready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !win
		 #########################################*/
		if (message.content.startsWith('!win')) {			
			try {
				const authorTag = message.author.tag;
				const userDiscordId = message.author.id;
				const winBool = true;
				commandHelper.reportMatch(message, authorTag, winBool);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during ready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !testwin <user>
		 #########################################*/
		if (message.content.startsWith('!testwin ') && botConfig.isTestMode) {
			try {
				const username = message.content.split('!testwin ')[1];
				const authorTag = username;
				const userDiscordId = message.author.id;
				const winBool = true;
				commandHelper.reportMatch(message, authorTag, winBool);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during testready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !lose
		 #########################################*/
		if (message.content.startsWith('!lose')) {			
			try {
				const authorTag = message.author.tag;
				const userDiscordId = message.author.id;
				const winBool = false;
				commandHelper.reportMatch(message, authorTag, winBool);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during ready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !testlose <user>
		 #########################################*/
		if (message.content.startsWith('!testlose ') && botConfig.isTestMode) {
			try {
				const username = message.content.split('!testlose ')[1];
				const authorTag = username;
				const userDiscordId = message.author.id;
				const winBool = false;
				commandHelper.reportMatch(message, authorTag, winBool);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during testready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !stats
		 #########################################*/
		if (message.content.startsWith('!stats')) {			
			try {
				const authorTag = message.author.tag;
				const userObjForDM = message.author;
				commandHelper.getStats(authorTag, userObjForDM);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during ready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !teststats <user>
		 #########################################*/
		if (message.content.startsWith('!teststats ') && botConfig.isTestMode) {
			try {
				const username = message.content.split('!teststats ')[1];
				const authorTag = username;
				const userObjForDM = message.author;
				commandHelper.getStats(authorTag, userObjForDM);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during testready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !leave
		 #########################################*/
		if (message.content.startsWith('!leave')) {			
			try {
				const authorTag = message.author.tag;
				const userObjForDM = message.author;
				commandHelper.leaveQueue(message, authorTag);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during ready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !testleave <user>
		 #########################################*/
		if (message.content.startsWith('!testleave ') && botConfig.isTestMode) {
			try {
				const username = message.content.split('!testleave ')[1];
				const authorTag = username;
				const userObjForDM = message.author;
				commandHelper.leaveQueue(message, authorTag);
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during testready command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !showq
		 #########################################*/
		if (message.content.startsWith('!showq') && commandHelper.isNotDM(message)) {			
			const requiredRole = 'user';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				message.reply(queueManager.getQueueFriendly(message.channel.name));
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "leave");
			}
		}
		/*#########################################
		 *      !joinspec
		 #########################################*/
		if (message.content.startsWith('!joinspec') && commandHelper.isNotDM(message)) {			
			const requiredRole = 'user';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				if (queueManager.isUserInSpecQueue(message.author.tag, message.channel.name)) {
					message.reply('user ' + message.author.tag + ' is already in the spectator queue for this datacenter');
				}
				else if (queueManager.isPlayerInQueue(message.author.tag, message.channel.name)) {
					message.reply('user ' + message.author.tag + ' already exists in the queue, please !leave first before joining again');
				}
				else {
					if (!queueManager.joinSpectator(message, message.author.tag, message.author.id, client)) {
						message.reply('this command can only be used from a queue-channel');
					}
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "joinspec");
			}
		}
		/*#########################################
		 *      !vouch <user>
		 #########################################*/
		if (message.content.startsWith('!vouch ')) {
			const requiredRole = 'voucher';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					let username = message.content.split('!vouch ')[1];
					commandHelper.getUserFromMentions(message)
						.then((mentionedUsername) => {
							if (mentionedUsername != null) {
								// the method found a user in mentions
								username = mentionedUsername;
							}
							if (userMembership.isUser(username)) {
								if(userMembership.isUserVouched(username)) {
									console.log('vouched!');
									if(userMembership.isUserApproved(username)) {
										console.log(message.author.tag + ' attempted to vouch user ' + username + ' but user has already been approved.');
										message.reply('User ' + username + ' already exists in the league.');
									}
									else {
										console.log(message.author.tag + ' attempted to vouch user ' + username + ' but user has been vouched but is awaiting admin approvel.');
										message.reply('User ' + username + ' has already been vouched but requires admin approval.');
									}
								}
								else {
									const userObj = userMembership.getUser(username); // assume not null since isUser passed
									if (userObj.user_role == 'waiting' && userObj.vouchers != null && (userObj.vouchers != message.author.tag || botConfig.isTestMode())) {
									//if (userObj.user_role == 'waiting' && userObj.vouchers != null) { // THIS IS FOR SELF TESTING!
										//  set vouched = 1 and if requiredAdminApproval = false then set approved = 1 and approvers = 'auto-approved'
										userMembership.finalizeVouch(userObj, message.author.tag)
											.then((data) => {
												if (botConfig.isVouchApprovalRequired()) {
													message.reply('User ' + username + ' has now been vouched but requires admin approval.');
												}
												else {
													message.reply('Successfully added user ' + username + ' as vouched and approved with role: user to KIC.');
												}
											})
											.catch((err) => {
												message.reply('Failed to vouch user ' + username + '. Please contact meastoso with the timestamp of this message.');
											});
									}
									else {
										// something terrible happened or someone tried to vouch same person twice, log as much as possible and report error to user
										message.reply('Failed to vouch user ' + username + '. Please contact meastoso with the timestamp of this message.');
									}
								}
							}
							else { // user does not exist yet
								if (userMembership.isUserAdmin(message.author.tag)) {
									// since an admin is vouching, automatically set vouched and approved to true and set role to 'user'
									// add admin to vouchers and approvers list
									const authorTag = username;
									const role = 'user';
									const vouched = true;
									const approved = true;
									const vouchers = message.author.tag;
									const approvers = message.author.tag;
									const approval_date = (new Date()).toISOString();
									userMembership.createNewUser(authorTag, role, vouched, approved, vouchers, approvers, approval_date)
										.then((data) => {
											message.reply('Successfully added user ' + username + ' as vouched and approved with role: user to KIC.');
										})
										.catch((err) => {
											logger.log("ERROR", "Failed to create new user as an admin, exception:", err);
											message.reply('Failed to add user ' + username + ' as an admin. Please contact meastoso with the timestamp of this message.');
										});
								}
								else {
									// since this is just a voucher set vouched and approved to false and set role to 'waiting'
									// set approvers to 'none' and set vouchers list to this user only (so far)
									const authorTag = username;
									const role = 'waiting';
									const vouched = false;
									const approved = false;
									const vouchers = message.author.tag;
									const approvers = 'none'; // this is bad but dynamo won't allow empty strings
									const approval_date = 'none'; // this is bad but dynamo won't allow empty strings
									userMembership.createNewUser(authorTag, role, vouched, approved, vouchers, approvers, approval_date)
										.then((data) => {
											message.reply('Successfully vouched user ' + username + '. One more vouch is required to be approved for the KIC.');
										})
										.catch((err) => {
											logger.log("ERROR", "Failed to create new user as a voucher, exception:", err);
											message.reply('Failed to add user ' + username + ' as a voucher. Please contact meastoso with the timestamp of this message.');
										});
								}
							}
						})
						.catch((err) => {
							console.log(err);
							logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
						});
				}
				catch(err) {
					logger.log("ERROR", "Caught exception during vouch command:", err);
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "vouch");
			}
		}
		/*#########################################
		 *      !data <user>
		 #########################################*/
		if (message.content.startsWith('!data ')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				// admins and super admins can see basic user details
				let messageText = '';
				try {
					let username = message.content.split('!data ')[1];
					commandHelper.getUserFromMentions(message)
						.then((mentionedUsername) => {
							if (mentionedUsername != null) {
								// the method found a user in mentions
								username = mentionedUsername;
							}
							if (userMembership.isUser(username)) {
								console.log('is user passed, getting object and creating text');
								const userObj = userMembership.getUser(username);
								messageText = userObj.user_id + ' has role ' + userObj.user_role + ', was first vouched ' + formatDate(userObj.creation_date) + ',';
								if (userObj.approved == 1) {
									messageText = messageText + ' fully vouched and approved ' + formatDate(userObj.approval_date) + ' with vouchers: ' + userObj.vouchers + ' and approvers: ' + userObj.approvers + ',';
								}
								else {
									if (userObj.vouched == 1) {
										messageText = messageText + ' and is fully vouched by ' + userObj.vouchers + ' but not approved by admins yet,';
									}
									else {
										messageText = messageText + ' but requires one more vouch, current vouchers: ' + userObj.vouchers + ',';
									}
								}
								if (userObj.banned == 1) {
									messageText = messageText + ' User is banned from the league, ';
								}
								if (userMembership.isAuthorized(message.author.tag, 'superadmin')) {
									// superadmins can see user stats in addition to basic data
									// TODO
									const player = userStats.getPlayer(username);
									messageText = messageText + '\n' + commandHelper.formatUserStats(player);
								}
								// WHISPER THIS TO THE USER
								message.author.createDM()
									.then((dmChannel) => {
										dmChannel.send(messageText);
									})
									.catch((err) => {
										console.log(err);
									});
							}
							else {
								message.reply('User ' + username + ' does not exist.');
							}							
						})
						.catch((err) => {
							console.log(err);
							logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
						});
				}
				catch(err) {
					logger.log("ERROR", "Error trying to format user data, exception:", err);
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "data");
			}
		}
		/*#########################################
		 *      !queueinfo
		 #########################################*/
		if (message.content.startsWith('!queueinfo')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				// WHISPER THIS TO THE USER
				message.author.createDM()
					.then((dmChannel) => {
						dmChannel.send(queueManager.getQueueFriendlyAdmin(message.channel.name));
					})
					.catch((err) => {
						console.log(err);
					});
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "queueinfo");
			}
		}
		/*#########################################
		 *      !remove <user>
		 #########################################*/
		if (message.content.startsWith('!remove ')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					let username = message.content.split('!remove ')[1];
					commandHelper.getUserFromMentions(message)
						.then((mentionedUsername) => {
							if (mentionedUsername != null) {
								// the method found a user in mentions
								username = mentionedUsername;
							}
							// same logic as !testleave
							commandHelper.leaveQueue(message, username);
						})
						.catch((err) => {
							console.log(err);
							logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
						});
				}
				catch(err) {
					logger.log("ERROR", "Error trying to remove user from queues, exception:", err);
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "remove");
			}
		}
		/*#########################################
		 *      !clear
		 #########################################*/
		if (message.content.startsWith('!clear')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				if (queueManager.clearQueue(message.channel.name)) {
					message.reply('the queue for this channel has been completely cleared.')
				}
				else {
					message.reply('please use this command within a queue channel.')
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "clear");
			}
		}
		/*#########################################
		 *      !count
		 #########################################*/
		if (message.content.startsWith('!count')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				message.reply("WHOA! There's " + userMembership.getApprovedUserCount() + " vouched and approved users in the KISADA inhouse league!");
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "count");
			}
		}
		/*#########################################
		 *      !approvals
		 #########################################*/
		if (message.content.startsWith('!approvals')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				const approvalsStr = userMembership.getApprovals().join(', ');
				if (approvalsStr.length < 1 || approvalsStr == '') {
					message.reply("there are no users requiring approval at this time.");
				}
				else {
					message.reply("the following users require admin approval: " + approvalsStr);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "approvals");
			}
		}
		/*#########################################
		 *      !approve <user>
		 #########################################*/
		if (message.content.startsWith('!approve ')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					let username = message.content.split('!approve ')[1];
					commandHelper.getUserFromMentions(message)
						.then((mentionedUsername) => {
							if (mentionedUsername != null) {
								// the method found a user in mentions
								username = mentionedUsername;
							}
							if (userMembership.isUser(username)) {
								if (userMembership.needsApproval(username)) {
									userMembership.approveUser(message.author.tag, username)
										.then((data) => {
											message.reply("user " + username + " has been approved!");
										})
										.catch((err) => {
											logger.log("ERROR", "Error trying to approve user " + username + ", exception:", err);
											message.reply('Failed to approve user ' + username + '. Please contact meastoso with the timestamp of this message.');
										});
								}
								else {
									message.reply(username + ' does not require approval at this time.');
								}
							}
							else {
								message.reply(username + ' is not a valid user.');
							}
						})
						.catch((err) => {
							console.log(err);
							logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
						});
				}
				catch(err) {
					logger.log("ERROR", "Error trying to get users role, exception:", err);
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "approve");
			}
		}
		/*#########################################
		 *      !role <user>
		 #########################################*/
		if (message.content.startsWith('!role ')) {
			const requiredRole = 'user';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					let username = message.content.split('!role ')[1];
					commandHelper.getUserFromMentions(message)
						.then((mentionedUsername) => {
							if (mentionedUsername != null) {
								// the method found a user in mentions
								username = mentionedUsername;
							}
							if (userMembership.isUser(username)) {
								const userObj = userMembership.getUser(username);
								const user_role = userObj.user_role;
								message.reply(username + ' has the role ' + user_role);
							}
							else {
								message.reply(username + ' is not a valid user.');
							}
						})
						.catch((err) => {
							console.log(err);
							logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
						});
				}
				catch(err) {
					logger.log("ERROR", "Error trying to get users role, exception:", err);
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "role");
			}
		}
		/*#########################################
		 *      !ban <user> <reason>
		 #########################################*/
		if (message.content.startsWith('!ban ')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					let username = message.content.split('!ban ')[1];
					commandHelper.getUserFromMentions(message)
						.then((mentionedUsername) => {
							if (mentionedUsername != null) {
								// the method found a user in mentions
								username = mentionedUsername;
							}
							userMembership.banUser(username)
								.then((data) => {
									message.reply("User " + username + " has been banned from KIC.");
									// TODO: add entry to audit system
								})
								.catch((err) => {
									logger.log("ERROR", "Error trying to format user data, exception:", err);
									replyInvalidUsage(message);
								});
						})
						.catch((err) => {
							console.log(err);
							logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
						});
				}
				catch(err) {
					logger.log("ERROR", "Error trying to format user data, exception:", err);
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "data");
			}
		}
		/*#########################################
		 *      !timeout <mins> <user>
		 #########################################*/
		if (message.content.startsWith('!timeout ')) {
			const requiredRole = 'admin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					const args = message.content.split('!timeout ')[1];
					const argsArr = args.split('');
					if (!Number.isInteger(parseInt(argsArr[0], 10))) {
						console.log('expected number for argsArr0 but found: ' + argsArr[0]);
						replyInvalidUsage(message);
						return;
					}
					let findingNumber = true;
					let arrIndex = 1; // start at 1
					let timeoutMinutes = parseInt(argsArr[0]);
					while (findingNumber) {
						if (argsArr[arrIndex] != ' ' && argsArr[arrIndex] != undefined) {
							console.log('found char ' + argsArr[arrIndex] + ' at index ' + arrIndex);
							timeoutMinutes = parseInt(args.substring(0, arrIndex+1), 10);
							arrIndex++;
						}
						else {
							console.log('found char ' + argsArr[arrIndex] + ' at index ' + arrIndex);
							// finished parsing number, break out
							findingNumber = false;
						}
					}
					console.log('checking if ' + timeoutMinutes + ' is a number');
					if (!Number.isInteger(timeoutMinutes)) {
						console.log('timeoutMinutes ' + timeoutMinutes + ' is not an integer, failing');
						replyInvalidUsage(message);
						return;
					}
					console.log('finished parsing number, value is: ' + timeoutMinutes);
					let username = args.substring(arrIndex+1, args.length);
					console.log('i THINK username is: ' + username);
					commandHelper.getUserFromMentions(message)
						.then((mentionedUsername) => {
							if (mentionedUsername != null) {
								// the method found a user in mentions
								username = mentionedUsername;
							}
							// now do logic with the arguments
							//queueManager.timeoutUser(username, timeoutMinutes);
							userMembership.timeoutUser(username, timeoutMinutes);
							
							
							
							
							
						})
						.catch((err) => {
							console.log(err);
							logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
						});
				}
				catch(err) {
					logger.log("ERROR", "Error trying to parse timeout command, exception:", err);
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "timeout");
			}
		}
		/*#########################################
		 *      !setrole <role> <user>
		 #########################################*/
		if (message.content.startsWith('!setrole ')) {
			if (message.author.tag == 'meastoso#3957' || message.author.tag == 'kisada#8580') { // need this for testing
				const allowedRoles = ['superadmin', 'admin', 'voucher', 'user'];
				setUserRole(message, allowedRoles);
			}
			else if (userMembership.isAuthorized(message.author.tag, 'superadmin')) {
				// superadmins can also set the admin role, admins cannot
				try {
					const allowedRoles = ['admin', 'voucher', 'user'];
					setUserRole(message, allowedRoles);
				}
				catch(err) {
					replyInvalidUsage(message);
				}
			}
			else if (userMembership.isAuthorized(message.author.tag, 'admin')) {
				try {
					const allowedRoles = ['voucher', 'user'];
					setUserRole(message, allowedRoles);
				}
				catch(err) {
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "setrole");
			}
		}
		/*#########################################
		 *      !setgraceperiod <days>
		 #########################################*/
		if (message.content.startsWith('!setgraceperiod ')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				const argsArr = message.content.split('!setgraceperiod ');
				if (argsArr.length > 1 && isInteger(argsArr[1])) {
					const newPeriod = parseInt(argsArr[1]);
					botConfig.setNewPlayerGracePeriod(newPeriod)
						.then((retObj) => {
							message.reply('Updated New Player Grace Period to: ' + newPeriod);
						})
						.catch((err) => {
							logger.log('ERROR', 'Failed to update graceperiod, exception:', err);
							message.reply('ERROR: Failed to update bot configuration. Please report to admin.');
						});
				}
				else {
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "setgraceperiod");
			}
		}
		/*#########################################
		 *      !vouchapproval <on|off>
		 #########################################*/
		if (message.content.startsWith('!vouchapproval ')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				const argsArr = message.content.split('!vouchapproval ');
				if (argsArr.length > 1 && (argsArr[1] == "on" || argsArr[1] == "off")) {
					let isVouchApprovalRequired = true;
					if (argsArr[1] == "off") isVouchApprovalRequired = false;
					botConfig.setVouchApproval(isVouchApprovalRequired)
						.then((retObj) => {
							message.reply('Updated bot configuration for requiring admin approval after vouches to: ' + argsArr[1]);
						})
						.catch((err) => {
							logger.log('ERROR', 'Failed to update isVouchApprovalRequired, exception:', err);
							message.reply('ERROR: Failed to update bot configuration. Please report to admin.');
						});
				}
				else {
					replyInvalidUsage(message);
				}
			}
			else {
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "vouchapproval");
			}
		}
		/*#########################################
		 *      !getuser <user> HIDDEN COMMAND SUPERADMIN
		 #########################################*/
		if (message.content.startsWith('!getuser ')) {
			//console.log(message.author);
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				commandHelper.getUserFromMentions(message)
					.then((username) => {
						if (username == null) {
							// the method did not find any users in mentions, parse username
							username = message.cleanContent.split('!getuser ')[1];
							console.log('this username is: ' + username);
						}
						console.log(username);
						const userTargetObj = userMembership.getUser(username);
						message.reply("user: " + JSON.stringify(userTargetObj));
					})
					.catch((err) => {
						console.log(err);
						logger.log('ERROR', 'Failed to try and get username from mentions, exception:', err);
					});
				console.log('finished here');
			}
			else {
				console.log('not authorized');
			}
		}
		/*#########################################
		 *      !getstats <user> HIDDEN COMMAND SUPERADMIN
		 #########################################*/
		if (message.content.startsWith('!getstats ')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				const username = message.content.split('!getstats ')[1];
				const userTargetObj = userStats.getPlayer(username);
				message.reply("userstats\n: " + JSON.stringify(userTargetObj));
			}
			else {
				console.log('not authorized');
			}
		}
		/*#########################################
		 *      !queues HIDDEN COMMAND SUPERADMIN
		 #########################################*/
		if (message.content.startsWith('!queues')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				message.reply("queues\n: " + JSON.stringify(queueManager.getQueues()) + "\nspec\n: " + JSON.stringify(queueManager.getSpecQueues()));
			}
			else {
				console.log('not authorized');
			}
		}
		/*#########################################
		 *      !rcmq HIDDEN COMMAND SUPERADMIN
		 #########################################*/
		if (message.content.startsWith('!rcmq')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				message.reply("getReadyCheckMatchQueue\n: " + JSON.stringify(queueManager.getReadyCheckMatchQueue()));
			}
			else {
				console.log('not authorized');
			}
		}
		/*#########################################
		 *      !matches HIDDEN COMMAND SUPERADMIN
		 #########################################*/
		if (message.content.startsWith('!matches')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				//message.reply("matches\n: " + JSON.stringify(queueManager.getMatches()));
				console.log(queueManager.getMatches());
			}
			else {
				console.log('not authorized');
			}
		}
		/*#########################################
		 *      !clearrcmq HIDDEN COMMAND SUPERADMIN
		 #########################################*/
		if (message.content.startsWith('!clearrcmq')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				queueManager.clearRCMQ();
				message.reply('superadmin ' + message.author.tag + ' cleared the ready-check-manager-queue');
			}
			else {
				console.log('not authorized');
			}
		}
		/*#########################################
		 *      !clearmatches HIDDEN COMMAND SUPERADMIN
		 #########################################*/
		if (message.content.startsWith('!clearmatches')) {
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				queueManager.clearMatchesArr();
				message.reply('superadmin ' + message.author.tag + ' cleared all active matches');
			}
			else {
				console.log('not authorized');
			}
		}
	}
});

client.login(botAppID);
