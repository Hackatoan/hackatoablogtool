require('dotenv').config();
const express = require('express');
const multer = require('multer');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { moveUploadedFile } = require('./utils/fileUtils');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Path to the local repository clone
const REPO_DIR = path.join(__dirname, 'repo');
// Construct the GitHub URL from env vars since dotenv doesn't interpolate by default
const GITHUB_REPO_URL = `https://${process.env.GITHUB_USERNAME}:${process.env.GITHUB_PAT}@github.com/${process.env.GITHUB_USERNAME}/${process.env.GITHUB_REPO}.git`;

// Configure Git
const git = simpleGit();

// Basic setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Basic Auth middleware
const authUser = process.env.ADMIN_USERNAME || 'admin';
const authPass = process.env.ADMIN_PASSWORD || 'password';
app.use(basicAuth({
    users: { [authUser]: authPass },
    challenge: true,
    realm: 'Hackatoa CMS'
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for File Uploads
// Temporary storage before moving files into the Git repository
const upload = multer({ dest: 'uploads/' });

// --- Helper Functions ---

// Initialize the repository. Clone it if it doesn't exist, else pull latest.
async function syncRepo() {
    if (!fs.existsSync(path.join(REPO_DIR, '.git'))) {
        console.log(`Cloning repository...`);
        // If repo dir exists but has no .git (e.g. Docker volume init), clear its contents instead of deleting the mount point
        if (fs.existsSync(REPO_DIR)) {
            const files = fs.readdirSync(REPO_DIR);
            for (const file of files) {
                fs.rmSync(path.join(REPO_DIR, file), { recursive: true, force: true });
            }
        }
        await simpleGit().clone(GITHUB_REPO_URL, REPO_DIR);
    }

    const localGit = simpleGit(REPO_DIR);
    console.log(`Pulling latest changes from Main...`);
    await localGit.checkout('Main');
    await localGit.pull('origin', 'Main');
    return localGit;
}

// Commit changes locally without pushing
async function commitLocal(localGit, message) {
    console.log(`Committing changes locally...`);
    await localGit.add('./*');
    await localGit.commit(message);
    console.log(`Changes committed successfully! Run publish to push.`);
}

// Move file from Multer temp storage to Git repo folder
async function moveUploadedFile(file, destinationPath) {
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
        await fs.promises.mkdir(destDir, { recursive: true });
    }
    await fs.promises.rename(file.path, destinationPath);
}

// --- API Endpoints ---

// 1. Music Upload
app.post('/api/upload/music', upload.array('songs'), async (req, res) => {
    try {
        const localGit = await syncRepo();
        const files = req.files;
        if (!files || files.length === 0) return res.status(400).send('No files uploaded.');

        let fileNames = [];
        for (const file of files) {
            const sanitizedFilename = path.basename(file.originalname);
            const destPath = path.join(REPO_DIR, 'public', 'assets', 'songs', sanitizedFilename);
            moveUploadedFile(file, destPath);
            fileNames.push(sanitizedFilename);
        }

        const updateScriptPath = path.join(REPO_DIR, 'update-songs.js');
        if (fs.existsSync(updateScriptPath)) {
            exec(`node update-songs.js`, { cwd: REPO_DIR }, async (error) => {
                if (error) console.error(`Error executing update-songs.js: ${error}`);
                await commitLocal(localGit, `Auto CMS Update: Added songs ${fileNames.join(', ')}`);
                res.send(`Songs uploaded and repository updated successfully.`);
            });
        } else {
            await commitLocal(localGit, `Auto CMS Update: Added songs ${fileNames.join(', ')}`);
            res.send(`Songs uploaded successfully (no update-songs.js found).`);
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 2. Mushroom Upload
app.post('/api/upload/mushroom', upload.array('mushroomImages'), async (req, res) => {
    try {
        const localGit = await syncRepo();
        const files = req.files;
        const { title, description } = req.body;
        if (!files || files.length === 0) return res.status(400).send('No files uploaded.');

        let fileNames = [];
        for (const file of files) {
            const sanitizedFilename = path.basename(file.originalname);
            const destPath = path.join(REPO_DIR, 'public', 'assets', 'mycology', sanitizedFilename);
            moveUploadedFile(file, destPath);
            fileNames.push(sanitizedFilename);
        }

        const dataPath = path.join(REPO_DIR, 'public', 'mushrooms-data.js');
        if (fs.existsSync(dataPath)) {
            let fileContent = fs.readFileSync(dataPath, 'utf8');
            const dateStr = new Date().toISOString().split('T')[0];

            let newEntries = [];
            for (let i = 0; i < fileNames.length; i++) {
                const imgNum = fileNames.length > 1 ? ` ${i + 1}` : '';
                newEntries.push(`    {\n        image: 'assets/mycology/${fileNames[i]}',\n        alt: ${JSON.stringify(description)},\n        title: ${JSON.stringify(title + imgNum)},\n        meta: '${dateStr}',\n    }`);
            }

            const entriesString = newEntries.join(',\n') + ',';
            // Prepend new objects right after the start of the array
            fileContent = fileContent.replace(/(window\.MUSHROOMS_DATA\s*=\s*\[)/, `$1\n${entriesString}`);
            fs.writeFileSync(dataPath, fileContent);
        }

        await commitLocal(localGit, `Auto CMS Update: Added mushroom entries ${fileNames.join(', ')}`);
        res.send('Mushroom data updated and repository updated successfully.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 3. Blog Image Upload (Markdown Inline)
app.post('/api/upload/blog-image', upload.single('blogImage'), async (req, res) => {
    try {
        await syncRepo();
        const file = req.file;
        if (!file) return res.status(400).send('No file uploaded.');

        const sanitizedFilename = path.basename(file.originalname);
        const finalFilename = Date.now() + '-' + sanitizedFilename;
        const destPath = path.join(REPO_DIR, 'public', 'assets', 'blog-media', finalFilename);
        await moveUploadedFile(file, destPath);

        // We do *not* commit immediately here typically, as the user is still writing the blog post.
        // It will be committed when the final blog post is submitted.

        // Return relative path for use in the blog editor
        res.json({ url: `/public/assets/blog-media/${finalFilename}` });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 4. Submit Blog Post
app.post('/api/blog/post', async (req, res) => {
    try {
        const localGit = await syncRepo();
        const { title, content, image, linkLabel, linkHref } = req.body;
        if (!title || !content) return res.status(400).send('Title and content are required.');

        // Prepend to blog-data.js array
        const dataPath = path.join(REPO_DIR, 'public', 'blog-data.js');
        if (fs.existsSync(dataPath)) {
            let fileContent = fs.readFileSync(dataPath, 'utf8');

            const newId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const dateStr = new Date().toISOString().split('T')[0];

            // Format timestamp and optionally append to content if it doesn't have it
            let finalContent = content.trim();
            const timestamp = new Date().toLocaleString();
            finalContent += `\n\n*Posted on ${timestamp}*`;

            // Build the object fields
            let entryRows = [
                `id: '${newId}'`,
                `title: ${JSON.stringify(title)}`,
                `meta: 'Log · ${dateStr}'`,
                `body: ${JSON.stringify(finalContent)}`
            ];

            if (image && image.trim()) {
                entryRows.push(`image: ${JSON.stringify(image.trim())}`);
            }
            if (linkLabel && linkLabel.trim() && linkHref && linkHref.trim()) {
                entryRows.push(`links: [\n            { label: ${JSON.stringify(linkLabel.trim())}, href: ${JSON.stringify(linkHref.trim())} }\n        ]`);
            }

            const newEntryObj = `    {\n        ${entryRows.join(',\n        ')}\n    },`;

            // Insert it right after the array opening bracket
            fileContent = fileContent.replace(/(window\.BLOG_ENTRIES\s*=\s*\[)/, `$1\n${newEntryObj}`);
            fs.writeFileSync(dataPath, fileContent);
        }

        await commitLocal(localGit, `Auto CMS Update: Added blog post "${title}"`);
        res.send('Blog post created and repository updated successfully.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Management APIs ---

function getBlogDataArray(dataPath) {
    if (!fs.existsSync(dataPath)) return [];
    try {
        const content = fs.readFileSync(dataPath, 'utf8');
        const vm = require('vm');
        const sandbox = { window: {} };
        vm.createContext(sandbox);
        vm.runInContext(content, sandbox);
        return sandbox.window.BLOG_ENTRIES || [];
    } catch (e) {
        console.error("Parse Error:", e);
        return [];
    }
}

function writeBlogDataArray(dataPath, entries) {
    const content = `// Auto-generated by Hackatoa CMS\nwindow.BLOG_ENTRIES = ${JSON.stringify(entries, null, 4)};\n`;
    fs.writeFileSync(dataPath, content, 'utf8');
}

// 5. Get all Blog Posts
app.get('/api/blog/posts', async (req, res) => {
    try {
        await syncRepo();
        const dataPath = path.join(REPO_DIR, 'public', 'blog-data.js');
        const entries = getBlogDataArray(dataPath);
        res.json(entries);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 6. Edit a Blog Post
app.put('/api/blog/post/:id', async (req, res) => {
    try {
        const localGit = await syncRepo();
        const { title, content, image, linkLabel, linkHref } = req.body;
        const dataPath = path.join(REPO_DIR, 'public', 'blog-data.js');
        let entries = getBlogDataArray(dataPath);

        const idx = entries.findIndex(e => e.id === req.params.id);
        if (idx !== -1) {
            let finalContent = content.trim();
            // remove previously appended timestamp to avoid stacking
            finalContent = finalContent.replace(/\n\n\*Last edited on [^*]+\*$/, '');
            finalContent = finalContent.replace(/\n\n\*Posted on [^*]+\*$/, '');

            const timestamp = new Date().toLocaleString();
            finalContent += `\n\n*Last edited on ${timestamp}*`;

            entries[idx].title = title;
            entries[idx].body = finalContent;
            if (image && image.trim()) entries[idx].image = image.trim();
            else delete entries[idx].image;

            if (linkLabel && linkLabel.trim() && linkHref && linkHref.trim()) {
                entries[idx].links = [{ label: linkLabel.trim(), href: linkHref.trim() }];
            } else {
                delete entries[idx].links;
            }
            writeBlogDataArray(dataPath, entries);
            await commitLocal(localGit, `Auto CMS Update: Edited blog post "${title}"`);
            return res.send('Blog post updated successfully.');
        } else {
            return res.status(404).send('Post not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 7. Delete a Blog Post
app.delete('/api/blog/post/:id', async (req, res) => {
    try {
        const localGit = await syncRepo();
        const dataPath = path.join(REPO_DIR, 'public', 'blog-data.js');
        let entries = getBlogDataArray(dataPath);

        const idx = entries.findIndex(e => e.id === req.params.id);
        if (idx !== -1) {
            const title = entries[idx].title;
            entries.splice(idx, 1);
            writeBlogDataArray(dataPath, entries);
            await commitLocal(localGit, `Auto CMS Update: Deleted blog post "${title}"`);
            return res.send('Blog post deleted successfully.');
        } else {
            return res.status(404).send('Post not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 8. Delete an Asset
app.delete('/api/asset', async (req, res) => {
    try {
        const localGit = await syncRepo();
        const assetPathRelative = req.body.path;

        if (!assetPathRelative) {
            return res.status(400).send('Path is required');
        }

        // Normalize and resolve the path to ensure it's within the repo directory
        const baseDir = REPO_DIR + path.sep;
        const absolutePath = path.resolve(baseDir, assetPathRelative);

        if (!absolutePath.startsWith(baseDir)) {
            return res.status(400).send('Invalid path');
        }

        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            await commitLocal(localGit, `Auto CMS Update: Deleted asset ${assetPathRelative}`);
            res.send('Asset deleted successfully.');
        } else {
            res.status(404).send('Asset not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 9. Get all Assets (to display for deletion)
app.get('/api/assets', async (req, res) => {
    try {
        await syncRepo();
        const basePath = path.join(REPO_DIR, 'public', 'assets');
        let fileList = [];

        function walkDir(dir) {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    walkDir(fullPath);
                } else {
                    fileList.push(fullPath.replace(REPO_DIR + path.sep, '').replace(/\\/g, '/'));
                }
            }
        }

        walkDir(basePath);
        res.json(fileList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 10. Publish Changes (Push to GitHub)
app.post('/api/publish', async (req, res) => {
    try {
        const localGit = await syncRepo();
        console.log(`Pushing latest commits to Main...`);
        await localGit.push('origin', 'Main');
        res.send('Changes pushed to GitHub successfully!');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error during push');
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Hackatoa CMS Server running on http://localhost:${PORT}`);
    console.log(`CMS Login Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`CMS Login Password: ${process.env.ADMIN_PASSWORD || 'password'}`);
});