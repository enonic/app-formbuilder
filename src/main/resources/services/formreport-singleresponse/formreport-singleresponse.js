var portalLib = require('/lib/xp/portal');
var contentLib = require('/lib/xp/content');
var nodeLib = require('/lib/xp/node');
var authLib = require('/lib/xp/auth');
var thymeleaf = require('/lib/thymeleaf');
var util = require('/lib/util/data');

var formbuilderRepo = nodeLib.connect({
    repoId: 'com.enonic.formbuilder',
    branch: 'draft',
    principals: ['role:system.admin']
});
var nodeIdPattern = RegExp(/^(?:[a-zA-Z0-9_\-.:])+$/);

var view = resolve('./formreport-singleresponse.html');

function handleGet(req) {
    var formId = req.params.formId;
    var formResponseId = req.params.formResponseId;

    if (nodeIdPattern.test(formId) && nodeIdPattern.test(formResponseId)) {
        var form = contentLib.get({ key: formId });

        var userHasWritePermissions = false;
        var contentPermissions = contentLib.getPermissions({
            key: formId
        });
        var principalsWhoMayWrite = util.forceArray(contentPermissions.permissions).map(function (permission) {
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
                body: '<!DOCTYPE html><html lang="en"><title>No permission</title><body><p>You do not have permission to view reports for this form content.<p></body></html>'
            };
        }

        // Form must not have been deleted, in order to present list
        if (form) {
            var formResponse = formbuilderRepo.get(formResponseId);

            if (formResponse && formResponse.type === 'base:unstructured' && formResponse.data && formResponse.data._formContentId === formId) {

                var files = [];
                // Replace attachment metadata with downloadable links to the same attachments
                Object.keys(formResponse.data).forEach(function (key) {
                    if (formResponse.data[key] && typeof formResponse.data[key] == 'object' && formResponse.data[key].attachments) {
                        util.forceArray(formResponse.data[key].attachments).forEach(function (attachment) {
                            if (attachment.id && attachment.name) {
                                files.push({
                                    url: portalLib.serviceUrl({
                                        service: 'formreport-filedl',
                                        type: 'absolute',
                                        params: {
                                            formId: form._id,
                                            fileId: attachment.id
                                        }
                                    }),
                                    name: attachment.name
                                });
                            }
                        });
                    }
                });

                var model = {
                    formDataAsJsonString: JSON.stringify(formResponse.data, null, 4),
                    files: files.length ? files : null
                }

                return {
                    body: thymeleaf.render(view, model),
                    contentType: 'text/html'
                };
            }
        }
    }

    return {
        contentType: 'text/html',
        body: '<!DOCTYPE html><html lang="en"><title>Invalid URL</title><body><p>Invalid URL: ' + req.url + '<p></body></html>'
    };
}
exports.get = handleGet;
