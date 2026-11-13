var contextLib = require('/lib/xp/context');
var repoLib = require('/lib/xp/repo');
var clusterLib = require('/lib/xp/cluster');

var repoName = 'com.enonic.formbuilder'

// Run with admin privileges
var runAsSu = function(callback) {
    return contextLib.run(
        {
            user: {
                login: 'su',
                userStore: 'system'
            }
        },
        callback
    );
}

// Initialize formbuilder repo
var init = function() {
    var formbuilderRepoExists = runAsSu(function() {
        return repoLib.get(repoName);
    });

    if (!formbuilderRepoExists) {
        runAsSu(function() {
            repoLib.create({
                id: repoName
            });
        });
    }
}

if (clusterLib.isMaster()) {
    init();
}
