import {useEffect, useState} from 'react'
import {ROUTES} from '../../shared/routes'
import {CONFIG_IMG_TEMPLATE, DEFAULT_CONFIG} from './lib/config'
import {type IConfig, type ICssQuery, type ICssRules} from './lib/config'
import {processPage} from './lib/process-page'
import {getFile, uploadFiles} from './lib/request'
import type {IConvertedImg, IFileName} from './lib/types'
import {download} from './lib/download'

const validateCssQuery = (query: ICssQuery) => {
	try {
		document.querySelector(query)
		return true
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (_) {
		return false
	}
}

function App() {
	const [config, setConfig] = useState<IConfig>(DEFAULT_CONFIG)
	const [oldEbook, setOldEbook] = useState<File | undefined>(undefined)

	const setPreCSS = (pre: ICssRules) =>
		setConfig(Object.assign({}, config, {css: {pre, post: config.css.post}}))

	const setPostCSS = (post: ICssRules) =>
		setConfig(Object.assign({}, config, {css: {pre: config.css.pre, post}}))

	const setText2convert = (img: IConfig['img']) => setConfig(Object.assign({}, config, {img}))

	const [assetDir, setAssetDir] = useState('')
	const [files2convert, setFiles2convert] = useState<string[]>([])
	const [convertedImgs, setConvertedImgs] = useState<IConvertedImg[]>([])
	const [updatedHTML, setUpdatedHTML] = useState<Record<IFileName, string>>({})

	const atLeastOneQuery = !!config.img.length
	const replacementValidationErrors = config.img.map(replacementText => {
		const validationErrors = []

		if (!replacementText.content || !validateCssQuery(replacementText.content))
			validationErrors.push('Need a valid CSS query for Image Text.')

		if (replacementText.alt && !validateCssQuery(replacementText.alt))
			validationErrors.push('Invalid Alt Text CSS Query.')

		return validationErrors
	})

	// upload files (when ready) and download new epub
	useEffect(() => {
		// conversion in progress or the user has not clicked covert
		if (files2convert.length || !convertedImgs.length) return

		// concat files
		const files: [IFileName, Blob][] = [
			/** @note this name cannot be in the epub already (in order to prevent overwriting existing files) */
			['kindle-accessible-img-styles.css', text2blob('text/css', config.css.post)],
			...Object.entries(updatedHTML).map(
				([src, html]) => [src, text2blob('text/html', html)] as [IFileName, Blob]
			),
			...convertedImgs.map(imgData => [imgData.src, imgData.blob] as [IFileName, Blob]),
		]

		uploadFiles<{filesUpdated?: boolean}>(ROUTES.uploadFiles, {}, files).then(async result => {
			if (!result.data.filesUpdated) throw new Error('Ebook files not updated on server!')

			const {data, errors} = await getFile(ROUTES.downloadEbook)
			if (errors.length) throw new Error(errors[0])

			const fileName =
				oldEbook?.name.split('.').slice(0, -1).join('.') + `-v-accessible-kindle.epub`

			download(fileName, await data!.blob())
		})
	}, [
		convertedImgs,
		convertedImgs.length,
		config.css.post,
		files2convert.length,
		oldEbook?.name,
		updatedHTML,
	])

	const addFile = (event: React.ChangeEvent<HTMLInputElement>) =>
		setOldEbook((event.currentTarget.files ?? [undefined])[0])

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (!oldEbook) return // @todo add error, but this shouldn't happen due to disabled.

		const fallback = {assetDir: '', files: []}
		const res = await uploadFiles(ROUTES.uploadEbook, fallback, [[oldEbook.name, oldEbook]])

		setAssetDir(res.data.assetDir)
		setFiles2convert(res.data.files)
	}

	return (
		<form onSubmit={event => onSubmit(event)}>
			{!oldEbook && (
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

			{config.img.concat([CONFIG_IMG_TEMPLATE]).map((replacementText, i) => {
				const updateReplacementText = (replacementText: IConfig['img'][number]) => {
					if (replacementText.alt || replacementText.content)
						return setText2convert(
							Object.assign(config.img.slice(), {[i]: replacementText})
						)

					// remove array item
					const newArray = config.img.slice()

					newArray.splice(i, 1)

					setText2convert(newArray)
				}

				const setAlt = (alt: string) => updateReplacementText({...replacementText, alt})

				const setClass = (className: string) =>
					updateReplacementText({...replacementText, class: className})

				const setContent = (content: string) =>
					updateReplacementText({...replacementText, content})

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
								onChange={event => setContent(event.currentTarget.value)}
								placeholder="CSS Query"
								type="text"
								value={replacementText.content}
							/>
						</label>
						<label>
							Alt Text:
							<input
								name={`alt-text-${i}`}
								onChange={event => setAlt(event.currentTarget.value)}
								type="text"
								value={replacementText.alt}
							/>
						</label>
						(Optional)
						<label>
							Image Class:
							<input
								name={`image-class-${i}`}
								onChange={event => setClass(event.currentTarget.value)}
								type="text"
								value={replacementText.class}
							/>
						</label>
						(Optional)
					</fieldset>
				)
			})}

			<label htmlFor="pre-css">Custom Pre CSS</label>
			<textarea
				cols={80}
				rows={6}
				id="pre-css"
				name="pre-css"
				onChange={event => setPreCSS(event.currentTarget.value)}
				value={config.css.pre}
			></textarea>
			<label htmlFor="post-css">Custom Post CSS</label>
			<textarea
				cols={80}
				rows={6}
				id="post-css"
				name="post-css"
				onChange={event => setPostCSS(event.currentTarget.value)}
				value={config.css.post}
			></textarea>

			<button
				disabled={
					!oldEbook || !atLeastOneQuery || !!replacementValidationErrors.flat().length
				}
				type="submit"
			>
				Convert
			</button>
			<button
				onClick={() => {
					const fileName = 'az-epub-accessibility-config.json'
					const content = JSON.stringify(config, null, 4)

					download(fileName, text2blob(content, 'application/json'))
				}}
			>
				Download Config
			</button>
			<output>{files2convert.join(', ')}</output>
			{!!files2convert.length && (
				<iframe
					onLoad={async event => {
						const doc =
							event.currentTarget.contentDocument ||
							event.currentTarget.contentWindow?.document

						if (!doc) return console.log('no doc...')

						const fileName = files2convert[0].split('/').slice(-1)[0]
						const pageName = fileName.split('.').slice(0, -1).join('.')

						const {html, imgs} = await processPage(
							doc,
							{assetDir, pageName, preCSS: config.css.pre},
							config.img
						)

						setConvertedImgs(convertedImgs.concat(imgs))
						setFiles2convert(files2convert.slice(1))

						if (html) setUpdatedHTML(Object.assign({}, updatedHTML, {[fileName]: html}))
					}}
					src={window.location.origin + '/' + files2convert[0]}
					width="1000"
				></iframe>
			)}
			{convertedImgs.map(imgData => (
				<img
					alt={imgData.altText}
					key={imgData.previewUrl}
					src={imgData.previewUrl}
					title={imgData.altText}
				/>
			))}
		</form>
	)
}

export default App

const text2blob = (content: string, mimeType: string) => new Blob([content], {type: mimeType})
