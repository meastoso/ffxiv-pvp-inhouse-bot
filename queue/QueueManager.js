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

// match role is 'healer, 'tank', 'melee', 'ranged'
const addPlayerToQueue = function(userName, discordChannelName, matchRole) {
	// TODO WRAP IN PROMISE
	const datacenter = getDatacenterFromDiscordChannel(discordChannelName);
	let player = userStats.getPlayer(userName);
	if (player == undefined) {
		// this player is queueing for the first time ever, does not exist in usersStats table
		console.log('this player is queueing for the first time ever, does not exist in usersStats table')
		userStats.createUserRecord(userName, matchRole, datacenter)
			.then((data) => {
				player = userStats.getPlayer(userName); // get updated user from cache
				// CONVERT CACHED PLAYER TO QUEUE PLAYER OBJ ADD PLAYER TO DATACENTER QUEUE
			})
			.catch((err) => {
				console.log(err);
			});
	}
	else { // player exists in userstats table and has queued before
		if (player[matchRole] == undefined) {
			console.log('this player exists but hasnt played this role before on any datacenter');
			userStats.createUserRecord(userName, matchRole, datacenter)
				.then((data) => {
					player = userStats.getPlayer(userName); // get updated user from cache
					// CONVERT CACHED PLAYER TO QUEUE PLAYER OBJ ADD PLAYER TO DATACENTER QUEUE
				})
				.catch((err) => {
					console.log(err);
				});
		}
		else {
			// player has already queued on this role before
			if (player[matchRole].mmrDatacenterMap[datacenter] == undefined) {
				console.log('player has queued on this role before but never on this datacenter before');
				// player has queued on this role before but never on this datacenter before
				
				// get highest mmr from other datacenters
				// update mmrMap with new datacenter in dynamo
				// update mmrMap with new datacenter in cache
				// add player object to datacenter queue
				userStats.addNewDatacenterToPlayer(userName, matchRole, datacenter)
					.then((data) => {
						player = userStats.getPlayer(userName); // get updated user from cache
						// CONVERT CACHED PLAYER TO QUEUE PLAYER OBJ ADD PLAYER TO DATACENTER QUEUE
					})
					.catch((err) => {
						console.log(err);
					});
			}
			else {
				// normal scenario, player has queued on this role on this datacenter before...
				console.log('normal scenario, player has queued on this role on this datacenter before...');
				// CONVERT CACHED PLAYER TO QUEUE PLAYER OBJ ADD PLAYER TO DATACENTER QUEUE
				
			}
		}
	}
}

module.exports = {
		addPlayerToQueue: addPlayerToQueue
}