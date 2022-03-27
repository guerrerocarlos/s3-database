const { Client, Event } = require('./example/models');

(async () => {
	// let c = Client({ id: 001, userId: 'Agent007' })
	// console.log(c)
	// c.save()

	let s = new Date()
	console.log("GET")
	let client = await Client.get({ userId: 'Agent007' })
	console.log("GOT", (new Date() - s) / 1000, "seconds" )
	console.log('client', client)
	console.log('id', client.id)

	// await client4.save()

	// let client3 = await Client.set({ id: '0000003', ip: '3.3.3.3' })
	// console.log(client3)
})()
