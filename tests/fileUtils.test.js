const fs = require('fs');
const path = require('path');
const { moveUploadedFile } = require('../utils/fileUtils');

jest.mock('fs');

describe('moveUploadedFile', () => {
    const mockFile = {
        path: '/tmp/uploaded-file-123'
    };
    const destinationPath = '/repo/public/assets/songs/song.mp3';
    const destinationDir = path.dirname(destinationPath);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should NOT call mkdirSync if destination directory exists', () => {
        fs.existsSync.mockReturnValue(true);

        moveUploadedFile(mockFile, destinationPath);

        expect(fs.existsSync).toHaveBeenCalledWith(destinationDir);
        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalledWith(mockFile.path, destinationPath);
    });

    test('should call mkdirSync with recursive: true if destination directory does NOT exist', () => {
        fs.existsSync.mockReturnValue(false);

        moveUploadedFile(mockFile, destinationPath);

        expect(fs.existsSync).toHaveBeenCalledWith(destinationDir);
        expect(fs.mkdirSync).toHaveBeenCalledWith(destinationDir, { recursive: true });
        expect(fs.renameSync).toHaveBeenCalledWith(mockFile.path, destinationPath);
    });

    test('should propagate error if fs.renameSync fails', () => {
        fs.existsSync.mockReturnValue(true);
        const error = new Error('Rename failed');
        fs.renameSync.mockImplementation(() => {
            throw error;
        });

        expect(() => {
            moveUploadedFile(mockFile, destinationPath);
        }).toThrow('Rename failed');
    });

    test('should propagate error if fs.mkdirSync fails', () => {
        fs.existsSync.mockReturnValue(false);
        const error = new Error('Mkdir failed');
        fs.mkdirSync.mockImplementation(() => {
            throw error;
        });

        expect(() => {
            moveUploadedFile(mockFile, destinationPath);
        }).toThrow('Mkdir failed');
    });
});
