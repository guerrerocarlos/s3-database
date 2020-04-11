process.env.stage = 'dev'

import { nockManager } from './utils'
import { Account, Client } from './models'

jest.setTimeout = 20000

describe('Database', () => {
    test(`Create two clients`, async () => {
        await nockManager('s3_database', `create_user`, 'success', async function () {

            let client1 = Client({ id: 'clientOne', username: 'guerrerocarlos', name: 'Carlos Guerrero' })
            let client2 = Client({ id: 'clientTwo', username: '', name: '' })

            await client1.save()
            await client2.save()

            return { client1, client2 }
        })
    })

    test(`Create two accounts`, async () => {
        await nockManager('s3_database', `create_accounts`, 'success', async function () {

            let accountA = Account({ id: 'accountA', amount: '00001', type: 'usd-savings', clientId: 'clientOne' })
            let accountB = Account({ id: 'accountB', amount: '00002', type: 'usd-savings', clientId: 'clientOne' })

            await accountA.save()
            await accountB.save()

            return { accountA, accountB }
        })
    })

    test(`Get clientOne`, async () => {
        await nockManager('s3_database', `get_clientOne`, 'success', async function () {
            let client1 = await Client.get('clientOne') // equals { id: clientOne } where id is the hashKey attribute
            return { client1 }
        })
    })

    test(`Get accountA`, async () => {
        await nockManager('s3_database', `get_accountA`, 'success', async function () {
            let accountA = await Account.get('accountA')
            return { accountA }
        })
    })

    test(`Get accounts of client 'clientOne' `, async () => {
        await nockManager('s3_database', `get_clientOne_accounts`, 'success', async function () {

            let accounts = await Account.get({ clientId: 'clientOne' })

            expect(accounts.length).toEqual(2)
            return { accounts } 
        })
    })

    test(`Update clientOne's info`, async () => {
        await nockManager('s3_database', `update_clientOne`, 'success', async function () {

            let client1 = await Client.getOne('clientOne') // equals { id: clientOne } where id is the hashKey attribute
            client1.name = "Carlos Alejandro"
            await client1.save()

            client1 = await Client.getOne('clientOne')
            expect(client1.name).toEqual("Carlos Alejandro")

            return { client1 }
        })
    })

    test(`Update clientOne's info and accounts to it`, async () => {
        await nockManager('s3_database', `update_many`, 'success', async function () {

            let accounts = await Account.get({ clientId: 'clientOne' })
            await Promise.all(accounts.map(async (account) => {
                account.amount = '1000'
                await account.save()
            }))
            return accounts
        })
    })
    test(`Get or create`, async () => {
        await nockManager('s3_database', `get_or_create`, 'success', async function () {
            let client = await Client.queryOneOrCreate({ id: '005', username: 'five', name: 'Five Integer' })
            await client.save()
            return client
        })
    })
    
})