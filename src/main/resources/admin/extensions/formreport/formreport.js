var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var thymeleaf = require('/lib/thymeleaf');
var ioLib = require('/lib/xp/io');
var nodeLib = require('/lib/xp/node');
var authLib = require('/lib/xp/auth');
var moment = require('/lib/moment.min.js');

var view = resolve('formreport.html');

/*var cssFile = ioLib.getResource(('/assets/css/formreport.css'));
var css = ioLib.readText(cssFile.getStream());*/

function handleGet(req) {
    var contentId = req.params.contentId;

    if (!contentId && portalLib.getContent()) {
        contentId = portalLib.getContent()._id;
    }

    if (!contentId) {
        return {
            contentType: 'text/html',
            body: '<widget class="error">No content selected</widget>'
        };
    }

    var content = contentLib.get({
        key: contentId,
        branch: 'draft'
    });
    var isForm = (content.type === app.name + ':form');

    var userHasWritePermissions = false;
    var contentPermissions = contentLib.getPermissions({
        key: contentId
    });
    var principalsWhoMayWrite = (Array.isArray(contentPermissions.permissions) ? contentPermissions.permissions : [contentPermissions.permissions]).map(function (permission) {
        if (permission.allow.indexOf('WRITE_PERMISSIONS') >= 0 || permission.deny.indexOf('WRITE_PERMISSIONS') < 0) {
            return permission.principal;
        }
    });
    principalsWhoMayWrite.forEach(function (principal) {
        if (principal.startsWith('role:')) {
            var role = principal.substring(5);
            if (authLib.hasRole(role)) {
                userHasWritePermissions = true;
            }
        }
    });
    if (!userHasWritePermissions) {
        return {
            contentType: 'text/html',
            body: '<widget class="error">No permission to create reports for this content.</widget>'
        };
    }

    var model = {
        widgetId: app.name,
        content: content,
        isForm: isForm,
        actionUrl: portalLib.serviceUrl({ service: 'formreport' }),
        currentDate: moment().format('YYYY-MM-DD'),
        filename: content._name + '-' + moment().format('YYYY-MM-DD') + '.csv'
    };

    if (isForm) {
        var formbuilderRepo = nodeLib.connect({
            repoId: 'com.enonic.formbuilder',
            branch: 'master',
            principals: ['role:system.admin']
        });

        var responses = formbuilderRepo.query({
            query: 'formContentId = "' + contentId + '"',
            sort: 'submittedAt ASC',
            count: 1
        });

        var lastResponseQuery = formbuilderRepo.query({
            query: 'formContentId = "' + contentId + '"',
            sort: 'submittedAt DESC',
            count: 1
        });

        var hasResponses = (responses.total > 0);

        model.hasResponses = hasResponses;
        model.numResponses = responses.total;
        model.oldestCreatedDate = (responses.hits.length) ? formbuilderRepo.get(responses.hits[0].id).submittedAt.substring(0, 10) : null;
        model.newestCreatedDate = (lastResponseQuery.hits.length) ? formbuilderRepo.get(lastResponseQuery.hits[0].id).submittedAt.substring(0, 10) : null;
    }

    return {
        contentType: 'text/html',
        body: thymeleaf.render(view, model)
    };
}
exports.get = handleGet;
