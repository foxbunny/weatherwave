let bus = (function () {
	function send(message, payload) {
		window.dispatchEvent(new CustomEvent(message, {detail: payload}))
	}

	function on(message, callback) {
		window.addEventListener(message, callback)
	}

	return {
		send,
		on,
	}
}())

let api = (function () {
	function request(url, callback) {
		let xhr = new XMLHttpRequest()
		xhr.open('GET', url)
		xhr.responseType = 'json'
		xhr.addEventListener('load', function () {
			callback(xhr.response)
		})
		xhr.send()
	}

	function searchLocations(keyword, callback) {
		if (!keyword) {
			callback([])
			return
		}

		let url = new URL('https://geocoding-api.open-meteo.com/v1/search')
		url.searchParams.set('name', keyword)
		request(url, function (response) {
			callback(response.results.map(function (loc) {
				return {
					name: loc.name,
					latitude: loc.latitude,
					longitude: loc.longitude,
					display: `${loc.name}, ${loc.admin1}, ${loc.country}`,
				}
			}))
		})
	}

	return {
		searchLocations,
	}
}())

searchAndSetLocation({
	elements: {
		region: document.getElementById('location-selector'),
		searchField: document.getElementById('location-search-field'),
		locationList: document.getElementById('location-list'),
	},
	bus,
	api,
})
showAndChangeCurrentLocation({
	elements: {
		region: document.getElementById('current-location'),
		display: document.getElementById('current-location-display'),
		changeTrigger: document.getElementById('change-location'),
	},
	bus,
	api,
})
showWeatherForecast({
	elements: {
		region: document.getElementById('weather-forecast'),
		forecastTemplate: document.getElementById('forecast'),
		tipTemplate: document.getElementById('tip'),
	},
	bus,
	api,
})

function searchAndSetLocation(options) {
	let {region, searchField, locationList} = options.elements
	let {bus, api} = options

	show()
	searchField.addEventListener('input', handleSearch)
	locationList.addEventListener('click', handleLocationSelect)

	function handleSearch(ev) {
		let keyword = ev.target.value.trim()
		clearTimeout(ev.target._debounceTimer)
		ev.target._debounceTimer = setTimeout(api.searchLocations, 300, keyword, updateLocationList)
	}

	function handleLocationSelect(ev) {
		let loc = ev.target._loc
		hide()
		bus.send('locationSelected', loc)
	}

	function updateLocationList(locationData) {
		let existingNodes = locationList.querySelectorAll('button')
		for (let i = 0, l = Math.max(locationData.length, existingNodes.length); i < l; i++) {
			let node = existingNodes[i]
			let loc = locationData[i]
			if (!loc) {
				node?.remove()
				continue
			}
			if (!node) {
				node = document.createElement('button')
				locationList.append(node)
			}
			Object.assign(node, {textContent: loc.display, _loc: loc})
		}
	}

	function show() {
		region.hidden = false
	}

	function hide() {
		region.hidden = false
	}
}

function showAndChangeCurrentLocation(options) {
	let {region, display, changeTrigger} = options.elements
	let {bus} = options

	bus.on('locationSelected', updateDetails)

	function updateDetails(ev) {
		console.log(ev.detail)
		display.innerText = ev.detail.name
		show()
	}

	function show() {
		region.hidden = false
	}

	function hide() {
		region.hidden = true
	}
}

function showWeatherForecast(options) {
	let {region} = option.elements
}