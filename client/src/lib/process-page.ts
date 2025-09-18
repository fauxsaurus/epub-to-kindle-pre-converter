import {el2imgBlob} from './el2img-blob'
import {getFile} from './request'
import type {ICssRules, IReplacementText} from './types'

export const processPage = async (
	doc: Document,
	{preCSS, pageName}: {preCSS: ICssRules; pageName: string},
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

	const style = Object.assign(doc.createElement('style'), {innerHTML: preCSS})
	if (preCSS) doc.head.append(style)

	// generate images
	const imgs = await Promise.all(
		elements2replace.map(async ({altTextEl, className, imgText}, i) => {
			const alt = getAltText(altTextEl ?? imgText)
			const blob = await el2imgBlob(imgText)
			const previewUrl = URL.createObjectURL(blob)
			const src = `../kindle-accessible/img-${pageName}-${i + 1}.jpg`

			altTextEl?.remove()
			imgText.after(Object.assign(doc.createElement('img'), {alt, class: className, src}))
			imgText.remove()

			return {altText: alt, blob, className, src, previewUrl}
		})
	)

	if (preCSS) style.remove()

	// get new HTML
	doc.head.innerHTML += `<link href="../kindle-accessible/style.css" rel="stylesheet" type="text/css"/>`

	const {data: oldHtml, errors} = await getFile(doc.location.href)
	if (errors.length) throw new Error(errors[0])

	const doctype = (await oldHtml!.text()).split(/<(html|head)/)[0]
	const html = doctype + doc.querySelector('html')!.outerHTML

	return {html, imgs}
}

const MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}

type IEntity = keyof typeof MAP

/** @note strips HTML and escapes for HTML attributes */
const getAltText = (el: Element) =>
	el.innerHTML.replace(/<\w[^>]+>/g, '').replace(/[&<>"']/g, match => MAP[match as IEntity])
