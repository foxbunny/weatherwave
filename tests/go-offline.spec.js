let {test, expect} = require('@playwright/test')
import {setup} from './common'

setup(test)

test(
	'When I go offline, the application will still load',
	async function ({page, context}) {
		await page.goto('/')
		await expect(page.getByLabel('Search locations:')).toBeVisible()
		await context.setOffline(true)
		await page.reload()
		await expect(page.getByLabel('Search locations:')).toBeVisible()
	}
)