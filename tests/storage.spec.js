let {test, expect} = require('@playwright/test')
import {setup} from './common'

setup(test)

test(
	'When I select a location and reload the page, the location is still selected',
	async function ({page}) {
		await page.getByLabel('Search locations:').fill('Belgrade')
		await page.getByRole('button', {name: 'Belgrade, Central Serbia, Serbia'}).click()
		await page.reload()
		let currentLocation = page.getByRole('region', {name: 'Current location'})
		await expect(currentLocation.getByText('Belgrade')).toBeVisible()
	}
)
