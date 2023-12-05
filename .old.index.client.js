import {Events, Timing, DOM, Maps, Template} from '.old.utils.client.js'

Events.setGlobalOption({debug: new URLSearchParams(location.search).get('debug') == 'true'})

let global = new Events.EventBus()
let selectedLocation

{ // Storage -->
	global.addEventListener('locationSet', function () {
		localStorage.lastLocation = JSON.stringify(selectedLocation || {})
	})
} // <-- Storage

{ // Search and set location -->
	let local = new Events.EventBus()

	setTimeout(function () {
		let lastLocation = JSON.parse(localStorage.lastLocation || null)
		if (lastLocation) {
			selectedLocation = lastLocation
			global.dispatchEvent('locationSet')
		}
		else _locationSelector.hidden = false
	})

	_locationSearch.addEventListener('input', Timing.debounce(function (ev) {
		let keyword = ev.target.value.trim()
		if (!keyword)
			local.dispatchEvent('locationsFound', {})
		else {
			let url = new URL('https://geocoding-api.open-meteo.com/v1/search')
			url.searchParams.set('name', keyword)
			local.dispatchGetRequest('locationsFound', url)
		}
	}))

	local.addEventListener('locationsFound', function (ev) {
		let locations = (ev.detail.response?.results || []).map(convertLocation)
		_locationList.replaceChildren()
		if (locations.length)
			_locationList.append(...locations.map(renderLocationOption))
	})

	_locationList.addEventListener('click', function (ev) {
		let loc = ev.target._location
		if (!loc) return
		selectedLocation = loc
		global.dispatchEvent('locationSet')
	})

	global.addEventListener('locationSet', function () {
		_locationSelector.hidden = true
		_locationList.replaceChildren()
		_locationSearch.value = ''
	})

	global.addEventListener('changeLocation', function () {
		_locationSelector.hidden = false
		_locationSearch.focus()
	})

	function renderLocationOption(loc) {
		let button = document.createElement('button')
		button.textContent = loc.display
		button._location = loc
		return button
	}

	function convertLocation(loc) {
		return {
			name: loc.name,
			latitude: loc.latitude,
			longitude: loc.longitude,
			timezone: loc.timezone,
			display: `${loc.name}, ${loc.admin1}, ${loc.country}`,
		}
	}
} // <-- Search and set location

{ // See current location -->
	let local = new Events.EventBus()

	global.addEventListener('locationSet', function () {
		_currentLocationDisplay.textContent = selectedLocation.name
		_currentLocation.hidden = false
	})

	_changeLocation.addEventListener('click', function () {
		_currentLocation.hidden = true
		global.dispatchEvent('changeLocation')
	})
} // <-- See current location

{ // See weather forecast -->
	let local = new Events.EventBus()

	let forecastApiUrl = 'https://api.open-meteo.com/v1/forecast?hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,cloud_cover,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,is_day'

	let today = new Date()
	let weatherTypes = {
		clear: 'clear',
		partlyClear: 'partly-cloudy',
		fog: 'fog',
		drizzle: 'drizzle',
		freezingDrizzle: 'freezing-drizzle',
		rain: 'rain',
		freezingRain: 'freezing-rain',
		snow: 'snow',
		snowGrains: 'snow-grains',
		rainShowers: 'rain-showers',
		showShowers: 'snow-showers',
		thunderstorm: 'thunderstorm',
		thunderstormWithHail: 'thunderstorm-with-hail',
	} // <-- weatherTypes
	let dateFormats = {
		sameMonth: {
			weekday: 'short',
			day: 'numeric',
		},
		differentMonth: {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
		},
		differentYear: {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		},
	} // <-- dateFormats
	let temperatureHeatmapColors = [
		{value: -50, h: 224, s: 50, l: 44},
		{value: 5, h: 182, s: 48, l: 50},
		{value: 10, h: 62, s: 100, l: 53},
		{value: 35, h: 50, s: 100, l: 53},
		{value: 45, h: 0, s: 100, l: 50},
	] // <-- temperatureHeatmapColors
	let precipitationHeatmapColors = [
		{value: 0, h: 214, s: 100, l: 100},
		{value: 30, h: 214, s: 62, l: 69},
		{value: 100, h: 214, s: 86, l: 51},
	] // <-- precipitationHeatmapColors
	let dewPointHeatmapColors = ['hsl(0, 0%, 100%)', 'hsl(0, 0%, 86%)']
	let humidityHeatmapColors = [
		{value: 0, h: 215, s: 0, l: 80},
		{value: 50, h: 215, s: 30, l: 80},
		{value: 85, h: 215, s: 50, l: 80},
		{value: 100, h: 215, s: 87, l: 38},
	] // <-- humidityHeatmapColors
	let cloudCoverHeatmapColors = [
		{value: 0, h: 193, s: 82, l: 69},
		{value: 50, h: 180, s: 28, l: 69},
		{value: 100, h: 180, s: 2, l: 69},
	] // <-- cloudCoverHeatmapColors
	let dayNightHeatmapColors = ['hsl(238, 8%, 10%)', 'hsl(193, 82%, 69%)']
	let precipitationGradientColor = '#2fadc6'

	let forecasts
	let forecastNodes = []
	let tipsObserver

	global.addEventListener('changeLocation', function () {
		_weatherForecast.hidden = true
	})

	global.addEventListener('locationSet', function () {
		let url = new URL(forecastApiUrl)
		url.searchParams.set('latitude', selectedLocation.latitude)
		url.searchParams.set('longitude', selectedLocation.longitude)
		url.searchParams.set('timezone', selectedLocation.timezone)
		url.searchParams.set('forecast_days', 10)
		local.dispatchGetRequest('forecastRetrieved', url)
	})

	local.addEventListener('forecastRetrieved.error', function () {
		global.dispatchEvent('error', 'Could not fetch the weather forecast')
	})

	local.addEventListener('forecastRetrieved.success', function (ev) {
		let response = ev.detail.response
		let forecasts = convertHourlyForecastToGroup(response.hourly, response.hourly_units)
		renderAllForecasts(forecasts)
	})

	// Converters

	function convertHourlyForecastToGroup(forecasts, units) {
		let hourlyForecastsByDate = new Maps.GroupMap(convertHourlyForecastToDatestamp)
		let previousDaylightValue = forecasts.is_day[0]
		for (let i = 0, time; time = forecasts.time[i]; i++) {
			let hour = convertDateToFormattedHours(time)
			let weather = convertWeatherCodeToWeatherType(forecasts.weather_code[i])
			let isDay = forecasts.is_day[i]
			let daylight = {
				value: isDay,
				color: dayNightHeatmapColors[+isDay],
				isDawn: previousDaylightValue < isDay,
				isDusk: previousDaylightValue > isDay,
			} // <-- daylight
			previousDaylightValue = isDay
			let temperature = {
				value: forecasts.temperature_2m[i],
				color: convertValueToHeatmap(temperatureHeatmapColors, forecasts.temperature_2m[i]),
				unit: units.temperature_2m,
			} // <-- temperature
			let precipitationProbability = {
				value: forecasts.precipitation_probability[i],
				color: convertValueToHeatmap(
					precipitationHeatmapColors,
					forecasts.precipitation_probability[i],
				),
				unit: units.precipitation_probability,
			} // <-- precipitationProbability
			let relativeHumidity = {
				value: forecasts.relative_humidity_2m[i],
				color: convertValueToHeatmap(humidityHeatmapColors, forecasts.relative_humidity_2m[i]),
				unit: units.relative_humidity_2m,
			} // <-- relativeHumidity
			let hasFog = forecasts.temperature_2m[i] < forecasts.dew_point_2m[i]
			let cloudCover = {
				value: forecasts.cloud_cover[i],
				color: convertValueToHeatmap(cloudCoverHeatmapColors, forecasts.cloud_cover[i]),
				unit: units.cloud_cover,
			} // <-- cloudCover
			let fog = {
				value: hasFog ? 'fog' : 'no fog',
				color: dewPointHeatmapColors[+hasFog],
			} // <-- fog

			hourlyForecastsByDate.add({
				time,
				hour,
				weather,
				daylight,
				temperature,
				precipitationProbability,
				relativeHumidity,
				cloudCover,
				fog,
			})
		}
		return hourlyForecastsByDate
	} // <-- convertHourlyForecastToGroup

	function convertWeatherCodeToWeatherType(code) {
		switch (code) {
			case 0:
				return weatherTypes.clear

			case 1:
			case 2:
			case 3:
				return weatherTypes.partlyClear

			case 45:
			case 48:
				return weatherTypes.fog

			case 51:
			case 53:
			case 55:
				return weatherTypes.drizzle

			case 56:
			case 57:
				return weatherTypes.freezingDrizzle

			case 61:
			case 63:
			case 65:
				return weatherTypes.rain

			case 66:
			case 67:
				return weatherTypes.freezingRain

			case 71:
			case 73:
			case 75:
				return weatherTypes.snow

			case 77:
				return weatherTypes.snowGrains

			case 80:
			case 81:
			case 82:
				return weatherTypes.rainShowers

			case 85:
			case 86:
				return weatherTypes.showShowers

			case 95:
				return weatherTypes.thunderstorm

			case 96:
			case 99:
				return weatherTypes.thunderstormWithHail
		}
	} // <-- convertWeatherCodeToWeatherType

	function convertHourlyForecastToDatestamp(forecast) {
		return convertDateToDatestamp(convertTimestampToDate(forecast.time))
	}

	function convertTimestampToDate(timestamp) {
		let d = new Date(timestamp)
		d.setHours(0, 0, 0, 0)
		return d
	}

	function convertDateToDatestamp(date) {
		return date.toLocaleDateString('en-ca') // YYYY-MM-DD
	}

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
	}

	function colorComponent(normalized, rangeMin, rangeMax) {
		return rangeMin + (rangeMax - rangeMin) * normalized
	}

	function convertAnythingToDate(something) {
		return new Date(something)
	}

	function convertDateToFormattedDateString(date) {
		let format = dateFormats.sameMonth
		if (!isDateSameYear(today, date)) format = dateFormats.differentYear
		else if (!isDateSameMonth(today, date)) format = dateFormats.differentMonth
		return date.toLocaleDateString(navigator.language, format)
	}

	function convertDateToFormattedHours(time) {
		return new Date(time).toLocaleTimeString(navigator.language, {hour: 'numeric'})
	}

	// Renderers

	function renderAllForecasts(forecasts) {
		forecasts.entries().forEach(function ([date, hourlyForecast], index) {
			let {children, slots} = forecastNodes[index] ??= Template.appendFromTemplate(_weatherForecast, 'forecast')
			renderHourlyForecastForDate(slots, date, hourlyForecast)
		})
		_weatherForecast.hidden = false
	}

	function renderHourlyForecastForDate(slots, date, hourlyForecasts) {
		let heatmaps = [
			createSimpleHeatmap('temperature'),
			createSimpleHeatmap('precipitationProbability', 'precipitation'),
			createSimpleHeatmap('relativeHumidity', 'humidity'),
			createSimpleHeatmap('cloudCover', 'cloud'),
			createSimpleHeatmap('fog'),
			createDaylightHeatmap('daylight'),
		]

		for (let i = 0, forecast; forecast = hourlyForecasts[i++];)
			heatmaps.forEach(function (heatmap) {
				heatmap.addForecast(forecast)
			})

		DOM.addVisibilityListener(slots.container, function (entry) {
			if (entry.isIntersecting) renderTips(slots.tips, hourlyForecasts)
			else destroyTips(slots.tips)
		})

		slots.hour.textContent = convertDateToFormattedDateString(convertAnythingToDate(date))
		heatmaps.forEach(function (heatmap) {
			heatmap.applyToSlot(slots)
		})
	}

	function renderTips(slot, hourlyForecasts) {
		let tips = document.createDocumentFragment()
		for (let i = 0, forecast; forecast = hourlyForecasts[i++];) {
			let { slots } = Template.appendFromTemplate(tips, 'tip')
			slots.hour.textContent = forecast.hour
			slots.temperature.textContent = renderValueWithUnit(forecast.temperature)
			slots.precipitation.textContent = renderValueWithUnit(forecast.precipitationProbability)
			slots.humidity.textContent = renderValueWithUnit(forecast.relativeHumidity)
		}
		slot.replaceChildren(tips)
	}

	function destroyTips(slot) {
		slot.replaceChildren()
	}

	function renderTipItem(label, icon, value) {
		let container = DOM.createElement('div')
		container.append(
			renderIcon(icon),
			Object.assign(DOM.createElement('span'), {textContent: label + ':'}),
			Object.assign(DOM.createElement('span'), {textContent: renderValueWithUnit(value)}),
		)
		return container
	}

	function renderValueWithUnit(forecast) {
		return forecast.value + (forecast.unit ?? '')
	}

	function createSimpleHeatmap(forecastKey, slotName = forecastKey) {
		let heatmapGradientColors = []

		function addForecast(forecast) {
			heatmapGradientColors.push(forecast[forecastKey].color)
		}

		function applyToSlot(slots) {
			slots[slotName].style.setProperty('--gradient-stops', heatmapGradientColors.join(','))
		}

		return {
			addForecast,
			applyToSlot,
		}
	}

	function createDaylightHeatmap(forecastKey, slotName = forecastKey) {
		let heatmap = createSimpleHeatmap(forecastKey, slotName)
		let dawnIndex = -1
		let duskIndex = -1
		let collectedForecastCount = 0

		function addForecast(forecast) {
			heatmap.addForecast(forecast)
			let daylight = forecast[forecastKey]
			if (daylight.isDawn) dawnIndex = collectedForecastCount
			if (daylight.isDusk) duskIndex = collectedForecastCount
			collectedForecastCount++
		}

		function applyToSlot(slots) {
			heatmap.applyToSlot(slots)
			let slot = slots[slotName]
			slot.style.setProperty('--dawn-pos', dawnIndex / collectedForecastCount * 100 + '%')
			slot.style.setProperty('--dusk-pos', duskIndex / collectedForecastCount * 100 + '%')
		}

		return {
			addForecast,
			applyToSlot,
		}
	}

	// Utility functions

	function isDateSameMonth(dateA, dateB) {
		return dateA.getMonth() == dateB.getMonth()
	}

	function isDateSameYear(dateA, dateB) {
		return dateA.getFullYear() == dateB.getFullYear()
	}
} // <-- See weather forecast