const { commitLocal } = require('../utils/gitUtils');

describe('commitLocal', () => {
    let mockGit;
    const commitMessage = 'Test commit message';

    beforeEach(() => {
        mockGit = {
            add: jest.fn().mockResolvedValue(true),
            commit: jest.fn().mockResolvedValue(true)
        };
        jest.clearAllMocks();
        // Spy on console.log to suppress output during tests and verify calls
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        console.log.mockRestore();
    });

    test('should successfully add and commit changes', async () => {
        await commitLocal(mockGit, commitMessage);

        expect(mockGit.add).toHaveBeenCalledWith('./*');
        expect(mockGit.commit).toHaveBeenCalledWith(commitMessage);
        expect(console.log).toHaveBeenCalledWith('Committing changes locally...');
        expect(console.log).toHaveBeenCalledWith('Changes committed successfully! Run publish to push.');
    });

    test('should throw error if git add fails', async () => {
        const error = new Error('Git add failed');
        mockGit.add.mockRejectedValue(error);

        await expect(commitLocal(mockGit, commitMessage)).rejects.toThrow('Git add failed');
        expect(mockGit.add).toHaveBeenCalledWith('./*');
        expect(mockGit.commit).not.toHaveBeenCalled();
    });

    test('should throw error if git commit fails', async () => {
        const error = new Error('Git commit failed');
        mockGit.commit.mockRejectedValue(error);

        await expect(commitLocal(mockGit, commitMessage)).rejects.toThrow('Git commit failed');
        expect(mockGit.add).toHaveBeenCalledWith('./*');
        expect(mockGit.commit).toHaveBeenCalledWith(commitMessage);
    });
});
