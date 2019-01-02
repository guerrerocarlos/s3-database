# s3-as-database [![Build Status](https://travis-ci.org/guerrerocarlos/s3-as-database.svg?branch=master)](https://travis-ci.org/guerrerocarlos/s3-as-database) [![codecov](https://codecov.io/gh/guerrerocarlos/s3-as-database/badge.svg?branch=master)](https://codecov.io/gh/guerrerocarlos/s3-as-database?branch=master)

> Use S3 as a database with public or private access from the frontend


## Install

```
$ npm install s3-database
```


## Define the Models

models.js
```js 
var AWS = require('aws-sdk')
var DB = require('s3-database')('bucket-name', AWS)

module.exports = {
    User: new DB('User', {
        id: {
            hashKey: true,
            type: String
        },
        name: {
            type: String
        }
    }),

    Mission: new DB('Mission', {
        id: {
            hashKey: true,
            type: String
        },
        title: {
            type: String
        }
        userId: {
            index: true,
            many: true,
            type: String
        }
    }, { 
        public: true // reachable from internet
    }), 
}
```


## Use the Models

index.js
```js 
var models = require('./models')
var User = models.User
var Account = models.Account

var q = User({id: "007", name: "James"})
var m
```




## License

MIT © [Carlos Guerrero](https://carlosguerrero.com)
