import type {IHtmlClass} from './config'

export type IFileName = string
export type IUrl = string

export type IConvertedImg = {
	altText: string
	blob: Blob
	className: IHtmlClass
	src: IUrl
	previewUrl: IUrl
}
