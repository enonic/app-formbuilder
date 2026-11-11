var mail = require('/lib/xp/mail'); // Import the mail functions
var nodeLib = require('/lib/xp/node'); // Import the node functions
var portal = require('/lib/xp/portal'); // Import the portal functions
var valueLib = require('/lib/xp/value'); // Import the value functions

var CheckboxInputMapper = require('/lib/form-builder/mapper/checkbox-input-mapper');

var moment = require('/lib/moment.min.js'); // Import Moment.js

var REPO_ID = 'com.enonic.formbuilder';
var ATTACHMENTS_NAME = '_attachments';
var ATTACHMENTS_PATH = '/' + ATTACHMENTS_NAME;

exports.save = function(request, siteConfig, formContent) {
  var formConfig = formContent.data;
  var formData = request.params;
  formData._formContentId = formContent._id;
  formData._formContentDisplayName = formConfig.title || formContent.displayName;
  return receiveForm(formData, siteConfig, formConfig, request);
};


/*** Utility functions ***/

var isSet = function(value) {
  return value !== null && typeof value !== 'undefined';
};

// Connect to the formbuilder repo with admin privileges
var connect = function() {
  return nodeLib.connect({
    repoId: REPO_ID,
    branch: 'master',
    principals: ['role:system.admin']
  });
};

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

var receiveForm = function(formData, siteConfig, formConfig, request) {
  var repo = (siteConfig.storageLocation !== 'none') ? connect() : null;
  var files = getFilesFromForm(portal.getMultipartForm());
  var emailAttachments = [];

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var stream = portal.getMultipartStream(file.name);
    emailAttachments.push({
      fileName: file.fileName,
      data: stream,
      mimeType: file.contentType
    });

    var attachment = { name: file.fileName };
    if (repo) {
      attachment.id = saveFile(repo, file, stream)._id;
    }
    var inputId = file.name.split("[")[0];
    if (!formData[inputId]) formData[inputId] = { attachments: [] };
    formData[inputId].attachments.push(attachment);
  }

  sendEmailToRecipients(formData, siteConfig, formConfig, request, emailAttachments);
  // TODO: try switching execution order with line above, or better: run asyncronously somehow
  if (repo) {
      try {
        return saveForm(repo, formData, request);
      }
      catch(e) {
        log.error(e.message);
        return false;
      }
  }
  // Return success if storageLocation is "none"
  return true;
};

var saveForm = function(repo, form, request) {
  var now = new Date();
  var timestamp = moment(now).format('YYYY-MM-DDTHH:mm:ss');
  var name = "".concat("[", timestamp, "] ", form._formContentDisplayName);

  // Never store the Google reCAPTCHA response
  // TODO: delete any other parameters that are not present in the input config and not private
  delete form['g-recaptcha-response'];

  // Sanitize string input values
  /*
    Disabled until the full list of HTML entities has been documented so that it can be reversed upon report generation, e.g. revert all @ chars converted to &#64;
    It seems like the "&\+<=>@ characters are the ones in question? Source: https://github.com/OWASP/java-html-sanitizer/issues/84
    doublequote &#34;, et &amp;, backslash \\, backslashspace \\ , doublespace  , plus &#43;, lessthan &lt;, equals &#61;, greaterthan &gt;, at &#64;

  for (var key in form) {
    if (form.hasOwnProperty(key) && typeof form[key] === 'string') {
        form[key] = portal.sanitizeHtml(form[key]);
    }
  }
  */

  // Submitted values only; form metadata is stored as separate properties below
  var data = {};
  for (var key in form) {
    // Prototype method: a submitted field named hasOwnProperty would shadow form.hasOwnProperty
    if (Object.prototype.hasOwnProperty.call(form, key) && key !== '_formContentId' && key !== '_formContentDisplayName') {
      data[key] = form[key];
    }
  }

  var node = {
    _parentPath: '/',
    _name: name,
    formContentId: form._formContentId,
    formDisplayName: form._formContentDisplayName,
    submittedAt: valueLib.instant(now),
    data: data
  };
  if (request.headers['Referer']) {
    node.referer = request.headers['Referer'];
  }

  try {
    return repo.create(node);
  } catch (e) {
    // Most likely another response with the same name (same second): fall back to a generated name
    delete node._name;
    return repo.create(node);
  }
};

var getAttachmentsFolder = function(repo) {
  var folder = repo.get(ATTACHMENTS_PATH);
  if (!folder) {
    try {
      folder = repo.create({
        _name: ATTACHMENTS_NAME,
        _parentPath: '/'
      });
    } catch (e) {
      // Created concurrently by another request
      folder = repo.get(ATTACHMENTS_PATH);
      if (!folder) throw e;
    }
  }
  return folder._path;
};

var getFilesFromForm = function(form) {
  var files = [];
  if (!form) return files;
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

var saveFile = function(repo, file, stream) {
  return repo.create({
    _parentPath: getAttachmentsFolder(repo),
    fileName: file.fileName,
    mimeType: file.contentType,
    size: file.size,
    binary: valueLib.binary(file.fileName, stream)
  });
};

var sendEmailToRecipients = function(formData, siteConfig, formConfig, request, emailAttachments) {
  var systemEmailAddr = formConfig.emailFrom || siteConfig.emailFrom;
  var userEmailAddr = null;

  // Arrays that will later be populated with values and concatenated in the e-mail body
  var labels = [];
  var values = [];

  // Populate arrays with input display names and values, in the same order as in the formConfig
  // irrelevant inputs such as headings are still included, in order to enforce a strict index correspondence between inputDisplayNames[] and inputValues[]
  (Array.isArray(formConfig.inputs) ? formConfig.inputs : [formConfig.inputs]).forEach(function(inputConfig) {
    // Empty strings by default, since all this will be concatenated into a single string in the end
    var label = inputConfig.label || '';
    var name = encodeURIComponent(inputConfig.name || inputConfig.label).replace(/\./g, '_');
    var value = _getInputValue(name, formData);

      // For checkbox inputs, create slightly more understandable values (normally it's either 'on' or not provided in the request data)
      if (inputConfig.input && inputConfig.input._selected && inputConfig.input._selected === 'checkbox') {
        var checkbox = CheckboxInputMapper.map(inputConfig);
        value = (formData[checkbox.name]) ? 'Yes' : 'No';
      }
    labels.push(label);
    values.push(value);

    // Set user e-mail address to be the value from the first e-mail input field in the form data
    if (inputConfig.input && inputConfig.input._selected && inputConfig.input._selected === 'email' && value && value.trim()) {
      // Only set once, for the first input of type 'email' with a supplied value. Disregard any following email input values
      if (!userEmailAddr) {
        userEmailAddr = value.trim();
      }
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
  var subject = formConfig.emailSubject ? formConfig.emailSubject : formData._formContentDisplayName;

  // Send e-mail receipt to user
  if (isSet(formConfig.receipt) && formConfig.receipt && formConfig.receipt._selected === 'enabled' && userEmailAddr && userEmailAddr.length > 0) {
    var emailBody = portal.processHtml({ value: formConfig.receipt.enabled.message });
    // Append form data to message HTML
    if (formConfig.receipt.enabled.includeFormData) {
      emailBody += '<code>' + formDataBeautified + '</code>';
    }

    mail.send({
      from: systemEmailAddr || 'noreply@example.com',
      to: userEmailAddr,
      subject: subject,
      body: emailBody,
      attachments: [], // a waste of time and resources to e-mail the uploaded attachments back to the user
      contentType: 'text/html; charset="UTF-8"'
    });
  }

  // Send e-mail to subscribers
  if (formConfig.emailSubscribers) {
    var mailParams = {
      from: systemEmailAddr || 'noreply@example.com',
      to: (Array.isArray(formConfig.emailSubscribers) ? formConfig.emailSubscribers : [formConfig.emailSubscribers]),
      subject: subject,
      body: '<code>' + formDataBeautified + '</code>',
      attachments: emailAttachments,
      contentType: 'text/html; charset="UTF-8"'
    };
    if (userEmailAddr) {
      mailParams.replyTo = userEmailAddr;
    }
    return mail.send(mailParams);
  } else {
    return false;
  }
}
