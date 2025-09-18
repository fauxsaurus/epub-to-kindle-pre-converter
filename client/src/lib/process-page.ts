import {el2imgBlob} from './el2img-blob'
import type {IReplacementText} from './types'

export const processPage = async (
	doc: Document,
	pageName: string,
	text2convert: IReplacementText[]
) => {
	// query elements to replace
	const elements2replace = text2convert.flatMap(replacementText => {
		const imgTexts = doc.querySelectorAll(replacementText.imageText)
		const altTexts = replacementText.altText
			? doc.querySelectorAll(replacementText.altText)
			: []
		const {className} = replacementText

		return Array.from(imgTexts).map((imgTextEl, i) => {
			return {imgText: imgTextEl, altTextEl: altTexts[i] ?? undefined, className}
		})
	})

	if (!elements2replace.length) return {html: '', imgs: []}

	// generate images
	const imgs = await Promise.all(
		elements2replace.map(async ({altTextEl, className, imgText}, i) => {
			const altText = getAltText(altTextEl ?? imgText)
			const blob = await el2imgBlob(imgText)
			const previewUrl = URL.createObjectURL(blob)
			const src = `../kindle-accessible/img-${pageName}-${i + 1}.jpg`

			const alt = altText

			altTextEl?.remove()
			imgText.after(Object.assign(doc.createElement('img'), {alt, class: className, src}))
			imgText.remove()

			return {altText, blob, className, src, previewUrl}
		})
	)

	// get new HTML
	doc.head.innerHTML += `<link href="../kindle-accessible/style.css" rel="stylesheet" type="text/css"/>`

	const html = await fetch(doc.location.href, {method: 'GET'})
		.then(async response => {
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

			const doctype = (await response.text()).split(/<(html|head)/)[0]

			return doctype + doc.querySelector('html')!.outerHTML
		})
		.catch(console.error)

	return {html, imgs}
}

const MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}

type IEntity = keyof typeof MAP

/** @note strips HTML and escapes for HTML attributes */
const getAltText = (el: Element) =>
	el.innerHTML.replace(/<\w[^>]+>/g, '').replace(/[&<>"']/g, match => MAP[match as IEntity])
