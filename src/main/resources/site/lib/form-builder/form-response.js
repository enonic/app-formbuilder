var contentLib = require('/lib/xp/content'); // Import the content functions
var context = require('/lib/xp/context'); // Import the context functions
var mail = require('/lib/xp/mail'); // Import the mail functions
var nodeLib = require('/lib/xp/node'); // Import the node functions
var portal = require('/lib/xp/portal'); // Import the portal functions
var repo = require('/lib/xp/repo'); // Import the repo functions
var util = require('/lib/enonic/util/data'); // Import the enonic util functions

var CheckboxInputMapper = require('/lib/form-builder/mapper/checkbox-input-mapper');

var moment = require('/lib/moment.min.js'); // Import Moment.js

var storeInCmsRepo = false;
var repoName = storeInCmsRepo ? 'cms-repo' : 'app-formbuilder-repo';

exports.save = function(request, formContent) {
  var formConfig = formContent.data;
  var formData = request.params;
  formData.formId = formContent._id;
  formData.displayName = formConfig.title || formContent.displayName;
  var responseFolder = getResponseFolder(formConfig);
  return receiveForm(formData, formConfig, responseFolder, request);
};


/*** Utility functions ***/

var isSet = function(value) {
  return value !== null && typeof value !== 'undefined';
};

// Run a function in the Draft branch context, such as storing form responses in the Draft branch
var runInDraft = function(callback) {
  return context.run(
    {
      repository: repoName,
      branch: 'draft'
    },
    callback
  );
}

// Run with admin privileges
var runAsSu = function(callback) {
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

var receiveForm = function(formData, formConfig, responseFolder, request) {
  var attachments = [];
  var emailAttachments = [];
  var multiPartForm = portal.getMultipartForm();
  if (multiPartForm) {
    attachments = saveAttachments(multiPartForm, responseFolder);
    for (var i = 0; i < attachments.length; i++) {
      var attachment = attachments[i];
      emailAttachments.push({
        fileName: attachment.displayName,
        data: runAsSu(function() {
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
        url: runAsSu(function() {
          return portal.attachmentUrl({
            id: attachment.id,
            download: true
          });
        }) || ""
      });
    }
  }
  var email = sendEmailToRecipients(formData, formConfig, request, emailAttachments);
  try {
    return saveForm(formData, responseFolder);
  }
  catch(e) {
    log.error(e.message);
    return false;
  }
};

var saveForm = function(form, responseFolder) {
  var timestamp = moment().format('YYYY-MM-DDTHH:mm:ss');
  var name = "".concat("[", timestamp, "] ", form.displayName);
  var response = runAsSu(function() {
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

var saveAttachments = function(form, responseFolder) {
  var attachmentsFolder = getAttachmentFolderOrCreateNew(responseFolder);
  var files = getFilesFromForm(form);
  var savedFiles = [];
  for (var index = 0; index < files.length; index++) {
    var savedFile = saveFile(files[index], attachmentsFolder);
    savedFiles.push(savedFile);
  }
  return savedFiles;
};

var getResponseFolder = function(formConfig) {
  if (storeInCmsRepo) {
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

var getAttachmentFolderOrCreateNew = function(parentFolder) {
  try {
    var attachmentsFolder = runAsSu(function() {
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

var saveFile = function(file, folder) {
  var stream = portal.getMultipartStream(file.name);
  var result = runAsSu(function() {
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

var sendEmailToRecipients = function(formData, formConfig, request, emailAttachments) {
  var systemEmailFrom = formConfig.emailFrom;
  var userEmailFrom = null;
  var userReceiptEmailTo = null;

  // Arrays that will later be populated with values and concatenated in the e-mail body
  var inputDisplayNames = [];
  var inputValues = [];

  // Populate arrays with input display names and values, in the same order as in the formConfig
  // irrelevant inputs such as headings are still included, in order to enforce a strict index correspondence between inputDisplayNames[] and inputValues[]
  util.forceArray(formConfig.inputs).forEach(function(_id) {
    // Empty strings by default, since all this will be concatenated into a single string in the end
    var displayName = ''; // the nicely formatted input name
    var inputValue = '';
    var inputName = ''; // used for looking up the input value in formData

    // Use contentLib.get without specifying branch in order to get content from cms-repo and from executed context (either draft or master)
    var inputContent = contentLib.get({ key: _id });
    if (inputContent) {
      displayName = inputContent.displayName;
      inputName = _getFormattedName(inputContent);
      inputValue = _getInputValue(inputName, formData);
      // For checkbox inputs, create slightly more understandable values (normally it's either 'on' or not provided in the request data)
      if (inputContent.type === app.name + ':input-checkbox') {
        var checkbox = CheckboxInputMapper.map(inputContent);
        inputValue = (formData[checkbox.name]) ? 'Yes' : 'No';
      }
      // Sets the e-mail address for the TO field
      if (inputContent.type === app.name + ':input-email') {
        userReceiptEmailTo = inputValue.trim();
      }
    }
    inputDisplayNames.push(displayName);
    inputValues.push(inputValue);

    // Set e-mail sender address to be the one given in the form data, if provided
    if (formConfig.emailFromInput && _id === formConfig.emailFromInput && inputValue) {
      formConfig.emailFrom = inputValue;
    }
  });

  // Generate string for e-mail body, with HTML line breaks after each input and value
  var formDataBeautified = [];
  inputDisplayNames.forEach(function(displayName, index) {
    var value = inputValues[index];
    // Only show inputs that have a value (not headings, fields left empty…)
    if (value) {
      formDataBeautified.push(displayName + ': ' + value + '<br/>');
    }
  });
  // Add referer info, if available. Other debug info may be printed here, but don't forget about privacy concerns with storing user data
  if (request.headers['Referer']) {
    formDataBeautified.push('<br/><br/>Form submitted from URL: ' + request.headers['Referer']);
  }
  // Join all data as separate lines in a single HTML string
  formDataBeautified = formDataBeautified.join(' ');

  // Create e-mail subject line
  var subjectFromInput = '';
  if (isSet(formConfig.subjectCheckbox) && formConfig.subjectCheckbox) {
    if (isSet(formConfig.subjectField)) {
      subjectFromInput = runAsSu(function () {
          return formData[contentLib.get({ key: formConfig["subjectField"] })._name];
      });
    }
  }
  var subject = (formConfig.emailSubject ? formConfig.emailSubject : formData.displayName) + (subjectFromInput.length > 0 ? ' # ' + subjectFromInput : '');

  // Send e-mail receipt to user
  if (isSet(formConfig.sendReceipt) && formConfig.sendReceipt && userEmailTo.length > 0) {
    mail.send({
      from: systemEmailFrom || 'noreply@example.com', // TODO: get from site config, or form
      to: userReceiptEmailTo,
      subject: subject,
      body: (isSet(formConfig.includeFormData) && formConfig.includeFormData)
        ? '<code>' + portal.processHtml({ value: formConfig.receiptMessage }) + '<br/>' + formDataBeautified + '</code>'
        : '<code>' + portal.processHtml({ value: formConfig.receiptMessage }) + '</code>',
      attachments: [],
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