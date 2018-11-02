var contentLib = require('/lib/xp/content'); // Import the content functions
var context = require('/lib/xp/context'); // Import the context functions
var mail = require('/lib/xp/mail'); // Import the mail functions
var nodeLib = require('/lib/xp/node'); // Import the node functions
var portal = require('/lib/xp/portal'); // Import the portal functions
var repo = require('/lib/xp/repo'); // Import the repo functions
var util = require('/lib/enonic/util/data'); // Import the enonic util functions

var CheckboxInputMapper = require('/lib/form-builder/mapper/checkbox-input-mapper');

var moment = require('/lib/moment.min.js'); // Import Moment.js

exports.save = function(request, siteConfig, formContent) {
  var formConfig = formContent.data;
  var formData = request.params;
  formData._formContentId = formContent._id;
  formData._formContentDisplayName = formConfig.title || formContent.displayName;
  var responseFolder = getResponseFolder(siteConfig, formConfig);
  return receiveForm(formData, siteConfig, formConfig, responseFolder, request);
};


/*** Utility functions ***/

var isSet = function(value) {
  return value !== null && typeof value !== 'undefined';
};

// Run a function in the Draft branch context, such as storing form responses in the Draft branch
var runInDraft = function(repoName, callback) {
  return context.run(
    {
      repository: repoName,
      branch: 'draft'
    },
    callback
  );
}

// Run with admin privileges
var runAsSu = function(repoName, callback) {
  return context.run(
    {
      repository: repoName,
      branch: 'draft',
      user: {
        login: 'su',
        userStore: 'system'
      }
    },
    callback
  );
}

// The same function as in input-mapper.js
var _getFormattedName = function(inputContent) {
  var name = inputContent.name || inputContent._name;
  var periodsSpacesDashes = /[\.\s-]+/g;
  return name.replace(periodsSpacesDashes, '_');
}

// Get input value from form data based on an input name
var _getInputValue = function(inputName, formData) {
  var value = '';
  if (inputName && formData[inputName]) {
    // Get file name for attachment objects which has been generated earlier in receiveForm(), otherwise we can assume it's an unmodified string value
    if (formData[inputName].attachments) {
      // support multiple attachments in single input
      var fileNames = [];
      formData[inputName].attachments.forEach(function(attachment) {
        fileNames.push(attachment.name);
      });
      value = fileNames.join(', ');
    } else {
      value = formData[inputName];
    }
  }
  return value;
}


/*** Private functions for the inner workings of the class ***/

var receiveForm = function(formData, siteConfig, formConfig, responseFolder, request) {
  var attachments = [];
  var emailAttachments = [];
  var multiPartForm = portal.getMultipartForm();
  if (multiPartForm) {
    // TODO: avoid saving attachments if storageLocation is "none"
    attachments = saveAttachments(siteConfig, multiPartForm, responseFolder);
    for (var i = 0; i < attachments.length; i++) {
      var attachment = attachments[i];
      emailAttachments.push({
        fileName: attachment.displayName,
        data: runAsSu(
            (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder',
            function() {
          return contentLib.getAttachmentStream({
            key: attachment.id,
            name: attachment.name
          });
        }),
        contentType: attachment.contentType
      });
      if (!formData[attachment.inputId]) formData[attachment.inputId] = { attachments: [] };
      formData[attachment.inputId].attachments.push({
        id: attachment.id,
        name: attachment.name,
        url: runAsSu(
            (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder',
            function() {
          return portal.attachmentUrl({
            id: attachment.id,
            download: true
          });
        }) || ""
      });
    }
  }
  var email = sendEmailToRecipients(formData, siteConfig, formConfig, request, emailAttachments);
  // TODO: try switching execution order with line above, or better: run asyncronously somehow
  if (siteConfig.storageLocation !== 'none') {
      try {
        return saveForm(formData, siteConfig, request, responseFolder);
      }
      catch(e) {
        log.error(e.message);
        return false;
      }
  }
};

var saveForm = function(form, siteConfig, request, responseFolder) {
  var timestamp = moment().format('YYYY-MM-DDTHH:mm:ss');
  var name = "".concat("[", timestamp, "] ", form._formContentDisplayName);
  if (request.headers['Referer']) {
      form._requestHeadersReferer = request.headers['Referer'];
  }
  // Never store the Google reCAPTCHA response
  // TODO: delete any other parameters that are not present in the input config and not private
  delete form['g-recaptcha-response'];

  // Sanitize input values
  for (var key in form) {
    if (form.hasOwnProperty(key)) {
        form[key] = portal.sanitizeHtml(form[key]);
    }
  }

  var response = runAsSu(
      (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder',
      function() {
    return contentLib.create({
      parentPath: responseFolder,
      displayName: name,
      requireValid: true,
      contentType: 'base:unstructured',
      branch: 'draft',
      data: form
    });
  });
  return response;
};

var saveAttachments = function(siteConfig, form, responseFolder) {
  var attachmentsFolder = getAttachmentFolderOrCreateNew(siteConfig, responseFolder);
  var files = getFilesFromForm(form);
  var savedFiles = [];
  for (var index = 0; index < files.length; index++) {
    var savedFile = saveFile(files[index], attachmentsFolder, siteConfig);
    savedFiles.push(savedFile);
  }
  return savedFiles;
};

var getResponseFolder = function(siteConfig, formConfig) {
  if (siteConfig.storageLocation === 'cmsRepo') {
    try {
      return formConfig["responseFolder"] ?
        contentLib.get({key: formConfig["responseFolder"]})._path :
        portal.getContent()._path;
    } catch (exception) {
      log.error("Could not resolve folder to store form responses in.", exception);
    }
  } else {
    return '/';
  }
};

var getAttachmentFolderOrCreateNew = function(siteConfig, parentFolder) {
  try {
    var attachmentsFolder = runAsSu(
        (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder',
        function() {
      return contentLib.create({
        name: '_attachments',
        parentPath: parentFolder,
        displayName: '_attachments',
        draft: true,
        contentType: 'base:folder',
        data: {},
        branch: 'draft'
      });
    });
    return attachmentsFolder._path;
  } catch (exception) {
    if (exception.code === 'contentAlreadyExists') {
      return parentFolder + "/_attachments";
    } else {
      log.error("Unexpected error when creating attachments-folder in path '%s': %s", parentFolder, exception);
      return parentFolder;
    }
  }
};

var getFilesFromForm = function(form) {
  var files = [];
  for (var inputName in form) {
    var input = form[inputName];
    if (inputIsFile(input)) {
      files.push(input);
    }
  }
  return files;
};

var inputIsFile = function(input) {
  return (input["fileName"] !== undefined && input["contentType"] !== undefined);
};

var saveFile = function(file, folder, siteConfig) {
  var stream = portal.getMultipartStream(file.name);
  var result = runAsSu(
      (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder',
      function() {
    return contentLib.createMedia({
      name: file.fileName,
      parentPath: folder,
      mimeType: file.contentType,
      data: stream,
      branch: 'draft'
    });
  });
  return {
    id: result._id,
    inputId: file.name.split("[")[0],
    name: result._name,
    displayName: file.fileName,
    type: result.type,
    contentType: file.contentType
  };
};

var sendEmailToRecipients = function(formData, siteConfig, formConfig, request, emailAttachments) {
  var systemEmailFrom = formConfig.emailFrom || siteConfig.emailFrom;
  var userEmailFrom = null;
  var userReceiptEmailTo = null;

  // Arrays that will later be populated with values and concatenated in the e-mail body
  var labels = [];
  var values = [];

  // Populate arrays with input display names and values, in the same order as in the formConfig
  // irrelevant inputs such as headings are still included, in order to enforce a strict index correspondence between inputDisplayNames[] and inputValues[]
  util.forceArray(formConfig.inputs).forEach(function(inputConfig) {
    // Empty strings by default, since all this will be concatenated into a single string in the end
    var label = inputConfig.label || '';
    var name = encodeURIComponent(inputConfig.name || inputConfig.label);
    var value = _getInputValue(name, formData);

      // For checkbox inputs, create slightly more understandable values (normally it's either 'on' or not provided in the request data)
      if (inputConfig.input && inputConfig.input._selected && inputConfig.input._selected === 'checkbox') {
        var checkbox = CheckboxInputMapper.map(inputConfig);
        value = (formData[checkbox.name]) ? 'Yes' : 'No';
      }
      // Sets the e-mail address for the TO field
      // Currently DISABLED (needs boolean sendReceipt in config)
      if (inputConfig.input && inputConfig.input._selected && inputConfig.input._selected === 'email') {
        userReceiptEmailTo = value.trim();
      }
    labels.push(label);
    values.push(value);

    // Set e-mail sender address to be the one given in the form data, if provided
    if (formConfig.emailFromInput && _id === formConfig.emailFromInput && value) {
        // TODO: verify logic!!! should perhaps have been userEmailFrom? Or was that specifically omitted due to variable scope?
      formConfig.emailFrom = value;
    }
  });

  // Generate string for e-mail body, with HTML line breaks after each input and value
  var formDataBeautified = [];
  labels.forEach(function(labelText, index) {
    var val = values[index];
    // Only show inputs that have a value (not headings, fields left empty…)
    if (val) {
      formDataBeautified.push(labelText + ': ' + val + '<br/>');
    }
  });
  // Add referer info, if available. Other debug info may be printed here, but don't forget about privacy concerns with storing user data
  if (request.headers['Referer']) {
    formDataBeautified.push('<br/><br/>Form submitted from URL: ' + request.headers['Referer']);
  }
  // Join all data as separate lines in a single HTML string
  formDataBeautified = formDataBeautified.join(' ');

  // Create e-mail subject line
  // Currently DISABLED due to missing boolean in form config
  // TODO: update to get data from optionset-based model
  var subjectFromInput = '';
  if (isSet(formConfig.subjectCheckbox) && formConfig.subjectCheckbox) {
    if (isSet(formConfig.subjectField)) {
      subjectFromInput = runAsSu(
          (siteConfig.storageLocation === 'cmsRepo') ? 'cms-repo' : 'com.enonic.formbuilder',
          function () {
          return formData[contentLib.get({ key: formConfig["subjectField"] })._name];
      });
    }
  }
  //var subject = (formConfig.emailSubject ? formConfig.emailSubject : formData.displayName) + (subjectFromInput.length > 0 ? ' # ' + subjectFromInput : '');
  var subject = (formConfig.emailSubject ? formConfig.emailSubject : formData._formContentDisplayName) + (subjectFromInput.length > 0 ? ' # ' + subjectFromInput : '');

  // Send e-mail receipt to user
  // Currently DISABLED due to missing boolean in form config
  if (isSet(formConfig.sendReceipt) && formConfig.sendReceipt && userEmailTo.length > 0) {
    mail.send({
      from: systemEmailFrom || 'noreply@example.com', // TODO: get from site config, or form
      to: userReceiptEmailTo,
      subject: subject,
      body: (isSet(formConfig.includeFormData) && formConfig.includeFormData)
        ? '<code>' + portal.processHtml({ value: formConfig.receiptMessage }) + '<br/>' + formDataBeautified + '</code>'
        : '<code>' + portal.processHtml({ value: formConfig.receiptMessage }) + '</code>',
      attachments: [], // a waste of time and resources to e-mail the uploaded attachments back to the user
      contentType: 'text/html; charset="UTF-8"'
    });
  }

  // Send e-mail to subscribers
  if (formConfig.emailSubscribers) {
    return mail.send({
      from: userEmailFrom || systemEmailFrom || 'noreply@example.com',
      to: util.forceArray(formConfig.emailSubscribers),
      subject: subject,
      body: '<code>' + formDataBeautified + '</code>',
      attachments: emailAttachments,
      contentType: 'text/html; charset="UTF-8"'
    });
  } else {
    return false;
  }
}
