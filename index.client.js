let DOM = (function () {
	function updateNodeList(options) {
		let { rootNode, childSelector, data, createChild, updateChild } = options
		let existingNodes = rootNode.querySelectorAll(childSelector)
		for (let i = 0, l = Math.max(data.length, existingNodes.length); i < l; i++) {
			let dataElement = data[i]
			let node = existingNodes[i]
			if (!dataElement) {
				node?.remove()
				continue
			}
			if (!node) {
				node = createChild()
				_locationList.append(node)
			}
			updateChild(node, dataElement)
		}
	}

	return {
		updateNodeList,
	}
}())

let XHR = (function () {
	function request(url, callback) {
		let xhr = new XMLHttpRequest()
		xhr.open('get', url)
		xhr.responseType = 'json'
		xhr.onload = function () {
			callback(xhr.response)
		}
		xhr.send()
	} // <-- request

	return {
		request,
	}
}())

let Search = (function () {
	let baseUrl = 'https://geocoding-api.open-meteo.com/v1/search'

	function createSearchUrl(keyword) {
		keyword = keyword.trim()
		let url = new URL(baseUrl)
		url.searchParams.set('name', keyword)
		return url
	} // <-- createSearchUrl

	function transformLocation(loc) {
		return {
			name: loc.name,
			latitude: loc.latitude,
			longitude: loc.longitude,
			timezone: loc.timezone,
			display: `${loc.name}, ${loc.admin1}, ${loc.country}`,
		}
	} // <-- transformLocation

	function getLocationsByKeyword(keyword, callback) {
		keyword = keyword.trim()
		if (!keyword) callback([])
		else XHR.request(createSearchUrl(keyword), function (data) {
			callback(data.results.map(transformLocation))
		})
	} // <-- getLocationsByKeyword


	return {
		getLocationsByKeyword,
	}
}())

let LocationSelector = (function () {
	function showSelector() {
		_locationSelector.hidden = false
	}

	function renderLocationList(locationData) {
		DOM.updateNodeList({
			rootNode: _locationList,
			childSelector: 'button',
			data: locationData,
			createChild: function () {
				return document.createElement('button')
			},
			updateChild: function (button, loc) {
				Object.assign(button, {
					textContent: loc.display,
					_location: loc,
				})
			},
		})
	}

	function setup() {
		showSelector()

		_locationSearch.addEventListener('input', function (ev) {
			Search.getLocationsByKeyword(ev.target.value, function (locationData) {
				renderLocationList(locationData)
			})
		})
	}

	return {
		setup
	}
}())

{ // Main -->
	LocationSelector.setup()
} // <-- Main



