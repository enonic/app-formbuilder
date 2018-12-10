var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var nodeLib = require('/lib/xp/node');
var util = require('/lib/enonic/util/data');
var moment = require('/lib/moment.min.js');

function createCSV(responses, formContent, separator) {
    var fieldReferences = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return encodeURIComponent(inputConfig.name || inputConfig.label).replace(/\./g, '_');
    });
    var fieldNames = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return inputConfig.label;
    });
    fieldNames.push('[submitted timestamp]');

    // Add response data to easily accessible array object
    var responseData = [];
    responses.forEach(function (response) {
        response.data._createdTime = response.createdTime;
        responseData.push(response.data);
    });

    // Function to fallback to empty strings for empty fields
    var replacer = function(key, value) {
        return (value === null) ? '' : value;
    };

    // Create CSV data
    var csv = responseData.map(function (row) {
        return fieldReferences.map(function (fieldRef) {
            return JSON.stringify(row[fieldRef], replacer);
        }).join(separator) + separator + row['_createdTime'];
    });

    // Add header column
    csv.unshift(fieldNames.join(separator));

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

    var responseMetadataQuery = 'data._formContentId = "' + formContentId + '"';
    if (fromDate || toDate) {
        var fromDateTime = (fromDate && moment(fromDate)) ? moment(fromDate).format('YYYY-MM-DD') + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
        // add one day to include hits from last day specified, fallback to tomorrow
        var toDateTime = (toDate && moment(toDate)) ? moment(toDate).add(1, 'days').format('YYYY-MM-DD') + 'T00:00:00Z' : moment().add(1, 'days').format('YYYY-MM-DD') + 'T00:00:00Z';
        responseMetadataQuery += ' AND range("createdTime", instant("' + fromDateTime + '"), instant("' + toDateTime + '"), "true", "false")';
    }

    var responsesMetadata = formbuilderRepo.query({
        branch: 'draft',
        query: responseMetadataQuery,
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

        // Add byte order mark for automatic UTF-8 recognition in Excel 2013 (and later) for Windows
        // source: http://stackoverflow.com/questions/6002256
        csv = '\uFEFF' + csv;

        // Delete exported content
        if (purge) {
            responsesMetadata.hits.forEach(function (hit) {
                formbuilderRepo.delete(hit.id);
            });
        }
    }

    return {
        body: csv,
        contentType: 'text/csv; charset="UTF-8"',
        headers: {
            'Content-Disposition': 'attachment; filename="' + filename + '"'
        }
    };
}
exports.get = handleGet;
