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
	let observedElements = new WeakMap()
	let observer = new IntersectionObserver(function (entries) {
		for (let entry of entries) {
			let callback = observedElements.get(entry.target)
			if (!callback) continue
			callback(entry)
		}
	})

	function addVisibilityListener(element, callback) {
		observedElements.set(element, callback)
		observer.observe(element)
	}

	function removeVisibilityListener(element) {
		observedElements.remove(element)
		observer.unobserve(element)
	}

	return {
		addVisibilityListener,
		removeVisibilityListener,
	}
}()) // <-- DOM

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
	}

	function appendFromTemplate(rootNode, templateName) {
		let content = templateIndex[templateName].cloneNode(true)
		let children = [...content.children]
		let slots = createIterableSlotIndex(content.querySelectorAll('[data-slot]'))
		rootNode.append(content)
		return {children, slots}
	}

	return {
		appendFromTemplate,
	}
}())

export {
	Events,
	Maps,
	Timing,
	Logging,
	DOM,
	Template,
}