let {ELEMENT_TYPES: E} = DOMTest

describe('Search and set location', function () {
	before(function () {
		DOMTest.setURL('../index.html')
	})

	let searchField = [E.FormField, 'Search locations:']
	let locationList = [E.Region, 'Select a location']

	context('On inital visit', function () {
		specify('I should see a location search form', function () {
			let locationSearchField = DOMTest.getElementByLabel(...searchField)
			expect(locationSearchField).to.be.visible
		})

		specify('When typing Belgrade into the search field, I should see a list of locations named Belgrade', function (done) {
			DOMTest.click(...searchField)
			DOMTest.pasteIntoFocusedField('Belgrade')
			DOMTest.waitForContentToUpdate(afterUpdate)
			function afterUpdate() {
				let locationList = DOMTest.getElementByLabel(E.Region, 'Select a location')
				expect(locationList).to.containElement(E.Button, 'Belgrade, Central Serbia, Serbia')
				expect(locationList).to.containElement(E.Button, 'Belgrade, Montana, United States')
				done()
			}
		})

		specify('When typing Belgrade, and then London, into the search field, I should see a new list with all Londons', function (done) {
			DOMTest.click(...searchField)
			DOMTest.pasteIntoFocusedField('Belgrade')
			DOMTest.waitForContentToUpdate(afterUpdate1)
			function afterUpdate1() {
				DOMTest.clearFocusedField()
				DOMTest.pasteIntoFocusedField('London')
				DOMTest.waitForContentToUpdate(afterUpdate2)
			}
			function afterUpdate2() {
				let list = DOMTest.getElementByLabel(...locationList)
				expect(list).not.to.containElement(E.Button, 'Belgrade, Central Serbia, Serbia')
				expect(list).to.containElement(E.Button, 'London, England, United Kingdom')
				done()
			}
		})

		specify('When typing Belgrade into the search field, and then clearing it, I should not see any locations in the list', function (done) {
			DOMTest.click(...searchField)
			DOMTest.pasteIntoFocusedField('Belgrade')
			DOMTest.waitForContentToUpdate(afterUpdate1)
			function afterUpdate1() {
				DOMTest.clearFocusedField()
				DOMTest.waitForContentToUpdate(afterUpdate2)
			}
			function afterUpdate2() {
				let list = DOMTest.getElementByLabel(...locationList)
				expect(list).not.to.containAnyElement(E.Button)
				done()
			}

		})
	})
})