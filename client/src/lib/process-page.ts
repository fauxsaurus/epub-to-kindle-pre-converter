import type {IConfig} from './config'
import {el2imgBlob} from './el2img-blob'
import {getFile} from './request'

type IOptions = {assetDir: string; pageName: string; preCSS: IConfig['css']['pre']}

export const processPage = async (
	doc: Document,
	{assetDir, pageName, preCSS}: IOptions,
	text2convert: IConfig['img']
) => {
	// query elements to replace
	const elements2replace = text2convert.flatMap(replacementText => {
		const imgTexts = doc.querySelectorAll(replacementText.content)
		const altTexts = replacementText.alt ? doc.querySelectorAll(replacementText.alt) : []
		const className = replacementText.class

		return Array.from(imgTexts).map((imgTextEl, i) => {
			return {imgText: imgTextEl, altTextEl: altTexts[i] ?? undefined, className}
		})
	})

	if (!elements2replace.length) return {html: '', imgs: []}

	const style = Object.assign(doc.createElement('style'), {innerHTML: preCSS})
	if (preCSS) doc.head.append(style)

	// generate images
	const imgs = await Promise.all(
		elements2replace.map(async ({altTextEl, className = '', imgText}, i) => {
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
	doc.head.innerHTML += `<link href="../${assetDir}style.css" rel="stylesheet" type="text/css"/>`

	const {data: oldHtml, errors} = await getFile(doc.location.href)
	if (errors.length) throw new Error(errors[0])

	const doctype = (await oldHtml!.text()).split(/<(html|head)/)[0]
	const html = doctype + doc.querySelector('html')!.outerHTML.replace(/><\/img>/g, ' />')

	return {html, imgs}
}

const MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}

type IEntity = keyof typeof MAP

/** @note strips HTML and escapes for HTML attributes */
const getAltText = (el: Element) =>
	el.innerHTML.replace(/<\w[^>]+>/g, '').replace(/[&<>"']/g, match => MAP[match as IEntity])
