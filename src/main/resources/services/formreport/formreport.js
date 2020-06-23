var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var nodeLib = require('/lib/xp/node');
var thymeleafLib = require('/lib/thymeleaf');
var util = require('/lib/util/data');
var moment = require('/lib/moment.min.js');

function createCSV(responses, formContent, format) {
    var separator = (format === 'csv-sc' || format === 'csv-no') ? ';' : ',';
    var fieldReferences = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return encodeURIComponent(inputConfig.name || inputConfig.label).replace(/\./g, '_');
    });
    var fieldNames = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return inputConfig.label;
    });
    // Add extra column for the response timestamps
    fieldNames.push('[submitted timestamp]');

    // Add processed response data to easily accessible array object
    var responseData = [];
    responses.forEach(function (response) {
        if (response.data) {
            // Add submitted timestamp for response
            response.data._createdTime = response.createdTime;

            // Replace attachment metadata with downloadable links to the same attachments
            Object.keys(response.data).forEach(function (key) {
                if (response.data[key] && typeof response.data[key] == 'object' && response.data[key].attachments) {
                    var inputAttachmentNames = [];
                    util.forceArray(response.data[key].attachments).forEach(function (attachment) {
                        if (attachment.id && attachment.name) {
                            inputAttachmentNames.push(attachment.name);
                        }
                    });
                    if (inputAttachmentNames.length) {
                        var hyperlinkCommand = format === 'csv-no' ? 'HYPERKOBLING' : 'HYPERLINK';
                        // Cell format: =HYPERLINK("https://mysite.com/_/service/app.name/formreport-filedl?fileId=<FILE_ID>&formResponseId=<FORM_RESPONSE_ID>";"File1.jpg, File2.pdf")
                        response.data[key] = '=' + hyperlinkCommand + '("' + portalLib.serviceUrl({
                            service: 'formreport-singleresponse',
                            type: 'absolute',
                            params: {
                                formId: formContent._id,
                                formResponseId: response._id
                            }
                        }) + '"' + separator + '"' + inputAttachmentNames.join(', ') + '")';
                    }
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

function createModelForHTML(responses, formContent) {
    var fieldReferences = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return encodeURIComponent(inputConfig.name || inputConfig.label).replace(/\./g, '_');
    });
    var fieldNames = util.forceArray(formContent.data.inputs).map(function (inputConfig) {
        return inputConfig.label;
    });

    // Add extra column for the response timestamps
    fieldNames.push('[submitted timestamp]');

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

    // Add processed response data to easily accessible array object
    var responseData = [];
    responses.forEach(function (response) {
        if (response.data) {
            // Add submitted timestamp for response
            response.data._createdTime = response.createdTime;

            // Process each response value into a cell value
            Object.keys(response.data).forEach(function (key) {
                var cell = {};

                // Replace attachment metadata with downloadable links to the same attachments
                if (response.data[key] && typeof response.data[key] == 'object' && response.data[key].attachments) {
                    cell.attachments = [];
                    util.forceArray(response.data[key].attachments).forEach(function (attachment) {
                        if (attachment.id && attachment.name) {
                            cell.attachments.push({
                                text: attachment.name,
                                url: portalLib.serviceUrl({
                                    service: 'formreport-filedl',
                                    type: 'absolute',
                                    params: {
                                        formId: formContent._id,
                                        fileId: attachment.id
                                    }
                                })
                            });
                        }
                    });
                } else {
                    cell = {
                        value: response.data[key]
                    }
                }

                // TODO: this might be wrong!
                responseData.push(cell);
            });
        }
    });

    // Generate rows of responses
    var rows = responses.map(function (response) {
        var row = {
            // Process cells in orrder according to form definition (fieldReferences array)
            cells: fieldReferences.map(function (fieldRef) {
                var field = response.data[fieldRef];
                var cell = {};

                // Replace attachment metadata with downloadable links to the same attachments
                if (field && typeof field == 'object' && field.attachments) {
                    cell.attachments = [];
                    util.forceArray(field.attachments).forEach(function (attachment) {
                        if (attachment.id && attachment.name) {
                            cell.attachments.push({
                                text: attachment.name,
                                url: portalLib.serviceUrl({
                                    service: 'formreport-filedl',
                                    type: 'absolute',
                                    params: {
                                        formId: formContent._id,
                                        fileId: attachment.id
                                    }
                                })
                            });
                        }
                    });
                } else {
                    // Any other type of cell: Pass on the value with fallback to empty string if null or undefined
                    cell = {
                        value: field || ''
                    }
                }

                return cell;
            })
        };
        // createdTime added to last cell for this row
        row.cells.push({
            value: response.createdTime
        });

        return row;
    });

    return {
        headings: fieldNames,
        rows: rows
    };
}

function handleGet(req) {
    var format = (req.params.format && req.params.format.trim()) ? req.params.format.trim() : 'html';
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

        if (format === 'html') {
            return {
                body: thymeleafLib.render(resolve("./formreport.html"), createModelForHTML(responses, formContent)),
                contentType: 'text/html'
            }

        } else {
            csv = createCSV(responses, formContent, format, format);
        }

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
