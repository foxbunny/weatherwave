// Library

let Bus = (function () {
	function send(message, payload) {
		window.dispatchEvent(new CustomEvent('#' + message, {detail: payload}))
	}

	function on(message, callback) {
		window.addEventListener('#' + message, function (ev) {
			callback(ev.detail)
		})
	}

	return {
		send,
		on,
	}

}()) // <-- Bus

let Maps = (function () {
	class MultiMap extends Map {
		get(key) {
			if (this.has(key)) return super.get(key)
			return []
		}

		set(key, value) {
			let values = this.get(key)
			values.push(value)
			super.set(key, values)
		}
	}

	class GroupMap {
		constructor(predicate) {
			this.predicate = predicate
			this.map = new MultiMap()
		}

		add(value) {
			let key = this.predicate(value)
			if (!key) return
			this.map.set(key, value)
		}

		[Symbol.iterator]() {
			return this.map[Symbol.iterator]()
		}
	}

	return {
		MultiMap,
		GroupMap,
	}
}()) // <-- Maps

let Iter = (function () {
	function* indexed(iterable) {
		let i = 0
		for (let element of iterable) yield [i++, element]
	}

	return {
		indexed,
	}
}())

let GlobalEvents = (function () {
	let eternalObserverListeners = new WeakMap()
	let eternalObserver = new IntersectionObserver(function (entries) {
		for (let entry of entries) {
			let {target, ...intersection} = entry
			let listener = eternalObserverListeners.get(target)
			if (!listener) eternalObserver.unobserve(target)
			else {
				listener.callback(entry.target, entry)
				if (listener.options.once) {
					eternalObserverListeners.delete(entry.target)
					eternalObserver.unobserve(entry.target)
				}
			}
		}
	})

	function addVisibilityListener(target, callback, options) {
		eternalObserverListeners.set(target, {callback, options})
		eternalObserver.observe(target)
	}

	return {
		addVisibilityListener,
	}
}()) // <-- GlobalEvents

let Template = (function () {
	let templateIndex = {}

	for (let template of document.querySelectorAll('template'))
		templateIndex[template.dataset.name] = template.content

	function createIterableSlotIndex(slotList) {
		let index = {
			[Symbol.iterator]: function () {
				return slotList[Symbol.iterator]()
			},
		}
		for (let slot of slotList) index[slot.dataset.slot] = slot
		return index
	} // <-- createIterableSlotIndex

	function createSlotIndex(node) {
		return new Proxy(node, {
			get: function (target, prop) {
				if (target.dataset.slot == prop) return node
				return target.querySelector('[data-slot="' + prop + '"]')
			},
		})
	} // <-- createSlotIndex

	function ensureChildAtIndex(rootNode, index, templateName) {
		let node = rootNode.children[index]
		if (!node) {
			node = templateIndex[templateName].cloneNode(true).firstElementChild
			rootNode.append(node)
		}
		return node
	} // <-- replaceNodeAtIndex

	return {
		createSlotIndex,
		ensureChildAtIndex,
	}
}()) // <-- Template

let Colors = (function () {
	function colorComponent(normalized, rangeMin, rangeMax) {
		return rangeMin + (rangeMax - rangeMin) * normalized
	} // <-- colorComponent

	function convertValueToHeatmap(heatmapColors, value) {
		let rangeMin = heatmapColors[0]
		let rangeMax = heatmapColors.at(-1)

		value = Math.max(rangeMin.value, Math.min(rangeMax.value, value))

		for (let i = 0, min, max; min = heatmapColors[i++], max = heatmapColors[i];) {
			if (value >= max.value) continue
			let normalized = (value - min.value) / (max.value - min.value)
			let h = colorComponent(normalized, min.h, max.h)
			let s = colorComponent(normalized, min.s, max.s)
			let l = colorComponent(normalized, min.l, max.l)
			return `hsl(${h.toFixed(2)}, ${s.toFixed(2)}%, ${l.toFixed(2)}%)`
		}
		return `hsl(${rangeMax.h}, ${rangeMax.s}%, ${rangeMax.l}%)`
	} // <-- convertValueToHeatmap

	return {
		convertValueToHeatmap,
	}
}()) // <-- Color

let API = (function () {
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
			callback(response.results)
		})
	}

	function getWeatherForecast(loc, callback) {
		let url = new URL('https://api.open-meteo.com/v1/forecast?hourly=temperature_2m%2Crelative_humidity_2m%2Cdew_point_2m%2Cprecipitation_probability%2Ccloud_cover%2Cweather_code%2Csurface_pressure%2Cwind_speed_10m%2Cwind_direction_10m%2Cis_day&forecast_days=10')
		url.searchParams.set('latitude', loc.latitude)
		url.searchParams.set('longitude', loc.longitude)
		url.searchParams.set('timezone', loc.timezone)
		request(url, function (response) {
			callback(response.hourly)
		})
	}

	return {
		searchLocations,
		getWeatherForecast,
	}
}()) // <-- API

// Initialization

navigator.serviceWorker?.register(new URL('service-worker.js', import.meta.url))
searchAndSetLocation({
	elements: {
		region: document.getElementById('location-selector'),
		searchField: document.getElementById('location-search-field'),
		locationList: document.getElementById('location-list'),
	},
	Bus,
	API,
})
showAndChangeCurrentLocation({
	elements: {
		region: document.getElementById('current-location'),
		display: document.getElementById('current-location-display'),
		changeTrigger: document.getElementById('change-location'),
	},
	Bus,
	API,
})
showWeatherForecast({
	elements: {
		region: document.getElementById('weather-forecast'),
		forecastTemplate: document.getElementById('forecast'),
		tipTemplate: document.getElementById('tip'),
	},
	Bus,
	API,
})
saveLocation({Bus})

// Features

function searchAndSetLocation(options) {
	let {region, searchField, locationList} = options.elements
	let {Bus, API} = options

	show()
	searchField.addEventListener('input', handleSearch)
	locationList.addEventListener('click', handleLocationSelect)
	Bus.on('locationSelected', hide)
	Bus.on('requestChangeLocation', show)

	function handleSearch(ev) {
		let keyword = ev.target.value.trim()
		clearTimeout(ev.target._debounceTimer)
		ev.target._debounceTimer = setTimeout(API.searchLocations, 300, keyword, function (locations) {
			updateLocationList(convertResponseToLocationList(locations))
		})
	}

	function handleLocationSelect(ev) {
		if (!ev.target._loc) return
		let loc = ev.target._loc
		hide()
		Bus.send('locationSelected', loc)
	}

	function convertResponseToLocationList(locs = []) {
		return locs.map(function (loc) {
			return {
				name: loc.name,
				latitude: loc.latitude,
				longitude: loc.longitude,
				timezone: loc.timezone,
				display: `${loc.name}, ${loc.admin1}, ${loc.country}`,
			}
		})
	} // <-- convertResponseToLocationList

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
		region.hidden = true
	}
} // <-- searchAndSetLocation

function showAndChangeCurrentLocation(options) {
	let {region, display, changeTrigger} = options.elements
	let {Bus} = options

	changeTrigger.addEventListener('click', requestChangeLocation)
	Bus.on('locationSelected', updateDetails)

	function updateDetails(loc) {
		display.innerText = loc.name
		show()
	}

	function requestChangeLocation() {
		hide()
		Bus.send('requestChangeLocation')
	}

	function show() {
		region.hidden = false
	}

	function hide() {
		region.hidden = true
	}
} // <-- showAndChangeCurrentLocation

function showWeatherForecast(options) {
	let {region} = options.elements
	let {Bus, API} = options
	let today = new Date()
	today.setHours(0, 0, 0, 0)

	let weatherParameters = [
		{
			key: 'temperature',
			extractFromResponse: function (forecasts, index) {
				return {temperature: forecasts.temperature_2m[index]}
			},
			heatmapColors: [
				{value: -50, h: 224, s: 50, l: 44},
				{value: 5, h: 182, s: 48, l: 50},
				{value: 10, h: 62, s: 100, l: 53},
				{value: 35, h: 50, s: 100, l: 53},
				{value: 45, h: 0, s: 100, l: 50},
			],
			addTipInfo: function (forecast, add) {
				add({
					slot: 'temperature',
					apply: function (slot) {
						slot.textContent = forecast.temperature + '°C'
					},
				})
			},
		},
		{
			key: 'precipitation',
			extractFromResponse: function (forecasts, index) {
				return {precipitation: forecasts.precipitation_probability[index]}
			},
			heatmapColors: [
				{value: 0, h: 214, s: 100, l: 100},
				{value: 30, h: 214, s: 62, l: 69},
				{value: 100, h: 214, s: 86, l: 51},
			],
			addTipInfo: function (forecast, add) {
				add({
					slot: 'precipitation',
					apply: function (slot) {
						slot.textContent = forecast.precipitation + '%'
					},
				})
			},
		},
		{
			key: 'humidity',
			extractFromResponse: function (forecasts, index) {
				return {humidity: forecasts.relative_humidity_2m[index]}
			},
			heatmapColors: [
				{value: 0, h: 215, s: 0, l: 80},
				{value: 50, h: 215, s: 30, l: 80},
				{value: 85, h: 215, s: 50, l: 80},
				{value: 100, h: 215, s: 87, l: 38},
			],
			addTipInfo: function (forecast, add) {
				add({
					slot: 'humidity',
					apply: function (slot) {
						slot.textContent = forecast.humidity + '%'
					},
				})
			},
		},
		{
			key: 'cloud',
			extractFromResponse: function (forecasts, index) {
				return {cloud: forecasts.cloud_cover[index]}
			},
			heatmapColors: [
				{value: 0, h: 193, s: 82, l: 69},
				{value: 50, h: 180, s: 28, l: 69},
				{value: 100, h: 180, s: 2, l: 69},
			],
		},
		{
			key: 'wind',
			extractFromResponse: function (forecasts, index) {
				return {wind: forecasts.wind_speed_10m[index], windDirection: forecasts.wind_direction_10m[index]}
			},
			heatmapColors: [
				{value: 0, h: 188, s: 0, l: 100},
				{value: 5, h: 188, s: 50, l: 96},
				{value: 28, h: 200, s: 78, l: 93},
				{value: 49, h: 235, s: 87, l: 95},
				{value: 74, h: 44, s: 87, l: 95},
				{value: 102, h: 10, s: 87, l: 95},
				{value: 300, h: 292, s: 97, l: 98},
			],
			modifySlot: function (forecast, slot, hour) {
				if (hour % 2) return
				let directionIndicator = Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
					innerHTML: '<use href="icons.svg#compass"/>',
				})
				directionIndicator.setAttribute('class', 'wind-direction')
				directionIndicator.style.setProperty('--dir', forecast.windDirection)
				slot.append(directionIndicator)
			},
		},
		{
			key: 'fog',
			extractFromResponse: function (forecasts, index) {
				return {fog: forecasts.temperature_2m[index] < forecasts.dew_point_2m[index]}
			},
			heatmapColors: [
				{value: 0, h: 0, s: 0, l: 100},
				{value: 1, h: 0, s: 0, l: 86},
			],
		},
		{
			key: 'daylight',
			extractFromResponse: function (forecasts, index) {
				let current = forecasts.is_day[index]
				let prev = forecasts.is_day[index - 1]
				let hourOfDay = index % 24 // NB: indexes continue for all hours of all days in the forecast
				return {
					daylight: forecasts.is_day[index],
					dawn: prev ^ current && current == 1 && hourOfDay / 24 * 100 + '%',
					dusk: prev ^ current && current == 0 && hourOfDay / 24 * 100 + '%',
				}
			},
			heatmapColors: [
				{value: 0, h: 238, s: 8, l: 10},
				{value: 1, h: 193, s: 82, l: 69},
			],
			modifySlot: function (forecast, slot) {
				if (forecast.dawn) slot.style.setProperty('--dawn-pos', forecast.dawn)
				if (forecast.dusk) slot.style.setProperty('--dusk-pos', forecast.dusk)
			},
		},
	]

	Bus.on('locationSelected', render)
	Bus.on('requestChangeLocation', hide)

	function render(loc) {
		API.getWeatherForecast(loc, function (forecasts) {
			renderHourlyForecasts(convertResponseToHourlyForecasts(forecasts))
			show()
		})
	}

	function convertResponseToHourlyForecasts(forecasts) {
		let hourlyForecastsByDate = new Maps.GroupMap(convertHourlyForecastToGroupKey)

		for (let i = 0, time; time = forecasts.time[i]; i++) {
			let hourlyForecast = {}
			for (let parameter of weatherParameters)
				Object.assign(hourlyForecast, parameter.extractFromResponse(forecasts, i))
			hourlyForecastsByDate.add({...hourlyForecast, time})
		}
		return hourlyForecastsByDate
	} // <-- convertResponseToHourlyForecasts

	function convertHourlyForecastToGroupKey(forecast) {
		let d = new Date(forecast.time)
		d.setHours(0, 0, 0, 0)
		return d.toLocaleDateString('en-CA')
	} // <-- convertHourlyForecastToGroupKey

	function show() {
		region.hidden = false
	}

	function hide() {
		region.hidden = true
	}

	function renderHourlyForecasts(hourlyForecastsByDate) {
		for (let [i, forecastData] of Iter.indexed(hourlyForecastsByDate)) {
			let [date, hourlyForecasts] = forecastData
			let slots = Template.createSlotIndex(Template.ensureChildAtIndex(region, i + 1, 'forecast'))
			let regionId = 'forecast-' + date

			slots.container.setAttribute('aria-labelledby', regionId)
			slots.heading.id = regionId
			slots.hour.textContent = formatForecastDate(date)

			// Visualizations
			let slotToHeatmapStops = new Maps.MultiMap()
			let hourToTipInfo = new Maps.MultiMap()

			for (let hour = 0, forecast; forecast = hourlyForecasts[hour]; hour++)
				for (let parameter of weatherParameters) {
					let parameterSlot = slots[parameter.key]
					slotToHeatmapStops.set(parameterSlot, Colors.convertValueToHeatmap(parameter.heatmapColors, forecast[parameter.key]))
					parameter.modifySlot?.(forecast, parameterSlot, hour)
					parameter.addTipInfo?.(forecast, hourToTipInfo.set.bind(hourToTipInfo, hour))
				}

			for (let [node, colors] of slotToHeatmapStops)
				node.style.setProperty('--gradient-stops', colors.join(','))

			GlobalEvents.addVisibilityListener(slots.tips, function (tipsContainer) {
				for (let [i, tipData] of Iter.indexed(hourToTipInfo)) {
					let [hour, tipInfos] = tipData
					let slots = Template.createSlotIndex(Template.ensureChildAtIndex(tipsContainer, i, 'tip'))
					slots.hour.textContent = new Date(1, 1, 1, hour).toLocaleTimeString(navigator.languag, {hour: 'numeric'})
					for (let {slot, apply} of tipInfos) apply(slots[slot])
				}
			}, {once: true})
		}
	}

	function formatForecastDate(date) {
		date = new Date(date)
		date.setHours(0, 0, 0, 0)
		if (date - today == 0) return 'today'
		return date.toLocaleDateString('en-US', {
			day: 'numeric',
			month: 'short',
			weekday: 'short',
		})
	}
} // <-- showWeatherForecast

function saveLocation(options) {
	Bus.on('locationSelected', storeLocation)
	Bus.on('requestChangeLocation', clearStoredLocation)

	if (localStorage.lastLocation) Bus.send('locationSelected', JSON.parse(localStorage.lastLocation))

	function storeLocation(loc) {
		localStorage.lastLocation = JSON.stringify(loc)
	}

	function clearStoredLocation() {
		delete localStorage.lastLocation
	}
} // <-- saveLocation