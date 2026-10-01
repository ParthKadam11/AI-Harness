import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// load the .env next to the code, so mypi works from any folder
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
