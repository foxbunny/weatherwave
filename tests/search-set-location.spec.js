const {test, expect} = require('@playwright/test')

test.use({ viewport: { width: 1024, height: 700 } })

test('When I visit the page, I see a location search field', async function ({page}) {
	await page.goto('/')
	expect(await page.getByLabel('Search locations:')).toBeVisible()
})
