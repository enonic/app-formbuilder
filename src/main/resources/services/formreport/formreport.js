var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var util = require('/lib/enonic/util/data');

function handleGet(req) {
    /*log.info('formreport service req');
    log.info(JSON.stringify(req, null, 4));*/

    var separator = (req.params.separator && req.params.separator.trim()) ? req.params.separator.trim() : ',';

    var responses = contentLib.query({
        branch: 'master',
        query: '',
        contentTypes: ['base:unstructured']
    });

    var csv = '';
    var fields = Object.keys(responses.hits[0].data);
    /*log.info('fields');
    log.info(JSON.stringify(fields, null, 4));*/
    var responseData = [];
    responses.hits.forEach(function (hit) {
        responseData.push(hit.data);
    });
    /*log.info('responseData');
    log.info(JSON.stringify(responseData, null, 4));*/

    var replacer = function(key, value) { return value === null ? '' : value };

    csv = responseData.map(function(row){
        return fields.map(function(fieldName){
            return JSON.stringify(row[fieldName], replacer)
        }).join(separator);
    });
    // add header column
    csv.unshift(fields.join(separator));

    return {
        body: csv.join('\r\n'),
        contentType: 'text/csv',
        contentDisposition: 'attachment; filename="' + req.params.filename + '"'
    };
}
exports.get = handleGet;
