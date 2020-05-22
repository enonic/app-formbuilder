var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var nodeLib = require('/lib/xp/node');
var util = require('/lib/util/data');
var moment = require('/lib/moment.min.js');

function createCSV(responses, formContent, separator) {
    var fieldReferences = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return encodeURIComponent(inputConfig.name || inputConfig.label).replace(/\./g, '_');
    });
    var fieldNames = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return inputConfig.label;
    });
    // Add extra column for the response timestamps
    fieldNames.push('[submitted timestamp]');

    // Add response data to easily accessible array object
    var responseData = [];
    responses.forEach(function (response) {
        if (response.data) {
            // Add submitted timestamp for response
            response.data._createdTime = response.createdTime;

            // Replace attachment metadata with downloadable links to the same attachments
            Object.keys(response.data).forEach(function (key) {
                if (response.data[key] && typeof response.data[key] == 'object' && response.data[key].attachments) {
                    util.forceArray(response.data[key].attachments).forEach(function (attachment, index) {
                        // Only process the first attachment (model should only allow one per input anyway, but just to be safe)
                        if (index === 0 && attachment.id && attachment.name) {
                            // Replace attachment data with CSV hyperlink formatted as =HYPERLINK("https://enonic.com/file.pdf";"file.pdf")
                            response.data[key] = '=HYPERLINK("' + portalLib.serviceUrl({
                                service: 'formreport-filedl',
                                type: 'absolute',
                                params: {
                                    formId: formContent._id,
                                    fileId: attachment.id
                                }
                            }) +  '"' + separator + '"' + attachment.name + '")';
                        }
                    });
                }
            });

            responseData.push(response.data);
        }
    });

    // Function to prettify field values
    var replacer = function(key, value) {
        if (value && typeof value === 'string') {
            // Convert whitespace to merged single space
            return value.replace(/[\s]+/gm, ' ');
        }
        if (value === null) {
            return ''
        }
        return value;
    };

    // Create CSV data
    var csv = responseData.map(function (row) {
        return fieldReferences.map(function (fieldRef) {
            return JSON.stringify(row[fieldRef], replacer);
        }).join(separator) + separator + row['_createdTime'];
    });

    // Add header column
    csv.unshift(fieldNames.join(separator));

    // Add line endings for rows and escape every backslash-escaped doublequote (using the CSV double-doublequote method)
    return csv.join('\r\n').replace(/\\"/gm, '""');
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

        // Delete exported content and related attachments
        if (purge) {
            responses.forEach(function (response) {
                // Delete related attachments
                // DEACTIVATED until a good toggle is found in the download service for enabling/disabling deleting attachments after they have been downloaded.
                // Currenly, the attachments need to remain in the system because they will always be downloaded manually AFTER the original form has been processed and/or deleted
                /*
                var relatedAttachmentIds = [];
                Object.keys(response.data).forEach(function (key) {
                    if (response.data[key] && typeof response.data[key] == 'object' && response.data[key].attachments) {
                        util.forceArray(response.data[key].attachments).forEach(function (attachment) {
                            if (attachment.id) {
                                relatedAttachmentIds.push(attachment.id);
                            }

                        });
                    }
                });
                formbuilderRepo.delete(relatedAttachmentIds);
                */

                // Delete form response
                formbuilderRepo.delete(response._id);
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
