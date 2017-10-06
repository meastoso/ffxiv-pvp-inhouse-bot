const Discord = require('discord.js');
const client = new Discord.Client();
const userMembership = require('./users/UserMembership.js'); 
const userStats = require('./users/UserStats.js');
const auditRecordsDAO = require('./dynamo/AuditRecordsDAO.js');
const botConfig = require('./s3/BotConfig.js');
const logger = require('./logging/logger.js');
const commandHelper = require('./util/CommandHelper.js');

const botAppID = 'MzU3OTg2ODU2MjM3MDA2ODU4.DJyB2Q.7TqQN5W7Y1vEr5kp-_hXpAIUF2g';

const availableRoles = ['superadmin', 'admin', 'voucher', 'user'];

client.on('ready', () => {
  console.log('I am ready!');
});

/**
 * Current TODO LIST:
 * 
 * 	- Implement remaining non-queue/matchmaking commands
 * 		- !data <user> (INCLUDE STATS FOR SUPERADMINS)
 * 		- !queueinfo
 * 		- !move <user> <pos>
 * 		- !remove <user>
 * 		- !clear
 * 		- !timeout <user> <min>
 * 
 * 			** ALL USER COMMANDS HERE: **
 * 		- !showqueue
 * 		- !lose / !win
 * 		- !leave
 * 		- !joinspec
 * 		- !joinrandom
 * 		- !join
 * 		- !stats
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
	const args = message.content.split('!setrole ')[1];
	const newRole = args.split(' ')[0]; // expecting args variable to be 'role username#1423' 
	const userTargetObj = userMembership.getUser(args.split(' ')[1]);
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
		 *      !join <h|t|m|r>
		 #########################################*/
		if (message.content.startsWith('!join ')) {
			try {
				const authorTag = message.author.tag;
				const args = message.content.split('!join ')[1]; // should be just 1 letter
				if (commandHelper.isClass(args)) {
					const classArg = args;
					commandHelper.joinCommand(message, authorTag, classArg);
				}
				else {
					replyInvalidUsage(message);
				}
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during vouch command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !testjoin <h|t|m|r> <user>
		 #########################################*/
		if (message.content.startsWith('!testjoin ') && botConfig.isTestMode) {
			try {
				const args = message.content.split('!testjoin ')[1]; // should be just 1 letter
				const argsArr = args.split(''); // makes array of the chars in the string
				if (argsArr.length > 2 && commandHelper.isClass(argsArr[0]) && argsArr[1] == ' ') {
					const classArg = argsArr.shift(); // leaves index 0 for classArg
					argsArr.shift(); // get rid of space
					const authorTag = argsArr.join('').trim();
					commandHelper.joinCommand(message, authorTag, classArg);
				}
				else {
					replyInvalidUsage(message);
				}
			}
			catch(err) {
				logger.log("ERROR", "Caught exception during vouch command:", err);
				replyInvalidUsage(message);
			}
		}
		/*#########################################
		 *      !vouch <user>
		 #########################################*/
		if (message.content.startsWith('!vouch ')) {
			const requiredRole = 'voucher';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					const username = message.content.split('!vouch ')[1];
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
											message.reply('Successfully added user ' + username + ' as vouched and approved with role: user to KIHL.');
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
									message.reply('Successfully added user ' + username + ' as vouched and approved with role: user to KIHL.');
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
									message.reply('Successfully vouched user ' + username + '. One more vouch is required to be approved for the KIHL.');
								})
								.catch((err) => {
									logger.log("ERROR", "Failed to create new user as a voucher, exception:", err);
									message.reply('Failed to add user ' + username + ' as a voucher. Please contact meastoso with the timestamp of this message.');
								});
						}
					}
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
					const username = message.content.split('!data ')[1];
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
					}
					else {
						message.reply('User ' + username + ' does not exist.');
					}
				}
				catch(err) {
					logger.log("ERROR", "Error trying to format user data, exception:", err);
					replyInvalidUsage(message);
				}
				if (userMembership.isAuthorized(message.author.tag, 'superadmin')) {
					// superadmins can see user stats in addition to basic data
					// TODO
					
					
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
				replyUnauthorized(message, requiredRole);
				logger.logUnauthorized(message.author, requiredRole, "data");
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
					const username = message.content.split('!approve ')[1];
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
					const username = message.content.split('!role ')[1];
					if (userMembership.isUser(username)) {
						const userObj = userMembership.getUser(username);
						const user_role = userObj.user_role;
						message.reply(username + ' has the role ' + user_role);
					}
					else {
						message.reply(username + ' is not a valid user.');
					}
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
			const requiredRole = 'user';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				try {
					const username = message.content.split('!ban ')[1];
					userMembership.banUser(username)
						.then((data) => {
							message.reply("User " + username + " has been banned from KIHL.");
							// TODO: add entry to audit system
						})
						.catch((err) => {
							logger.log("ERROR", "Error trying to format user data, exception:", err);
							replyInvalidUsage(message);
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
			const requiredRole = 'superadmin';
			if (userMembership.isAuthorized(message.author.tag, requiredRole)) {
				const username = message.content.split('!getuser ')[1];
				const userTargetObj = userMembership.getUser(username);
				message.reply("user: " + JSON.stringify(userTargetObj));
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
	}
});

client.login(botAppID);
