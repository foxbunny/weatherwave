let searchBelgrade = require('./fixtures/search-belgrade.json')
let searchLondon = require('./fixtures/search-london.json')
let forecastBelgrade = require('./fixtures/forecast-belgrade.json')

// Mock date solution based on https://github.com/microsoft/playwright/issues/6347#issuecomment-1085850728

export function setup(test) {
	test.use({viewport: {width: 1024, height: 700}})
	test.beforeEach(async function ({context}) {
		await context.route(/\/search\?name=belgrade/i, async function (route) {
			await route.fulfill({json: searchBelgrade})
		})
		await context.route(/\/search\?name=london/i, async function (route) {
			await route.fulfill({json: searchLondon})
		})
		await context.route(/\/forecast/, async function (route) {
			await route.fulfill({json: forecastBelgrade})
		})
	})
	test.beforeEach(async function ({page}) {
		await page.addInitScript(`{
			let date = new Date('${forecastBelgrade.hourly.time[0]}').getTime()
			Date = class extends Date {
				 constructor(...args) {
					  if (args.length === 0) { super(date) }
					  else { super(...args) }
				 }
			}
			let __DateNowOffset = date - Date.now()
			let __DateNow = Date.now
			Date.now = () => __DateNow() + __DateNowOffset
		}`)
		await page.goto('/')
	})
}
