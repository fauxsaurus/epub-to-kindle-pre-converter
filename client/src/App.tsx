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

	const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		/** @todo upload epub, unzip, get all text files, return list to the client, client: load each file (WITH proper CSS), query the iframe, draw all found text to images, replace the markup (including the alt text source) with new image markup using the .kindle-full-line-image images/file-img-#.ext format for the source, send images and the new XHTML off to the server, send new CSS to server, server (just add a new css file and link to it in every xhtml document to ensure the rules are applied everywhere where a query is matched--ignore files where the contents remain unchanged): add these files to a new zip and export the epub (with a validation step at the end?), send a download link to the client, client initiate an auto download (might not be able to do that without the click... gotta keep the onSubmit event open the whole time?) download name = file.name-pre-converted-accessible-kindle.epub */
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

			{text2convert.concat([REPLACEMENT_TEXT_TEMPLATE]).map((replacementText, i, array) => {
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
		</form>
	)
}

export default App
