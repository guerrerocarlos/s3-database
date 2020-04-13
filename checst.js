const { Client, Event } = require('./example/models');

(async () => {
	let client4 = await Client.get({ userId: 'Agent004' })
	console.log('client4', client4)

	// await client4.save()

	// let client3 = await Client.set({ id: '0000003', ip: '3.3.3.3' })
	// console.log(client3)
})()
