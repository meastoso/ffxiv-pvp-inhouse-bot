"use strict";

/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

const AWS = require('aws-sdk');
AWS.config.loadFromPath('./credentials'); 
const s3 = new AWS.S3();
const pvpBotConfigurationBucket = 'meastoso-ffxiv-pvp-bot-configuration';
const configKey = 'pvp-bot-config-1';

let configCache = {};

const TEST_MODE = true;

// method to get the current global configuration for the bot
const getConfig = function() {
	return new Promise((resolve, reject) => {
		let params = {Bucket: pvpBotConfigurationBucket, Key: configKey};
		s3.getObject(params, function(err, data) {
			if (err) {
				console.log('Failed to get the bot configuration from S3...');
				console.log(err);
				reject(err);
			} else {
				console.log('Successfully retrieved bot configuration from S3...');
				resolve(JSON.parse(data.Body.toString()));
			}
		});
	});
}

// Method to update the configuration with the new config object specified
const updateConfig = function(updatedConfigObj) {
	return new Promise((resolve, reject) => {
		let params = {Bucket: pvpBotConfigurationBucket, Key: configKey, Body: JSON.stringify(updatedConfigObj)};
		s3.putObject(params, function(err, data) {
			if (err) {
				console.log('Failed to update the bot configuration in S3...');
				console.log(err);
				reject(err);
			} else {
				console.log('Successfully updated the bot configuration in S3...');
				resolve('OK');
			}
		});
	});
}

/*############################################################
 * When bot starts or restarts, load configuration into cache
 ############################################################*/
getConfig()
	.then((configObj) => {
		console.log('Successfully retrieved bot configuration at startup...');
		console.log(configObj);
		configCache = configObj;
	})
	.catch((err) => {
		console.log('Error when trying to get Bot Configuration at startup...');
		console.log(err);
	});

const setNewPlayerGracePeriod = function(days) {
	return new Promise((resolve, reject) => {
		const updatedConfigObj = configCache;
		updatedConfigObj.newPlayerGracePeriod = days;
		updateConfig(updatedConfigObj)
			.then((retObj) => {
				console.log('Successfully updated newPlayerGracePeriod to ' + days + ' days');
				configCache = updatedConfigObj; // update the cache with the new value
				resolve(retObj);
			})
			.catch((err) => {
				console.log('Failed to update newPlayerGracePeriod to ' + days + ' days');
				console.log(err);
				reject(err);
			});
	});
};

// returns the days (integer) required before a new player can vouch
const getNewPlayerGracePeriod = function() {
	return configCache.newPlayerGracePeriod;
};

const setVouchApproval = function(onBool) {
	return new Promise((resolve, reject) => {
		const updatedConfigObj = configCache;
		updatedConfigObj.isVouchApprovalRequired = onBool;
		updateConfig(updatedConfigObj)
			.then((retObj) => {
				console.log('Successfully updated isVouchApprovalRequired to ' + onBool);
				configCache = updatedConfigObj; // update the cache with the new value
				resolve(retObj);
			})
			.catch((err) => {
				console.log('Failed to update isVouchApprovalRequired to ' + onBool);
				console.log(err);
				reject(err);
			});
	});
};

// returns true if voucher approval is required
const isVouchApprovalRequired = function() {
	return configCache.isVouchApprovalRequired;
};

// public methods
module.exports = {
		setNewPlayerGracePeriod: setNewPlayerGracePeriod,
		getNewPlayerGracePeriod: getNewPlayerGracePeriod,
		setVouchApproval: setVouchApproval,
		isVouchApprovalRequired: isVouchApprovalRequired,
		isTestMode: function() {
			return TEST_MODE;
		}
}