var contentLib = require('/lib/xp/content');
var nodeLib = require('/lib/xp/node');

var formbuilderRepo = nodeLib.connect({
    repoId: 'com.enonic.formbuilder',
    branch: 'draft',
    principals: ['role:system.admin']
});
var nodeIdPattern = RegExp(/^(?:[a-zA-Z0-9_\-.:])+$/);

function handleGet(req) {
    var formId = req.params.formId;
    var fileId = req.params.fileId;

    if (nodeIdPattern.test(formId) && nodeIdPattern.test(fileId)) {
        var form = contentLib.get({ key: formId });
        var file = formbuilderRepo.get(fileId);

        if (form && file && file.attachment && file.attachment.name && file.attachment.mimeType) {
            var stream = formbuilderRepo.getBinary({
                key: fileId,
                binaryReference: file.attachment.name
            });

            return {
                body: stream,
                contentType: file.attachment.mimeType,
                headers: {
                    'Content-Disposition': 'attachment; filename="' + file.attachment.name + '"'
                }
            }
        }
    }

    return {
        body: 'Invalid URL: ' + req.url
    }
}
exports.get = handleGet;
