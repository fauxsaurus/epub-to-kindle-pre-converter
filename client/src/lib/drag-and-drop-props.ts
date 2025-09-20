type IDragEvent<E extends HTMLElement> = React.DragEvent<E>
type FN<I extends unknown[] = [], O = void> = (...args: I) => O
type IProps = {dragging: boolean; setDragging: FN<[boolean]>; setFiles: FN<[File[]]>}

export const getDragAndDropProps = <E extends HTMLElement>({
	dragging,
	setDragging,
	setFiles,
}: IProps) => ({
	'data-dragging': dragging,
	onDragEnter: (event: IDragEvent<E>) => (prevent(event), setDragging(true)),
	onDragOver: (event: IDragEvent<E>) => (prevent(event), setDragging(true)),
	onDragLeave: (event: IDragEvent<E>) => (prevent(event), setDragging(false)),
	onDrop: (event: IDragEvent<E>) => {
		prevent(event)
		setDragging(false)
		setFiles(Array.from(event.dataTransfer.files))
	},
})

const prevent = <E extends HTMLElement>(event: React.DragEvent<E>) => {
	event.preventDefault()
	event.stopPropagation()
}
