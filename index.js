// var fetch = require("node-fetch");
var log = console.log
// todo:
// - allow ttl attribute even if not in the schema
// - check that object functions like `save` are not overwritten by attributes, maybe use reserved words

module.exports = function (bucket, AWS, opts) {

	console.log("s3-database", { bucket })

	let dbPrefix = opts && opts.dbPrefix
	class S3Object {
		constructor(config) {
			// console.log("config", config)
			this._config = config;
			Object.defineProperty(this, "_config", {
				enumerable: false,
				writable: true
			});
		}

		expire(ttl, cb) {
			this.ttl = new Date().getTime() + ttl * 1000;
			return cb(null, this);
		}

		async save() {
			console.log("SAVE!")
			var self = this;
			var saved = false;
			var putPromises = [];
			var bodyToSave = {};
			// console.log("this._config", this._config)
			if (Object.keys(this._config).indexOf("schema") > -1) {
				Object.keys(this._config.schema).forEach(each_index => {
					if (
						this._config.schema[each_index].default &&
						self[each_index] === undefined
					) {
						if (
							typeof this._config.schema[each_index].default === "function"
						) {
							self[each_index] = this._config.schema[each_index].default(
								this
							);
						} else {
							self[each_index] = this._config.schema[each_index].default;
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

			this._config.indexes.forEach(each_index => {
				if (self[each_index] != undefined || this._config.schema[each_index].composed) {

					saved = true;
					var index_path = each_index;

					if (
						this._config.schema[each_index] &&
						this._config.schema[each_index].composed
					) {
						index_path = each_index + '/' + this._config.schema[each_index].composed
							.map(key => {
								return self[key];
							})
							.join("/");
					}

					var params = {
						Body: JSON.stringify(bodyToSave),
						Bucket: this._config.bucket,
						// TODO: Define public objects
						// ACL: "public-read",
						// this._config.opts && this._config.opts.public
						// 	? "public-read"
						// 	: "private",
						Key:
							[
								dbPrefix,
								this._config.collection,
								index_path,
							`${self[each_index]}.json`].filter(Boolean).join("/")
					};

					if (
						this._config.hashKey &&
						this._config.canRepeat.indexOf(each_index) > -1
					) {
						params.Key =
							[
								dbPrefix,
								this._config.collection,
								each_index,
							self[each_index],
							self[this._config.schema[each_index].key || this._config.hashKey] +
							".json"].filter(Boolean).join("/")
					}

					putPromises.push(
						this._config.S3.putObject(params).promise()
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

	class DBFactory {
		constructor(collectionName, schema, opts) {
			this.config = {
				hashKey: "id",
				indexes: [],
				collection: collectionName,
				opts: opts,
				bucket,
				S3: new AWS.S3(),
				schema,
				canRepeat: []
			}

			// Object.defineProperty(this.config, "S3", {
			// 	enumerable: false,
			// 	writable: false
			// });

			var newIndexes = [];
			Object.keys(schema).forEach(eachIndex => {
				if (schema[eachIndex].hashKey || schema[eachIndex].index) {
					newIndexes.push(eachIndex);
					if (schema[eachIndex].canRepeat) {
						this.config.canRepeat.push(eachIndex);
					}
					if (schema[eachIndex].hashKey) {
						this.config.hashKey = eachIndex;
					}
				}
			});
			this.config.indexes = newIndexes;

			var dbHandler = (obj) => {
				return new S3Obj(this.config, obj);
			};

			dbHandler.addSchema = schemaDefinition => {
				Object.keys(schemaDefinition).forEach(schemaKey => {
					this.config.schema[schemaKey] = schemaDefinition[schemaKey];
					if (schemaDefinition[schemaKey].index) {
						this.config.indexes.push(schemaKey);
					}
					if (schemaDefinition[schemaKey].repeated) {
						this.config.canRepeat.push(eachIndex);
					}
				});
			};

			dbHandler.fetch = async (value) => {
				var parameter = "id";
				if (typeof value === "object") {
					parameter = Object.keys(value)[0];
					value = value[parameter];
				}
				// if (this.config.opts && this.config.opts.public) {
				// 	var url = [
				// 		"https://s3.amazonaws.com/" +
				// 		this.config.bucket
				// 		,
				// 		dbPrefix
				// 		,
				// 		this.config.collection
				// 		,
				// 		parameter
				// 		,
				// 		value +
				// 		".json?preventCache=" +
				// 		new Date().getTime()].filter(Boolean).join("/")
				// 	return fetch(url)
				// 		.then(res => res.json())
				// 		.then(json => new S3Obj(this.config, json))
				// } else {
					var params = {
						Bucket: this.config.bucket,
						Key:
							[
								dbPrefix,
								this.config.collection,
								parameter,
								value + ".json"].filter(Boolean).join("/")
					};
					console.log('params', params)
					var data = await this.config.S3.getObject(params).promise()
					var instanceData = JSON.parse(data.Body.toString());
					console.log("instanceData", instanceData)
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
					return new S3Obj(this.config, instanceData)

				// }
			}

			dbHandler.scan = query => {
				let allFiles = [];
				return new Promise((resolve, reject) => {
					let params = { Bucket: this.config.bucket };
					let attr = this.config.hashKey;
					let paramsPrefixes = []
					if (query) {
						if (query.Delimiter) {
							params.Delimiter = query.Delimiter;
						}

						let key = Object.keys(query)[0];
						if (typeof query[key] === 'boolean') {
							paramsPrefixes = [
								dbPrefix,
								this.config.collection,
								`${key}/`];
						} else {
							paramsPrefixes = [dbPrefix,this.config.collection, key, `${query[key]}/`];
						}
					} else {
						paramsPrefixes = [dbPrefix, this.config.collection, `${this.config.hashKey}/`]
					}

					params.Prefix = paramsPrefixes.filter(Boolean).join("/")

					log('scan', params)
					let getFromBucket = (ContinuationToken) => {
						if (ContinuationToken) {
							params.ContinuationToken = ContinuationToken;
						}
						this.config.S3.listObjectsV2(params, function (err, data) {
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

			dbHandler.deleteRaw = objects => {
				let _objs = [];
				objects.forEach(_object => {
					Object.keys(_object).forEach(_key => {
						_objs.push({
							Key: [dbPrefix, this.config.collection, _key, `${_object[_key]}.json`].filter(Boolean).join("/")
						});
					});
				});
				var params = {
					Bucket: this.config.bucket,
					Delete: {
						Objects: _objs,
						Quiet: false
					}
				};
				console.log("Delete:", JSON.stringify(params, null, 2))
				return this.config.S3.deleteObjects(params).promise()
			};

			dbHandler.delete = async (id) => {
				console.log("DELETE!", id)
				if (typeof id !== 'object') {
					try {
						var object = await dbHandler.get(id)

						console.log("delete got", object)

						var deleteObjects = []

						for (var key of this.config.indexes) {
							var deleteParams = {}
							if (object[key]) {
								console.log("INDEX", key, this.config.schema[key])
								if (this.config.schema[key] && this.config.schema[key].canRepeat) {
									deleteParams[key] = `${object[key]}/${object[this.config.hashKey]}`
								} else {
									deleteParams[key] = object[key]
								}
								deleteObjects.push(deleteParams)
							}
						}

						console.log("deleteObjects", deleteObjects)

						dbHandler.deleteRaw(deleteObjects)
					} catch (err) {
						console.log("Delete skipped (not found)", err)
					}
				}
			}

			dbHandler.set = async (attribs, extraAttributes) => {
				let result
				if (typeof attribs === 'string') {
					attribs = { id: attribs }
				}
				try {
					result = await dbHandler.get(attribs)
					result = Object.assign(result, { ...attribs, ...extraAttributes })
				} catch (err) {
					result = new S3Obj(this.config, attribs);
				}

				console.log("SET got:", result)

				await result.save()
				return result
			};

			dbHandler.upsert = dbHandler.set

			dbHandler.ls = async (value, opts = {}) => {
				if (typeof value === "string") {
					var query = {};
					query[this.config.hashKey] = value;
					return await dbHandler.scan(query);
				}

				if (typeof value === "object") {
					var key = Object.keys(value)[0]
					if (this.config.schema[key]) {
						if (this.config.schema[key].composed && typeof value[key] !== 'boolean') {
							console.log('COMPOSED')
							var composed = this.config.schema[key].composed
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

						console.log('ls query', query)

						if ((this.config.schema[key].canRepeat || typeof value[key] === 'boolean')) {
							console.log("🟢")
							query.Delimiter = '/'
							var queries = await dbHandler.scan(query);

							console.log("scanned", queries)

							if (opts.fetchAll) {
								return await Promise.all(queries.map(dbHandler.get))
							}

							return queries
						} else {
							return [await dbHandler.get(query)]
						}

					} else {
						throw Error(`"${key}" is not defined in ${collection}'s schema`)
					}
				}

				return await dbHandler.scan();

			};

			dbHandler.get = async value => {
				if (typeof value === "number") {
					value = { [this.config.hashKey]: value.toString() }
				}
				if (typeof value === "string") {
					value = { [this.config.hashKey]: value }
				}

				console.log("get", value)
				let got = await dbHandler.fetch(value);
				console.log("got", got)
				return got
				// var queries = await dbHandler.ls(value, { fetchAll: true })
				// return await Promise.all(queries.map(dbHandler.fetch));
			};

			dbHandler.getTree = async value => {
				if (typeof value === "string") {
					var query = { [this.config.hashKey]: value };
					return await dbHandler.getTree(query);
				}

				var results = await dbHandler.get(value)

				var key = Object.keys(value)[0]
				if (this.config.schema[key].composed) {
					var composition = this.config.schema[key].composed
					console.log('results', results)
					console.log('composition', composition)
				} else {
					return results
				}
			};

			return dbHandler;
		}
	}

	return DBFactory;
};
