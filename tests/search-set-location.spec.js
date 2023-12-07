let {test, expect} = require('@playwright/test')
let searchBelgrade = require('./fixtures/search-belgrade.json')
let searchLondon = require('./fixtures/search-london.json')
let forecast = require('./fixtures/forecast-belgrade.json')

test.use({viewport: {width: 1024, height: 700}})

test(
	'Shown initially',
	async function ({page}) {
		await page.goto('/')
		await expect(await page.getByLabel('Search locations:')).toBeVisible()
	},
)

test(
	'When I enter "belgrade" in the search field, buttons for the Belgrade lcoations appear',
	async function ({page}) {
		await page.route(/\/search/, async route => {
			console.log('called', route)
			await route.fulfill({ json: searchBelgrade })
		})

		await page.goto('/')
		await page.getByLabel('Search locations:').fill('belgrade')
		let locationList = page.getByRole('group', {name: 'Select a location'})
		await expect(locationList.getByRole('button', {name: /^Belgrade/})).toHaveCount(10)
	},
)

test(
	'When I enter "belgrade" the change that to "london" in search, buttons for London are shown, but not Belgrade',
	async function ({page}) {
		await page.route(/\/search\?name=belgrade/, async route => {
			await route.fulfill({ json: searchBelgrade })
		})
		await page.route(/\/search\?name=london/, async route => {
			await route.fulfill({ json: searchLondon })
		})

		let searchField = page.getByLabel('Search locations:')
		await page.goto('/')
		await searchField.fill('belgrade')
		await searchField.fill('london')
		let locationList = page.getByRole('group', {name: 'Select a location'})
		await expect(locationList.getByRole('button', {name: /^London/})).toHaveCount(10)
		await expect(locationList.getByRole('button', {name: /^Belgrade/})).toHaveCount(0)
	},
)

test(
	'When I clear the seach field, the list is empty',
	async function ({page}) {
		await page.route(/\/search/, async route => {
			console.log('called', route)
			await route.fulfill({ json: searchBelgrade })
		})

		await page.goto('/')
		await page.getByLabel('Search locations:').fill('belgrade')
		await page.getByLabel('Search locations:').clear()
		let locationList = page.getByRole('group', {name: 'Select a location'})
		await expect(locationList.getByRole('button')).toHaveCount(0)
	},
)
