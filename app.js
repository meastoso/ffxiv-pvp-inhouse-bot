const Discord = require('discord.js');
const client = new Discord.Client();
const userMembership = require('./users/UserMembership.js'); 
const userStats = require('./users/UserStats.js');
const auditRecordsDAO = require('./dynamo/AuditRecordsDAO.js');

client.on('ready', () => {
  console.log('I am ready!');
});

/*
 * message.author.username = 'meastoso'
 * message.author.discriminator = '3957'
 * message.author.tag = 'meastoso#3957'
 * message.channel.name = 'general'
 */
client.on('message', message => {
	if (message.content.startsWith('!')) { // only continue parsing message if it starts with '!'
		if (message.content === '!kisada') {
			const username = message.author.username;
			const discriminator = message.author.discriminator;
			const tag = message.author.tag; // NOTE: 
			const channelname = message.channel.name;
			console.log('user: ' + username);
			console.log('discriminator: ' + discriminator);
			console.log('tag: ' + tag);
			console.log('channel: ' + channelname);
			
			//****************************************
			// THIS IS HOW YOU SEND PRIVATE MESSAGES
			//****************************************
			/*message.author.createDM()
				.then((dmChannel) => {
					dmChannel.send('you sexy');
				})
				.catch((err) => {
					console.log(err);
				});*/
			
			message.reply('I AM LOOKING FOR GIRLFRIEND');
		}
	}
});

client.login('MzU3OTg2ODU2MjM3MDA2ODU4.DJyB2Q.7TqQN5W7Y1vEr5kp-_hXpAIUF2g');
//client.login('MzU3OTg2ODU2MjM3MDA2ODU4.DLLx0Q.LckUr9nw3uFM2SUB8ObSOdNbM6w');
