var fetch = require("node-fetch");

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

    save(cb) {
      return new Promise((success, reject) => {
        // console.log('this.___config', JSON.stringify(this.___config, null, 2))
        var self = this;
        var saved = false;
        var putPromises = [];
        var bodyToSave = {};

        if (Object.keys(this.___config).indexOf("schema") > -1) {
          Object.keys(this.___config.schema).forEach(each_index => {
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
              bodyToSave[each_index] = self[each_index];
            }
          });
        }

        this.___config.indexes.forEach(each_index => {
          // console.log('each_index', each_index)
          if (self[each_index] != undefined) {
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
              index_path = each_index + '/' + this.___config.schema[each_index].composed_by
                .map(key => {
                  return self[key];
                })
                .join("/");
            }

            var params = {
              Body: JSON.stringify(bodyToSave),
              Bucket: bucket,
              ACL: "public-read",
              // this.___config.opts && this.___config.opts.public
              // 	? "public-read"
              // 	: "private",
              Key:
                this.___config.collection +
                "/" +
                index_path +
                "/" +
                self[each_index] +
                ".json"
            };
            if (
              this.___config.hashKey &&
              this.___config.non_uniques.indexOf(each_index) > -1
            ) {
              params.Key =
                this.___config.collection +
                "/" +
                each_index +
                "/" +
                self[each_index] +
                "/" +
                self[this.___config.hashKey] +
                ".json";
            }
            putPromises.push(
              new Promise((success, reject) => {
                self.___config.S3.putObject(params, function (err, data) {
                  if (err) reject(err.stack);
                  else success({ err: err, data: data });
                });
              })
            );
          }
        });

        if (!saved) {
          reject();
          if (cb) cb("S3 DB Error: No indexes provided.");
        } else {
          Promise.all(putPromises).then(results => {
            success();
            if (cb) cb(null, results);
          });
        }
      });
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
    constructor(collection, indexes, opts) {
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

      config.schema = indexes;
      config.non_uniques = [];

      if (indexes == undefined) {
        this.indexes = ["id"];
      } else {
        if (typeof indexes === "object") {
          var newIndexes = [];
          Object.keys(indexes).forEach(eachIndex => {
            if (indexes[eachIndex].hashKey || indexes[eachIndex].index) {
              newIndexes.push(eachIndex);
              if (indexes[eachIndex].repeated) {
                config.non_uniques.push(eachIndex);
              }
              if (indexes[eachIndex].hashKey) {
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
            config.non_uniques.push(eachIndex);
          }
        });
      };

      dbHandler.query = (value, cb) => {
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
          fetch(url)
            .then(res => res.json())
            .then(json => cb(null, [new S3ObjectInstance(config, json)]))
            .catch(err => {
              cb(err);
            }); // fetch doesnt call catch, check res.status or something like that
        } else {
          var params = {
            Bucket: config.bucket,
            Key: config.collection + "/" + parameter + "/" + value + ".json"
          };
          config.S3.getObject(params, function (err, data) {
            if (err) {
              if (cb && typeof cb === "function")
                cb({ error: JSON.stringify(query) + " not found" });
            } else {
              var instanceData = JSON.parse(data.Body.toString());

              if (
                instanceData.ttl === undefined ||
                instanceData.ttl < new Date().getTime()
              ) {
                if (cb) cb(null, [new S3ObjectInstance(config, instanceData)]);
              } else {
                // if (instanceData.ttl >= new Date().getTime()) {
                //     // delete the object
                // }
                if (cb) cb(null, [new S3ObjectInstance(config, instanceData)]);
              }
            }
          });
        }
      };

      dbHandler.queryPromise = value => {
        return new Promise((success, reject) => {
          dbHandler.query(value, function (err, res) {
            if (err) {
              console.log("ERR:", err);
              reject(err);
            } else {
              success(res);
            }
          });
        });
      };

      dbHandler.scan = query => {
        let allFiles = [];
        let self = this;
        return new Promise((resolve, reject) => {
          let params = { Bucket: config.bucket };
          let attr = config.hashKey; //Object.keys(query ? query : config.schema)[0]

          if (query) {
            if (query.Prefix || query.Delimiter) {
              params.Prefix = `${config.collection}/${query.Prefix || ""}`;
            }

            if (query.Delimiter) {
              params.Delimiter = query.Delimiter;
            }

            if (!query.Prefix && !query.Delimiter) {
              let key = Object.keys(query)[0];
              // attr = key
              if (config.non_uniques.indexOf(key) > -1) {
                params.Prefix = `${config.collection}/${key}/${query[key]}/`;
              } else {
                params.Prefix = `${config.collection}/${key}/`;
              }
            }
          } else {
            params.Prefix = `${config.collection}/${config.hashKey}/`;
          }

          console.log("params", params);
          function getFromBucket(ContinuationToken) {
            if (ContinuationToken) {
              params.ContinuationToken = ContinuationToken;
            }
            config.S3.listObjectsV2(params, function (err, data) {
              console.log(
                "listObjectsV2 result:",
                JSON.stringify({ err, data })
              );
              if (err) reject({ err: err, stack: err.stack });
              else {
                console.log("data", data);
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

      dbHandler.queryOne = (value, cb) => {
        return new Promise((success, reject) => {
          dbHandler.query(value, function (e, r) {
            if (r) {
              if (cb && typeof cb === "function") cb(e, r[0]);
              success(r[0]);
            } else {
              reject(e);
              if (cb) cb(e);
            }
          });
        });
      };

      dbHandler.queryOnePromise = dbHandler.queryOne;

      // dbHandler.getOneOrCreate = (value, cb) => {
      //     return new Promise((success, reject) => {
      //         var self = this
      //         dbHandler.getOne(value, function (err, result) {
      //             if (err) {
      //                 let newObj = new S3ObjectInstance(config, value)
      //                 if(cb) {
      //                     cb(null, newObj)
      //                 }
      //                 success(newObj)
      //             } else {
      //                 cb(null, result)
      //                 success(result)
      //             }
      //         })
      //     })
      // }

      dbHandler.queryOneOrCreate = (value, cb) => {
        return new Promise(success => {
          dbHandler.queryOne(value, function (err, result) {
            if (err) {
              var a = new S3ObjectInstance(config, value);
              a.save().then(() => {
                success(a);
              });
            } else {
              success(result);
            }
          });
        });
      };

      dbHandler.get = async value => {
        if (value === undefined || Object.keys(value).length === 0) {
          return await dbHandler.scan();
        }
        if (typeof value === "string") {
          var query = {};
          query[config.hashKey] = value;
          return await dbHandler.queryPromise(query);
        } else {
          if (config.non_uniques.indexOf(Object.keys(value)[0]) > -1) {
            console.log("scan...", value);
            let queries = await dbHandler.scan(value);
            console.log("queries...", queries);

            // return queries
            return await Promise.all(queries.map(dbHandler.queryOnePromise));
          } else {
            return await dbHandler.queryPromise(value);
          }
        }
      };

      dbHandler.getOne = async value => {
        let result = await dbHandler.get(value);
        return result[0];
      };

      return dbHandler;
    }
  }

  return DBCreator;
};
