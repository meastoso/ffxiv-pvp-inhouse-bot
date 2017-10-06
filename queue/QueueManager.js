/*
 * Queue Manager - manages all the queues
 */
const userStats = require('../users/UserStats.js'); 

// NOTE: I want this to be an ENUM but because kisada can change channel names
function getDatacenterFromDiscordChannel(discordChannelName) {
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

const queues = {
		'primal': [],
		'aether': [],
		'chaos': [],
		'mana': [],
		'gaia': [],
		'elemental': []
};

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

const startMatch = function(matchObj, discordClient) {
	const finalMatchObj = sortMatch(matchObj);
	// now send DMs to each user in the match
	
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
	const q = queues[datacenter];
	for (let i = 0; i < q.length; i++) {
		if (q[i].user_id == playerName) {
			return true;
		}
	}
	return false;
}

// TEST TEST TEST DELETE THIS LATER
healerArrTest = [];
tankArrTest = [];
meleeArrTest = [];
rangedArrTest = [];

// make healers
healer1 = {
		'user_id': 'meastoso#3957',
		'healer': 1,
		'healerMMR': 1600
};
healerArrTest.push(healer1);
healer2 = {
		'user_id': 'aviars#3957',
		'healer': 1,
		'healerMMR': 2400
};
healerArrTest.push(healer2);
tank1 = {
		'user_id': 'lion#3957',
		'tank': 1,
		'tankMMR': 1900
};
tankArrTest.push(tank1);
tank2 = {
		'user_id': 'dark#3957',
		'tank': 1,
		'tankMMR': 1400
};
tankArrTest.push(tank2);
melee1 = {
		'user_id': 'kisada#3957',
		'melee': 1,
		'meleeMMR': 1750
};
meleeArrTest.push(melee1);
melee2 = {
		'user_id': 'melo#3957',
		'melee': 1,
		'meleeMMR': 1900
};
meleeArrTest.push(melee2);
ranged1 = {
		'user_id': 'miyu#3957',
		'ranged': 1,
		'rangedMMR': 1120
};
rangedArrTest.push(ranged1);
ranged2 = {
		'user_id': 'elia#3957',
		'ranged': 1,
		'rangedMMR': 1450
};
rangedArrTest.push(ranged2);

const matchObjTest = {
		'healerArr': healerArrTest,
		'tankArr': tankArrTest,
		'meleeArr': meleeArrTest,
		'rangedArr': rangedArrTest
}

const testStartMatch = function(discordClient) {
	startMatch(matchObjTest, discordClient);
}
	

module.exports = {
		addPlayerToQueue: addPlayerToQueue,
		checkForMatch: checkForMatch,
		getQueues: getQueues,
		startMatch: startMatch,
		isPlayerInQueue: isPlayerInQueue,
		testStartMatch: testStartMatch
}