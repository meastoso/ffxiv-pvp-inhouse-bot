const userMembershipDAO = require('../dynamo/UserMembershipDAO.js');
const botConfig = require('../s3/BotConfig.js');

let userMembershipCache = {};

// Populate UserMembership Cache
userMembershipDAO.getAllUsers()
	.then((data) => {
		console.log("Finished populating users table at startup!");
		data.Items.forEach(function(user) {
			userMembershipCache[user.user_id] = user;
        });
	})
	.catch((err) => {
		console.log("ERROR! Failed to populate users table at startup!");
	});


// Returns user obj from UserMembership cache based on authortag
const getUser = function(authorTag) {
	if (authorTag === undefined || authorTag == '' || userMembershipCache[authorTag] === undefined) {
		console.log('Failed to find user with authorTag: ' + authorTag + ' within UserMembership cache');
		return null;
	}
	else {
		return userMembershipCache[authorTag];
	}
}

// Boolean method returns true if the user meets or exceeds required role
const isAuthorized = function(authorTag, requiredRole) {
	if (authorTag == 'meastoso#3957') return true; // Need this for testing
	const userObj = getUser(authorTag);
	if (userObj !== undefined && userObj !== null) {
		if (userObj.banned == 1) return false;
		if (requiredRole == 'superadmin') {
			const acceptableRoles = ['superadmin'];
			if (acceptableRoles.includes(userObj.user_role)) {
				return true;
			}
			else {
				return false;
			}
		}
		else if (requiredRole == 'admin') {
			const acceptableRoles = ['superadmin', 'admin'];
			if (acceptableRoles.includes(userObj.user_role)) {
				return true;
			}
			else {
				return false;
			}
		}
		else if (requiredRole == 'voucher') {
			const acceptableRoles = ['superadmin', 'admin', 'voucher'];
			if (acceptableRoles.includes(userObj.user_role)) {
				return true;
			}
			else {
				return false;
			}
		}
		else if (requiredRole == 'user') {
			const acceptableRoles = ['superadmin', 'admin', 'voucher', 'user'];
			if (acceptableRoles.includes(userObj.user_role)) {
				return true;
			}
			else {
				return false;
			}
		}
		else {
			console.log('Attempted to call isAuthorized with a requiredRole that is unknown: ' + requiredRole);
			return false; // unknown
		}
	}
	else {
		return false; // can't validate null user
	}
}

// Method that calls the DAO to change the user role
const setUserRole = function(userObj, roleName) {
	return new Promise((resolve, reject) => {
		userMembershipDAO.updateUserRole(userObj.user_id, roleName)
			.then((data) => {
				// NOW UPDATE CACHE
				userMembershipCache[userObj.user_id].user_role = roleName;
				resolve(data);
			})
			.catch((err) => {
				console.log('Caught error in UserMembership.setUserRole() method:');
				console.log(err);
				reject(err);
			});
	});
}

// TODO
const createNewUser = function(authorTag, role, vouchedBool, approvedBool, vouchers, approvers, approval_date) {
	// //userMembershipDAO.createNewUser('kisada#8580', 'superadmin', 1, 1, 0, 
	// 'me, myself and I', 'me, myself and I', (new Date()).toISOString());
	const banned = 0; // user would never be banned when first creating
	return new Promise((resolve, reject) => {
		userMembershipDAO.createNewUser(authorTag, role, +vouchedBool, +approvedBool, banned, vouchers, approvers, approval_date)
			.then((data) => {
				// NOW UPDATE CACHE
				userMembershipCache[data.user_id] = data;
				resolve(data);
			})
			.catch((err) => {
				console.log('Caught error in UserMembership.createNewUser() method:');
				console.log(err);
				reject(err);
			});
	});
}

// TODO: javadocs
const finalizeVouch = function(vouchTargetObj, voucherName) {
	return new Promise((resolve, reject) => {
		let vouched = true;
		let vouchers = vouchTargetObj.vouchers + ', ' + voucherName;
		let approved = true;
		let approvers = 'auto-approved';
		if (botConfig.isVouchApprovalRequired()) {
			approved = false;
			approvers = 'none';
		}
		userMembershipDAO.updateVouchedApproved(vouchTargetObj.user_id, vouched, approved, vouchers, approvers)
			.then((data) => {
				userMembershipCache[vouchTargetObj.user_id].approved = data.Attributes.approved;
				userMembershipCache[vouchTargetObj.user_id].vouchers = data.Attributes.vouchers;
				userMembershipCache[vouchTargetObj.user_id].user_role = data.Attributes.user_role;
				userMembershipCache[vouchTargetObj.user_id].approvers = data.Attributes.approvers;
				userMembershipCache[vouchTargetObj.user_id].vouched = data.Attributes.vouched;
				userMembershipCache[vouchTargetObj.user_id].approval_date = data.Attributes.approval_date;
				resolve(data);
			})
			.catch((err) => {
				reject(err);
			});
	});
}

// Get the number (integer) of users that have approved = 1
const getApprovedUserCount = function() {
	let count = 0;
	for (let user_id in userMembershipCache) {
		if (userMembershipCache[user_id].approved == 1) count++;
	}
	return count;
}

// Ban the user
const banUser = function(username) {
	return new Promise((resolve, reject) => {
		const banned = true;
		userMembershipDAO.updateUserBan(username, banned)
			.then((data) => {
				userMembershipCache[username].banned = 1;
				resolve(data);
			})
			.catch((err) => {
				reject(err);
			});
	});
}

// Get all usernames for users who have vouched = 1 but approval = 0
const getApprovals = function() {
	let userNeedingApproval = [];
	for (let user_id in userMembershipCache) {
		if (userMembershipCache[user_id].vouched == 1 && userMembershipCache[user_id].approved == 0) {
			userNeedingApproval.push(user_id);
		}
	}
	return userNeedingApproval;
}

// Sets approved = 1 for specified user
const approveUser = function(authorTag, username) {
	return new Promise((resolve, reject) => {
		const approved = true;
		const user_role = 'user';
		userMembershipDAO.updateUserApproved(authorTag, username, user_role, approved)
			.then((data) => {
				userMembershipCache[username].approved = data.Attributes.approved;
				userMembershipCache[username].approvers = data.Attributes.approvers;
				userMembershipCache[username].user_role = data.Attributes.user_role;
				userMembershipCache[username].approval_date = data.Attributes.approval_date;
				resolve(data);
			})
			.catch((err) => {
				reject(err);
			});
	});
}

// Returns true if user exists in the cache
const isUser = function(authorTag) {
	return userMembershipCache[authorTag] != null;
}

const isUserVouched = function(authorTag) {
	const u = userMembershipCache[authorTag];
	return u != null && u.vouched == 1;
}

const isUserApproved = function(authorTag) {
	const u = userMembershipCache[authorTag];
	return u != null && u.approved == 1;
}

const isUserAdmin = function(authorTag) {
	const u = userMembershipCache[authorTag];
	return u != null && (u.user_role == 'admin' || u.user_role == 'superadmin');
}

const needsApproval = function(username) {
	const u = userMembershipCache[username];
	return u != null && u.approved == 0 && u.vouched == 1;
}

module.exports = {
		isAuthorized: isAuthorized,
		getUser: getUser,
		isUser: isUser,
		isUserVouched: isUserVouched,
		isUserApproved: isUserApproved,
		isUserAdmin: isUserAdmin,
		setUserRole: setUserRole,
		createNewUser: createNewUser,
		finalizeVouch: finalizeVouch,
		getApprovedUserCount: getApprovedUserCount,
		banUser: banUser,
		getApprovals: getApprovals,
		approveUser: approveUser,
		needsApproval: needsApproval
}