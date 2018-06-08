var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var nodeLib = require('/lib/xp/node');
var util = require('/lib/enonic/util/data');
var moment = require('/lib/moment.min.js');

function createCSV(responses, formContent, separator) {
    log.info('responses');
    log.info(JSON.stringify(responses, null, 4));
    log.info('formContent');
    log.info(JSON.stringify(formContent, null, 4));
    log.info('separator');
    log.info(JSON.stringify(separator, null, 4));
    
    // TODO: improve fields array, at least base it on the most recent content or on form content id from URL parameter
    // TODO: get fields from form content!
    var fields = Object.keys(responses[0].data);

    var responseData = [];
    responses.forEach(function (hit) {
        responseData.push(hit.data);
    });

    var replacer = function(key, value) {
        return (value === null) ? '' : value;
    };

    var csv = responseData.map(function(row) {
        return fields.map(function(fieldName) {
            return JSON.stringify(row[fieldName], replacer);
        }).join(separator);
    });

    // add header column
    csv.unshift(fields.join(separator));

    return csv.join('\r\n');
}

function handleGet(req) {
    var separator = (req.params.separator && req.params.separator.trim()) ? req.params.separator.trim() : ';';
    var filename = (req.params.filename && req.params.filename.trim()) ? req.params.filename.trim() : 'formbuilder-report.csv';
    var repoId = (req.params.repoId && req.params.repoId.trim()) ? req.params.repoId.trim() : 'com.enonic.formbuilder';
    var fromDate = (req.params.fromDate && req.params.fromDate.trim()) ? req.params.fromDate.trim() : null;
    var toDate = (req.params.toDate && req.params.toDate.trim()) ? req.params.toDate.trim() : null;
    var purge = (req.params.purge) ? true : false;
    var formContentId = (req.params.formContentId && req.params.formContentId.trim()) ? req.params.formContentId.trim() : null;

    if (!formContentId) {
        throw new Error('Missing form content ID.');
    }

    var formContentInMaster = contentLib.get({
        key: formContentId,
        branch: 'master'
    });
    var formContentInDraft = contentLib.get({
        key: formContentId,
        branch: 'draft'
    });

    var formContent = formContentInMaster || formContentInDraft;

    if (!formContent) {
        throw new Error('Could not find any form content by the specified ID.');
    }

    // TODO: test what happens with invalid repo name, throw error
    var formbuilderRepo = nodeLib.connect({
        repoId: repoId,
        branch: 'draft',
        principals: ['role:system.admin']
    });

    var responseKeysQuery = 'data._formContentId = "' + formContentId + '"';
    if (fromDate || toDate) {
        var fromDateTime = (fromDate && moment(fromDate)) ? moment(fromDate).format('YYYY-MM-DD') + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
        // add one day to include hits from last day specified, fallback to tomorrow
        var toDateTime = (toDate && moment(toDate)) ? moment(toDate).add(1, 'days').format('YYYY-MM-DD') + 'T00:00:00Z' : moment().add(1, 'days').format('YYYY-MM-DD') + 'T00:00:00Z';
        responseKeysQuery += ' AND range("createdTime", instant("' + fromDateTime + '"), instant("' + toDateTime + '"), "true", "false")';
    }

    var responsesMetadata = formbuilderRepo.query({
        branch: 'draft',
        query: responseKeysQuery,
        sort: 'createdTime ASC',
        count: -1,
        contentTypes: ['base:unstructured']
    });

    var csv = '';
    if (responsesMetadata.hits.length) {
        var responses = [];
        responsesMetadata.hits.forEach(function (hit) {
            responses.push(formbuilderRepo.get(hit.id));
        });
        csv = createCSV(responses, formContent, separator);
        log.info('csv');
        log.info(JSON.stringify(csv, null, 4));
    }

    return false;

    return {
        body: '',
        contentType: 'text/csv',
        contentDisposition: 'attachment; filename="' + req.params.filename + '"'
    };
}
exports.get = handleGet;
