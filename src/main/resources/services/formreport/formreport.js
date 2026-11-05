var contentLib = require('/lib/xp/content');
var contextLib = require('/lib/xp/context');
var portalLib = require('/lib/xp/portal');
var nodeLib = require('/lib/xp/node');
var thymeleafLib = require('/lib/thymeleaf');
var moment = require('/lib/moment.min.js');

// Links to the other report services carry the project repository, so they can look up the form content
function withRepository(params, repository) {
    if (repository) {
        params.repository = repository;
    }
    return params;
}

function createCSV(responses, formContent, format, repository) {
    var separator = (format === 'csv-sc' || format === 'csv-no') ? ';' : ',';
    var fieldReferences = (Array.isArray(formContent.data.inputs) ? formContent.data.inputs : [formContent.data.inputs]).map(function (inputConfig) {
        return encodeURIComponent(inputConfig.name || inputConfig.label).replace(/\./g, '_');
    });
    var fieldNames = (Array.isArray(formContent.data.inputs) ? formContent.data.inputs : [formContent.data.inputs]).map(function (inputConfig) {
        return inputConfig.label;
    });
    // Add extra column for the response timestamps
    fieldNames.push('[submitted timestamp]');

    // Add processed response data to easily accessible array object
    var responseData = [];
    responses.forEach(function (response) {
        if (response.data) {
            // Add submitted timestamp for response
            response.data._createdTime = response.submittedAt;

            // Replace attachment metadata with downloadable links to the same attachments
            Object.keys(response.data).forEach(function (key) {
                if (response.data[key] && typeof response.data[key] == 'object' && response.data[key].attachments) {
                    var inputAttachmentNames = [];
                    (Array.isArray(response.data[key].attachments) ? response.data[key].attachments : [response.data[key].attachments]).forEach(function (attachment) {
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
                            params: withRepository({
                                formId: formContent._id,
                                formResponseId: response._id
                            }, repository)
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

function createModelForHTML(responses, formContent, repository) {
    var fieldReferences = (Array.isArray(formContent.data.inputs) ? formContent.data.inputs : [formContent.data.inputs]).map(function (inputConfig) {
        return encodeURIComponent(inputConfig.name || inputConfig.label).replace(/\./g, '_');
    });
    var fieldNames = (Array.isArray(formContent.data.inputs) ? formContent.data.inputs : [formContent.data.inputs]).map(function (inputConfig) {
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
                    (Array.isArray(field.attachments) ? field.attachments : [field.attachments]).forEach(function (attachment) {
                        if (attachment.id && attachment.name) {
                            cell.attachments.push({
                                text: attachment.name,
                                url: portalLib.serviceUrl({
                                    service: 'formreport-filedl',
                                    type: 'absolute',
                                    params: withRepository({
                                        formId: formContent._id,
                                        fileId: attachment.id
                                    }, repository)
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
            value: response.submittedAt
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
    var fromDate = (req.params.fromDate && req.params.fromDate.trim()) ? req.params.fromDate.trim() : null;
    var toDate = (req.params.toDate && req.params.toDate.trim()) ? req.params.toDate.trim() : null;
    var purge = (req.params.purge) ? true : false;
    var formContentId = (req.params.formContentId && req.params.formContentId.trim()) ? req.params.formContentId.trim() : null;
    var repository = (req.params.repository && req.params.repository.trim()) ? req.params.repository.trim() : null;

    if (!formContentId) {
        throw new Error('Missing form content ID.');
    }

    // The form content lives in the project repository passed on by the widget
    var getFormContent = function (branch) {
        return contextLib.run({ repository: repository, branch: branch }, function () {
            return contentLib.get({ key: formContentId });
        });
    };
    var formContent = getFormContent('master') || getFormContent('draft');

    if (!formContent) {
        throw new Error('Could not find any form content by the specified ID.');
    }

    var formbuilderRepo = nodeLib.connect({
        repoId: 'com.enonic.formbuilder',
        branch: 'master',
        principals: ['role:system.admin']
    });

    var responseMetadataQuery = 'formContentId = "' + formContentId + '"';
    if (fromDate || toDate) {
        var fromDateTime = (fromDate && moment(fromDate)) ? moment(fromDate).format('YYYY-MM-DD') + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
        // add one day to include hits from last day specified, fallback to tomorrow
        var toDateTime = (toDate && moment(toDate)) ? moment(toDate).add(1, 'days').format('YYYY-MM-DD') + 'T00:00:00Z' : moment().add(1, 'days').format('YYYY-MM-DD') + 'T00:00:00Z';
        responseMetadataQuery += ' AND range("submittedAt", instant("' + fromDateTime + '"), instant("' + toDateTime + '"), "true", "false")';
    }

    var responsesMetadata = formbuilderRepo.query({
        query: responseMetadataQuery,
        sort: 'submittedAt ASC',
        count: -1
    });

    var csv = '';
    if (responsesMetadata.hits.length) {
        var responses = [];
        responsesMetadata.hits.forEach(function (hit) {
            responses.push(formbuilderRepo.get(hit.id));
        });

        // Collect attachment ids now: createCSV() replaces the attachment cells with hyperlinks
        var attachmentIds = [];
        responses.forEach(function (response) {
            Object.keys(response.data).forEach(function (key) {
                if (response.data[key] && typeof response.data[key] == 'object' && response.data[key].attachments) {
                    (Array.isArray(response.data[key].attachments) ? response.data[key].attachments : [response.data[key].attachments]).forEach(function (attachment) {
                        if (attachment.id) {
                            attachmentIds.push(attachment.id);
                        }
                    });
                }
            });
        });

        if (format === 'html') {
            return {
                body: thymeleafLib.render(resolve("./formreport.html"), createModelForHTML(responses, formContent, repository)),
                contentType: 'text/html'
            }

        } else {
            csv = createCSV(responses, formContent, format, repository);
        }

        // Add byte order mark for automatic UTF-8 recognition in Excel 2013 (and later) for Windows
        // source: http://stackoverflow.com/questions/6002256
        csv = '\uFEFF' + csv;

        // Delete exported content and related attachments
        if (purge) {
            if (attachmentIds.length) {
                formbuilderRepo.delete(attachmentIds);
            }
            responses.forEach(function (response) {
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
