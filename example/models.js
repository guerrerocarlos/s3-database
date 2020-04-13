var AWS = require('aws-sdk')
// var config = require('./config')
var DB = require('../')(`d4js`, AWS)

// if(config.stage === 'testing'){
    // AWS.config.loadFromPath('./aws_config.json');
// }

module.exports = {

  Client: new DB('Client', {
    id: {
      hashKey: true,
      type: String
    },
    ip: {
      type: String
    },
    userId: {
      type: String,
      index: true,
    }
  }),

  Event: new DB('Event', {
    id: {
      hashKey: true,
      type: String,
      default: (e) => `${e.userId}-${e.serverTime}`
    },
    connectionId: {
      type: String
    },
    userId: {
      type: String,
      index: true,
      canRepeat: true
    },
    serverTime: {
      // hashKey: true,
      index: true,
      composed: ['date', 'userId', 'connectionId'],
      type: String
    },
    date: {
      type: String,
      index: true,
      canRepeat: true,
      key: 'userId'
    },
    event: {
      type: String
    },
    payload: {
      type: Object
    },
  }),


}


