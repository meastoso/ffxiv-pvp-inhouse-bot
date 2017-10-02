var AWS = require("aws-sdk");
AWS.config.loadFromPath('./credentials');
const docClient = new AWS.DynamoDB.DocumentClient();
const table = "audit-records";

// TODO: javadocs
// mmr is a map with key = datacenterName and value = mmr
const createNewItem = function(user_id, action, target_user_id, args) {
	const creation_time = (new Date()).toISOString();
	const params = {
	    TableName:table,
	    Item:{
	        "user_id": user_id,
	        "creation_time": creation_time,
	        "action": action,
	        "target_user_id": target_user_id,
	        "args": args
	    }
	};
	console.log("Creating a new AuditRecord Item...");
	docClient.put(params, function(err, data) {
	    if (err) {
	        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
	    } else {
	        console.log("Added item:", JSON.stringify(data, null, 2));
	    }
	});
}

//createNewItem("meastoso#3957", "timeout", "kisada#1862", "being a dirty little loser");

// expose public methods
module.exports = {
		createNewItem: createNewItem,
}