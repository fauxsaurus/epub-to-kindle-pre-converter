import AdmZip from 'adm-zip'
import dotenv from 'dotenv'
import express, {type Request, type Response} from 'express'
import fs from 'fs'
import https from 'https'
import mime from 'mime-types'
import multer from 'multer'
import path from 'path'
import {z} from 'zod'

import {ROUTES} from '../shared/routes.ts'

dotenv.config()

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB (max epub file size)

const EPUB_MIMETYPE = 'application/epub+zip'

const EbookUploadSchema = z
	.object({
		fieldname: z.string(),
		originalname: z.string(),
		encoding: z.string(),
		mimetype: z.string(),
		size: z.number(),
		buffer: z.instanceof(Buffer),
	})
	.refine(obj => [EPUB_MIMETYPE, 'application/octet-stream'].includes(obj.mimetype), {
		message: 'Invalid file type.',
	})
	.refine(obj => obj.size <= MAX_FILE_SIZE, {message: 'File size should not exceed 100MB'})
	.transform(obj => new File([obj.buffer as BlobPart], obj.originalname, {type: obj.mimetype}))

const FilesUploadSchema = z
	.object({
		fieldname: z.string(),
		originalname: z.string(),
		encoding: z.string(),
		mimetype: z.string(),
		size: z.number(),
		buffer: z.instanceof(Buffer),
	})
	.refine(obj => obj.size <= MAX_FILE_SIZE, {message: 'File size should not exceed 100MB'})
// .transform(obj => new File([obj.buffer as BlobPart], obj.originalname, {type: obj.mimetype}))

const app = express()
const options = {
	key: fs.readFileSync(process.env.SSL_KEY_PATH!),
	cert: fs.readFileSync(process.env.SSL_CERT_PATH!),
}

const port = 3000

const storage = multer.memoryStorage()
const upload = multer({storage: storage})

const state: {assetDir: string; zip?: AdmZip} = {assetDir: ''}

app.use((req, _, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
	next()
})

app.post(ROUTES.uploadEbook, upload.single('files'), async (req: Request, res: Response) => {
	const validationResult = EbookUploadSchema.safeParse(req.file)

	if (!validationResult.success)
		return res.status(400).json({
			error: 'Invalid file uploaded.',
			details: validationResult.error.flatten().fieldErrors,
		})

	const file = validationResult.data

	state.zip = new AdmZip(Buffer.from(await file.arrayBuffer()))

	const [files, dirs] = state.zip
		.getEntries()
		.reduce(
			(lrFilter, entry) => (
				lrFilter[entry.isDirectory ? 1 : 0].push(entry.entryName), lrFilter
			),
			[[], []] as [string[], string[]]
		)

	// set asset directory (ensuring that it is a unique name that does not exist in the epub)
	let i = 0
	const getAssetDir = () => `kindle-accessible${i ? `-${i}` : ''}/`
	while (dirs.includes('OEBPS/' + getAssetDir())) i += 1
	state.assetDir = getAssetDir()

	// return data
	const htmlFiles = files.filter(file => file.endsWith('html'))
	if (htmlFiles.length) return res.status(200).json({assetDir: state.assetDir, files: htmlFiles})

	res.status(500).json({
		error: 'Did not find any text files.',
		debug: {filePaths: state.zip.getEntries().map(entry => entry.entryName)},
	})
})

app.post(ROUTES.uploadFiles, upload.array('files'), async (req, res) => {
	if (!state.zip) return res.status(428).json({error: 'Upload an eBook first.'})

	const validationResult = z.array(FilesUploadSchema).safeParse(req.files)
	if (!validationResult.success)
		return res.status(400).json({
			error: 'Invalid file(s) uploaded.',
			details: validationResult.error.flatten().fieldErrors,
		})

	const files = validationResult.data
	const newFileNames = files.map(file => file.originalname)
	const oldFileNames = state.zip
		.getEntries()
		.map(entry => entry.entryName.split('/').slice(-1)[0])

	newFileNames.map((newFileName, newFileI) => {
		const {buffer} = files[newFileI]
		const oldEntryI = oldFileNames.indexOf(newFileName)

		// insert file
		if (oldEntryI === -1)
			return void state.zip!.addFile(`OEBPS/${state.assetDir}${newFileName}`, buffer)

		// update file
		const fullPath = state.zip!.getEntries()[oldEntryI].entryName

		state.zip!.updateFile(fullPath, buffer)
	})

	res.status(200).json({filesUpdated: true})
})

app.get(ROUTES.downloadEbook, async (_, res) => {
	if (!state.zip) return res.status(404)

	const downloadName = 'kindle-accessible.epub'
	const buffer = state.zip.toBuffer()

	res.set('Content-Type', EPUB_MIMETYPE)
	res.set('Content-Disposition', `attachment; filename=${downloadName}`)
	res.set('Content-Length', buffer.byteLength + '')

	res.send(buffer)
})

/** @note server index.html */
app.get('/', (_, res) =>
	res
		.status(200)
		.setHeader('Content-Type', 'text/html')
		.sendFile(path.join(process.cwd(), `/client/dist/index.html`))
)

/** @note Serves epub files directly from zip. */
app.get('/*filepath', async (req: Request, res: Response) => {
	const filePath = (req.params.filepath as unknown as []).join('/') || 'index.html'
	const mimeType = mime.lookup(filePath.split('/').slice(-1)[0])

	/** @note serve client files */
	if (!filePath.includes('/') || filePath.startsWith('assets/'))
		return res
			.status(200)
			.setHeader('Content-Type', mimeType)
			.sendFile(path.join(process.cwd(), `/client/dist/${filePath}`))

	const zipEntry = state.zip?.getEntry(filePath)
	if (!zipEntry) return res.status(404).json({error: `File "${filePath}" not found.`})

	res.status(200).setHeader('Content-Type', mimeType).send(zipEntry.getData())
})

// --- Start the Server ---
https.createServer(options, app).listen(port, '0.0.0.0', () => {
	console.log(`Server is listening on https://localhost:${port}`)
})
