let {test, expect} = require('@playwright/test')
let searchBelgrade = require('./fixtures/search-belgrade.json')
let forecastBelgrade = require('./fixtures/forecast-belgrade.json')

test(
	'When I click on the location button, the location is selected, and search field is hidden',
	async function ({page}) {
		await page.goto('/')
		let locBelgrade = {
			name: 'Belgrade',
			latitude: 44.80401,
			longitude: 20.46513,
			display: 'Belgrade, Central Serbia, Serbia',
		}

		await page.evaluate(function (loc) {
			window.dispatchEvent(new CustomEvent('locationSelected', {detail: loc}))
		}, locBelgrade)

		let currentLocation = page.getByRole('region', {name: 'Current location'})
		await expect(currentLocation.getByText('Belgrade')).toBeVisible()
		await expect(currentLocation.getByRole('button', {name: 'Change location'})).toBeVisible()
	},
)
