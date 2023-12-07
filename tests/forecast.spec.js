let {test, expect} = require('@playwright/test')

test(
	'When a I select a location, I see the weather forecast for the next 10 days',
	async function ({page}) {
		await page.goto('/')
		await page.getByLabel('Search locations:').fill('Belgrade')
		await page.getByRole('button', {name: 'Belgrade, Central Serbia, Serbia'}).click()
		await expect(page.getByText('10-day forecast')).toBeVisible()
	},
)
