import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';
import { testSetup } from "./run-evaluations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the same location as the main app
// For compiled JS, look in the parent directory
const isCompiled = __dirname.includes('dist');
const envPath = isCompiled ? path.join(__dirname, '../../.env') : path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Run test setup if this script is executed directly
const normalizedImportUrl = import.meta.url.replace(/^file:\/\/\//, '').replace(/\\/g, '/');
const normalizedArgv1 = process.argv[1].replace(/\\/g, '/');
if (normalizedImportUrl === normalizedArgv1) {
    testSetup().catch(console.error);
}
