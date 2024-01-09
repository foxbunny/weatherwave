let {test, expect} = require('@playwright/test')
import {setup} from './common'

setup(test)

async function selectLocation(page) {
	await page.getByLabel('Search locations:').fill('Belgrade')
	await page.getByRole('button', {name: 'Belgrade, Central Serbia, Serbia'}).click()
}

test(
	'When a I select a location, I see 10-day forecast header',
	async function ({page}) {
		await selectLocation(page)
		await expect(page.getByText('10-day forecast')).toBeVisible()
	},
)

test(
	'When I select a location, I see 10 blocks of forecasts, one for each day',
	async function ({page}) {
		await selectLocation(page)
		let headings = await page.getByRole('heading', {name: 'Hourly forecast for'})
			.evaluateAll(function (headings) {
				return headings.map(function (heading) {
					return heading.textContent.replace(/\s+/g, ' ').trim()
				})
			})
		expect(headings).toEqual([
			'Hourly forecast for today',
			'Hourly forecast for Fri, Dec 8',
			'Hourly forecast for Sat, Dec 9',
			'Hourly forecast for Sun, Dec 10',
			'Hourly forecast for Mon, Dec 11',
			'Hourly forecast for Tue, Dec 12',
			'Hourly forecast for Wed, Dec 13',
			'Hourly forecast for Thu, Dec 14',
			'Hourly forecast for Fri, Dec 15',
			'Hourly forecast for Sat, Dec 16',
		])
	},
)

for (let parameter of ['temperature', 'precipitation', 'humidity', 'cloud', 'wind', 'fog', 'daylight'])
	test(
		`When I select a location, the ${parameter} bar is shown`,
		async function ({page}) {
			await selectLocation(page)
			let bar1 = page
				.getByRole('region', {name: 'Hourly forecast for today'})
				.locator('[data-slot=' + parameter + ']')
				.first()
			let bar2 = page
				.getByRole('region', {name: 'Hourly forecast for Wed, Dec 13'})
				.locator('[data-slot=' + parameter + ']')
				.first()
			await expect(bar1).toHaveScreenshot({threshold: 0.05})
			await expect(bar2).toHaveScreenshot({threshold: 0.05})
		},
	)

test(
	'When I select a location and then hover over an hour, I see details about that hour.',
	async function ({page}) {
		await selectLocation(page)
		await page.locator('.tip').filter({hasText: '6 AM Temperature: 2.2°C'}).hover()
		await expect(page.locator('.tip-content').filter({hasText: '6 AM Temperature: 2.2°C Precipitation: 0% Relative humidity: 90%'})).toBeVisible()
	},
)