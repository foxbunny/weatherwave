import {EventBus} from './utils.client.js'
import * as utils from './utils.client.js'

EventBus.setGlobalOption({debug: true})

let global = new EventBus({location: null})

{ // Search and set location -->
	let local = new EventBus()

	_locationSearch.addEventListener('input', function (ev) {
		utils.debounce(ev, function () {
			let url = new URL('https://geocoding-api.open-meteo.com/v1/search')
			url.searchParams.set('name', ev.target.value)
			local.dispatchGetRequest('locationsFound', url)
		})
	})

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
	let dewPointHeatmapColors = ['hsl(0 0% 100%)', 'hsl(0 0% 86%)']
	let humidityHeatmapColors = [
		{value: 0, h: 215, s: 0, l: 80},
		{value: 50, h: 215, s: 30, l: 80},
		{value: 85, h: 215, s: 50, l: 80},
		{value: 100, h: 215, s: 87, l: 38},
	]
	let precipitationGradientColor = '#2fadc6'

	let forecastApiUrl = 'https://api.open-meteo.com/v1/forecast?hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,rain,showers,snowfall,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max'

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
		local.set('forecasts', {
			hourly: convertHourlyForecastToGroup(response.hourly, response.hourly_units),
			daily: convertDailyForecastToGroup(response.daily, response.daily_units),
		})
	})

	local.addEventListener('data.forecasts', function () {
		let forecasts = local.get('forecasts')
		_weatherForecast.append(...forecasts.daily.map(function (dailyForecast) {
			let date = dailyForecast.date
			let hourlyForecast = forecasts.hourly.get(date)
			return renderHourlyForecast(date, hourlyForecast, dailyForecast)
		}))
		_weatherForecast.hidden = false
	})

	function convertHourlyForecastToGroup(forecasts, units) {
		let hourlyForecastsByDate = new utils.GroupMap(convertHourlyForecastToDatestamp)
		for (let i = 0, time; time = forecasts.time[i]; i++) {
			let convertToDataObj = convertValueAtIndexToDataObj.bind(null, forecasts, units, i)
			hourlyForecastsByDate.add({
				time,

				// Weather
				weather: convertWeatherCodeToWeatherType(forecasts.weather_code[i]),

				// Temperatures
				dewPoint: convertToDataObj('dew_point_2m'),
				temperature: convertToDataObj('temperature_2m'),

				// Precipitation
				precipitationProbability: convertToDataObj('precipitation_probability'),
				rain: convertToDataObj('rain'),
				showers: convertToDataObj('showers'),
				snowfall: convertToDataObj('snowfall'),

				// Atmospheric conditions
				relativeHumidity: convertToDataObj('relative_humidity_2m'),
				pressure: convertToDataObj('surface_pressure'),

				// Wind
				windDirection: convertToDataObj('wind_direction_10m'),
				windSpeed: convertToDataObj('wind_speed_10m'),
			})
		}
		return hourlyForecastsByDate
	}

	function convertDailyForecastToGroup(forecasts, units) {
		return forecasts.time.map(function (date, i) {
			let convertToDataObj = convertValueAtIndexToDataObj.bind(null, forecasts, units, i)
			return {
				date,

				// Weather
				weather: convertWeatherCodeToWeatherType(forecasts.weather_code[i]),

				// Temperature
				temperatureMax: convertToDataObj('temperature_2m_max'),
				temperatureMin: convertToDataObj('temperature_2m_min'),
				apparentTemperatureMax: convertToDataObj('apparent_temperature_max'),
				apparentTemperatureMin: convertToDataObj('apparent_temperature_min'),

				// Precipitation
				precipitationHours: convertToDataObj('precipitation_hours'),
				rainSum: convertToDataObj('rain_sum'),
				showersSum: convertToDataObj('showers_sum'),
				snowfallSum: convertToDataObj('snowfall_sum'),

				// Sun
				sunrise: convertToDataObj('sunrise', convertAnythingToDate),
				sunset: convertToDataObj('sunset', convertAnythingToDate),
				daylightDuration: convertToDataObj('daylight_duration'),
				sunshineDuration: convertToDataObj('sunshine_duration'),
			}
		})
	}

	function convertValueAtIndexToDataObj(forecast, units, index, key, parse = asIs) {
		return {
			value: parse(forecast[key][index]),
			unit: units[key],
		}
	}

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
	}

	function convertHourlyForecastToDatestamp(forecast) {
		return convertDateToDatestamp(convertTimestampToDate(forecast.time))
	}

	function convertTimestampToDate(timestamp) {
		let d = new Date(timestamp)
		d.setHours(0, 0, 0, 0)
		return d
	}

	function convertDateToDatestamp(date) {
		return date.toLocaleDateString('en-ca')
	}

	function renderHourlyForecast(date, hourlyForecasts) {
		let formattedDate = formatDate(convertAnythingToDate(date))
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

		let temperatureHeatmap = Object.assign(utils.createElement('div'), {className: 'tempearture heatmap'})
		let precipitationHeatmap = Object.assign(utils.createElement('div'), {className: 'precipitation heatmap'})
		let humidityHeatmap = Object.assign(utils.createElement('div'), {className: 'humidity heatmap'})
		let dewPointHeatmap = Object.assign(utils.createElement('div'), {className: 'dew-point heatmap'})

		let temperatureGradientStops = []
		let precipitationGradientStops = []
		let humidityGradientStops = []
		let dewPointGradientStops = []

		let tips = Object.assign(utils.createElement('div'), {className: 'tips'})

		for (let i = 0, forecast; forecast = hourlyForecasts[i]; i++) {
			temperatureGradientStops.push(valueToHeatmap(temperatureHeatmapColors, forecast.temperature.value))
			precipitationGradientStops.push(valueToHeatmap(precipitationHeatmapColors, forecast.precipitationProbability.value))
			humidityGradientStops.push(valueToHeatmap(humidityHeatmapColors, forecast.relativeHumidity.value))
			dewPointGradientStops.push(dewPointHeatmapColors[+(forecast.temperature.value < forecast.dewPoint.value)])

			let tip = Object.assign(utils.createElement('div'), {
				className: 'tip',
				innerHTML: utils.html`
					<div class="tip-content">
						 <div>${formatHours(forecast.time)}</div>
						 <div>Temperature: ${renderValueWithUnit(forecast.temperature)}</div>
						 <div>Precipitation: ${renderValueWithUnit(forecast.precipitationProbability)}</div>
						 <div>Relative humidity: ${renderValueWithUnit(forecast.relativeHumidity)}</div>
						 <div>Dew point: ${renderValueWithUnit(forecast.dewPoint)}</div>
					</div>
				 `
			})
			tips.append(tip)
		} // <-- heatmap gradients

		duplicateLast(temperatureGradientStops)
		duplicateLast(precipitationGradientStops)
		duplicateLast(humidityGradientStops)
		duplicateLast(dewPointGradientStops)

		temperatureHeatmap.style.setProperty('--gradient-stops', temperatureGradientStops.join(','))
		precipitationHeatmap.style.setProperty('--gradient-stops', precipitationGradientStops.join(','))
		humidityHeatmap.style.setProperty('--gradient-stops', humidityGradientStops.join(','))
		dewPointHeatmap.style.setProperty('--gradient-stops', dewPointGradientStops.join(','))

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
			temperatureHeatmap,
			precipitationHeatmap,
			humidityHeatmap,
			dewPointHeatmap,
			grid,
			tips,
		)

		return container
	}

	function renderValueWithUnit(forecast) {
		return forecast.value + forecast.unit
	}

	function valueToHeatmap(heatmapColors, value) {
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
		return `hsl(${rangeMax.h}, ${rangeMax.s}%, ${rangeMax.l}%`
	}

	function colorComponent(normalized, rangeMin, rangeMax) {
		return rangeMin + (rangeMax - rangeMin) * normalized
	}

	function asIs(something) {
		return something
	}

	function convertAnythingToDate(something) {
		return new Date(something)
	}

	function formatDate(date) {
		let format = dateFormats.sameMonth
		if (!isDateSameYear(today, date)) format = dateFormats.differentYear
		else if (!isDateSameMonth(today, date)) format = dateFormats.differentMonth
		return date.toLocaleDateString(navigator.language, format)
	}

	function formatHours(time) {
		return new Date(time).toLocaleTimeString(navigator.language, {hour: 'numeric'})
	}

	function isDateSameMonth(dateA, dateB) {
		return dateA.getMonth() == dateB.getMonth()
	}

	function isDateSameYear(dateA, dateB) {
		return dateA.getFullYear() == dateB.getFullYear()
	}

	function duplicateLast(array) {
		array.push(array.at(-1))
	}
} // <-- See weather forecast