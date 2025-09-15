import dotenv from 'dotenv'
import fs from 'fs'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

dotenv.config()

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	root: 'client',
	server: {
		https: {
			key: fs.readFileSync(process.env.SSL_KEY_PATH!),
			cert: fs.readFileSync(process.env.SSL_CERT_PATH!),
		},
	},
})
