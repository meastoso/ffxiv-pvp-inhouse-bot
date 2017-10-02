var AWS = require("aws-sdk");
AWS.config.loadFromPath('./credentials');
const docClient = new AWS.DynamoDB.DocumentClient();
const table = "user-stats";

// TODO: javadocs
// mmr is a map with key = datacenterName and value = mmr
const createNewItem = function(user_id, user_role, mmrDatacenterMap, total_games, total_won) {
	const creation_date = (new Date()).toISOString();
	const params = {
	    TableName:table,
	    Item:{
	        "user_id": user_id,
	        "user_role": user_role,
	        "mmrDatacenterMap": mmrDatacenterMap,
	        "total_games": total_games,
	        "total_won": total_won
	    }
	};
	console.log("Creating a new UserStats Item...");
	docClient.put(params, function(err, data) {
	    if (err) {
	        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
	    } else {
	        console.log("Added item:", JSON.stringify(data, null, 2));
	    }
	});
}

/*const mmrDatacenterMap = {
		'primal': '1000',
		'aether': '1000'
};
createNewItem("meastoso#3957", "healer", mmrDatacenterMap, 0, 0);*/

// TODO: javadocs
const getItem = function(user_id, user_role) {
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

//getItem("meastoso#3957", "healer");

const updateMMR = function(user_id, user_role, datacenter, newMMR) {
	// Update the item, unconditionally,
	var params = {
	    TableName:table,
	    Key:{
	        "user_id": user_id,
	        "user_role": user_role
	    },
	    UpdateExpression: "set mmrDatacenterMap." + datacenter + " = :m",
	    ExpressionAttributeValues:{
	        ":m":newMMR
	    },
	    ReturnValues:"UPDATED_NEW"
	};

	console.log("Updating the item...");
	docClient.update(params, function(err, data) {
	    if (err) {
	        console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
	    } else {
	        console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
	    }
	});
}

//updateMMR("meastoso#3957", "healer", "aether", 1025);

// expose public methods
module.exports = {
		createNewItem: createNewItem,
		getItem: getItem,
		// create an update method for specified use-cases
		updateMMR: updateMMR
}