import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const RPC_URL = 'http://localhost:9933';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// UPDATED: Pointing to your new .jam file in the root
const BLOB_PATH = path.join(__dirname, 'my-jam-service.jam');

async function main() {
    console.log("🔍 Looking for the JAM Blob...");

    if (!fs.existsSync(BLOB_PATH)) {
        console.error(`❌ Error: Could not find ${BLOB_PATH}`);
        return;
    }

    const blob = fs.readFileSync(BLOB_PATH);
    const blobHex = '0x' + blob.toString('hex');

    console.log(`📦 Found JAM Blob (${blob.length} bytes). Sending to local node...`);

    try {
        const response = await axios.post(RPC_URL, {
            jsonrpc: "2.0",
            id: 1,
            // Note: The method depends on your PolkaJam version. 
            // 'author_submitExtrinsic' is standard for Polkadot-like nodes.
            method: "author_submitExtrinsic", 
            params: [blobHex]
        });

        if (response.data.error) {
            console.error("❌ Node rejected the blob:", response.data.error.message);
        } else {
            console.log("✅ Success! Extrinsic Hash:", response.data.result);
            console.log("---");
            console.log("Your service is now in the transaction pool.");
            console.log("Check your polkajam logs to see it enter the Refine stage!");
        }
    } catch (err) {
        console.error("❌ Connection failed. Ensure your 'polkajam' node is running with --dev");
    }
}

main();