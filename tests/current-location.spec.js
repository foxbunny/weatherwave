let {test, expect} = require('@playwright/test')
import {setup} from './common'

setup(test)

test(
	'When I click on the location button, the location is selected, and search field is hidden',
	async function ({page}) {
		await page.getByLabel('Search locations:').fill('Belgrade')
		await page.getByRole('button', {name: 'Belgrade, Central Serbia, Serbia'}).click()
		let currentLocation = page.getByRole('region', {name: 'Current location'})
		await expect(currentLocation.getByText('Belgrade')).toBeVisible()
		await expect(currentLocation.getByRole('button', {name: 'Change location'})).toBeVisible()
	},
)
