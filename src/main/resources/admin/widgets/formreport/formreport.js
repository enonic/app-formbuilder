var contentLib = require('/lib/xp/content');
var portalLib = require('/lib/xp/portal');
var thymeleaf = require('/lib/thymeleaf');
var ioLib = require('/lib/xp/io');
var nodeLib = require('/lib/xp/node');
var util = require('/lib/util/data');
var moment = require('/lib/moment.min.js');

var view = resolve('formreport.html');

/*var cssFile = ioLib.getResource(('/assets/css/formreport.css'));
var css = ioLib.readText(cssFile.getStream());*/

function handleGet(req) {
    var contentId = req.params.contentId;

    if (!contentId && portalLib.getContent()) {
        contentId = portalLib.getContent()._id;
    }

    if (!contentId) {
        return {
            contentType: 'text/html',
            body: '<widget class="error">No content selected</widget>'
        };
    }

    var content = contentLib.get({
        key: contentId,
        branch: 'draft'
    });
    var isForm = (content.type === app.name + ':form');

    var model = {
        widgetId: app.name,
        content: content,
        isForm: isForm,
        actionUrl: portalLib.serviceUrl({ service: 'formreport' }),
        currentDate: moment().format('YYYY-MM-DD'),
        filename: content._name + '-' + moment().format('YYYY-MM-DD') + '.csv'
    };

    if (isForm) {
        var contentPath = content._path;
        var sitePath = contentPath.split('/')[1];

        var site = contentLib.get({
            key: '/' + sitePath,
            branch: 'draft'
        });

        var siteConfig = null;
        if (site && site.data && site.data.siteConfig) {
            // Traverse siteConfigs for one or all apps of a site, returning the config for the last match of this app (should only be one match anyway)
            // This is basically just the same as portalLib.getSiteConfig() if the current site was already in the context
            util.forceArray(site.data.siteConfig).forEach(function (sc, index) {
                if (sc.applicationKey === app.name) {
                    siteConfig = sc.config;
                }
            });
        }

        var formbuilderRepo = nodeLib.connect({
            repoId: (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder',
            branch: 'draft',
            principals: ['role:system.admin']
        });

        var responses = formbuilderRepo.query({
            branch: 'draft',
            query: 'data._formContentId = "' + contentId + '"',
            sort: 'createdTime ASC',
            count: 1,
            contentTypes: ['base:unstructured']/*,
            aggregations: {
                oldestCreatedTime: {
                    terms: {
                        field: 'createdTime',
                        order: 'count DESC',
                        size: 1
                    }
                }
            }*/
        });

        var lastResponseQuery = formbuilderRepo.query({
            branch: 'draft',
            query: 'data._formContentId = "' + contentId + '"',
            sort: 'createdTime DESC',
            count: 1,
            contentTypes: ['base:unstructured'],
            /*aggregations: {
                newestCreatedTime: {
                    terms: {
                        field: 'createdTime',
                        order: 'count DESC',
                        size: 1
                    }
                }
            }*/
        });

        var hasResponses = (responses.total > 0);

        model.hasResponses = hasResponses;
        model.numResponses = responses.total;
        /*model.oldestCreatedDate = (responses.aggregations && responses.aggregations.oldestCreatedTime
            && responses.aggregations.oldestCreatedTime.buckets
            && responses.aggregations.oldestCreatedTime.buckets[0]
            && responses.aggregations.oldestCreatedTime.buckets[0].key) ?
                responses.aggregations.oldestCreatedTime.buckets[0].key.substring(0, 10) : null;
        model.newestCreatedDate = (lastResponse.aggregations && lastResponse.aggregations.newestCreatedTime
            && lastResponse.aggregations.newestCreatedTime.buckets
            && lastResponse.aggregations.newestCreatedTime.buckets[0]
            && lastResponse.aggregations.newestCreatedTime.buckets[0].key) ?
                lastResponse.aggregations.newestCreatedTime.buckets[0].key.substring(0, 10) : null;*/
        model.oldestCreatedDate = (responses.hits.length) ? formbuilderRepo.get(responses.hits[0].id).createdTime.substring(0, 10) : null;
        model.newestCreatedDate = (lastResponseQuery.hits.length) ? formbuilderRepo.get(lastResponseQuery.hits[0].id).createdTime.substring(0, 10) : null;
        model.repoId = (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder';
    }

    return {
        contentType: 'text/html',
        body: thymeleaf.render(view, model)
    };
}
exports.get = handleGet;
