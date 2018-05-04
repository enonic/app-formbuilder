var contextLib = require('/lib/xp/context');
var nodeLib = require('/lib/xp/node');
var repoLib = require('/lib/xp/repo');

var repoName = 'com.enonic.formbuilder'

// Run with admin privileges
var runAsSu = function(callback) {
    return contextLib.run(
        {
            branch: 'draft',
            user: {
                login: 'su',
                userStore: 'system'
            }
        },
        callback
    );
}

// Initialize formbuilder repo

var formbuilderRepoExists = runAsSu(function() {
    return repoLib.get(repoName);
});

if (!formbuilderRepoExists) {
    runAsSu(function() {
        repoLib.create({
            id: repoName
        });
        repoLib.createBranch({
            branchId: 'draft',
            repoId: repoName
        });
    });
}



try {
    var formbuilderRepo = nodeLib.connect({
        repoId: repoName,
        branch: 'draft',
        principals: ['role:system.admin']
    });
    var contentRoot = formbuilderRepo.get('/content');
    if (!contentRoot) {
        formbuilderRepo.create({
            _name: 'content'
        });
    }
} catch(e) {
    log.error('Could not connect to repo ' + repoName + ' or create node ' + repoName + '/content. ', e);
}
