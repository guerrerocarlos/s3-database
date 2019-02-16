# s3-database

> Use S3 as backend database (with optional public access from the frontend)

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
