
const { nockManager } = require('../utils')
const { Client, Event } = require('../example/models')
const test = require('ava');

test(`Create two clients`, async (t) => {
  await nockManager('s3_database', `client`, 'create_client1and2', t, async function test() {

    let client1 = Client({ id: '0000001', ip: '4.2.2.1' })
    let client2 = Client({ id: '0000002', ip: '8.8.8.8' })

    await client1.save()
    await client2.save()

    return { client1, client2 }
  })
})

test(`Set or create`, async (t) => {
  await nockManager('s3_database', `client`, 'setObject', t, async function () {

    let client3 = await Client.set({ id: '0000003', ip: '3.3.3.3' })

    return client3
  })
})

test(`Set similar to Map()`, async (t) => {
  await nockManager('s3_database', `client`, 'setIdAndObject', t, async function () {

    let client4 = await Client.set('0000004', { userId: "Agent004", ip: '4.4.4.4' })

    return client4
  })
})

test(`Get object, update it and save it`, async (t) => {
  await nockManager('s3_database', `client`, 'getUpdateAndSave', t, async function () {

    let client1 = await Client.get('0000001')

    client1.userId = 'Agent0001'
    await client1.save()

    return client1
  })
})

test(`Set data to object`, async (t) => {
  await nockManager('s3_database', `client`, 'setWithObject', t, async function () {

    let client1 = await Client.set('0000002', { userId: 'Agent0002' })

    return client1
  })
})

test(`Get object by userId instead of id`, async (t) => {
  await nockManager('s3_database', `client`, 'getWithObjUpdateAndSave', t, async function () {

    let clients = await Client.get({ userId: 'Agent004' })
    console.log('clients', clients)

    await clients[0].save()

    return clients
  })
})

test(`Get all clients`, async (t) => {
  await nockManager('s3_database', `client`, 'getAll', t, async function () {

    let clients = await Client.get()

    return clients
  })
})
