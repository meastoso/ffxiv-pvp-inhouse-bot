var AWS = require("aws-sdk");
AWS.config.loadFromPath('./credentials');
const docClient = new AWS.DynamoDB.DocumentClient();
const table = "user-stats";

// TODO: javadocs
// mmr is a map with key = datacenterName and value = mmr
const createNewUser = function(user_id, user_role, mmrDatacenterMap) {
	return new Promise((resolve, reject) => {
		const creation_date = (new Date()).toISOString();
		const params = {
		    TableName:table,
		    Item:{
		        "user_id": user_id,
		        "user_role": user_role,
		        "mmrDatacenterMap": mmrDatacenterMap
		    }
		};
		console.log("Creating a new UserStats Item...");
		docClient.put(params, function(err, data) {
		    if (err) {
		        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
		        reject(err);
		    } else {
		        console.log("Added item:", JSON.stringify(data, null, 2));
		        resolve(params.Item);
		    }
		});
	});
}

/*const mmrDatacenterMap = {
		'primal': '1000',
		'aether': '1000'
};
createNewItem("meastoso#3957", "healer", mmrDatacenterMap, 0, 0);*/

// TODO: javadocs
const getUserStats = function(user_id, user_role) {
	var params = {
	    TableName: table,
	    Key:{
	        "user_id": user_id,
	        "user_role": user_role,
	    }
	};
	docClient.get(params, function(err, data) {
	    if (err) {
	        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
	    } else {
	        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
	    }
	});
}

const updateMMR = function(user_id, user_role, datacenter, newMMR, newTotalWins, newTotalGames) {
	return new Promise((resolve, reject) => {
		// Update the item, unconditionally,
		var params = {
		    TableName:table,
		    Key:{
		        "user_id": user_id,
		        "user_role": user_role
		    },
		    UpdateExpression: "set mmrDatacenterMap." + datacenter + ".rating = :m, mmrDatacenterMap." + datacenter + ".total_won = :tw, mmrDatacenterMap." + datacenter + ".total_games = :tg",
		    ExpressionAttributeValues:{
		        ":m":newMMR,
		        ":tw":newTotalWins,
		        ":tg":newTotalGames
		    },
		    ReturnValues:"UPDATED_NEW"
		};
	
		console.log("Updating the item...");
		docClient.update(params, function(err, data) {
		    if (err) {
		        console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
		        reject(err);
		    } else {
		        console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
		        resolve(data);
		    }
		});
	});
}

const addNewDatacenterToUser = function(user_id, user_role, newDatacenter, newDatacenterObj) {
	return new Promise((resolve, reject) => {
		// Update the item, unconditionally,
		var params = {
		    TableName:table,
		    Key:{
		        "user_id": user_id,
		        "user_role": user_role
		    },
		    UpdateExpression: "set mmrDatacenterMap." + newDatacenter + " = :dco",
		    ExpressionAttributeValues:{
		        ":dco":newDatacenterObj
		    },
		    ReturnValues:"UPDATED_NEW"
		};

		console.log("Updating the item...");
		docClient.update(params, function(err, data) {
		    if (err) {
		        console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
		        reject(err);
		    } else {
		        console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
		        resolve(data);
		    }
		});
	});
}

//updateMMR("meastoso#3957", "healer", "aether", 1025);

//TODO;
const getAllUsers = function() {
	return new Promise((resolve, reject) => {
		var params = {
			TableName:table,
			ProjectionExpression: "#uid, #ur, mmrDatacenterMap, total_games, total_won",
			ExpressionAttributeNames: {
			    "#uid": "user_id",
			    "#ur": "user_role",
			},
		};
		
		docClient.scan(params, onScan);
		function onScan(err, data) {
			if (err) {
		        console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
		        reject(err);
		    } else {
		        // print all the movies
		        console.log("Scan succeeded.");
		        // continue scanning if we have more movies, because
		        // scan can retrieve a maximum of 1MB of data
		        if (typeof data.LastEvaluatedKey != "undefined") {
		            console.log("Scanning for more...");
		            params.ExclusiveStartKey = data.LastEvaluatedKey;
		            docClient.scan(params, onScan);
		        }
		        else {
		        	// done scanning, resolve
		        	resolve(data);
		        }
		    }
		}
	});
}

// expose public methods
module.exports = {
		createNewUser: createNewUser,
		getUserStats: getUserStats,
		// create an update method for specified use-cases
		updateMMR: updateMMR,
		getAllUsers: getAllUsers,
		addNewDatacenterToUser: addNewDatacenterToUser
}