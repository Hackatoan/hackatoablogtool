/**
 * Commit changes locally without pushing
 * @param {Object} localGit - The simple-git instance for the local repository
 * @param {string} message - The commit message
 */
async function commitLocal(localGit, message) {
    console.log(`Committing changes locally...`);
    await localGit.add('./*');
    await localGit.commit(message);
    console.log(`Changes committed successfully! Run publish to push.`);
}

module.exports = {
    commitLocal
};
