var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var thymeleaf = require('/lib/xp/thymeleaf');
var ioLib = require('/lib/xp/io');

var view = resolve('formreport.html');
/*var cssFile = ioLib.getResource(('/assets/css/formreport.css'));
var css = ioLib.readText(cssFile.getStream());*/

function handleGet(req) {
    var uid = req.params.uid;
    /*log.info('uid');
    log.info(JSON.stringify(uid, null, 4));*/
    var contentId = req.params.contentId;
    /*log.info('contentId');
    log.info(JSON.stringify(contentId, null, 4));*/
    if (!contentId) {
        contentId = portalLib.getContent()._id;
    }

    var form = contentLib.get({
        key: contentId,
        branch: 'draft'
    });

    var responses = contentLib.query({
        branch: 'master',
        query: '',
        contentTypes: ['base:unstructured']
    });

    var hasNoResponses = !(responses.hits.length);

    var isForm = (form.type === app.name + ':form');

    var actionUrl = portalLib.serviceUrl({ service: 'formreport' });

    var params = {
        uid: uid,
        isForm: isForm,
        actionUrl: actionUrl,
        filename: form.displayName + '.csv'
    };

    return {
        contentType: 'text/html',
        body: thymeleaf.render(view, params)
    };
}
exports.get = handleGet;

function getContentTitle(id) {
    var content = contentLib.get({key: id});
    if (content) {
        return sanitize(content.displayName) + ' - ' + content._path;
    }
    return null;
}
