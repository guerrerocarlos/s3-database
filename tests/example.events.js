
const { nockManager } = require('../utils')
const { Client, Event } = require('../example/models')
const test = require('ava');

test(`Create Event`, async (t) => {
	await nockManager('s3_database', `event`, 'createOne', t, async function () {

		return await Event.set("AAA", {
			connectionId: "conn001",
			userId: "user002",
			serverTime: 1586789721110,
			event: 'pageview',
			date: '10-10-2020',
			payload: {
				path: '/',
				browser: 'Google Chrome'
			}
		})

	})
})

test(`Create Events`, async (t) => {
	await nockManager('s3_database', `event`, 'createMany', t, async function a() {

		const e1 = await Event.set("BBB", {
			connectionId: "conn002",
			userId: "user002",
			serverTime: 1586789722220,
			event: 'pageview',
			date: '10-11-2020',
			payload: {
				path: '/',
				browser: 'Google Chrome'
			}
		})

		const e2 = await Event.set("CCC", {
			connectionId: "conn003",
			userId: "user003",
			serverTime: 1586789723330,
			event: 'pageview',
			date: '10-11-2020',
			payload: {
				path: '/',
				browser: 'Google Chrome'
			}
		})

		const e3 = await Event.set("DDD", {
			connectionId: "conn004",
			userId: "user004",
			serverTime: 1586789724440,
			event: 'pageview',
			date: '10-10-2020',
			payload: {
				path: '/',
				browser: 'Google Chrome'
			}
		})

		const e4 = await Event.set("DDD", {
			connectionId: "conn004",
			userId: "user004",
			serverTime: 1586789724441,
			event: 'pageview',
			date: '10-10-2020',
			payload: {
				path: '/',
				browser: 'Google Chrome'
			}
		})

		return { e1, e2, e3, e4 }

	})
})


test(`List All Events`, async (t) => {
	await nockManager('s3_database', `event`, 'listEvent', t, async function () {

		var allEvents = await Event.ls()

		return allEvents

	})
})

test(`List Event's Days`, async (t) => {
	await nockManager('s3_database', `event`, 'lsDays', t, async function () {

		var allDates = await Event.ls({
			date: true
		})

		return allDates

	})
})


test(`Get All Events`, async (t) => {
	await nockManager('s3_database', `event`, 'getEvents', t, async function () {

		var allEvents = await Event.get()

		return allEvents

	})
})



test(`List All Event's UserIds`, async (t) => {
	await nockManager('s3_database', `event`, 'lsUserIds', t, async function () {

		var allEvents = await Event.ls({
			userId: true
		})

		return allEvents

	})
})

test(`List All Events of an Specific Date`, async (t) => {
	await nockManager('s3_database', `event`, 'listOfDate', t, async function () {

		var userIds = await Event.ls({
			serverTime: {
				date: '10-10-2020'
			}
		})

		return userIds

	})
})

test(`List Connections of an Specific Date and User`, async (t) => {
	await nockManager('s3_database', `event`, 'listOfDateAndUser', t, async function () {

		var connectionIds = await Event.ls({
			serverTime: {
				date: '10-10-2020',
				userId: 'user002'
			}
		})

		return connectionIds

	})
})

test(`List Connections of an Specific Date and User (p2)`, async (t) => {
	await nockManager('s3_database', `event`, 'listOfDateAndUser2', t, async function () {

		var connectionIds = await Event.ls({
			serverTime: {
				date: '10-11-2020',
				userId: 'user002'
			}
		})

		return connectionIds

	})
})


test(`List Connections of an Specific Date and User (p3)`, async (t) => {
	await nockManager('s3_database', `event`, 'listOfDateAndUser3', t, async function () {

		var connectionIds = await Event.ls({
			serverTime: {
				date: '10-10-2020',
				userId: 'user004'
			}
		})

		return connectionIds

	})
})

test(`List Events of an Specific Date, User and ConnectionId`, async (t) => {
	await nockManager('s3_database', `event`, 'listOfDateAndUserAndConnId', t, async function () {

		var events = await Event.ls({
			serverTime: {
				date: '10-10-2020',
				userId: 'user004',
				connectionId: 'conn004',
			}
		})

		return events

	})
})

test(`Get Connections of an Specific Date and User (p3)`, async (t) => {
	await nockManager('s3_database', `event`, 'getOfDateAndUser3', t, async function () {

		var connectionIds = await Event.get({
			serverTime: {
				date: '10-10-2020',
				userId: 'user004'
			}
		})

		return connectionIds

	})
})

test(`Get Events of an Specific Date, User and ConnectionId`, async (t) => {
	await nockManager('s3_database', `event`, 'getOfDateAndUserAndConnId', t, async function () {

		var events = await Event.get({
			serverTime: {
				date: '10-10-2020',
				userId: 'user004',
				connectionId: 'conn004',
			}
		})

		return events

	})
})
