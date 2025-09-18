/** @note `computedStyleMap()` is only available in Chromium-based browsers. */
export const el2imgBlob = async (el: Element) => {
	// setup vector (svg)
	const styleMap = el.computedStyleMap()
	const style = Array.from(styleMap)
		.map(([prop, value]) => `${prop}: ${(Array.from(value)[0] + '').replace(/"/g, `'`)};`)
		.join(' ')

	const [width, height] = el2dimensions(el, styleMap)
	const type = el.tagName

	const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
		<foreignObject width="100%" height="100%">
			<${type} xmlns="http://www.w3.org/1999/xhtml" style="${style}">${el.innerHTML}</${type}>
		</foreignObject>
	</svg>`

	// setup raster (jpg)
	const img = await loadImg(`data:image/svg+xml,${encodeURIComponent(svgString)}`)
	const canvas = new OffscreenCanvas(width, height)
	const context = canvas.getContext('2d')!

	context.fillStyle = '#fff'
	context.fillRect(0, 0, width, height)
	context.drawImage(img, 0, 0, width, height)

	return canvas.convertToBlob({type: 'image/jpeg', quality: 0.7})
}

const MARGINS = 'top,bottom,left,right'.split(',').map(side => 'margin-' + side)

/** @returns an element's [width, height] plus their margins. */
const el2dimensions = (el: Element, styleMap = el.computedStyleMap()) => {
	const {height: h, width: w} = el.getBoundingClientRect()
	const [t, b, l, r] = MARGINS.map(prop =>
		parseInt(styleMap.get(prop)!.toString()!.match(/^\d+/)?.[0] ?? '0')
	)
	return [~~w + l + r, ~~h + b + t]
}
const loadImg = async (src: string, img = new Image()) =>
	new Promise<HTMLImageElement>((resolve, reject) =>
		Object.assign(img, {
			onerror: () => reject(new Error(`Failed to load image from ${src}`)),
			onload: () => resolve(img),
			src,
		})
	)
