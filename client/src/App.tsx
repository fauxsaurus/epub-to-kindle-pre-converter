import {useState} from 'react'

type ICssClass = string
type ICssQuery = string
type ICssRules = string
type IReplacementText = {altText: ICssQuery | ''; className: ICssClass; imageText: ICssQuery}

const REPLACEMENT_TEXT_TEMPLATE = {altText: '', className: 'kindle-accessible-image', imageText: ''}

const validateCssQuery = (query: ICssQuery) => {
	try {
		document.querySelector(query)
		return true
	} catch (_) {
		return false
	}
}

const DEFAULT_CSS_RULES = `/** @note Full-width image with one line above and below. */
.kindle-accessible-image {	
	margin: 1rem 0;
	width: 100%;
}`

/** @note `computedStyleMap()` is only avilable in chrome*/
const el2img = async (el: Element) => {
	const styleMap = el.computedStyleMap()
	const style = Array.from(styleMap)
		.map(([prop, value]) => `${prop}: ${(Array.from(value)[0] + '').replace(/"/g, `'`)};`)
		.join(' ')
	// + 'margin: 0' // @note

	const {height: h, width: w} = el.getBoundingClientRect()
	const type = el.tagName.toLocaleLowerCase()

	const marginTop = parseInt(styleMap.get('margin-top')!.toString()!.match(/^\d+/)?.[0] ?? '0')
	const marginBottom = parseInt(
		styleMap.get('margin-bottom')!.toString()!.match(/^\d+/)?.[0] ?? '0'
	)
	const marginLeft = parseInt(styleMap.get('margin-left')!.toString()!.match(/^\d+/)?.[0] ?? '0')
	const marginRight = parseInt(
		styleMap.get('margin-right')!.toString()!.match(/^\d+/)?.[0] ?? '0'
	)

	const width = ~~w + marginLeft + marginRight
	const height = ~~h + marginBottom + marginTop

	const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
		<foreignObject width="100%" height="100%">
			<${type} xmlns="http://www.w3.org/1999/xhtml" style="${style}">${el.innerHTML}</${type}>
		</foreignObject>
	</svg>`

	const src = `data:image/svg+xml,${encodeURIComponent(svgString)}`
	const img = await new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image()

		image.onload = () => resolve(image)
		image.onerror = () => reject(new Error(`Failed to load image from ${src}`))

		image.src = src
	})

	const canvas = new OffscreenCanvas(width, height)
	canvas.getContext('2d')!.fillStyle = '#fff'
	canvas.getContext('2d')!.fillRect(0, 0, width, height)
	canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

	const blob = await canvas.convertToBlob({type: 'image/jpeg', quality: 0.7})

	console.log(URL.createObjectURL(blob))
}

function App() {
	const [file, setFile] = useState<File | undefined>(undefined)
	const [text2convert, setText2convert] = useState<IReplacementText[]>([
		{
			altText: '.braille+.screen-reader-only',
			className: 'kindle-accessible-image',
			imageText: '.braille',
		},
		{
			altText: '.runes+.screen-reader-only',
			className: 'kindle-accessible-image',
			imageText: '.runes',
		},
		{
			altText: '',
			className: 'kindle-accessible-image',
			imageText: '[lang="ko"]',
		},
	])
	const [cssRules, setCssRules] = useState<ICssRules>(DEFAULT_CSS_RULES)
	const [files2convert, setFiles2convert] = useState<string[]>([])

	const atLeastOneQuery = !!text2convert.length
	const replacementValidationErrors = text2convert.map(replacementText => {
		const validationErrors = []

		if (!replacementText.imageText || !validateCssQuery(replacementText.imageText))
			validationErrors.push('Need a valid CSS query for Image Text.')

		if (replacementText.altText && !validateCssQuery(replacementText.altText))
			validationErrors.push('Invalid Alt Text CSS Query.')

		return validationErrors
	})

	const addFile = (event: React.ChangeEvent<HTMLInputElement>) =>
		setFile((event.currentTarget.files ?? [undefined])[0])

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (!file) return // @todo add error, but this shouldn't happen due to disabled.

		const formData = new FormData()

		formData.append('file', file, file.name)

		const url = `${window.location.origin}/api/upload-ebook`

		await fetch(url, {method: 'POST', body: formData})
			.then(async response => {
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

				setFiles2convert((await response.json()).files ?? [])
			})
			.catch(console.error)
	}

	return (
		<form onSubmit={event => onSubmit(event)}>
			{!file && (
				<ul data-validation="error">
					<li>Need a valid epub.</li>
				</ul>
			)}
			<label>
				Epub: <input accept=".epub" name="file" onChange={addFile} type="file" />
			</label>
			<div>
				Note: If an Alt Text field is left blank, the textual contents from the first query
				will serve as an image's alt text (useful for allowing character sets that Kindle's
				cannot visually show (i.e., Korean), to still be made available in TTS without
				redundant markup).
			</div>
			<ul data-validation="error" hidden={atLeastOneQuery}>
				<li>Need at least one Image Text CSS Query.</li>
			</ul>

			{text2convert.concat([REPLACEMENT_TEXT_TEMPLATE]).map((replacementText, i) => {
				const updateReplacementText = (replacementText: IReplacementText) => {
					if (replacementText.altText || replacementText.imageText)
						return setText2convert(
							Object.assign(text2convert.slice(), {[i]: replacementText})
						)

					// remove array item
					const newArray = text2convert.slice()

					newArray.splice(i, 1)

					setText2convert(newArray)
				}

				const setAltText = (altText: string) =>
					updateReplacementText({...replacementText, altText})

				const setClassName = (className: string) =>
					updateReplacementText({...replacementText, className})

				const setImageText = (imageText: string) =>
					updateReplacementText({...replacementText, imageText})

				return (
					<fieldset key={i}>
						<legend>Replacement Group {i + 1}</legend>
						<ul
							data-validation="error"
							hidden={!replacementValidationErrors[i]?.length}
						>
							{replacementValidationErrors[i]?.map((error, i) => (
								<li key={i}>{error}</li>
							))}
						</ul>
						<label>
							Image Text:
							<input
								name={`image-text-${i}`}
								onChange={event => setImageText(event.currentTarget.value)}
								placeholder="CSS Query"
								type="text"
								value={replacementText.imageText}
							/>
						</label>
						<label>
							Alt Text:
							<input
								name={`alt-text-${i}`}
								onChange={event => setAltText(event.currentTarget.value)}
								type="text"
								value={replacementText.altText}
							/>
						</label>
						(Optional)
						<label>
							Image Class:
							<input
								name={`image-class-${i}`}
								onChange={event => setClassName(event.currentTarget.value)}
								type="text"
								value={replacementText.className}
							/>
						</label>
						(Optional)
					</fieldset>
				)
			})}

			<label htmlFor="css-rules">Custom CSS</label>
			<textarea
				cols={80}
				rows={6}
				id="css-rules"
				name="css-rules"
				onChange={event => setCssRules(event.currentTarget.value)}
				value={cssRules}
			></textarea>

			<button
				disabled={!file || !atLeastOneQuery || !!replacementValidationErrors.flat().length}
				type="submit"
			>
				Convert
			</button>
			<output>{files2convert.join(', ')}</output>
			{!!files2convert.length && (
				<iframe
					onLoad={async event => {
						const doc =
							event.currentTarget.contentDocument ||
							event.currentTarget.contentWindow?.document

						if (!doc) return console.log('no doc...')

						const images2make = text2convert.flatMap(replacementText => {
							const imgTexts = doc.querySelectorAll(replacementText.imageText)
							const altTexts = replacementText.altText
								? doc.querySelectorAll(replacementText.altText)
								: []
							const {className} = replacementText

							return Array.from(imgTexts).map((imgText, i) => {
								const altText = (altTexts[i] ?? imgText).innerHTML.replace(
									/<\w[^>]+>/g,
									''
								)
								return {imgText, altText, className}
							})
						})

						if (!images2make.length) return setFiles2convert(files2convert.slice(1))

						const el = images2make[0].imgText

						el2img(el)
					}}
					src={window.location.origin + '/' + files2convert[0]}
					width="1000"
				></iframe>
			)}
		</form>
	)
}

export default App
