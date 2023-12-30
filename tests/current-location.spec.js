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

test(
	'When I have a location selected, and I click "Change location", I see a search field',
	async function ({page}) {
		await page.getByLabel('Search locations:').fill('Belgrade')
		await page.getByRole('button', {name: 'Belgrade, Central Serbia, Serbia'}).click()
		await page.getByRole('button', {name: 'Change location'}).click()
		await expect(page.getByRole('button', {name: 'Change location'})).toBeHidden()
		await expect(page.getByLabel('Search locations:')).toBeVisible()
	},
)