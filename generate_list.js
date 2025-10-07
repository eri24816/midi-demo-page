// generates resource/list.json

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = process.argv[2] || 'resource';
const myList = {};

// Helper function to get directories and files
async function scanDirectory(dirPath) {
    const relativePath = path.relative(root, dirPath).replace(/\\/g, '/');
    const normalizedPath = relativePath === '' ? '.' : relativePath;

    myList[normalizedPath] = {
        dirs: [],
        files: []
    };

    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isFile()) {
            myList[normalizedPath].files.push(item.name);
        } else if (item.isDirectory()) {
            myList[normalizedPath].dirs.push(item.name);
            await scanDirectory(fullPath);
        }
    }

    // sort file by if file name starts with digits
    myList[normalizedPath].files.sort((a, b) => {
        const aMatch = a.match(/^\d+/);
        const bMatch = b.match(/^\d+/);
        if (aMatch && bMatch) {
            return parseInt(aMatch[0]) - parseInt(bMatch[0]);
        }
    });
}

// Main execution
async function main() {
    try {
        // Create resource directory if it doesn't exist
        try {
            await fs.access(root);
        } catch {
            await fs.mkdir(root);
        }

        // Start scanning
        await scanDirectory(root);

        // Write the result to list.json
        await fs.writeFile(
            path.join(root, 'list.json'), 
            JSON.stringify(myList, null, 2)
        );
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main(); 