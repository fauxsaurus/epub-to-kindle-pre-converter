import AdmZip from 'adm-zip'
import cors from 'cors'
import dotenv from 'dotenv'
import express, {type Request, type Response} from 'express'
import fs from 'fs'
import https from 'https'
import multer from 'multer'
import path from 'path'
import {z} from 'zod'

dotenv.config()

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB (max epub file size)

const FileUploadSchema = z
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

const app = express()
const options = {
	key: fs.readFileSync(process.env.SSL_KEY_PATH!),
	cert: fs.readFileSync(process.env.SSL_CERT_PATH!),
}

const port = 3000

const storage = multer.memoryStorage()
const upload = multer({storage: storage})

app.use(cors())

app.post('/api/upload-ebook', upload.single('file'), async (req: Request, res: Response) => {
	const validationResult = FileUploadSchema.safeParse(req.file)

	if (!validationResult.success)
		return res.status(400).json({
			error: 'Invalid file uploaded.',
			details: validationResult.error.flatten().fieldErrors,
		})

	const file = validationResult.data

	const zip = new AdmZip(Buffer.from(await file.arrayBuffer()))
	const zipEntries = zip.getEntries()

	const textFiles = zipEntries
		.filter(entry => entry.entryName.startsWith('OEBPS/text') && !entry.isDirectory)
		.map(entry => path.basename(entry.entryName)) // Get just the filename

	if (textFiles.length) return res.status(200).json({files: textFiles})

	res.status(500).json({
		error: 'Did not find any text files.',
		debug: {filePaths: zipEntries.map(entry => entry.entryName)},
	})
})

// --- Start the Server ---
https.createServer(options, app).listen(port, '0.0.0.0', () => {
	console.log(`Server is listening on https://localhost:${port}`)
})
