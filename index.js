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

		async save() {
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
						// TODO: check/cast to each type defined in the schema
						bodyToSave[each_index] = '' + self[each_index];
					}
				});
			}

			this.___config.indexes.forEach(each_index => {
				if (self[each_index] != undefined || this.___config.schema[each_index].composed) {

					saved = true;
					var index_path = each_index;

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
						// TODO: Define public objects
						// ACL: "public-read",
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

					putPromises.push(
						self.___config.S3.putObject(params).promise()
					);
				}
			});

			await Promise.all(putPromises)
			return self

		}
	}

	class S3Obj extends S3Object {
		constructor(config, obj) {
			super(config);

			if (!(this instanceof S3Obj)) {
				return new S3Obj(obj);
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
				return new S3Obj(config, obj);
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
				var parameter = "id";
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
						.then(json => new S3Obj(config, json))
				} else {
					var params = {
						Bucket: config.bucket,
						Key: config.collection + "/" + parameter + "/" + value + ".json"
					};
					var data = await config.S3.getObject(params).promise()
					var instanceData = JSON.parse(data.Body.toString());
					// TODO: enable ttl support
					// if (
					// 	instanceData.ttl === undefined ||
					// 	instanceData.ttl < new Date().getTime()
					// ) {
					// 	return new S3Obj(config, instanceData)
					// } else {
					// 	// if (instanceData.ttl >= new Date().getTime()) {
					// 	//     // delete the object
					// 	// }
					// 	return new S3Obj(config, instanceData)
					// }
					return new S3Obj(config, instanceData)

				}
			}

			dbHandler.scan = query => {
				let allFiles = [];
				return new Promise((resolve, reject) => {
					let params = { Bucket: config.bucket };
					let attr = config.hashKey;
					if (query) {
						if (query.Delimiter) {
							params.Delimiter = query.Delimiter;
						}

						let key = Object.keys(query)[0];
						if (typeof query[key] === 'boolean') {
							params.Prefix = `${config.collection}/${key}/`;
						} else {
							params.Prefix = `${config.collection}/${key}/${query[key]}/`;
						}
					} else {
						params.Prefix = `${config.collection}/${config.hashKey}/`;
					}

					function getFromBucket(ContinuationToken) {
						if (ContinuationToken) {
							params.ContinuationToken = ContinuationToken;
						}
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
				if (typeof ids === 'string') {
					var ids = [ids]
				}
				// TODO: completely remove all files from S3
				if (typeof id === 'string') {

					var object = await dbHandler.get(id)
					var deleteObjects = []

					for (var key of config.indexes.concat(config.hashKey)) {
						var deleteParams = {}
						deleteParams[key] = object[key]
						deleteObjects.push(deleteParams)
					}

					dbHandler.deleteRaw(deleteObjects)
				}
			}

			dbHandler.deleteRaw = objects => {
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
				return config.S3.deleteObjects(params).promise()
			};

			dbHandler.set = async (newAttributes, extraAttributes) => {
				if (typeof newAttributes === 'string') {
					newAttributes = Object.assign(extraAttributes, { id: newAttributes })
				}

				try {
					var result = await dbHandler.get(newAttributes[config.hashKey])
					result = Object.assign(result, newAttributes)
				} catch (err) {
					var result = new S3Obj(config, newAttributes);
				}
				await result.save()
				return result
			};

			dbHandler.ls = async (value, opts = {}) => {
				if (typeof value === "string") {
					var query = {};
					query[config.hashKey] = value;
					return await dbHandler.scan(query);
				}

				if (typeof value === "object") {
					var key = Object.keys(value)[0]
					if (config.schema[key]) {
						if (config.schema[key].composed && typeof value[key] !== 'boolean') {
							var composed = config.schema[key].composed
							var query = {}
							query[key] = composed.map((attr) => {
								return value[key][attr]
							})
							query[key] = query[key].filter(Boolean).join('/')

							if (opts.fetchAll) {
								let queries = await dbHandler.scan(query);
								queries = queries.map((item) => {
									return { [key]: `${query[key]}/${item['id']}` }
								})

								return queries
							} else {
								query.Delimiter = '/'
								let queries = await dbHandler.scan(query);
								return queries
							}
						}


						var query = {};
						query = { [key]: value[key] }

						if (config.schema[key].canRepeat) {
							query.Delimiter = '/'
							var queries = await dbHandler.scan(query);
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
