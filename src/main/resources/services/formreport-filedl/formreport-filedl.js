var contentLib = require('/lib/xp/content');
var nodeLib = require('/lib/xp/node');

var formbuilderRepo = nodeLib.connect({
    repoId: 'com.enonic.formbuilder',
    branch: 'master',
    principals: ['role:system.admin']
});
var nodeIdPattern = RegExp(/^(?:[a-zA-Z0-9_\-.:])+$/);

function handleGet(req) {
    var formId = req.params.formId;
    var fileId = req.params.fileId;

    if (nodeIdPattern.test(formId) && nodeIdPattern.test(fileId)) {
        var form = contentLib.get({ key: formId });
        var file = formbuilderRepo.get(fileId);

        if (form && file && file.fileName && file.mimeType) {
            var stream = formbuilderRepo.getBinary({
                key: fileId,
                binaryReference: file.fileName
            });

            return {
                body: stream,
                contentType: file.mimeType,
                headers: {
                    'Content-Disposition': 'attachment; filename="' + file.fileName + '"'
                }
            }
        }
    }

    return {
        contentType: 'text/html',
        body: '<!DOCTYPE html><html lang="en"><title>Invalid URL</title><body><p>Invalid URL: ' + req.url + '<p></body></html>'
    };
}
exports.get = handleGet;
