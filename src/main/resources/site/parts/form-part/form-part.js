var portal = require('/lib/xp/portal'); // Import the portal functions
var thymeleaf = require('/lib/xp/thymeleaf'); // Import the Thymeleaf rendering function
var contentLib = require('/lib/xp/content'); // Import the content library

var moment = require('/lib/moment.min.js'); // Import Moment.js

var FormMapper = require('/lib/form-builder/mapper/form-mapper');
var FormResponse = require('/lib/form-builder/form-response');

var styleConfig = {
    bootstrap: {
        css: "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/css/bootstrap.min.css",
        view: "/views/bootstrap/form.html"
    },
    "xp-formbuilder": {
        css: "css/formbuilder.css",
        view: "/views/xp-formbuilder/form.html"
    },
    default: {
        css: "",
        view: "/views/default/form.html"
    }
};

var createCssUrl = function(style) {
    var pathOrUrl = styleConfig[style].css;
    if (pathOrUrl === undefined || pathOrUrl === null || pathOrUrl === "") {
        return "";
    } else if (pathOrUrl.contains("://")) {
        return pathOrUrl; // Absolute URL. Doesn't need handling.
    } else {
        return portal.assetUrl({path: styleConfig[style].css});
    }
};

var getFormContent = function() {
    var component = portal.getComponent();
    var componentConfig = component["config"];
    return componentConfig.form ? contentLib.get({key: componentConfig.form}) : portal.getContent();
};

var groupInputsByHeading = function(inputs) {
    var headingPositions = [];
    for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        // Include position 0 in case there is no heading at first
        if (input.type === 'heading' || i == 0) {
            headingPositions.push(i);
        }
    }

    var inputGroups = [];
    for (var i = 0; i < headingPositions.length; i++) {
        var sliceStart = headingPositions[i];

        var sliceEnd = inputs.length; // By default the last entries in the inputs array are included
        // If there is another heading coming up, only slice up until that heading position
        if (i + 1 < headingPositions.length) {
            sliceEnd = headingPositions[i + 1];
        }

        var currentInputGroup = inputs.slice(sliceStart, sliceEnd);
        inputGroups.push(currentInputGroup);
    }

    return inputGroups;
}

// Handle the GET request (a page view)
exports.get = function(request) {
    // Get site config
    var siteConfig = portal.getSiteConfig();

    // Get the component data to check if a form has been added to the part.
    // This enables the use of this part in other templates than the form template, as well as fragments
    var content = getFormContent();
    if (!content || content.type !== app.name + ':form') {
        return {
            body: thymeleaf.render(resolve("/views/error/form-not-found.html"), {})
        };
    } else if (!content.data.inputs) {
        return {
            body: thymeleaf.render(resolve("/views/error/form-missing-inputs.html"), {})
        };
    }

    content.data.id = content._name;
    var contentData = content.data;

    // Set up the form structure
    var form = FormMapper.map(contentData);

    // Prepare the model object with the needed data extracted from the content
    var model = {
        name: content.displayName,
        form: form,
        formInputGroups: groupInputsByHeading(form.inputs),
        introText: contentData.introText ? portal.processHtml({ value: contentData.introText }) : null
    };

    //log.info(JSON.stringify(model, null, 4));

    // Specify the view file to use. Use form config as primary option, site config as secondary option and "default" as fallback/default.
    var style = contentData.style || siteConfig["formbuilder-style"] || "default";
    var view = resolve(styleConfig[style].view);

    // Get client-side JavaScript for the formbuilder
    var formScript = portal.assetUrl({
        path: 'js/formbuilder.js'
    });

    // Return the merged view and model in the response object
    return {
        body: thymeleaf.render(view, model),
        pageContributions: {
            headBegin: styleConfig[style].css ? "<link rel='stylesheet' href='" + createCssUrl(style) + "'/>" : "",
            headEnd: "<script type='text/javascript' src='" + formScript + "'></script>"
        }
    };
};

// Handles either redirect or AJAX response
function applyResponse(responseContent, responseMessage) {
    if (responseContent) {
        // Redirect to content for response
        return {
            status: 303,
            headers: {
                Location: portal.pageUrl({ id: responseContent, type: 'absolute'})
            },
            postProcess: false,
            applyFilters: false
        }
    }
    else {
        return {
            body: portal.processHtml({ value: responseMessage })
        }
    }
}

// Handle POST request (a form submission)
exports.post = function(request) {
    var formContent = getFormContent();

    // Save the form response
    var response = FormResponse.save(request, formContent);
    if (response) {
        return applyResponse(formContent.data.successContent, formContent.data.successMessage);
    } else {
        return applyResponse(formContent.data.errorContent, formContent.data.errorMessage);
    }
};
