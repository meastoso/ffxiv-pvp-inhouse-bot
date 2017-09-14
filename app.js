const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  if (message.content === '!kisada') {
    message.reply('I AM LOOKING FOR GIRLFRIEND');
  }
});

client.login('MzU3OTg2ODU2MjM3MDA2ODU4.DJyB2Q.7TqQN5W7Y1vEr5kp-_hXpAIUF2g');
