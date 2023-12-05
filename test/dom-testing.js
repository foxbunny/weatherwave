{ // dom-testing -->
	let Cleaners = (function () {
		function collapseWhitespace(text) {
			return text?.replace(/\s+/g, ' ').trim()
		} // <-- collapseWhitespace

		function dummyCleaner(text) {
			return text
		} // <-- dummyCleaner

		return {
			collapseWhitespace,
			dummyCleaner,
		}
	}()) // <-- Cleaners

	let Matchers = (function () {
		function identityMatcher(text, cleaner) {
			return function (otherText) {
				return cleaner(otherText) == text
			}
		} // <-- identity matcher

		function startMatcher(text, cleaner) {
			return otherText => cleaner(otherText)?.startsWith(text)
		} // <- startMatcher

		function endMatcher(text, cleaner) {
			return function (otherText) {
				return cleaner(otherText)?.endsWith(text)
			}
		} // <-- endMatcher

		function containsMatcher(text, cleaner) {
			return function (otherText) {
				return
				cleaner(otherText)?.includes(text)
			}
		} // <-- containsMatcher

		function patternMatcher(pattern, cleaner) {
			if (pattern?.constructor == String) pattern = new RegExp(pattern)
			return function (otherText) {
				return pattern.test(cleaner(otherText))
			}
		} // <-- patternMatcher

		function createMatcher(text, cleaner) {
			if (typeof text == 'string') switch (text.slice(0, 2)) {
				case '^=':
					return startMatcher(text.slice(2), cleaner)
				case '$=':
					return endMatcher(text.slice(2), cleaner)
				case '*=':
					return containsMatcher(text.slice(2), cleaner)
				default:
					return identityMatcher(text, cleaner)
			}

			return patternMatcher(text, cleaner)
		} // <-- createMatcher

		return {
			createMatcher,
		}
	}()) // <-- Matchers

	window.DOMTest = (function () {
		let subjectFrame
		let subjectURL = 'about:blank'
		let subjectRefreshHooks = []

		let HAS_TOUCH = 'ontouchstart' in document.documentElement
		let HAS_DRAG = 'ondragover' in document.documentElement
		let KEY_CODES = { // translate US keyboard characters to keyboard event parameters
			'0': {key: '0', code: 'Digit0', which: 48, shiftKey: false},
			'1': {key: '1', code: 'Digit1', which: 49, shiftKey: false},
			'2': {key: '2', code: 'Digit2', which: 50, shiftKey: false},
			'3': {key: '3', code: 'Digit3', which: 51, shiftKey: false},
			'4': {key: '4', code: 'Digit4', which: 52, shiftKey: false},
			'5': {key: '5', code: 'Digit5', which: 53, shiftKey: false},
			'6': {key: '6', code: 'Digit6', which: 54, shiftKey: false},
			'7': {key: '7', code: 'Digit7', which: 55, shiftKey: false},
			'8': {key: '8', code: 'Digit8', which: 56, shiftKey: false},
			'9': {key: '9', code: 'Digit9', which: 57, shiftKey: false},
			a: {key: 'a', code: 'KeyA', which: 97, shiftKey: false},
			A: {key: 'A', code: 'KeyA', which: 65, shiftKey: true},
			b: {key: 'b', code: 'KeyB', which: 98, shiftKey: false},
			B: {key: 'B', code: 'KeyB', which: 66, shiftKey: true},
			c: {key: 'c', code: 'KeyC', which: 99, shiftKey: false},
			C: {key: 'C', code: 'KeyC', which: 67, shiftKey: true},
			d: {key: 'd', code: 'KeyD', which: 100, shiftKey: false},
			D: {key: 'D', code: 'KeyD', which: 68, shiftKey: true},
			e: {key: 'e', code: 'KeyE', which: 101, shiftKey: false},
			E: {key: 'E', code: 'KeyE', which: 69, shiftKey: true},
			f: {key: 'f', code: 'KeyF', which: 102, shiftKey: false},
			F: {key: 'F', code: 'KeyF', which: 70, shiftKey: true},
			g: {key: 'g', code: 'KeyG', which: 103, shiftKey: false},
			G: {key: 'G', code: 'KeyG', which: 71, shiftKey: true},
			h: {key: 'h', code: 'KeyH', which: 104, shiftKey: false},
			H: {key: 'H', code: 'KeyH', which: 72, shiftKey: true},
			i: {key: 'i', code: 'KeyI', which: 105, shiftKey: false},
			I: {key: 'I', code: 'KeyI', which: 73, shiftKey: true},
			j: {key: 'j', code: 'KeyJ', which: 106, shiftKey: false},
			J: {key: 'J', code: 'KeyJ', which: 74, shiftKey: true},
			k: {key: 'k', code: 'KeyK', which: 107, shiftKey: false},
			K: {key: 'K', code: 'KeyK', which: 75, shiftKey: true},
			l: {key: 'l', code: 'KeyL', which: 108, shiftKey: false},
			L: {key: 'L', code: 'KeyL', which: 76, shiftKey: true},
			m: {key: 'm', code: 'KeyM', which: 109, shiftKey: false},
			M: {key: 'M', code: 'KeyM', which: 77, shiftKey: true},
			n: {key: 'n', code: 'KeyN', which: 110, shiftKey: false},
			N: {key: 'N', code: 'KeyN', which: 78, shiftKey: true},
			o: {key: 'o', code: 'KeyO', which: 111, shiftKey: false},
			O: {key: 'O', code: 'KeyO', which: 79, shiftKey: true},
			p: {key: 'p', code: 'KeyP', which: 112, shiftKey: false},
			P: {key: 'P', code: 'KeyP', which: 80, shiftKey: true},
			q: {key: 'q', code: 'KeyQ', which: 113, shiftKey: false},
			Q: {key: 'Q', code: 'KeyQ', which: 81, shiftKey: true},
			r: {key: 'r', code: 'KeyR', which: 114, shiftKey: false},
			R: {key: 'R', code: 'KeyR', which: 82, shiftKey: true},
			s: {key: 's', code: 'KeyS', which: 115, shiftKey: false},
			S: {key: 'S', code: 'KeyS', which: 83, shiftKey: true},
			t: {key: 't', code: 'KeyT', which: 116, shiftKey: false},
			T: {key: 'T', code: 'KeyT', which: 84, shiftKey: true},
			u: {key: 'u', code: 'KeyU', which: 117, shiftKey: false},
			U: {key: 'U', code: 'KeyU', which: 85, shiftKey: true},
			v: {key: 'v', code: 'KeyV', which: 118, shiftKey: false},
			V: {key: 'V', code: 'KeyV', which: 86, shiftKey: true},
			w: {key: 'w', code: 'KeyW', which: 119, shiftKey: false},
			W: {key: 'W', code: 'KeyW', which: 87, shiftKey: true},
			x: {key: 'x', code: 'KeyX', which: 120, shiftKey: false},
			X: {key: 'X', code: 'KeyX', which: 88, shiftKey: true},
			y: {key: 'y', code: 'KeyY', which: 121, shiftKey: false},
			Y: {key: 'Y', code: 'KeyY', which: 89, shiftKey: true},
			z: {key: 'z', code: 'KeyZ', which: 122, shiftKey: false},
			Z: {key: 'Z', code: 'KeyZ', which: 90, shiftKey: true},
			'!': {key: '!', code: 'Digit1', which: 33, shiftKey: true},
			'@': {key: '@', code: 'Digit2', which: 64, shiftKey: true},
			'#': {key: '#', code: 'Digit3', which: 35, shiftKey: true},
			$: {key: '$', code: 'Digit4', which: 36, shiftKey: true},
			'%': {key: '%', code: 'Digit5', which: 37, shiftKey: true},
			'^': {key: '^', code: 'Digit6', which: 94, shiftKey: true},
			'&': {key: '&', code: 'Digit7', which: 38, shiftKey: true},
			'*': {key: '*', code: 'Digit8', which: 42, shiftKey: true},
			'(': {key: '(', code: 'Digit9', which: 40, shiftKey: true},
			')': {key: ')', code: 'Digit0', which: 41, shiftKey: true},
			'`': {key: '`', code: 'Backquote', which: 96, shiftKey: false},
			'~': {key: '~', code: 'Backquote', which: 126, shiftKey: true},
			'-': {key: '-', code: 'Minus', which: 45, shiftKey: false},
			_: {key: '_', code: 'Minus', which: 95, shiftKey: true},
			'=': {key: '=', code: 'Equal', which: 61, shiftKey: false},
			'+': {key: '+', code: 'Equal', which: 43, shiftKey: true},
			'[': {key: '[', code: 'BracketLeft', which: 91, shiftKey: false},
			'{': {key: '{', code: 'BracketLeft', which: 123, shiftKey: true},
			']': {key: ']', code: 'BracketRight', which: 93, shiftKey: false},
			'}': {key: '}', code: 'BracketRight', which: 125, shiftKey: true},
			'\\': {key: '\\', code: 'Backslash', which: 92, shiftKey: false},
			'|': {key: '|', code: 'Backslash', which: 124, shiftKey: true},
			';': {key: ';', code: 'Semicolon', which: 59, shiftKey: false},
			':': {key: ':', code: 'Semicolon', which: 58, shiftKey: true},
			'\'': {key: '\'', code: 'Quote', which: 39, shiftKey: false},
			'"': {key: '"', code: 'Quote', which: 34, shiftKey: true},
			',': {key: ',', code: 'Comma', which: 44, shiftKey: false},
			'<': {key: '<', code: 'Comma', which: 60, shiftKey: true},
			'.': {key: '.', code: 'Period', which: 46, shiftKey: false},
			'>': {key: '>', code: 'Period', which: 62, shiftKey: true},
			'/': {key: '/', code: 'Slash', which: 47, shiftKey: false},
			'?': {key: '?', code: 'Slash', which: 63, shiftKey: true},
			' ': {key: ' ', code: 'Space', which: 32, shiftKey: false},
			'Delete': {key: 'Delete', code: 'Delete', which: 46, shiftKey: false},
			'Backspace': {key: 'Backspace', code: 'Backspace', which: 8, shiftKey: false},
			'Enter': {key: 'Enter', code: 'Enter', which: 13, shiftKey: false},
			'Esc': {key: 'Escape', code: 'Escape', which: 27, shiftKey: false},
		} // <-- KEY_CODES
		let REGION_SELECTOR = ':is(section,article,main,header,footer,aside,fieldset,form,[role="region"]):not([hidden])'
		let NON_BUBBLING_EVENTS = ['focus', 'blur', 'load', 'unload', 'scroll']
		let NON_CANCELABLE_EVENTS = ['focus', 'blur', 'change', 'input', 'mousewheel', 'load', 'unload', 'scroll']
		let MIN_TYPING_DELAY = 50
		let OBSERVE_ALL = {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
		}

		let ELEMENT_TYPES = Object.freeze({
			Button: 'button',
			Link: 'link',
			FormField: 'form field',
			Region: 'region',
			Any: '*',
		}) // <-- ELEMENT_TYPES

		function setFrame(node) {
			subjectFrame = node
		} // <-- setFrame

		function setURL(url) {
			subjectURL = '' + url
		} // <-- setURL

		function addRefreshHook(callback) {
			subjectRefreshHooks.push(callback)
		} // <-- addRefreshHook

		function refreshFrame(callback) {
			subjectFrame.onload = function (ev) {
				!function callNextHook() {
					let next = subjectRefreshHooks.shift()
					if (next == null) callback()
					else if (next.length > 1) {
						next(subjectFrame, callNextHook)
					}
					else {
						next(subjectFrame)
						callNextHook()
					}
				}()
			}
			subjectFrame.src = subjectURL
		} // <-- refreshFrame

		// Element query

		function fieldLabelMatches(node, matcher) {
			if (!node.labels) return

			let label = ''

			if (node.hasAttribute('aria-label')) {
				return matcher(node.getAttribute('aria-label'))
			}
			else if (node.hasAttribute('aria-labelledby')) {
				return matcher(subjectFrame.contentDocument.getElementById(node.getAttribute('aria-labelledby'))?.textContent)
			}
			else {
				for (let labelNode of node.labels) {
					// Selects and textareas are treated as part of the 'textContent'
					// of the label, so we will clone the label and remove any such
					// elements before we check the actual text.
					let labelNodeCopy = labelNode.cloneNode(true)
					labelNodeCopy.querySelectorAll('select,textarea').forEach($ => $.remove())
					if (matcher(labelNodeCopy.textContent)) return true
				}
			}
		} // <-- fieldLabelMatches

		function labelMatches(node, matcher) {
			return (
				matcher(node.textContent)
				|| matcher(node.getAttribute('aria-label'))
				|| matcher(subjectFrame.contentDocument.getElementById(node.getAttribute('aria-labelledby'))?.textContent)
			)
		} // <-- labelMatcher

		function* generateElementsByType(elementType, scope = subjectFrame.contentDocument) {
			let querySelectorAll = scope.querySelectorAll.bind(scope)

			switch (elementType) {
				case ELEMENT_TYPES.Button:
					yield* querySelectorAll(`:is(button,[role=button]):not([hidden])`)
					break
				case ELEMENT_TYPES.Link:
					yield* querySelectorAll('a[href]:not([hidden])')
					break
				case ELEMENT_TYPES.FormField:
					yield* querySelectorAll(':is(input,select,textarea):not([hidden])')
					break
				case ELEMENT_TYPES.Region:
					yield* querySelectorAll(':is(heaher,footer,section,aside,article,form,fieldset):not([hidden])')
					break
				case ELEMENT_TYPES.Any:
					yield* querySelectorAll('*')
					break
				default:
					throw Error(`Unsupported element type "${elementType}"`)
			}
		}

		function* generateElementsByLabel(elementType, label, scope) {
			let matcher = Matchers.createMatcher(label, Cleaners.collapseWhitespace)
			let nodesOfType = generateElementsByType(elementType, scope)

			switch (elementType) {
				case ELEMENT_TYPES.Button:
					for (let node of nodesOfType)
						if (labelMatches(node, matcher)) yield node
					break
				case ELEMENT_TYPES.Link:
					for (let node of nodesOfType)
						if (labelMatches(node, matcher)) yield node
					break
				case ELEMENT_TYPES.FormField:
					for (let node of nodesOfType) {
						if (fieldLabelMatches(node, matcher)) yield node
						else if (matcher(node.value)) yield node
					}
					break
				case ELEMENT_TYPES.Region:
					for (let node of nodesOfType) {
						if (labelMatches(node, matcher) || (node.matches('input,select,textarea') && (fieldLabelMatches(node, matcher) || matcher(node.value)))) {
							let $region = node.closest(REGION_SELECTOR)
							if ($region) yield $region
						}
						else if (node.matches('fieldset') && matcher(node.querySelector('legend')?.textContent)) {
							yield node
						}
					}
					break
				case ELEMENT_TYPES.Any:
					for (let node of nodesOfType)
						if (matcher(node.textContent)) yield node
					break
				default:
					throw Error(`Unsupported element type "${elementType}"`)
			}
		} // <-- generateElementsByLabel

		function getElementByLabel(elementType, label, position = 1, scope) {
			if (typeof position == 'object') {
				scope = position
				position = 1
			}
			let i = position
			for (let element of generateElementsByLabel(elementType, label)) {
				i--
				if (!i) return element
			}
		} // <-- getElementByLabel

		function getElementsByLabel(elementType, label, scope) {
			return Array.from(generateElementsByLabel(elementType, label, scope))
		} // <-- getElementsByLabel

		function getElementByType(elementType, scope) {
			for (let node of generateElementsByType(elementType, scope)) return node
		} // <-- getElmentByType

		// Assertions

		function isVisible(element) {
			return element.offsetParent != null
		} // <-- isVisible

		function containsLabeledElement(node, elementType, label) {
			let targetElement = getElementByLabel(elementType, label, node)
			if (targetElement == null) return false
			return node.contains(targetElement)
		} // <-- containsElement

		function containsAnyElement(node, elementType) {
			let targetElement = getElementByType(elementType)
		}

		// Interaction

		function dispatchEventChain(node, events) {
			// A highly inaccurate way of approximating prevented defaults, but
			// good enough in most cases.
			for (let [type, init = {}] of events) {
				let ev = dispatchEvent(node, type, init)
				if (NON_CANCELABLE_EVENTS.includes(type)) continue
				if (ev.defaultPrevented) return ev
			}
		} // <-- dispatchEventChain

		function dispatchEvent(node, type, init = {}) {
			let EventCtor = Event
			let ev

			// For some events, select a more appropriate constructor
			if (type.startsWith('key')) EventCtor = KeyboardEvent
			if (type.startsWith('pointer')) EventCtor = PointerEvent
			if (type.startsWith('mouse')) EventCtor = MouseEvent
			if (type.startsWith('drag')) EventCtor = DragEvent

			init.bubbles = !NON_BUBBLING_EVENTS.includes(type)
			init.cancelable = !NON_CANCELABLE_EVENTS.includes(type)

			ev = new EventCtor(type, init)

			// These events require the methods to be called, but do not dispatch
			// events, so we still need to dispatch the event later.
			if (type == 'focus') node.focus()
			if (type == 'blur') node.focus()

			// For click event, calling Element.click() will dispatch the event,
			// so we don't need to dispatch it separately.
			if (type == 'click') node.click()
			else node.dispatchEvent(ev)

			return ev
		} // <-- dispatchEvent

		function blur(node) {
			if (!node) return
			// Remove focus from an element
			if (node.__originalValue && node.__originalValue !== node.value) {
				// Value of an input changed so we emit the change event
				dispatchEvent(node, 'change')
				delete node.__originalValue
			}
			dispatchEventChain(node, HAS_TOUCH ? [
				['mouseleave'],
				['mouseout'],
				['blur'],
			] : [
				['pointerleave'],
				['mouseleave'],
				['blur'],
			])
			dispatchEvent(node, 'blur')
		} // <-- blur

		function keyPress(node, init) {
			// Simulate the entire keypress event cycle
			dispatchEvent(node, 'keydown', init)
			dispatchEvent(node, 'keyup', init)
			dispatchEvent(node, 'keypress', init)
		} // <-- keyPress

		function clickElement(node) {
			let activeElement = subjectFrame.contentDocument.activeElement
			let alreadyHasFocus = activeElement == node
			let events

			if (!alreadyHasFocus) blur(activeElement)

			if (HAS_TOUCH) {
				events = [
					['pointerover'],
					['pointerenter'],
					['pointerdown'],
					['touchstart'],
					['pointerup'],
					['pointerout'],
					['pointerleave'],
					['touchend'],
					['mouseover'],
					['mouseenter'],
					['mousemove'],
					['mousedown'],
				]
				if (!alreadyHasFocus) events.push(['focus'])
				events.push(
					['mouseup'],
					['click'],
				)
			}
			else {
				events = alreadyHasFocus
					? []
					: [
						['pointerover'],
						['pointerenter'],
						['mouseover'],
						['mouseenter'],
					]
				events.push(
					['pointerdown'],
					['mousedown'],
				)
				if (node != subjectFrame.contentDocument.activeElement) events.push(['focus'])
				events.push(
					['pointerup'],
					['mouseup'],
					['click'],
					['pointermove'],
					['mousemove'],
				)
			}
			dispatchEventChain(node, events)

			// Some special cases where clicking also changes the value
			if (node.tagName == 'INPUT' && node.type == 'checkbox') {
				dispatchEvent(node, 'change')
			}
			if (node.tagName == 'INPUT' && node.type == 'radio' && !node.checked) {
				dispatchEvent(node, 'change')
			}
		}

		function doubleClick(node) {
			clickElement(node)
			clickElement(node)
			dispatchEvent(node, 'dblclick')
		} // <-- doubleClick

		function click(elementType, label, position = 1) {
			// Click an element with specified type and label. The third
			// parameter is the order fo the element in the list of all
			// matching element.
			let targetElement = getElementByLabel(elementType, label, position)
			clickElement(targetElement)
		} // <-- clickElement

		function typeIntoFocusedField(text, done) {
			let targetElement = subjectFrame.contentDocument.activeElement

			if (!targetElement) throw Error(`No focused element found`)

			// Remember the original value before typing in order to simulate
			// the change event on blur.
			targetElement.__originalValue ??= targetElement.value
			let chars = text.split('')

			!function typeNextChar() {
				if (!chars.length) return done()
				let chr = chars.shift()
				targetElement.value += chr
				keyPress(targetElement, KEY_CODES[chr] || {key: chr, shiftKey: false})
				dispatchEventChain(targetElement, [
					['beforeinput'],
					['input'],
				])
				this.setTimeout(typeNextChar, MIN_TYPING_DELAY + Math.random() * 50)
			}()
		} // <-- typeIntoFocusedField

		function pasteIntoFocusedField(text) {
			let targetElement = subjectFrame.contentDocument.activeElement
			targetElement.__originalValue ??= targetElement.value
			keyPress(targetElement, {...KEY_CODES.v, ctrlKey: true})
			targetElement.value += text
			dispatchEvent(targetElement, 'input')
		} // <-- pasteIntoFocusedField

		function clearFocusedField() {
			let targetElement = subjectFrame.contentDocument.activeElement
			targetElement.__originalValue ??= targetElement.value
			doubleClick(targetElement)
			keyPress(targetElement, {...KEY_CODES.Delete})
			targetElement.value = ''
			dispatchEvent(targetElement, 'input')
		} // <-- clearFocusedField

		// Timings

		function waitForContentToUpdate(callback) {
			// FIXME: Observing the entire tree is super-expensive.
			// However, for removals, this is the only way. Creating
			// a separate observer just for removals to speed up
			// additions is silly. So for now, no good solution.
			let observer = new MutationObserver(function (_ignored, observer) {
				observer.disconnect()
				callback()
			})
			setTimeout(function () {
				observer.disconnect()
			}, 5000)
			observer.observe(subjectFrame.contentDocument, OBSERVE_ALL)
		} // <-- waitForContentToUpdate

		// Integration

		function useChai() {
			// FIXME: For negative result, we always get Error: Script error. (:0)

			chai.Assertion.addProperty('visible', function (node) {
				let obj = chai.util.flag(this, 'object')
				let result = isVisible(obj)
				this.assert(
					result,
					'expected #{this} to be visible',
					'expected #{this} to be hidden',
				)
			})

			chai.Assertion.addMethod('containElement', function (elementType, label) {
				let obj = chai.util.flag(this, 'object')
				let result = containsLabeledElement(obj, elementType, label)
				this.assert(
					result,
					`expected #{this} to contain a ${elementType} element labelled "${label}"`,
					`expected #{this} not to contain a ${elementType} element labelled "${label}"`,
				)
			})

			chai.Assertion.addMethod('containAnyElement', function (elementType) {
				let obj = chai.util.flag(this, 'object')
				let result = containsAnyElement(obj, elementType)
				this.assert(
					result,
					`expected #{this} to contain a ${elementType} element`,
					`expected #{this} not to contain a ${elementType} element`,
				)
			})
		} // <-- useChai

		// Exports

		return {
			ELEMENT_TYPES,
			setFrame,
			setURL,
			addRefreshHook,
			refreshFrame,

			getElementByLabel,
			getElementsByLabel,

			keyPress,
			click,
			typeIntoFocusedField,
			pasteIntoFocusedField,
			clearFocusedField,

			waitForContentToUpdate,

			isVisible,
			useChai,
		}
	}()) // <-- DOMTest

	window.XHRTest = (function () {
		let subjectFrame
		let fixtures = new Map()

		function addFixture(pattern, fixture) {
			fixtures.set(pattern, fixture)
		} // <-- addFixture

		function register(subjectFrameNode, callback) {
			subjectFrame = subjectFrameNode

			let script = Object.assign(document.createElement('script'), {
				async: true,
				src: 'https://unpkg.com/xhook/dist/xhook.min.js',
			})
			script.onload = function () {
				subjectFrame.contentWindow.xhook.before(function (request, requestHookCallback) {
					for (let [pattern, fixture] of fixtures) {
						if (!pattern.test(request.url)) continue
						setTimeout(function () {
							requestHookCallback(fixture)
						})
					}
				})
				callback()
			}
			subjectFrameNode.contentDocument.head.append(script)
		} // <-- register

		return {
			addFixture,
			register,
		}
	}())
} // <-- dom-testing