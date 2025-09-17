export type ICssClass = string
export type ICssQuery = string
export type ICssRules = string
export type IUrl = string

export type IReplacementText = {altText: ICssQuery | ''; className: ICssClass; imageText: ICssQuery}
export type IConvertedImg = {
	altText: string
	blob: Blob
	className: ICssClass
	src: IUrl
	previewUrl: IUrl
}
