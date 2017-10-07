/*
 * Queue Manager - manages all the queues
 */
const userStats = require('../users/UserStats.js'); 

// NOTE: I want this to be an ENUM but because kisada can change channel names
// Returns null if no discord channel is passed
function getDatacenterFromDiscordChannel(discordChannelName) {
	if (discordChannelName == undefined || discordChannelName == null) {
		return null;
	}
	if (discordChannelName.includes("primal-queues")) {
		return "primal";
	}
	if (discordChannelName.includes("aether-queues")) {
		return "aether";
	}
	if (discordChannelName.includes("chaos-queues")) {
		return "chaos";
	}
	if (discordChannelName.includes("mana-queues")) {
		return "mana";
	}
	if (discordChannelName.includes("gaia-queues")) {
		return "gaia";
	}
	if (discordChannelName.includes("elemental-queues")) {
		return "elemental";
	}
}

// cache object to hold queues
const queues = {
		'primal': [],
		'aether': [],
		'chaos': [],
		'mana': [],
		'gaia': [],
		'elemental': []
};

// holds matches ready to go that are waiting for ready check, array of type finalMatchObjWrapper
const readyCheckMatchQueue = [];
const activeMatches = [];

/**
 * queuePlayerObj = {
 * 		'user_id': 'meastoso#3957',
 * 		'healer': 1,
 * 		'tank': 1,
 * 		'melee': 0,
 * 		'ranged': 0,
 * 		'healerMMR': 1320,
 * 		'tankMMR': 1000,
 * 		'meleeMMR': 0,
 * 		'rangedMMR': 0
 * 		'userDiscordId': 372371929836261
 * }
 * 
 */
// TODO: Can expand this to be for !joinrandom multiple roles
function getQueuePlayerObj(playerName, userDiscordId, playerObj, datacenter, role) {
	let queuePlayerObj = {};
	queuePlayerObj['user_id'] = playerName;
	queuePlayerObj[role] = 1;
	queuePlayerObj[role + 'MMR'] = playerObj[role].mmrDatacenterMap[datacenter].rating;
	queuePlayerObj['userDiscordId'] = userDiscordId;
	queuePlayerObj['datacenter'] = datacenter;
	return queuePlayerObj;
}

// match role is 'healer, 'tank', 'melee', 'ranged'
const addPlayerToQueue = function(userName, userDiscordId, discordChannelName, matchRole) {
	return new Promise((resolve, reject) => {
		const datacenter = getDatacenterFromDiscordChannel(discordChannelName);
		let player = userStats.getPlayer(userName);
		if (player == undefined) {
			// this player is queueing for the first time ever, does not exist in usersStats table
			console.log('this player is queueing for the first time ever, does not exist in usersStats table')
			userStats.createUserRecord(userName, matchRole, datacenter)
				.then((data) => {
					player = userStats.getPlayer(userName); // get updated user from cache
					const queuePlayerObj = getQueuePlayerObj(userName, userDiscordId, player, datacenter, matchRole);
					queues[datacenter].push(queuePlayerObj);
					resolve('OK');
				})
				.catch((err) => {
					console.log(err);
					reject(err);
				});
		}
		else { // player exists in userstats table and has queued before
			if (player[matchRole] == undefined) {
				console.log('this player exists but hasnt played this role before on any datacenter');
				userStats.createUserRecord(userName, matchRole, datacenter)
					.then((data) => {
						player = userStats.getPlayer(userName); // get updated user from cache
						const queuePlayerObj = getQueuePlayerObj(userName, userDiscordId, player, datacenter, matchRole);
						queues[datacenter].push(queuePlayerObj);
						resolve('OK');
					})
					.catch((err) => {
						console.log(err);
						reject(err);
					});
			}
			else {
				// player has already queued on this role before
				if (player[matchRole].mmrDatacenterMap[datacenter] == undefined) {
					userStats.addNewDatacenterToPlayer(userName, matchRole, datacenter)
						.then((data) => {
							player = userStats.getPlayer(userName); // get updated user from cache
							const queuePlayerObj = getQueuePlayerObj(userName, userDiscordId, player, datacenter, matchRole);
							queues[datacenter].push(queuePlayerObj);
							resolve('OK');
						})
						.catch((err) => {
							console.log(err);
							reject(err);
						});
				}
				else {
					// normal scenario, player has queued on this role on this datacenter before...
					const queuePlayerObj = getQueuePlayerObj(userName, userDiscordId, player, datacenter, matchRole);
					queues[datacenter].push(queuePlayerObj);
					resolve('OK');
				}
			}
		}
	});
}

// Returns null if match is not ready, matchObj if ready
const checkForMatch = function(discordChannelName) {
	const datacenter = getDatacenterFromDiscordChannel(discordChannelName);
	const q = queues[datacenter]; // array of queuePlayerObjs
	// loop through queue and see if we can make a match
	if (q.length > 7) {
		let healerArr = [];
		let tankArr = [];
		let meleeArr = [];
		let rangedArr = [];
		for (let i = 0; i < q.length; i++) {
			if (q[i].healer) {
				healerArr.push(q[i]);
			}
			else if (q[i].tank) {
				tankArr.push(q[i]);
			}
			else if (q[i].melee) {
				meleeArr.push(q[i]);
			}
			else if (q[i].ranged) {
				rangedArr.push(q[i]);
			}
		}
		if (healerArr.length > 1 && tankArr.length > 1 && meleeArr.length > 1 && rangedArr.length > 1) {
			console.log('WE HAVE ENOUGH FOR A MATCH!');
			const matchObj = {
					'healerArr': healerArr,
					'tankArr': tankArr,
					'meleeArr': meleeArr,
					'rangedArr': rangedArr
			}
			return matchObj;
		}
	}
	else {
		console.log("checked for a match but less than 8 players in queue...");
	}
	return null;
}

// only call this once ready checks have been confirmed
const startMatch = function(finalMatchObjWrapper, discordClient) {
	//now that ready checks have finished send out match details and wait for win/lose
	sendMatchDetailsDM(finalMatchObjWrapper.finalMatchObj, discordClient);
	activeMatches.push(finalMatchObjWrapper);
	// go remove these players from the queue
	removePlayersFromQueues(finalMatchObjWrapper);
	console.log('added finalMatchObj to activeMatches array.');
}

function removePlayersFromQueues(finalMatchObjWrapper) {
	// loop through each key and remove that user_id from the queue for this datacenter
	for (let key in finalMatchObjWrapper) {
		if (key != 'finalMatchObj') {
			// found a player that hasn't readied yet
			const user_id = key;
			removePlayerFromQueues(user_id);
		}
	}
}

function removePlayerFromQueues(user_id) {
	for (let datacenter in queues) {
		currQueue = queues[datacenter];
		if (currQueue.length > 0) {
			for (let i = 0; i < currQueue.length; i++) {
				// loop through the queue, find the player and splice
				if (currQueue[i].user_id == user_id) {
					currQueue.splice(i,1);
				}
			}
		}
	}
}

// don't need to get ready checks from spectators
const sendReadyChecks = function(matchObj, discordClient) {
	const finalMatchObj = sortMatch(matchObj);
	finalMatchObj.claws.forEach(function(queuePlayerObj) {
		//const userDiscordId = queuePlayerObj.userDiscordId;
		const userDiscordId = '195033055512100864'; // meastoso discord ID
		const username = queuePlayerObj.user_id;
		const role = getRoleFromQueryPlayerObj(queuePlayerObj);
		sendReadyCheckDM(userDiscordId, username, role, discordClient);
	});
	// Send DMs for fangs
	finalMatchObj.fangs.forEach(function(queuePlayerObj) {
		//const userDiscordId = queuePlayerObj.userDiscordId;
		const userDiscordId = '195033055512100864'; // meastoso discord ID
		const username = queuePlayerObj.user_id;
		const role = getRoleFromQueryPlayerObj(queuePlayerObj);
		sendReadyCheckDM(userDiscordId, username, role, discordClient);
	});
	// add final match obj to match ready queue cache
	const finalMatchObjWrapper = getFinalMatchObjWrapper(finalMatchObj);
	readyCheckMatchQueue.push(finalMatchObjWrapper);
	console.log('finished sending out ready check DMs and pushed final match obj to match ready queue');
	
	// TODO: ADD A TIMEOUT OF 1 MINUTE HERE TO CALL A FUNCTION TO CLEAN UP QUEUE
}

// helper to wrap some utility into the final match obj
function getFinalMatchObjWrapper(finalMatchObj) {
	const finalMatchObjWrapper = {
			'finalMatchObj': finalMatchObj
	};
	for (let i = 0; i < finalMatchObj.claws.length; i++) {
		const queuePlayerObj = finalMatchObj.claws[i];
		// add each player as object key in wrapper obj with value 0; 
		// changes to 1 when players sends !ready
		finalMatchObjWrapper[queuePlayerObj.user_id] = 0;
	}
	for (let i = 0; i < finalMatchObj.fangs.length; i++) {
		const queuePlayerObj = finalMatchObj.fangs[i];
		// add each player as object key in wrapper obj with value 0; 
		// changes to 1 when players sends !ready
		finalMatchObjWrapper[queuePlayerObj.user_id] = 0;
	}
	return finalMatchObjWrapper;
}

function sendReadyCheckDM(userDiscordId, username, role, discordClient) {
	let mt = 'Hello ' + username + ', you have been added to a match as ' + role + '!';
	mt = mt + ' Please confirm you are ready by entering "!ready" in this private message channel.';
	mt = mt + ' If you do not !ready within 1 minute you will be removed from the queue and timed-out for 30 minutes.';
	discordClient.fetchUser(userDiscordId)
		.then((user) => {
			user.createDM()
				.then((dmChannel) => {
					dmChannel.send(mt);
				})
				.catch((err) => {
					logger.log("ERROR", "Caught exception sending match ready DM to user:", err);
				});
		})
		.catch((err) => {
			logger.log("ERROR", "Caught exception fetching user to send match DM:", err);
		});
}

function sendMatchDetailsDM(finalMatchObj, discordClient) {
	console.log(finalMatchObj);
	const randomMatchNumber = Math.floor(1000 + Math.random() * 9000);
	const randomPassword = Math.floor(1000 + Math.random() * 9000);
	const clawsAvgScore = finalMatchObj.clawsAvgScore;
	const fangsAvgScore = finalMatchObj.fangsAvgScore;
	// send DMs for !ready to claws team
	finalMatchObj.claws.forEach(function(queuePlayerObj) {
		//const userDiscordId = queuePlayerObj.userDiscordId;
		const userDiscordId = '195033055512100864'; // meastoso discord ID
		const username = queuePlayerObj.user_id;
		const role = getRoleFromQueryPlayerObj(queuePlayerObj);
		const teamName = 'Claws';
		sendMatchReadyDM(userDiscordId, username, role, randomMatchNumber, randomPassword, clawsAvgScore, fangsAvgScore, discordClient, teamName);
	});
	// Send DMs for fangs
	finalMatchObj.fangs.forEach(function(queuePlayerObj) {
		//const userDiscordId = queuePlayerObj.userDiscordId;
		const userDiscordId = '195033055512100864'; // meastoso discord ID
		const username = queuePlayerObj.user_id;
		const role = getRoleFromQueryPlayerObj(queuePlayerObj);
		const teamName = 'Fangs';
		sendMatchReadyDM(userDiscordId, username, role, randomMatchNumber, randomPassword, clawsAvgScore, fangsAvgScore, discordClient, teamName);
	});
	// Send DMs for spectators
	finalMatchObj.specs.forEach(function(queuePlayerObj) {
		//const userDiscordId = queuePlayerObj.userDiscordId;
		const userDiscordId = '195033055512100864'; // meastoso discord ID
		const username = queuePlayerObj.user_id;
		const role = getRoleFromQueryPlayerObj(queuePlayerObj);
		const teamName = 'Spectator';
		sendMatchReadyDM(userDiscordId, username, role, randomMatchNumber, randomPassword, clawsAvgScore, fangsAvgScore, discordClient, teamName);
	});
}

function sendMatchReadyDM(userDiscordId, username, role, randomMatchNumber, randomPassword, clawsAvgScore, fangsAvgScore, discordClient, teamName) {
	let mt = 'Hello ' + username + ', your match is ready!';
	mt = mt + ' Please join cross-world party finder "KIHL #' + randomMatchNumber + '"';
	mt = mt + ' with password "' + randomPassword + '" as Team: ' + teamName + '.\n';
	mt = mt + 'Claws Rating: ' + clawsAvgScore + '\n';
	mt = mt + 'Fangs Rating: ' + fangsAvgScore;
	discordClient.fetchUser(userDiscordId)
		.then((user) => {
			user.createDM()
				.then((dmChannel) => {
					dmChannel.send(mt);
				})
				.catch((err) => {
					logger.log("ERROR", "Caught exception sending match ready DM to user:", err);
				});
		})
		.catch((err) => {
			logger.log("ERROR", "Caught exception fetching user to send match DM:", err);
		});
}

function getRoleFromQueryPlayerObj(queryPlayerObj) {
	if (queryPlayerObj.healer) {
		return "healer";
	}
	else if (queryPlayerObj.tank) {
		return "tank";
	}
	else if (queryPlayerObj.melee) {
		return "melee";
	}
	else if (queryPlayerObj.ranged) {
		return "ranged";
	}
}

// returns claws, fangs and specs
function sortMatch(matchObj) {
	let claws = [];
	let clawsAvgScore = 0;
	let fangs = [];
	let fangsAvgScore = 0;
	let specs = [];
	// this is gross but i can't figure out a better way LELELEL...
	let bestDiff = 5000;
	for (let h = 0; h < 2; h++) {
		for (let t = 0; t < 2; t++) {
			for (let m = 0; m < 2; m++) {
				for (let r = 0; r < 2; r++) {
					let team1 = [matchObj.healerArr[h], matchObj.tankArr[t], matchObj.meleeArr[m], matchObj.rangedArr[r]];
					let team2 = [matchObj.healerArr[+!h], matchObj.tankArr[+!t], matchObj.meleeArr[+!m], matchObj.rangedArr[+!r]];
					let team1Score = getTeamScore(team1);
					let team2Score = getTeamScore(team2);
					let teamScoreDiff = Math.abs(team1Score - team2Score);
					if (teamScoreDiff < bestDiff) {
						console.log('found better teamscore of: ' + teamScoreDiff);
						bestDiff = teamScoreDiff;
						claws = team1;
						clawsAvgScore = Math.round(team1Score/4);
						fangs = team2;
						fangsAvgScore = Math.round(team2Score/4);
					}
				}	
			}	
		}
	}
	const finalMatchObj = {
			'claws': claws,
			'clawsAvgScore': clawsAvgScore,
			'fangs': fangs,
			'fangsAvgScore': fangsAvgScore,
			'specs': specs
	}
	return finalMatchObj;
}

function getTeamScore(teamArr) {
	let teamScore = 0;
	for (let i = 0; i < teamArr.length; i ++) {
		if (teamArr[i].healerMMR != undefined) {
			teamScore += teamArr[i].healerMMR;
		}
		else if (teamArr[i].tankMMR != undefined) {
			teamScore += teamArr[i].tankMMR;
		}
		else if (teamArr[i].meleeMMR != undefined) {
			teamScore += teamArr[i].meleeMMR;
		}
		else if (teamArr[i].rangedMMR != undefined) {
			teamScore += teamArr[i].rangedMMR;
		}
	}
	return teamScore;
}


const getQueues = function() {
	return queues;
}

const isPlayerInQueue = function(playerName, discordChannelName) {
	const datacenter = getDatacenterFromDiscordChannel(discordChannelName);
	if (datacenter == undefined) {
		return false;
	}
	const q = queues[datacenter];
	for (let i = 0; i < q.length; i++) {
		if (q[i].user_id == playerName) {
			return true;
		}
	}
	return false;
}

// returns finalMatchObjWrapper if user is confirmed, null if no match is found
const confirmUserReady = function(username) {
	// loop through each finalMatchObjWrapper in the readyCheckMatchQueue to find match this player belongs to
	for (let i = 0; i < readyCheckMatchQueue.length; i++) {
		const finalMatchObjWrapper = readyCheckMatchQueue[i];
		for (let key in finalMatchObjWrapper) {
			if (key == username) {
				// found a match with this user
				console.log('found user in match, setting to 1 and returning match!');
				finalMatchObjWrapper[username] = 1;
				return finalMatchObjWrapper;
			}
		}
	}
	return null; // returning null means we did not find a match with this user as a player
}

// checks the finalMatchObjWrapper to see if all players have confirmed
const checkMatchReady = function(finalMatchObjWrapper, discordClient) {
	// loop through each property of this object and confirm all nonMatchObj (players) == 1
	let allConfirmed = true;
	let single_user = '';
	for (let key in finalMatchObjWrapper) {
		if (key != 'finalMatchObj' && finalMatchObjWrapper[key] != 1) {
			// found a player that hasn't readied yet
			allConfirmed = false;
		}
		if (key != 'finalMatchObj') {
			single_user = key; // just need 1 user to find in matchqueuebyuser
		}
	}
	if (allConfirmed) {
		console.log('all confirmed ready for match!');
		startMatch(finalMatchObjWrapper, discordClient);
		removeMatchFromReadyCheckMatchQueueByUser(single_user);
	}
	else {
		console.log('not all confirmed ready!');
	}
}

function removeMatchFromReadyCheckMatchQueueByUser(username) {
	for (let i = 0; i < readyCheckMatchQueue.length; i++) {
		const finalMatchObjWrapper = readyCheckMatchQueue[i];
		for (let key in finalMatchObjWrapper) {
			if (key == username) {
				// found a match with this user to delete
				readyCheckMatchQueue.splice(i, 1);
			}
		}
	}
}


//return true if the report was successful, false if not found
const reportMatch = function(username, winBool) {
	// TODO: add timestamp to finalGameObj and check it to clear old games nobody reported
	// TODO: add game number to finalMatchObj
	for (let i = 0; i < activeMatches.length; i++) {
		//const finalMatchObjWrapper = activeMatches[i];
		for (let key in activeMatches[i]) {
			if (key == username && activeMatches[i][key] != 'win' && activeMatches[i][key] != 'lose') {
				if (winBool) {
					activeMatches[i][key] = 'win';
				}
				else {
					activeMatches[i][key] = 'lose';
				}
				return true;
			}
		}
	}
	return false;
}

//Returns true if the user is in a game but hasn't reported yet
const isUserInGameUnreported = function(username) {
	// loop through activeGames and find if the user key exists for any of the game objects
	for (let i = 0; i < activeMatches.length; i++) {
		const finalMatchObjWrapper = activeMatches[i];
		for (let key in finalMatchObjWrapper) {
			if (key == username && finalMatchObjWrapper[key] != 'win' && finalMatchObjWrapper[key] != 'lose') {
				return true;
			}
		}
	}
	return false;
}

const checkMatchCompleteWithUser = function(message, username) {
	// loop through each of the games
	for (let i = 0; i < activeMatches.length; i++) {
		const finalMatchObjWrapper = activeMatches[i];
		for (let key in finalMatchObjWrapper) {
			if (key == username) {
				// found match with this user
				let fangsWin = 0;
				let fangsLose = 0;
				let clawsWin = 0;
				let clawsLose = 0;
				const finalMatchObj = finalMatchObjWrapper.finalMatchObj;
				for (let i = 0; i < finalMatchObj.claws.length; i++) {
					if (finalMatchObjWrapper[finalMatchObj.claws[i].user_id] == 'win') {
						clawsWin = clawsWin + 1;
						console.log('added win for claws, new clawsWin value: ' + clawsWin);
					}
					else if (finalMatchObjWrapper[finalMatchObj.claws[i].user_id] == 'lose') {
						clawsLose = clawsLose + 1;
						console.log('added lose for claws, new clawsLose value: ' + clawsLose);
					}
				}
				for (let i = 0; i < finalMatchObj.fangs.length; i++) {
					if (finalMatchObjWrapper[finalMatchObj.fangs[i].user_id] == 'win') {
						fangsWin = fangsWin + 1;
						console.log('added win for fangs, new fangsWin value: ' + fangsWin);
					}
					else if (finalMatchObjWrapper[finalMatchObj.fangs[i].user_id] == 'lose') {
						fangsLose = fangsLose + 1;
						console.log('added lose for fangs, new fangsLose value: ' + fangsLose);
					}
				}
				// compare totals and figure out who won or lost or if there are conflicts
				if (fangsWin + clawsLose > 4) {
					// the fangs win and we have at least 5 people report
					message.reply('thank you for reporting, the Fangs have won, MMR has been adjusted and the match has been closed.');
					const clawsWinBool = false;
					adjustMMR(finalMatchObj, clawsWinBool);
					activeMatches.splice(i,1);// remove game 
				}
				else if (clawsWin + fangsLose > 4) {
					// the claws win and we have at least 5 people report
					message.reply('thank you for reporting, the Claws have won, MMR has been adjusted and the match has been closed.');
					const clawsWinBool = true;
					adjustMMR(finalMatchObj, clawsWinBool);
					activeMatches.splice(i,1);// remove game 
				}
				else if (clawsWin > 0 && fangsWin > 0) {
					// conflicting report, send messages to admins
					console.log('found conflicting reports for this match!');
					message.reply('thank you for reporting the match but we found conflicts in the reports. Please notify an Admin to review this match');
					activeMatches.splice(i,1);// remove game 
				}
				else {
					console.log('Checked if the match was completed but not enough reports yet');
				}
				return null; // return to break out of loop
			}
		}
	}
}

function adjustMMR(finalMatchObj, clawsWinBool) {
	// loop through claws and fangs arr, +25 if win, -25 if lose 
	for (let i = 0; i < finalMatchObj.claws.length; i++) {
		const queuePlayerObj = finalMatchObj.claws[i];
		const winBool = clawsWinBool;
		const user_role = getRoleFromQueryPlayerObj(queuePlayerObj);
		userStats.updatePlayerMMRMatchComplete(queuePlayerObj.user_id, user_role, queuePlayerObj.datacenter, winBool);
	}
	for (let i = 0; i < finalMatchObj.fangs.length; i++) {
		const queuePlayerObj = finalMatchObj.fangs[i];
		const winBool = !clawsWinBool;
		const user_role = getRoleFromQueryPlayerObj(queuePlayerObj);
		userStats.updatePlayerMMRMatchComplete(queuePlayerObj.user_id, user_role, queuePlayerObj.datacenter, winBool);
	}
	console.log('finished updating players MMR');
}

const testStartMatch = function(discordClient) {
	startMatch(matchObjTest, discordClient);
}
	
const testSendReadyChecks = function(discordClient) {
	sendReadyChecks(matchObjTest, discordClient);
}

const getReadyCheckMatchQueue = function() {
	return readyCheckMatchQueue;
}

const getMatches = function() {
	return activeMatches;
}

module.exports = {
		addPlayerToQueue: addPlayerToQueue,
		checkForMatch: checkForMatch,
		getQueues: getQueues,
		startMatch: startMatch,
		isPlayerInQueue: isPlayerInQueue,
		testStartMatch: testStartMatch,
		testSendReadyChecks: testSendReadyChecks,
		confirmUserReady: confirmUserReady,
		checkMatchReady: checkMatchReady,
		getReadyCheckMatchQueue: getReadyCheckMatchQueue,
		sendReadyChecks: sendReadyChecks,
		reportMatch: reportMatch,
		isUserInGameUnreported: isUserInGameUnreported,
		checkMatchCompleteWithUser: checkMatchCompleteWithUser,
		getMatches: getMatches
}