export type IHtmlClass = string
export type ICssQuery = string
export type ICssRules = string

export type IConfig = {
	css: {
		/** @note CSS to adjust img[i].content matches with before image conversion. */
		pre: ICssRules
		/** @note CSS to adjust generated images embedded in the new epub with. */
		post: ICssRules
	}
	img: {
		/** @note Specifies what elements to derive img[alt=values] from (if left blank, the textual content of `content` will be used). */
		alt?: ICssQuery
		/** @note An optional img[class="list value"] for css.post to provide custom styles to. */
		class?: IHtmlClass
		/** @note Specifies what HTML elements to convert images. */
		content: ICssQuery
	}[]
	meta: {
		/** A sentence explaining what program this file is for. */
		info: string
		/** A number for use in a switch statement to gracefully handle/update old config schemas. */
		version: number
	}
}

const info = `For use with https://github.com/fauxsaurus/epub-to-awz-kfx-pre-converter.`

export const DEFAULT_CONFIG: IConfig = {
	css: {pre: '', post: ''},
	img: [],
	meta: {info, version: 1},
}

export const CONFIG_IMG_TEMPLATE: IConfig['img'][number] = {
	alt: '',
	class: 'kindle-accessible-image',
	content: '',
}
