import {EventBus} from './utils.client.js'
import * as utils from './utils.client.js'

EventBus.setGlobalOption({debug: true})

let global = new EventBus({location: null})

{ // Search and set location -->
	let local = new EventBus()

	_locationSearch.addEventListener('input', utils.debounce(function (ev) {
		let keyword = ev.target.value.trim()
		if (!keyword) return
		let url = new URL('https://geocoding-api.open-meteo.com/v1/search')
		url.searchParams.set('name', keyword)
		local.dispatchGetRequest('locationsFound', url)
	}))

	local.addEventListener('locationsFound', function (ev) {
		let locations = (ev.detail.response?.results || []).map(convertLocation)
		_locationList.replaceChildren()
		if (locations.length) {
			let blankOption = document.createElement('option')
			blankOption.textContent = 'Select a location'
			_locationList.append(blankOption, ...locations.map(renderLocationOption))
		}
	})

	_locationList.addEventListener('change', function (ev) {
		let selectedLocation = _locationList.selectedOptions[0]?._location
		if (!selectedLocation) return
		global.set('location', selectedLocation)
	})

	global.addEventListener('data.location', function () {
		_locationSelector.hidden = true
	})

	global.addEventListener('changeLocation', function () {
		_locationSelector.hidden = false
		_locationSearch.focus()
	})

	function renderLocationOption(loc) {
		let option = document.createElement('option')
		option.textContent = loc.display
		option._location = loc
		return option
	}

	function convertLocation(loc) {
		return {
			latitude: loc.latitude,
			longitude: loc.longitude,
			timezone: loc.timezone,
			display: `${loc.name}, ${loc.admin1}, ${loc.country}`,
		}
	}
} // <-- Search and set location

{ // See current location -->
	let local = new EventBus()

	global.addEventListener('data.location', function () {
		_currentLocationDisplay.textContent = 'Showing weather for ' + global.get('location').display
		_currentLocation.hidden = false
	})

	_changeLocation.addEventListener('click', function () {
		_currentLocation.hidden = true
		global.dispatchEvent('changeLocation')
	})
} // <-- See current location

{ // See weather forecast -->
	let local = new EventBus({forecasts: undefined})

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

	let forecastApiUrl = 'https://api.open-meteo.com/v1/forecast?hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,cloud_cover,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,is_day'

	global.addEventListener('data.location', function () {
		let loc = global.get('location')
		let url = new URL(forecastApiUrl)
		url.searchParams.set('latitude', loc.latitude)
		url.searchParams.set('longitude', loc.longitude)
		url.searchParams.set('timezone', loc.timezone)
		url.searchParams.set('forecast_days', 10)
		local.dispatchGetRequest('forecastRetrieved', url)
	})

	local.addEventListener('forecastRetrieved.error', function () {
		global.dispatchEvent('error', 'Could not fetch the weather forecast')
	})

	local.addEventListener('forecastRetrieved.success', function (ev) {
		let response = ev.detail.response
		local.set('forecasts', convertHourlyForecastToGroup(response.hourly, response.hourly_units))
	})

	local.addEventListener('data.forecasts', function () {
		let forecasts = local.get('forecasts')
		_weatherForecast.append(...forecasts.entries().map(function ([date, forecasts]) {
			return renderHourlyForecast(date, forecasts)
		}))
		_weatherForecast.hidden = false
	})

	// Converters

	function convertHourlyForecastToGroup(forecasts, units) {
		let hourlyForecastsByDate = new utils.GroupMap(convertHourlyForecastToDatestamp)
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
				color: convertValueToHeatmap(precipitationHeatmapColors, forecasts.precipitation_probability[i]),
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

	// Data collectors

	class SimpleHeatmap {
		constructor(forecastKey, heatmapClassName = forecastKey, icon = heatmapClassName) {
			this.forecastKey = forecastKey
			this.heatmapClassName = heatmapClassName
			this.heatmapGradientColors = []
			this.icon = icon
		}

		addGradientColor(forecast) {
			this.heatmapGradientColors.push(forecast[this.forecastKey].color)
		}

		getIcon() {
			return this.icon
		}

		render() {
			let element = Object.assign(utils.createElement('div'), {
				className: this.heatmapClassName + ' heatmap',
			})
			element.append(renderIcon(this.icon))
			element.style.setProperty('--gradient-stops', this.heatmapGradientColors.join(','))
			return element
		}
	} // <-- Heatmap

	class DaylightHeatmap extends SimpleHeatmap {
		constructor(forecastKey, heatmapClassName = forecastKey, icon = heatmapClassName, dawnIcon = 'sun', duskIcon = 'moon') {
			super(forecastKey, heatmapClassName, icon)
			this.dawnIcon = dawnIcon
			this.duskIcon = duskIcon
			this.dawnIndex = -1
			this.duskIndex = -1
		}

		addGradientColor(forecast) {
			let daylight = forecast[this.forecastKey]
			if (daylight.isDawn) this.dawnIndex = this.heatmapGradientColors.length
			if (daylight.isDusk) this.duskIndex = this.heatmapGradientColors.length
			super.addGradientColor(forecast)
		}
	} // <-- DaylightHeatmap

	// Renderers

	function renderHourlyForecast(date, hourlyForecasts) {
		let formattedDate = convertDateToFormattedDateString(convertAnythingToDate(date))
		let forecastDoc = utils.createElement('section')
		forecastDoc.append(
			Object.assign(utils.createElement('h2'), {
				textContent: 'Hourly forecast for ' + formattedDate,
			}),
			renderHourlyVisualization(hourlyForecasts),
		)
		return forecastDoc
	}

	function renderHourlyVisualization(hourlyForecasts) {
		// Heatmaps

		let heatmaps = [
			new SimpleHeatmap('temperature'),
			new SimpleHeatmap('precipitationProbability', 'precipitation'),
			new SimpleHeatmap('relativeHumidity', 'humidity'),
			new SimpleHeatmap('cloudCover', 'cloud'),
			new SimpleHeatmap('fog'),
			new DaylightHeatmap('daylight'),
		]

		let tips = Object.assign(utils.createElement('div'), {className: 'tips'})

		for (let i = 0, forecast; forecast = hourlyForecasts[i++];) {
			heatmaps.forEach(function (heatmap) {
				heatmap.addGradientColor(forecast)
			})

			let tip = Object.assign(utils.createElement('div'), {
				className: 'tip',
				tabIndex: 0,
			})
			let tipContent = Object.assign(utils.createElement('div'), {
				className: 'tip-content'
			})
			tipContent.append(
				renderTipItem('Temperature', 'temperature', forecast.temperature),
				renderTipItem('Precipitation', 'precipitation', forecast.precipitationProbability),
				renderTipItem('Relative humidity', 'humidity', forecast.relativeHumidity),
				renderTipItem('Cloud cover', 'cloud', forecast.cloudCover),
				renderTipItem('', 'fog', forecast.fog),
			)
			tip.append(tipContent)
			tips.append(tip)
		} // <-- heatmap gradients & tips

		// Grid lines

		let hourLineCount = 12
		let grid = Object.assign(utils.createElement('div'), {className: 'grid'})
		grid.setAttribute('aria-hidden', true)

		for (let i = 0; i < hourLineCount + 1; i++) {
			let hour = Object.assign(utils.createElement('div'), {
				className: 'grid-item',
				innerHTML: `<div class="grid-label">${i * 2 % 24}</div>`,
			})
			grid.append(hour)
		} // <-- grid elements

		// Assemble

		let container = Object.assign(document.createElement('div'), {
			className: 'hourly-visualization',
		})

		container.append(
			...heatmaps.map(renderHeatmap),
			grid,
			tips,
		)

		return container
	} // <-- renderHourlyVisualization

	function renderTipItem(label, icon, value) {
		let container = utils.createElement('div')
		container.append(
			renderIcon(icon),
			Object.assign(utils.createElement('span'), {textContent: label + ':'}),
			Object.assign(utils.createElement('span'), {textContent: renderValueWithUnit(value)}),
		)
		return container
	}

	function renderValueWithUnit(forecast) {
		return forecast.value + (forecast.unit ?? '')
	}

	function renderIcon(icon) {
		let use = utils.assignAttributes(utils.createSVG('use'), {href: 'icons.svg#' + icon})
		let svg = utils.assignAttributes(utils.createSVG('svg'), {class: 'icon', 'aria-hidden': true})
		svg.append(use)
		return svg
	}

	function renderHeatmap(heatmap) {
		switch (heatmap.constructor) {
			case SimpleHeatmap:
				return renderSimpleHeatmap(heatmap)
			case DaylightHeatmap:
				return renderDaylightHeatmap(heatmap)
		}
	}

	function renderSimpleHeatmap(heatmap) {
		let element = Object.assign(utils.createElement('div'), {
			className: heatmap.heatmapClassName + ' heatmap',
		})
		element.append(renderIcon(heatmap.icon))
		element.style.setProperty('--gradient-stops', heatmap.heatmapGradientColors.join(','))
		return element
	}

	function renderDaylightHeatmap(heatmap) {
		let element = renderSimpleHeatmap(heatmap)
		element.append(
			utils.assignAttributes(renderIcon(heatmap.dawnIcon), {class: 'icon dawn'}),
			utils.assignAttributes(renderIcon(heatmap.duskIcon), {class: 'icon dusk'}),
		)
		element.style.setProperty('--dawn-pos', heatmap.dawnIndex / heatmap.heatmapGradientColors.length * 100 + '%')
		element.style.setProperty('--dusk-pos', heatmap.duskIndex / heatmap.heatmapGradientColors.length * 100 + '%')
		return element
	}

	// Utility functions

	function asIs(something) {
		return something
	}

	function isDateSameMonth(dateA, dateB) {
		return dateA.getMonth() == dateB.getMonth()
	}

	function isDateSameYear(dateA, dateB) {
		return dateA.getFullYear() == dateB.getFullYear()
	}
} // <-- See weather forecast