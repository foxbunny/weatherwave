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

	function appendFromTemplate(rootNode, templateName) {
		let content = templateIndex[templateName].cloneNode(true)
		let children = [...content.children]
		let slots = createIterableSlotIndex(content.querySelectorAll('[data-slot]'))
		rootNode.append(content)
		return {children, slots}
	} // <-- appendFromTemplate

	return {
		appendFromTemplate,
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
			return `hsl(${h}, ${s}%, ${l}%)`
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

let Plugins = [
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
		addMarker: function (forecast, add) {
			if (forecast.dawn) add({property: '--dawn-pos', value: forecast.dawn})
			if (forecast.dusk) add({property: '--dusk-pos', value: forecast.dusk})
		},
	},
]

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

function searchAndSetLocation(options) {
	let {region, searchField, locationList} = options.elements
	let {Bus, API} = options

	show()
	searchField.addEventListener('input', handleSearch)
	locationList.addEventListener('click', handleLocationSelect)
	Bus.on('locationSelected', hide)

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

	Bus.on('locationSelected', updateDetails)

	function updateDetails(loc) {
		display.innerText = loc.name
		show()
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

	Bus.on('locationSelected', render)

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
			for (let plugin of Plugins)
				Object.assign(hourlyForecast, plugin.extractFromResponse(forecasts, i))
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
		for (let [date, hourlyForecasts] of hourlyForecastsByDate) {
			// Section heading
			let {slots} = Template.appendFromTemplate(region, 'forecast')
			let regionId = 'forecast-' + date
			slots.container.setAttribute('aria-labelledby', regionId)
			slots.heading.id = regionId
			slots.hour.textContent = formatForecastDate(date)

			// Visualizations
			let slotToHeatmapStops = new Maps.MultiMap()
			let slotToMarkers = new Maps.MultiMap()
			let hourToTipInfo = new Maps.MultiMap()

			for (let hour = 0, forecast; forecast = hourlyForecasts[hour]; hour++)
				for (let plugin of Plugins) {
					let pluginSlot = slots[plugin.key]
					slotToHeatmapStops.set(pluginSlot, Colors.convertValueToHeatmap(plugin.heatmapColors, forecast[plugin.key]))
					plugin.addMarker?.(forecast, slotToMarkers.set.bind(slotToMarkers, pluginSlot))
					plugin.addTipInfo?.(forecast, hourToTipInfo.set.bind(hourToTipInfo, hour))
				}

			for (let [node, colors] of slotToHeatmapStops)
				node.style.setProperty('--gradient-stops', colors.join(','))

			for (let [node, markers] of slotToMarkers)
				for (let marker of markers)
					node.style.setProperty(marker.property, marker.value)

			GlobalEvents.addVisibilityListener(slots.tips, function (tipsContainer) {
				for (let [hour, tipInfos] of hourToTipInfo) {
					let {slots} = Template.appendFromTemplate(tipsContainer, 'tip')
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