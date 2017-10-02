var AWS = require("aws-sdk");
AWS.config.loadFromPath('./credentials');

var dynamodb = new AWS.DynamoDB();

var params = {
    TableName : "user-membership",
    KeySchema: [       
        { AttributeName: "user_id", KeyType: "HASH"}
    ],
    AttributeDefinitions: [       
        { AttributeName: "user_id", AttributeType: "S" }
    ],
    ProvisionedThroughput: {       
        ReadCapacityUnits: 10, 
        WriteCapacityUnits: 10
    }
};

dynamodb.createTable(params, function(err, data) {
    if (err) {
        console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
    }
});