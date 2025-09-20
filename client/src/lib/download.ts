import type {IFileName} from './types'

export const download = (download: IFileName, blob: Blob) => {
	const href = URL.createObjectURL(blob)
	const link = Object.assign(document.createElement('a'), {download, hidden: true, href})

	document.body.appendChild(link).click()

	setTimeout(() => (URL.revokeObjectURL(href), document.body.removeChild(link)), 0)
}
