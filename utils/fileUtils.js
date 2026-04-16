const fs = require('fs');
const path = require('path');

/**
 * Move file from Multer temp storage to Git repo folder
 * @param {Object} file - The file object from Multer
 * @param {string} destinationPath - The destination path for the file
 */
function moveUploadedFile(file, destinationPath) {
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    try {
        fs.renameSync(file.path, destinationPath);
    } catch (err) {
        if (err.code === 'EXDEV') {
            fs.copyFileSync(file.path, destinationPath);
            fs.unlinkSync(file.path);
        } else {
            throw err;
        }
    }
}

module.exports = {
    moveUploadedFile
};
