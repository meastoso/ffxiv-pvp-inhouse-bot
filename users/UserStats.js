const userStatsDAO = require('../dynamo/UserStatsDAO.js');

let userStatsCache = {};

//Populate UserMembership Cache
userStatsDAO.getAllUsers()
	.then((data) => {
		console.log("Finished populating users stats table at startup!");
		data.Items.forEach(function(userRecord) {
			if (userStatsCache[userRecord.user_id] == undefined) {
				userStatsCache[userRecord.user_id] = {};
			}
			userStatsCache[userRecord.user_id][userRecord.user_role] = {
					'mmrDatacenterMap': userRecord.mmrDatacenterMap
			};
        });
	})
	.catch((err) => {
		console.log("ERROR! Failed to populate users table at startup!");
	});


const createUserRecord = function(username, role, datacenter) {
	return new Promise((resolve, reject) => {
		console.log('attempting to createUserRecord() in UserStats.js with datacenter: ' + datacenter);
		const mmrDatacenterMap = {};
		mmrDatacenterMap[datacenter] = {};
		mmrDatacenterMap[datacenter].rating = 1000;
		mmrDatacenterMap[datacenter].total_won = 0;
		mmrDatacenterMap[datacenter].total_games = 0;
		userStatsDAO.createNewUser(username, role, mmrDatacenterMap)
			.then((data) => {
				// NOW UPDATE CACHE
				//userMembershipCache[userObj.user_id].user_role = roleName;
				if (userStatsCache[data.user_id] == undefined) {
					userStatsCache[data.user_id] = {};
				}
				userStatsCache[data.user_id][data.user_role] = {
						'mmrDatacenterMap': data.mmrDatacenterMap
				};
				resolve(data);
			})
			.catch((err) => {
				console.log('Caught error in UserStats.createUserRecord() method:');
				console.log(err);
				reject(err);
			});
	});
}


// returns player from cache, returns undefined if player doesn't exist
const getPlayer = function(userName) {
	return userStatsCache[userName];
}

const addNewDatacenterToPlayer = function(userName, matchRole, newDatacenter) {
	return new Promise((resolve, reject) => {
		const newDatacenterObj = {};
		newDatacenterObj['rating'] = 1000; // GET THIS FROM HIGHEST
		newDatacenterObj['total_won'] = 0;
		newDatacenterObj['total_games'] = 0;
		userStatsDAO.addNewDatacenterToUser(userName, matchRole, newDatacenter, newDatacenterObj)
			.then((data) => {
				// NOW UPDATE CACHE
				userStatsCache[userName][matchRole].mmrDatacenterMap[newDatacenter] = newDatacenterObj;
				resolve(data);
			})
			.catch((err) => {
				console.log('Caught error in UserStats.createUserRecord() method:');
				console.log(err);
				reject(err);
			});
	});
}


module.exports = {
		getPlayer: getPlayer,
		createUserRecord: createUserRecord,
		addNewDatacenterToPlayer, addNewDatacenterToPlayer
}