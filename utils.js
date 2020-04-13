const { setupRecorder } = require('nock-record')

async function nockManager(testName, specificCase, specificResult, t, callback) {
	const record = setupRecorder()
	const { completeRecording, assertScopesFinished } = await record(`${testName}.${specificCase}.${specificResult}.nock`, {
		afterRecord: function (nockDefs) {
			return nockDefs.map(def => {
				try {
					const headers = def.rawHeaders.reduce(
						(acc, curr, i, arr) => {
							if (i % 2 === 0) {
								acc[arr[i].toLowerCase()] = arr[i + 1].toLowerCase();
							}
							return acc;
						},
						{}
					);
					if (
						headers['transfer-encoding'] === 'chunked' &&
						headers['content-encoding'] === 'gzip' &&
						Array.isArray(def.response)
					) {
						def.response = JSON.parse(
							zlib.gunzipSync(Buffer.from(def.response.join(''), 'hex')).toString(
								'utf-8'
							)
						);
						def.rawHeaders = Object.entries(headers).flatMap(([key, value]) => {
							if (key === 'transfer-encoding' || key === 'content-encoding') {
								return [];
							}
							return [key, value];
						});
					}
				} catch (ex) {
					console.warn('Failed to decode response', ex);
				}
				return def;
			});

		}
	});
	let result = await callback()
	completeRecording()
	t.snapshot({ action: callback.toString(), result });
	assertScopesFinished()
	return result
}

module.exports = {
	nockManager
}
