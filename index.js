var fetch = require("node-fetch");
var debug = require("debug")('s3-database')

// todo:
// - allow ttl attribute even if not in the schema
// - check that object functions like `save` are not overwritten by attributes, maybe use reserved words

module.exports = function (bucket, AWS) {
  class S3Object {
    constructor(config) {
      this.___config = config;
      Object.defineProperty(this, "___config", {
        enumerable: false,
        writable: true
      });
    }

    expire(ttl, cb) {
      this.ttl = new Date().getTime() + ttl * 1000;
      return cb(null, this);
    }

    async save() {
      console.log('saving!')

      var self = this;
      var saved = false;
      var putPromises = [];
      var bodyToSave = {};

      if (Object.keys(this.___config).indexOf("schema") > -1) {
        console.log('GOT SCHEMA')
        Object.keys(this.___config.schema).forEach(each_index => {
          console.log('each_index', each_index)
          if (
            this.___config.schema[each_index].default &&
            self[each_index] === undefined
          ) {
            if (
              typeof this.___config.schema[each_index].default === "function"
            ) {
              self[each_index] = this.___config.schema[each_index].default(
                this
              );
            } else {
              self[each_index] = this.___config.schema[each_index].default;
            }
          }
          bodyToSave[each_index] = self[each_index];
        });
      } else {
        Object.keys(self).forEach(each_index => {
          if (each_index.indexOf("___") !== 0) {
            // TODO: check/cast to each type defined in the schema
            bodyToSave[each_index] = '' + self[each_index];
          }
        });
      }

      this.___config.indexes.forEach(each_index => {
        console.log('checking each_index', each_index, this.___config.schema[each_index])
        if (self[each_index] != undefined || this.___config.schema[each_index].composed) {

          saved = true;
          var index_path = each_index;
          console.log(
            each_index,
            "composed?",
            this.___config.schema[each_index]
          );

          if (
            this.___config.schema[each_index] &&
            this.___config.schema[each_index].composed
          ) {
            index_path = each_index + '/' + this.___config.schema[each_index].composed
              .map(key => {
                return self[key];
              })
              .join("/");
          }

          var params = {
            Body: JSON.stringify(bodyToSave),
            Bucket: bucket,
            // ACL: "public-read",
            // this.___config.opts && this.___config.opts.public
            // 	? "public-read"
            // 	: "private",
            Key:
              this.___config.collection +
              "/" +
              index_path +
              "/" +
              self[this.___config.hashKey] +
              ".json"
          };

          if (
            this.___config.hashKey &&
            this.___config.canRepeat.indexOf(each_index) > -1
          ) {
            params.Key =
              this.___config.collection +
              "/" +
              each_index +
              "/" +
              self[each_index] +
              "/" +
              self[this.___config.schema[each_index].key || this.___config.hashKey] +
              ".json";
          }

          console.log('PUT params >>', params)

          putPromises.push(
            self.___config.S3.putObject(params).promise()
          );
        }
      });


      await Promise.all(putPromises)
      return self
      // if (!saved) {
      // 	reject();
      // 	if (cb) cb("S3 DB Error: No indexes provided.");
      // } else {
      // 	Promise.all(putPromises).then(results => {
      // 		success();
      // 		if (cb) cb(null, results);
      // 	});
      // }
    }
  }

  class S3ObjectInstance extends S3Object {
    constructor(config, obj) {
      super(config);

      if (!(this instanceof S3ObjectInstance)) {
        return new S3ObjectInstance(obj);
      }
      for (var key in obj) {
        this[key] = obj[key];
      }

      return this;
    }
  }

  class DBCreator {
    constructor(collection, schema, opts) {
      var config = {};
      config.hashKey = "id";
      config.collection = collection;
      config.opts = opts;
      config.bucket = bucket;
      config.S3 = new AWS.S3();

      Object.defineProperty(config, "S3", {
        enumerable: false,
        writable: true
      });

      config.schema = schema;
      config.canRepeat = [];

      if (schema == undefined) {
        this.indexes = ["id"];
      } else {
        if (typeof schema === "object") {
          var newIndexes = [];
          Object.keys(schema).forEach(eachIndex => {
            if (schema[eachIndex].hashKey || schema[eachIndex].index) {
              newIndexes.push(eachIndex);
              if (schema[eachIndex].canRepeat) {
                config.canRepeat.push(eachIndex);
              }
              if (schema[eachIndex].hashKey) {
                config.hashKey = eachIndex;
              }
            }
          });
          config.indexes = newIndexes;
        } else {
          config.indexes = indexes;
        }
      }

      var dbHandler = function (obj) {
        return new S3ObjectInstance(config, obj);
      };

      dbHandler.addSchema = schemaDefinition => {
        Object.keys(schemaDefinition).forEach(schemaKey => {
          config.schema[schemaKey] = schemaDefinition[schemaKey];
          if (schemaDefinition[schemaKey].index) {
            config.indexes.push(schemaKey);
          }
          if (schemaDefinition[schemaKey].repeated) {
            config.canRepeat.push(eachIndex);
          }
        });
      };

      dbHandler.fetch = async (value) => {
        // console.log('query', value)
        var self = this;
        var query = value;
        var parameter = "id"; // this.hashKey
        if (typeof value === "object") {
          parameter = Object.keys(value)[0];
          value = value[parameter];
        }
        if (config.opts && config.opts.public) {
          var url =
            "https://s3.amazonaws.com/" +
            config.bucket +
            "/" +
            config.collection +
            "/" +
            parameter +
            "/" +
            value +
            ".json?preventCache=" +
            new Date().getTime();
          return fetch(url)
            .then(res => res.json())
            .then(json => new S3ObjectInstance(config, json))
        } else {
          var params = {
            Bucket: config.bucket,
            Key: config.collection + "/" + parameter + "/" + value + ".json"
          };
          console.log(params)
          var data = await config.S3.getObject(params).promise()
          var instanceData = JSON.parse(data.Body.toString());
          console.log('instanceData', instanceData)
          // if (
          // 	instanceData.ttl === undefined ||
          // 	instanceData.ttl < new Date().getTime()
          // ) {
          // 	return new S3ObjectInstance(config, instanceData)
          // } else {
          // 	// if (instanceData.ttl >= new Date().getTime()) {
          // 	//     // delete the object
          // 	// }
          // 	return new S3ObjectInstance(config, instanceData)
          // }
          return new S3ObjectInstance(config, instanceData)

        }
      }

      // dbHandler.queryPromise = value => {
      // 	console.log('queryPromise', value)
      // 	return new Promise((success, reject) => {
      // 		dbHandler.query(value, function (err, res) {
      // 			if (err) {
      // 				console.log("ERR:", err);
      // 				reject(err);
      // 			} else {
      // 				success(res);
      // 			}
      // 		});
      // 	});
      // };

      dbHandler.scan = query => {
        let allFiles = [];
        let self = this;
        return new Promise((resolve, reject) => {
          let params = { Bucket: config.bucket };
          let attr = config.hashKey; //Object.keys(query ? query : config.schema)[0]
          console.log('query', query)
          if (query) {
            // if (query.Prefix) {
            // 	params.Prefix = `${config.collection}/${query.Prefix || ""}`;
            // }

            if (query.Delimiter) {
              params.Delimiter = query.Delimiter;
            }

            // if (!query.Prefix) {
            let key = Object.keys(query)[0];
            // attr = key
            if (typeof query[key] === 'boolean') {
              console.log('is boolean')
              params.Prefix = `${config.collection}/${key}/`;
            } else {
              console.log('not boolean')
              params.Prefix = `${config.collection}/${key}/${query[key]}/`;
            }
            // }
          } else {
            params.Prefix = `${config.collection}/${config.hashKey}/`;
          }

          console.log("🚀 params", params);
          function getFromBucket(ContinuationToken) {
            if (ContinuationToken) {
              params.ContinuationToken = ContinuationToken;
						}
						console.log('listObjectsV2', params)
            config.S3.listObjectsV2(params, function (err, data) {
              if (err) reject({ err: err, stack: err.stack });
              else {
                if (data.Contents) {
                  allFiles = allFiles.concat(data.Contents);
                }
                if (data.CommonPrefixes) {
                  allFiles = allFiles.concat(data.CommonPrefixes);
                }
                if (data.NextContinuationToken) {
                  getFromBucket(data.NextContinuationToken);
                } else {
                  console.log("allFiles", allFiles);
                  var result = [];
                  allFiles.sort(
                    (a, b) =>
                      new Date(a.LastModified).getTime() >
                      new Date(b.LastModified).getTime()
                  );
                  allFiles.forEach(_file => {
                    var item = {};
                    if (_file.Key) {
                      item[attr] = _file.Key.replace(params.Prefix, "").replace(
                        ".json",
                        ""
                      );
                    }
                    if (_file.Prefix) {
                      item = _file.Prefix.replace(params.Prefix, "");
                      if (item[item.length - 1] === "/") {
                        item = item.slice(0, item.length - 1);
                      }
                    }
                    result.push(item);
                  });
                  resolve(result);
                }
              }
            });
          }
          getFromBucket();

        });
      };

      dbHandler.delete = async (ids) => {
        // TODO: delete completely
        if (typeof ids === 'string') {

          var object = await dbHandler.get(ids)
          console.log('going to delete:', object)
          var deleteObjects = []

          for (var key of config.indexes) {
            var deleteParams = {}
            deleteParams[key] = object[key]
            deleteObjects.push(deleteParams)
          }
          console.log(deleteObjects)

          dbHandler.deleteRaw(deleteObjects)
        }
      }

      dbHandler.deleteRaw = objects => {
        return new Promise((success, reject) => {
          let _objs = [];
          objects.forEach(_object => {
            Object.keys(_object).forEach(_key => {
              _objs.push({
                Key: `${config.collection}/${_key}/${_object[_key]}.json`
              });
            });
          });
          var params = {
            Bucket: config.bucket,
            Delete: {
              Objects: _objs,
              Quiet: false
            }
          };
          config.S3.deleteObjects(params, function (err, data) {
            if (err) {
              reject();
              console.log(err); // an error occurred
            } else {
              console.log(data);
              success();
            }
          });
        });
      };

      dbHandler.set = async (newAttributes, extraAttributes) => {
        if (typeof newAttributes === 'string') {
          console.log('🔫assign attributes', newAttributes, 'to',  extraAttributes)
          newAttributes = Object.assign(extraAttributes, { id: newAttributes })
        }

        console.log('SET', newAttributes)
        try {
          console.log('🐷 query', { [config.hashKey]: newAttributes[config.hashKey] })
          var result = await dbHandler.get(newAttributes[config.hashKey])
          console.log('🐷result', result)
          result = Object.assign(result, newAttributes)
        } catch (err) {
          console.log('👀not found, creating new')
          var result = new S3ObjectInstance(config, newAttributes);
        }
        await result.save()
        return result
      };

      dbHandler.ls = async (value, opts = {}) => {
        if (typeof value === "string") {
          console.log('value is string')
          var query = {};
          query[config.hashKey] = value;
          return await dbHandler.scan(query);
        }

        if (typeof value === "object") {
          console.log('value is an object')
          var key = Object.keys(value)[0]
          if (config.schema[key]) {
            if (config.schema[key].composed && typeof value[key] !== 'boolean') {
              console.log('value is composed')
              var composed = config.schema[key].composed
              var query = {}
              query[key] = composed.map((attr) => {
                console.log(attr, 'value', value[key][attr])
                return value[key][attr]
              })
              console.log('🗼query', query)
              query[key] = query[key].filter(Boolean).join('/')
              console.log('🏰query', query)

              if (opts.fetchAll) {
                console.log('got to fetch all')

                let queries = await dbHandler.scan(query);
                queries = queries.map((item) => {
                  return { [key]: `${query[key]}/${item['id']}` }
                })

                return queries
              } else {
                query.Delimiter = '/'
                let queries = await dbHandler.scan(query);
                console.log('ls result:', queries)
                return queries
              }
            }


            var query = {};
            query = { [key]: value[key] }
            console.log('query', query)

            if (config.schema[key].canRepeat) {
              query.Delimiter = '/'
              var queries = await dbHandler.scan(query);
              console.log('queries', queries)
              return queries
            }

            return [query]

          } else {
            throw Error(`"${key}" is not defined in ${collection}'s schema`)
          }
        }

        return await dbHandler.scan();

      };

      dbHandler.get = async value => {

        if (typeof value === "string") {
          var query = { [config.hashKey]: value };
          return await dbHandler.fetch(query);
        }

        var queries = await dbHandler.ls(value, { fetchAll: true })
        return await Promise.all(queries.map(dbHandler.fetch));
      };

      return dbHandler;
    }
  }

  return DBCreator;
};
