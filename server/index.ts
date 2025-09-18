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

const EbookUploadSchema = z
	.object({
		fieldname: z.string(),
		originalname: z.string(),
		encoding: z.string(),
		mimetype: z.string(),
		size: z.number(),
		buffer: z.instanceof(Buffer),
	})
	.refine(obj => ['application/epub+zip', 'application/octet-stream'].includes(obj.mimetype), {
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

const state: {zip?: AdmZip} = {}

app.post(ROUTES.uploadEbook, upload.single('files'), async (req: Request, res: Response) => {
	const validationResult = EbookUploadSchema.safeParse(req.file)

	if (!validationResult.success)
		return res.status(400).json({
			error: 'Invalid file uploaded.',
			details: validationResult.error.flatten().fieldErrors,
		})

	const file = validationResult.data

	state.zip = new AdmZip(Buffer.from(await file.arrayBuffer()))

	const textFiles = state.zip
		.getEntries()
		.filter(entry => entry.entryName.startsWith('OEBPS/text') && !entry.isDirectory)
		.map(entry => entry.entryName) // Get just the filename

	if (textFiles.length) return res.status(200).json({files: textFiles})

	res.status(500).json({
		error: 'Did not find any text files.',
		debug: {filePaths: state.zip.getEntries().map(entry => entry.entryName)},
	})
})

app.post(ROUTES.uploadFiles, upload.array('files'), async (req, res) => {
	const validationResult = z.array(FilesUploadSchema).safeParse(req.files)
	if (!validationResult.success)
		return res.status(400).json({
			error: 'Invalid file(s) uploaded.',
			details: validationResult.error.flatten().fieldErrors,
		})

	const files = validationResult.data
})

/** @note Serves epub files directly from zip. */
app.get('/*filepath', async (req: Request, res: Response) => {
	const filePath = (req.params.filepath as unknown as []).join('/') || 'index.html'

	/** @note serve client files */
	if (!filePath.includes('/') || filePath.includes('assets/')) {
		const mimeType = mime.lookup(filePath.split('/').slice(-1)[0])

		console.log(path.join(process.cwd(), `/client/dist/${filePath}`))

		return res
			.status(200)
			.setHeader('Content-Type', mimeType)
			.sendFile(path.join(process.cwd(), `/client/dist/${filePath}`))
	}

	const zipEntry = state.zip?.getEntry(filePath)
	if (!zipEntry) return res.status(404).json({error: `File "${filePath}" not found.`})

	const mimeType = mime.lookup(filePath.split('/').slice(-1)[0])

	res.status(200).setHeader('Content-Type', mimeType).send(zipEntry.getData())
})

// --- Start the Server ---
https.createServer(options, app).listen(port, '0.0.0.0', () => {
	console.log(`Server is listening on https://localhost:${port}`)
})
