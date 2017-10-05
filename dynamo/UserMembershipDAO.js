var AWS = require("aws-sdk");
AWS.config.loadFromPath('./credentials');
const docClient = new AWS.DynamoDB.DocumentClient();
const table = "user-membership";

// TODO: javadocs
const createNewUser = function(user_id, user_role, vouched, approved, banned, vouchers, approvers, approval_date) {
	return new Promise((resolve, reject) => {
		const creation_date = (new Date()).toISOString();
		const params = {
		    TableName:table,
		    Item:{
		        "user_id": user_id,
		        "user_role": user_role,
		        "vouched": vouched,
		        "approved": approved,
		        "banned": banned,
		        "vouchers": vouchers,
		        "approvers": approvers,
		        "creation_date": creation_date,
		        "approval_date": approval_date,
		    }
		};
		console.log("Creating a new UserMembership Item...");
		docClient.put(params, function(err, data) {
		    if (err) {
		        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
		        reject(err);
		    } else {
		        console.log("Added item:", JSON.stringify(data, null, 2));
		        resolve(params.Item); // data appears to always be empty from the .put() call so return params object
		    }
		});
	});
}

// TODO: javadocs
const getUser = function(user_id) {
	var params = {
	    TableName: table,
	    Key:{
	        "user_id": user_id
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

// TODO;
const getAllUser = function() {
	return new Promise((resolve, reject) => {
		var params = {
			TableName:table,
			ProjectionExpression: "#uid, user_role, vouched, approved, banned, vouchers, approvers, creation_date, approval_date",
			ExpressionAttributeNames: {
			    "#uid": "user_id",
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

// TODO:
const updateUserRole = function(user_id, newRole) {
	return new Promise((resolve, reject) => {
		// Update the item, unconditionally,
		var params = {
		    TableName:table,
		    Key:{
		        "user_id": user_id
		    },
		    UpdateExpression: "set user_role = :r",
		    ExpressionAttributeValues:{
		        ":r":newRole
		    },
		    ReturnValues:"UPDATED_NEW"
		};
	
		console.log("UserMembership DAO - Updating user " + user_id + " with role: " + newRole);
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

//TODO:
const updateVouchedApproved = function(user_id, vouchedBool, approvedBool, vouchers, approvers) {
	return new Promise((resolve, reject) => {
		// Update the item, unconditionally,
		let approval_date = 'none';
		let user_role = 'waiting';
		if (approvedBool) {
			approval_date = (new Date()).toISOString();
			user_role = 'user';
		}
		const vouched = +vouchedBool;
		const approved = +approvedBool;
		var params = {
		    TableName:table,
		    Key:{
		        "user_id": user_id
		    },
		    UpdateExpression: "set user_role = :r, vouched = :v, approved = :a, vouchers = :vs, approvers = :as, approval_date = :ad",
		    ExpressionAttributeValues:{
		        ":r":user_role,
		        ":v":vouched,
		        ":a":approved,
		        ":vs":vouchers,
		        ":as":approvers,
		        ":ad":approval_date
		    },
		    ReturnValues:"UPDATED_NEW"
		};
	
		console.log("UserMembership DAO - updating Vouched and/or Approved for " + user_id);
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

// expose public methods
module.exports = {
		createNewUser: createNewUser,
		getUser: getUser,
		getAllUsers: getAllUser,
		updateUserRole: updateUserRole,
		updateVouchedApproved: updateVouchedApproved
}