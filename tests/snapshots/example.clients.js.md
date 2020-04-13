# Snapshot report for `tests/example.clients.js`

The actual snapshot is saved in `example.clients.js.snap`.

Generated by [AVA](https://avajs.dev).

## Create two clients

> Snapshot 1

    {
      action: `async function test() {␊
      ␊
          let client1 = Client({ id: '0000001', ip: '4.2.2.1' })␊
          let client2 = Client({ id: '0000002', ip: '8.8.8.8' })␊
      ␊
          await client1.save()␊
          await client2.save()␊
      ␊
          return { client1, client2 }␊
        }`,
      result: {
        client1: S3Obj {
          id: '0000001',
          ip: '4.2.2.1',
        },
        client2: S3Obj {
          id: '0000002',
          ip: '8.8.8.8',
        },
      },
    }

## Get all clients

> Snapshot 1

    {
      action: `async function () {␊
      ␊
          let clients = await Client.get()␊
      ␊
          return clients␊
        }`,
      result: [
        S3Obj {
          id: '0000001',
          ip: '4.2.2.1',
          userId: 'Agent0001',
        },
        S3Obj {
          id: '0000002',
          ip: '8.8.8.8',
          userId: 'Agent0002',
        },
        S3Obj {
          id: '0000003',
          ip: '3.3.3.3',
        },
        S3Obj {
          id: '0000004',
          ip: '4.4.4.4',
          userId: 'Agent004',
        },
      ],
    }

## Get object by userId instead of id

> Snapshot 1

    {
      action: `async function () {␊
      ␊
          let clients = await Client.get({ userId: 'Agent004' })␊
          console.log('clients', clients)␊
      ␊
          await clients[0].save()␊
      ␊
          return clients␊
        }`,
      result: [
        S3Obj {
          id: '0000004',
          ip: '4.4.4.4',
          userId: 'Agent004',
        },
      ],
    }

## Get object, update it and save it

> Snapshot 1

    {
      action: `async function () {␊
      ␊
          let client1 = await Client.get('0000001')␊
      ␊
          client1.userId = 'Agent0001'␊
          await client1.save()␊
      ␊
          return client1␊
        }`,
      result: S3Obj {
        id: '0000001',
        ip: '4.2.2.1',
        userId: 'Agent0001',
      },
    }

## Set data to object

> Snapshot 1

    {
      action: `async function () {␊
      ␊
          let client1 = await Client.set('0000002', { userId: 'Agent0002' })␊
      ␊
          return client1␊
        }`,
      result: S3Obj {
        id: '0000002',
        ip: '8.8.8.8',
        userId: 'Agent0002',
      },
    }

## Set or create

> Snapshot 1

    {
      action: `async function () {␊
      ␊
          let client3 = await Client.set({ id: '0000003', ip: '3.3.3.3' })␊
      ␊
          return client3␊
        }`,
      result: S3Obj {
        id: '0000003',
        ip: '3.3.3.3',
      },
    }

## Set similar to Map()

> Snapshot 1

    {
      action: `async function () {␊
      ␊
          let client4 = await Client.set('0000004', { userId: "Agent004", ip: '4.4.4.4' })␊
      ␊
          return client4␊
        }`,
      result: S3Obj {
        id: '0000004',
        ip: '4.4.4.4',
        userId: 'Agent004',
      },
    }