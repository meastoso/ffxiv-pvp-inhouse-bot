var AWS = require("aws-sdk");
AWS.config.loadFromPath('./credentials');


const docClient = new AWS.DynamoDB.DocumentClient();




module.exports = {
		addNewItem: function() {
			const table = "user-membership";
			const user_id = "meastoso#3957";
			const user_role = "super-admin";
			const vouched = 1;
			const approved = 1;
			const banned = 0;
			const vouchers = "me, myself, I";
			const approvers = "me, myself, I";
			// The Date values are stored as ISO-8601 formatted strings.
			const creation_date = (new Date()).toISOString();
			const approval_date = (new Date()).toISOString();

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

			console.log("Adding a new item...");
			docClient.put(params, function(err, data) {
			    if (err) {
			        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
			    } else {
			        console.log("Added item:", JSON.stringify(data, null, 2));
			    }
			});
		
		},
		getItem: function() {
			const table = "user-membership";
			const user_id = "meastoso#3957";
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
		},
		updateItem: function() {
			const table = "user-membership";
			const user_id = "meastoso#3957";
			const newRole = "voucher";
			const newApprovalDate = (new Date()).toISOString();

			// Update the item, unconditionally,
			var params = {
			    TableName:table,
			    Key:{
			        "user_id": user_id
			    },
			    UpdateExpression: "set approval_date = :ad",
			    ExpressionAttributeValues:{
			        ":ad":newApprovalDate
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
}