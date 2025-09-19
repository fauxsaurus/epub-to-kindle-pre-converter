import type {IFileName, IUrl} from './types'

export const getFile = (url: IUrl): Promise<{data?: Response; errors: string[]}> =>
	fetch(url, {method: 'GET'})
		.then(async res => {
			if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

			return {data: res, errors: []}
		})
		.catch(error => {
			console.error(error)

			return {data: undefined, errors: [error.toString()]}
		})

export const uploadFiles = async <T>(
	path: string,
	fallback: T,
	files: [IFileName, Blob | File][]
): Promise<{data: T; errors: string[]}> => {
	const body = new FormData()

	files.forEach(([name, blob]) => body.append('files', blob, name))

	return fetch(window.location.origin + path, {method: 'POST', body})
		.then(async response => {
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

			return {data: (await response.json()) ?? fallback, errors: []}
		})
		.catch(error => {
			console.error(error)
			return {data: fallback, errors: [error.toString()]}
		})
}
