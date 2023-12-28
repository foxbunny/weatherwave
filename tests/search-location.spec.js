let {test, expect} = require('@playwright/test')
import {setup} from './common'

setup(test)

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
		await page.getByLabel('Search locations:').fill('belgrade')
		let locationList = page.getByRole('group', {name: 'Select a location'})
		await expect(locationList.getByRole('button', {name: /^Belgrade/})).toHaveCount(10)
	},
)

test(
	'When I enter "belgrade" the change that to "london" in search, buttons for London are shown, but not Belgrade',
	async function ({page}) {
		let searchField = page.getByLabel('Search locations:')
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
		await page.getByLabel('Search locations:').fill('belgrade')
		await page.getByLabel('Search locations:').clear()
		let locationList = page.getByRole('group', {name: 'Select a location'})
		await expect(locationList.getByRole('button')).toHaveCount(0)
	},
)

test(
	'When I search for "belgrade" and select the first option, the location list is hidden',
	async function ({ page }) {
		await page.getByLabel('Search locations:').fill('belgrade')
		let locationList = page.getByRole('group', {name: 'Select a location'})
		locationList.getByRole('button', {name: 'Belgrade, Central Serbia'}).click()
		await expect(locationList).toBeHidden()
	},
)