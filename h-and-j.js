// Based on http://github.com/aristus/sweet-justice
function copy_protect(e) {
	"use strict";

	var body = document.getElementsByTagName('body')[0];
	var shyphen = /(?:\u00AD|\&#173;|\&shy;)/g;
	var shadow = document.createElement('div');
	shadow.style.overflow = 'hidden';
	shadow.style.position = 'absolute';
	shadow.style.top = '-5000px';
	shadow.style.height = '1px';
	body.appendChild(shadow);

	// FF3, WebKit
	// IE9 includes support for this style of selection, but the selectAllChildren call fails with an "Unspecified error"
	if(!$.browser.msie && typeof window.getSelection !== 'undefined') {
		var sel = window.getSelection();
		var range = sel.getRangeAt(0);
		shadow.appendChild(range.cloneContents());
		shadow.innerHTML = shadow.innerHTML.replace(shyphen, '');
		sel.selectAllChildren(shadow);
		window.setTimeout(function() {
			shadow.parentNode.removeChild(shadow);
			if(typeof window.getSelection().setBaseAndExtent !== 'undefined') {
				sel.setBaseAndExtent(range.startContainer,
				                     range.startOffset,
				                     range.endContainer,
				                     range.endOffset);
			}
		}, 0);
	// Internet Explorer
	} else {
		var sel = document.selection;
		var range = sel.createRange();
		shadow.innerHTML = range.htmlText.replace(shyphen, '');
		var range2 = body.createTextRange();
		range2.moveToElementText(shadow);
		range2.select();
		window.setTimeout(function() {
			shadow.parentNode.removeChild(shadow);
			if(range.text !== '') {
				range.select();
			}
		}, 0);
	}
	return;
}

function hyphenate_and_justify(options) {
	"use strict";

	var profile = Object.isDefined(options.profile) ? options.profile : false;
	
	if(profile && Object.isDefined(window.time)) {
		profile = window.time;
	} else {
		profile = {
			start: function() {},
			stop: function() {}
		}
	}

	var console = window.console || {
		log: function() {}
	};

	profile.start("hyphenate_and_justify");

	var useFractionalSpacingsDefault = $.browser.msie || $.browser.mozilla;
	var useFractionalSpacings = Object.isDefined(options.usefractions) ? options.usefractions : useFractionalSpacingsDefault;
	var targetAlignment = /*options.alignment || */'justify';
	var minimumHyphenationLength = options.minimumHyphenationLength || 6;
	var maximumLinebreakTolerance = options.linebreakTolerance || 5;
	var cacheMeasurements = Object.isDefined(options.cacheMeasurements) ? options.cacheMeasurements : true;
	var limitCache = Object.isDefined(options.limitCache) ? options.limitCache : false;
	var hyphenate = Object.isDefined(options.hyphenate) ? options.hyphenate : true;
	var protectCopying = Object.isDefined(options.protectCopying) ? options.protectCopying : true;

	var defaultLanguage = options.defaultLanguage || 'en';
	var overrideLanguage = options.overrideLanguage;
	
	function find_language(element) {
		if(overrideLanguage) {
			return overrideLanguage;
		}
		do {
			if($(element).attr('lang')) {
				return $(element).attr('lang');
			}
		} while((element = element.parentNode) != null) 
		return defaultLanguage;
	}
	
	var floatVersion = parseFloat($.browser.version);
	var supported = ($.browser.msie && floatVersion >= 9.0) ||
	                ($.browser.mozilla && floatVersion >= 2.0) ||
	                ($.browser.opera && floatVersion >= 11.0) ||
	                ($.browser.webkit && floatVersion >= 533.16);

	function browserJustify(element) {
		if(hyphenate) {
			Hyphenator.hyphenate(element, find_language(element));
		}
		$(element).css('text-align', targetAlignment);
		if($.browser.msie) {
			$(element).css('-ms-text-justify', 'newspaper');
		}
	}

	if(!supported) {
		console.log("not supported in this browser--falling back to browser justification");
		$(options.pattern).bind('copy', copy_protect);
		$(options.pattern).each(function(index, element) {
			browserJustify(element);
		});
		return;
	}

	var space = {
	    	width: 0,
	    	stretch: 0,
	    	shrink: 0
	    },
	    hyphenPenalty = 100;

	var measurementCache = {};
	var cacheables = {
		' ': true,
		'-': true,
		'\u2014': true,
		'\u00ad': true,
		'\u00a0': true,
		'the': true,
		'and': true
	};
	var cacheHits = 0, cacheMisses = 0;

	if(protectCopying) {
		$(options.pattern).bind('copy', copy_protect);
	}
	$(options.pattern).not('#ruler').each(function(index, element) {
		var ruler = element.cloneNode(false);
		ruler.id = 'ruler';
		$(ruler).css({
			visibility: 'hidden',
			position: 'absolute',
			width: 'auto',
			'max-width': 'none',
			display: 'inline',
			top: '-8000px',
			left: '-8000px',
			'text-indent': '0em'
		});

		$(element.parentNode).append(ruler);
		var rulerMeasurer = ruler;

		function measure(str) {
			function measureCore(str) {
				var div = document.createElement('div');
				div.appendChild(document.createTextNode(str));
				rulerMeasurer.appendChild(div);
				var result = parseFloat(document.defaultView.getComputedStyle(div, null).getPropertyValue('width'));
				rulerMeasurer.removeChild(div);
				return result;
			}
			if(cacheMeasurements && (!limitCache || str in cacheables)) {
				if(!(ruler.innerHTML in measurementCache)) {
					measurementCache[ruler.innerHTML] = {};
				}
				var subCache = measurementCache[ruler.innerHTML];
				if(!(str in subCache)) {
					++cacheMisses;
					subCache[str] = { width: measureCore(str), hits: 0 };
				} else {
					++cacheHits;
				}
				var cacheEntry = subCache[str];
				++cacheEntry.hits;
				return cacheEntry.width;
			} else {
				return measureCore(str);
			}
		}
		
		function measureEx(str) {
			var div = document.createElement('div');
			div.appendChild(document.createTextNode(str));
			rulerMeasurer.appendChild(div);
			var result = parseFloat(document.defaultView.getComputedStyle(div, null).getPropertyValue('width'));
			var ml = parseFloat($(rulerMeasurer).css('margin-left')),
			    bl = parseFloat($(rulerMeasurer).css('border-left-width')),
			    pl = parseFloat($(rulerMeasurer).css('padding-left')),
			    pr = parseFloat($(rulerMeasurer).css('padding-right')),
			    br = parseFloat($(rulerMeasurer).css('border-right-width')),
			    mr = parseFloat($(rulerMeasurer).css('margin-right'));
			rulerMeasurer.removeChild(div);
			return {
				left: ml + bl + pl,
				width: result,
				right: pr + br + mr
			};
		}

		function measureAvailableDimensions(element) {
			var targetHeight = $(element).height();
			var maxWidth = $(element).width();

			var lengths = [];
			
			// FF 4, like IE9, uses DirectWrite and has sub-pixel positioning. For some reason, it occasionally seems to create lines
			// that are _ever_so_slightly_ too long. As I can't see any reason for this (all the lines in a block will be right except
			// one or two at random), I'm making a crude hack: make the bounding box 1px smaller on FF, so even with slight overflow
			// we'll be safe.
			var fixup = $.browser.mozilla ? -1.0 : 0.0;

			var measuringImage = document.createElement('img');
			measuringImage.width = 1;
			measuringImage.height = 1;
			measuringImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP%2F%2F%2F%2F%2F%2F%2FyH5BAEAAAEALAAAAAABAAEAAAICTAEAOw%3D%3D';
			$(measuringImage).css({
				margin: '0',
				border: '0',
				padding: '0',
				display: 'inline'
			});

			var measurer = element.cloneNode(false);
			element.parentNode.insertBefore(measurer, element);
			var endPoint = measuringImage.cloneNode(true);
			// for whatever reason, text-indent doesn't indent images, even if those images are set as inline.
			// Instead, it only indents actual text. This is in spite of the spec saying that it applies to
			// inline content (not merely text). Fortunately, a zero width space is proper inline content,
			// and doesn't throw out the spacings.
			measurer.appendChild(document.createTextNode('\u200b'));
			measurer.appendChild(endPoint);
			do {
				var baseline = endPoint.offsetTop;

				var maxSuccessful = 0;
				var minUnsuccessful = maxWidth + 1;

				var spacer = measuringImage.cloneNode(true);
				spacer.width = maxSuccessful;
				measurer.insertBefore(spacer, endPoint);
				while((minUnsuccessful - maxSuccessful) > 4) {
					// too long
					if(endPoint.offsetTop != baseline) {
						minUnsuccessful = Math.min(minUnsuccessful, spacer.width);
					// too short
					} else {
						maxSuccessful = Math.max(maxSuccessful, spacer.width);
					}
					spacer.width = maxSuccessful + ((minUnsuccessful - maxSuccessful ) / 2);
				}
				spacer.width = maxSuccessful;
				while(endPoint.offsetTop == baseline) {
					++maxSuccessful;
					++spacer.width;
				}
				measurer.insertBefore(document.createElement('br'), endPoint);
				lengths.push(maxSuccessful + fixup);
			} while($(measurer).height() < targetHeight);
			$(measurer).remove();
			return lengths;
		}

		profile.start("measureAvailableDimensions");
		var lineLengths = measureAvailableDimensions(element);
		profile.stop("measureAvailableDimensions");

		function buildNodeList(element) {
			function buildNodeListInner(root) {
				var lang = find_language(root);
				var result = [];
				var structuredResult = [];

				for(var i = 0, l = root.childNodes.length; i < l; ++i) {
					var node = root.childNodes[i];
					switch(node.nodeType) {
					case Node.ELEMENT_NODE: {
							var el = node.cloneNode(false);
							$(el).css('display', 'inline-block');
							rulerMeasurer.appendChild(el);
							rulerMeasurer = el;
							var x = buildNodeListInner(node, node);
							var baseWidth = measureEx('');
							rulerMeasurer = rulerMeasurer.parentNode;
							rulerMeasurer.removeChild(el);

							for(var j = 0; j < x.result.length; ++j) {
								if(x.result[j].type === 'box') {
									x.result[j].width += baseWidth.left;
									break;
								}
							}

							for(var j = x.result.length; j > 0; --j) {
								if(x.result[j - 1].type === 'box') {
									x.result[j - 1].width += baseWidth.right;
									break;
								}
							}

							result = result.concat(x.result);
							structuredResult.push(linebreak.element(x.structuredResult, node));
						}
						break;
					case Node.TEXT_NODE: {
							var words = node.nodeValue.split(/(\u0020|\u00a0)/); // any special spacing (zero width, quarter em, etc.) should be left as-is.
							words.forEach(function (word, index, array) {
								if(!word.match(/\u0020|\u00a0/)) {
									var hyphenated = [];
									if(hyphenate && word.length > minimumHyphenationLength) {
										var hh = Hyphenator.hyphenate(word, lang).split(/([-\u00ad])/);
										// hyphenator doesn't break words with hard hyphens (to avoid e.g. "Hew-lett-Pack-ard") but we want 
										// to treat them as linebreak opportunities
										for(var j = 0; j < hh.length; ++j) {
											if(hh[j] === '-' && hyphenated.length > 0) {
												hyphenated[hyphenated.length - 1] += '-';
											} else if(hh[j] !== '\u00ad') {
												hyphenated.push(hh[j]);
											}
										}
									}

									if(hyphenated.length > 1) {
										hyphenated.forEach(function (part, partIndex, partArray) {
											result.push(linebreak.box(measure(part), part));
											structuredResult.push(result[result.length - 1]);

											if(partIndex !== partArray.length - 1 && !part.match(/.*-/)) {
												result.push(linebreak.penalty(measure('-'), hyphenPenalty, 1));
												structuredResult.push(result[result.length - 1]);
											}
										}, this);
									} else {
										result.push(linebreak.box(measure(word), word));
										structuredResult.push(result[result.length - 1]);
									}
								} else {
									var emWidth = measure('\u2014');
									space.width = measure('\u00a0');
									space.stretch = ((space.width * 3) / 6);
									space.shrink = ((space.width * 3) / 9);
									switch(targetAlignment) {
									case 'justify': {
											result.push(linebreak.glue(space.width, space.stretch, space.shrink));
											structuredResult.push(result[result.length - 1]);
										}
										break;
									case 'centre': {
											result.push(linebreak.glue(0, emWidth, 0));
											structuredResult.push(result[result.length - 1]);
											result.push(linebreak.penalty(0, 0, 0));
											structuredResult.push(result[result.length - 1]);
											result.push(linebreak.glue(space.width, -2 * emWidth, 0));
											structuredResult.push(result[result.length - 1]);
											result.push(linebreak.box(0, ''));
											structuredResult.push(result[result.length - 1]);
											result.push(linebreak.penalty(0, linebreak.defaults.infinity, 0));
											structuredResult.push(result[result.length - 1]);
											result.push(linebreak.glue(0, emWidth, 0));
											structuredResult.push(result[result.length - 1]);
										}
										break;
									case 'left':
									case 'right': {
											result.push(linebreak.glue(0, emWidth, 0));
											structuredResult.push(result[result.length - 1]);
											result.push(linebreak.penalty(0, 0, 0));
											structuredResult.push(result[result.length - 1]);
											result.push(linebreak.glue(space.width, -emWidth, 0)); 
											structuredResult.push(result[result.length - 1]);
										}
										break;
									}
								}

							}, node);
						}
						break;
					}
				}
				return { result: result, structuredResult: structuredResult };
			}

			var x = buildNodeListInner(element, null);

			var nodes = x.result;

			switch(targetAlignment) {
			case 'left':
			case 'right':
			case 'justify': {
					nodes.push(linebreak.glue(0, linebreak.defaults.infinity, 0, null));
					x.structuredResult.push(nodes[nodes.length - 1]);
					nodes.push(linebreak.penalty(0, -linebreak.defaults.infinity, 1, null));
					x.structuredResult.push(nodes[nodes.length - 1]);
				}
				break;
			case 'centre': {
					var emWidth = measure('\u2014');
					
					nodes.unshift(linebreak.glue(0, emWidth, 0));
					x.structuredResult.unshift(nodes[0]);
					nodes.unshift(linebreak.box(0, ''));
					x.structuredResult.unshift(nodes[0]);
					
					nodes.push(linebreak.glue(0, emWidth, 0));
					x.structuredResult.push(nodes[nodes.length - 1]);
					nodes.push(linebreak.penalty(0, -linebreak.defaults.infinity, 0));
					x.structuredResult.push(nodes[nodes.length - 1]);
				}
				break;
			}
			var structuredNodes = {
				type: 'element',
				value: x.structuredResult,
				template: element,
				width: x.result.filter(function(n) {
					return n.type !== 'penalty';
				}).reduce(function(original, next) { 
					return original + next.width;
				}, 0)
			};
			
			return { nodes: nodes, structuredNodes: linebreak.element(x.structuredResult, element) };
		}
		
		var nodes = null,
		    structuredNodes = null;
		
		(function() {
			profile.start("buildNodeList");
			var x = buildNodeList(element);
			profile.stop("buildNodeList");
			nodes = x.nodes;
			structuredNodes = x.structuredNodes;
		})();

		if(nodes.length === 2) {
			return;
		}

		profile.start("linebreak");
		// Perform the line breaking
		var tol = 0;
		var breaks = [];
		do {
			breaks = linebreak(nodes, lineLengths, {tolerance: ++tol});
		} while(breaks.length == 0 && tol < maximumLinebreakTolerance);
		profile.stop("linebreak");
		if(breaks.length == 0) {
			console.log("could not find any suitable breaks");
			browserJustify(element);
			$(ruler).remove();
			return;
		}

		// Build lines from the line breaks found.
		var lineStart = 0;
		var lines = [];
		for(var i = 1; i < breaks.length; ++i) {
			lines.push({ ratio: breaks[i].ratio, nodes: nodes.slice(lineStart, breaks[i].position + 1) });
			lineStart = breaks[i].position + 1;
		}
		
		lines.forEach(function(line) {
			for(var i = 0; i < line.nodes.length; ++i) {
				if(line.nodes[i].type === 'box' || (line.nodes[i].type === 'penalty' && line.nodes[i].penalty === -linebreak.defaults.infinity)) {
					break;
				}
				line.nodes[i].type = 'ignore-' + line.nodes[i].type;
			}
		});

		// TODO this is not actually right, the spaces are not of uniform size--perhaps iterate through and calculate a mean of all shrinks/stretches found in the line
		space.width = measure('\u00a0');
		// presume a space is 1/3 em, that you can stretch to 2/3 em, and shrink to 1/6 em
		space.stretch = ((space.width * 3) / 6);
		space.shrink = ((space.width * 3) / 9);

		function structuredIterator(root, startElement, closeElement) {
			this.stack = [{ node: root, index: 0}];
			this.topOfStack = this.stack[this.stack.length - 1];
			this.startElement = startElement || function() {};
			this.closeElement = closeElement || function() {};
			this.moveNext = function() {
				if(this.stack.length == 0) { 
					return false;
				}
				++this.topOfStack.index;

				if(this.topOfStack.index >= this.topOfStack.node.value.length) {
					if(this.stack.length > 1) {
						this.closeElement(this.topOfStack.node.template);
					}

					this.stack.pop();
					if(this.stack.length == 0) { 
						return false;
					}
					this.topOfStack = this.stack[this.stack.length - 1];

					return this.moveNext();
				}
				this.drillDown();
				return true;
			}

			this.drillDown = function() {
				while(this.topOfStack.node.value.length > 0 && this.topOfStack.node.value[this.topOfStack.index].type === 'element') {
					this.stack.push({ node: this.topOfStack.node.value[this.topOfStack.index], index: 0});
					this.topOfStack = this.stack[this.stack.length - 1];

					this.startElement(this.topOfStack.node.template);

					if(this.topOfStack.node.value.length == 0) {
						return this.moveNext();
					}
				}
			}
			this.current = function() {
				return this.stack.length > 0 ? this.topOfStack.node.value[this.topOfStack.index] : null;
			}

			this.drillDown();
		};

		var tagOutput = document.createDocumentFragment();
		var currentWriteDestination = tagOutput;

		var wordSpace = Number.NaN;

		function createSpacedSpan() {
			var e = document.createElement('span');
			// white-space: nowrap; display: inline-block;
			$(e).attr("style", "word-spacing: " + wordSpace.toFixed(useFractionalSpacings ? 2 : 0) + "px;");
			return e;
		}

		function pushSpacing() {
			if(!isNaN(wordSpace)) {
				var s = createSpacedSpan();
				currentWriteDestination.appendChild(s);
				currentWriteDestination = s;
			}
		}

		function popSpacing() {
			if(!isNaN(wordSpace)) {
				currentWriteDestination = currentWriteDestination.parentNode;
			}
		}

		var iter = new structuredIterator(structuredNodes, function(elt) {
			popSpacing();
			var e = elt.cloneNode(false);
			currentWriteDestination.appendChild(e);
			currentWriteDestination = e;
			pushSpacing();
		}, function(elt) {
			popSpacing();
			currentWriteDestination = currentWriteDestination.parentNode;
			pushSpacing();
		});

		profile.start("lines.forEach");

		var carryOver = null;
		lines.forEach(function (line, lineIndex, lineArray) {
			var totalAdjustment = 0;
			wordSpace = line.ratio * (line.ratio < 0 ? space.shrink : space.stretch);
			var integerWordSpace = Math.round(wordSpace);
			var spaces = line.nodes.reduce(function(original, next, index, array) {
				if(next.type === 'glue' && next.width > 0 && index !== array.length - 1) {
					return original + 1;
				} else {
					return original;
				}
			}, 0);
			var spacesToAdjust = 0;

			function roundToCents(x) {
				x *= 100;
				x = Math.floor(x);
				x /= 100;
				return x;
			}

			if(useFractionalSpacings) {
				// fractional spacing adjustments should be ideal no matter what (so are a better fit for devices like printers where 1 
				// CSS px is 3-6 printer pixels, and high resolution is feasible.
				// However, this is complicated a little by Internet Explorer rounding to the nearest hundredth of a pixel, which can push me slightly high.
				// I want to unconditionally round down (to tend towards tighter spacing, which is safe, rather than looser, which causes spurious breaks)
				// so I can't use toFixed (as that is round-to-nearest)
				wordSpace = roundToCents(wordSpace);
			} else {
				// integral spacing adjustments, however, will tend to cause the spacing to be a little bit high or a little bit low
				// so we split the line into two, the first portion tending to be a little under, the second a little over (or vice versa)
				// this will tend to produce better output on screen

				var adjustment = wordSpace - integerWordSpace;
				var integerAdjustment = adjustment < 0 ? Math.floor(adjustment) : Math.ceil(adjustment);
				totalAdjustment = Math.round(adjustment * spaces);
				spacesToAdjust = Math.abs(totalAdjustment);
				// for first portion of line, use the adjusted width, then for the remainder the normal integer width
				wordSpace = integerWordSpace + integerAdjustment;
			}

			pushSpacing();
			line.nodes.forEach(function (n, index, array) {
				if(!useFractionalSpacings && totalAdjustment != 0 && spacesToAdjust == 0) {
					totalAdjustment = 0;
					popSpacing();
					wordSpace = integerWordSpace;
					pushSpacing();
				}

				switch(n.type) {
				case 'box':
					if(carryOver !== null) {
						currentWriteDestination.appendChild(carryOver);
						currentWriteDestination.appendChild(document.createTextNode('\u00ad'));
						carryOver = null;
					}
					currentWriteDestination.appendChild(document.createTextNode(n.value));
					break;
				case 'glue':
					if(n.width > 0) {
						if(index !== array.length - 1) {
							--spacesToAdjust;
							if($.browser.opera) {
								// opera doesn't apply word-spacing to &nbsp;. WTF!
								currentWriteDestination.appendChild(document.createTextNode(' '));
							} else {
								currentWriteDestination.appendChild(document.createTextNode('\u00a0'));
								//currentWriteDestination.appendChild(document.createTextNode(' '));
							}
						} else {
							currentWriteDestination.appendChild(document.createTextNode(' '));
						}
					}
					break;
				case 'penalty':
					if(index === array.length - 1) {
						switch(n.penalty) {
						case hyphenPenalty:
							if($.browser.webkit || $.browser.opera) {
								// WebKit and Opera shit the bed because they can't break <span>hy&shy;</span><span>phen</span>, so we hold
								// this over and put it on the "next line", so the hyphen goes all in one span.
								carryOver = currentWriteDestination.removeChild(currentWriteDestination.lastChild);
							} else {
								currentWriteDestination.appendChild(document.createTextNode('\u00ad'));
							}
							break;
						case 0:
							currentWriteDestination.appendChild(document.createTextNode(' '));
							break;
						default:
							if(currentWriteDestination.lastChild !== null && (currentWriteDestination.lastChild.nodeValue === ' ' || currentWriteDestination.lastChild.nodeValue === '\u00a0')) {
								currentWriteDestination.removeChild(currentWriteDestination.lastChild);
							}
							break;
						}
					}
					break;
				}
				iter.moveNext();
			});
			popSpacing();
		});
		profile.stop("lines.forEach");

		$(element).empty();
		element.appendChild(tagOutput);
		// Opera and WebKit won't break soft hyphens across text nodes. Fusing the text nodes fixes this.
		// This doesn't, alas, resolve their inability to break soft hyphens across elements.
		// see https://bugs.webkit.org/show_bug.cgi?id=56269
		element.normalize();

		$(ruler).remove();
		
		return;
	});
	
//	var cacheArr = [];
//	for(var x in measurementCache) {
//		for(var y in measurementCache[x]) {
//			cacheArr.push({ text: y, hits: measurementCache[x][y].hits });
//		}
//	}
//	cacheArr.sort(function(a, b) {
//		return a.hits - b.hits;
//	});
//	console.log("cache hits: " + cacheHits + " cache misses: " + cacheMisses);
	profile.stop("hyphenate_and_justify");
}
