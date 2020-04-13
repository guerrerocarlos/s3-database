var AWS = require('aws-sdk')
// var config = require('./config')
var DB = require('../')(`s3-bucket-name.carlosguerrero.com`, AWS)

// if(config.stage === 'testing'){
//     AWS.config.loadFromPath('./tests/aws_config.json');
// }

module.exports = {

    Account: new DB('Account', {
        id: {
            hashKey: true,
            type: String
        },
        amount: {
            type: String
        },
        type: {
            type: String
        },
        clientId: {
            index: true,
            repeated: true,
            type: String
        }
    }),

    Client: new DB('Client', {
        id: {
            hashKey: true,
            type: String
        },
        name: {
            type: String
        },
        username: {
            type: String
        }
    }),

}
