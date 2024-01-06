let CACHE_ID = 'weatherwave-0001'
let ASSETS = [
	'./',
	'./index.html',
	'./index.screen.css',
	'./index.client.js',
	'./Gabarito-ExtraBold.woff',
	'./Gabarito-ExtraBold.woff2',
	'./Gabarito-Regular.woff',
	'./Gabarito-Regular.woff2',
	'./icons.svg',
	'./favicon.svg',
]

function invalidateStaleCaches() {
	console.log('Activating new version', CACHE_ID)
	return caches.keys()
		.then(keys => Promise.all(
			keys.map(function (key) {
				if (key != CACHE_ID)
					caches.delete(key)
			})),
		)
}

function populateAssetCache() {
	console.log('Installing new version', CACHE_ID)
	return caches.open(CACHE_ID)
		.then(function (cache) {
			cache.addAll(ASSETS.map(function (path) {
				let assetUrl = new URL(path, location)
				return new Request(assetUrl, {cache: 'reload'})
			}))
		})
}

function proxyAssetFetch(req) {
	return caches.match(req, {ignoreSearch: true})
		.then(function (res) {
			return res || fetch(req)
		})
}

self.oninstall = function (ev) {
	ev.waitUntil(populateAssetCache())
}
self.onactivate = function (ev) {
	ev.waitUntil(invalidateStaleCaches())
}
self.onfetch = function (ev) {
	ev.respondWith(proxyAssetFetch(ev.request))
}