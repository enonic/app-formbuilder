var contextLib = require('/lib/xp/context');
var repoLib = require('/lib/xp/repo');
var clusterLib = require('/lib/xp/cluster');
const taskLib = require('/lib/xp/task');
const migration = require('/lib/form-builder/migration');

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

    // Moves responses stored by 2.x to the node layout, in the background. Does nothing once they are migrated
    try {
        taskLib.executeFunction({
            description: 'Form Builder: migrate 2.x responses',
            func: migration.run
        });
    } catch (e) {
        log.error('Form Builder migration: could not start', e);
    }
}
