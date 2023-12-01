let Events = (function() {
	let globalBusOptions = Object.seal({
		debug: false,
	})

	class EventBus {
		constructor(initialState, options) {
			options = {...globalBusOptions, ...options}
			this.debug = options.debug
			this.data = Object.seal(initialState)
			this.eventTarget = new EventTarget()
		}

		set(key, value) {
			this.data[key] = value
			this.dispatchEvent('data', this.data)
			this.dispatchEvent('data.' + key, value)
		}

		get(key, defaultValue) {
			return this.data[key] ?? defaultValue
		}

		addEventListener(type, listener) {
			this.eventTarget.addEventListener(type, listener)
		}

		dispatchEvent(type, value) {
			if (this.debug) console.debug('dispatchEvent', type, value)
			this.eventTarget.dispatchEvent(new CustomEvent(type, {detail: value}))
		}

		dispatchGetRequest(type, url) {
			let this_ = this
			let req = new XMLHttpRequest()
			req.open('GET', url)
			req.responseType = 'json'
			req.onload = function () {
				let result = {response: req.response, status: req.status}
				this_.dispatchEvent(type, result)
				this_.dispatchEvent(type + '.success', result)
			}
			req.onerror = function () {
				let result = {status: -1}
				this_.dispatchEvent(type, result)
				this_.dispatchEvent(type + '.error', result)
			}
			req.send()
		}
	}

	function setGlobalOption(options) {
		Object.assign(globalBusOptions, options)
	}

	return {
		setGlobalOption,
		EventBus,
	}
}()) // <-- Events

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

		get(key) {
			return this.map.get(key)
		}

		entries() {
			return Array.from(this.map.entries())
		}
	}

	return {
		MultiMap,
		GroupMap,
	}
}()) // <-- Maps

let Timing = (function () {
	function debounce(callback, delay = 500) {
		let timer
		return function (...args) {
			clearTimeout(timer)
			timer = setTimeout(callback, delay, ...args)
		}
	}

	return {
		debounce,
	}
}()) // <-- Timing

let Logging = (function () {
	function logAndReturn(something) {
		console.log(something)
		return something
	}

	return {
		logAndReturn,
	}
}()) // <-- Logging

let DOM = (function () {
	let safeStringMarker = Symbol('safe')

	function html(strings, ...values) {
		let result = strings[0]
		for (let i = 0; i < values.length; i++) {
			let value = values[i]
			if (value[safeStringMarker]) result += values.toString()
			else result += ('' + value).replace(/[&"<>]/g, function (matchedStr) {
				switch (matchedStr) {
					case '&': return '&amp;'
					case '"': return '&quot;'
					case '<': return '&lt;'
					case '>': return '&gt;'
				}
			})
			result += strings[i + 1]
		}
		return {
			[safeStringMarker]: true,
			toString() { return result }
		}
	}

	let createElement = document.createElement.bind(document)
	let createSVG = document.createElementNS.bind(document, 'http://www.w3.org/2000/svg')
	let createFrag = document.createDocumentFragment.bind(document)

	function assignAttributes(node, obj) {
		for (let name in obj) node.setAttribute(name, obj[name])
		return node
	}

	return {
		createElement,
		createSVG,
		createFrag,
		assignAttributes,
	}
}()) // <-- DOM

export {
	Events,
	Maps,
	Timing,
	Logging,
	DOM,
}