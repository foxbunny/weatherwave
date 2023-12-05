mocha.setup('bdd')
mocha.checkLeaks()

let subject = document.querySelector('iframe')

DOMTest.setFrame(subject)
DOMTest.useChai()
DOMTest.addRefreshHook(function (subjectFrame, next) {
	XHRTest.register(subjectFrame, next)
})
XHRTest.addFixture(/search\?name=Belgrade/, Fixtures.locationSearch)
XHRTest.addFixture(/search\?name=Emptyland/, Fixtures.locationSearchEmpty)
XHRTest.addFixture(/forecast/, Fixtures.forecasts)

window.expect = chai.expect

beforeEach(function (done) {
	DOMTest.refreshFrame(done.bind(null, undefined))
})
