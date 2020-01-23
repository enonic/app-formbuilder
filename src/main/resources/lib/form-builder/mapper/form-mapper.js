var portal = require('/lib/xp/portal'); // Import the portal functions
var contentLib = require('/lib/xp/content'); // Import the portal functions

var LIST_UTIL = require('/lib/form-builder/list-util');
var Form = require('/lib/form-builder/model/form').Form;
var CheckboxInputMapper = require('/lib/form-builder/mapper/checkbox-input-mapper');
var CheckboxesInputMapper = require('/lib/form-builder/mapper/checkboxes-input-mapper');
var ColorInputMapper = require('/lib/form-builder/mapper/color-input-mapper');
var DateInputMapper = require('/lib/form-builder/mapper/date-input-mapper');
var DateTimeInputMapper = require('/lib/form-builder/mapper/datetime-input-mapper');
var EmailInputMapper = require('/lib/form-builder/mapper/email-input-mapper');
var FileInputMapper = require('/lib/form-builder/mapper/file-input-mapper');
var HiddenInputMapper = require('/lib/form-builder/mapper/hidden-input-mapper');
var NumberInputMapper = require('/lib/form-builder/mapper/number-input-mapper');
var PasswordInputMapper = require('/lib/form-builder/mapper/password-input-mapper');
var RadioInputMapper = require('/lib/form-builder/mapper/radio-input-mapper');
var RangeInputMapper = require('/lib/form-builder/mapper/range-input-mapper');
var SearchInputMapper = require('/lib/form-builder/mapper/search-input-mapper');
var SelectInputMapper = require('/lib/form-builder/mapper/select-input-mapper');
var TelInputMapper = require('/lib/form-builder/mapper/tel-input-mapper');
var TextInputMapper = require('/lib/form-builder/mapper/text-input-mapper');
var TextareaInputMapper = require('/lib/form-builder/mapper/textarea-input-mapper');
var TimeInputMapper = require('/lib/form-builder/mapper/time-input-mapper');
var UrlInputMapper = require('/lib/form-builder/mapper/url-input-mapper');

exports.map = function (formConfig) {
  var form = Form(formConfig.id)
    .setTitle(formConfig.title)
    .setSubmitText(_getSubmitText(formConfig))
    .setActionUrl(_getActionUrl(formConfig))
    .setSubmitMethod(_getSubmitMethod(formConfig))
    //.setUsingAjax(formConfig.useAjax);
    .setUsingAjax(true);

  LIST_UTIL.iterateSafely(formConfig.inputs, function(item) {
    /*
    var inputContent = contentLib.get({key: item});
    if (inputContent !== null) {
      var inputData = _mapInputField(inputContent);
      if (inputData.type === "file") form.enctype = "multipart/form-data";
      form.addInputField(inputData);
    } else {
      log.error("Could not retrieve input element with ID '" + item + "'.");
    }
    */
    // If valid input config (required fields have been set)
    if (item.label) {
        if (item.input._selected === "file") form.enctype = "multipart/form-data";
        form.addInputField(_mapInputField(item));
    }
  });
  return form;
};

var _getSubmitText = function(formConfig) {
  return (formConfig.submitText) ? formConfig.submitText : "Submit";
};

var _getActionUrl = function(formConfig) {
  return (formConfig.actionUrl) ? formConfig.actionUrl : portal.componentUrl({});
};

var _getSubmitMethod = function(formConfig) {
  //return (formConfig.submitText) ? formConfig.submitText : "post";
  return "post";
};

var _mapInputField = function(inputConfig) {
  switch (_getInputType(inputConfig)) {
    case "checkbox":
      return CheckboxInputMapper.map(inputConfig);
    case "checkboxes":
      return CheckboxesInputMapper.map(inputConfig);
    case "color":
      return ColorInputMapper.map(inputConfig);
    case "date":
      return DateInputMapper.map(inputConfig);
    case "datetime-local":
      return DateTimeInputMapper.map(inputConfig);
    case "email":
      return EmailInputMapper.map(inputConfig);
    case "file":
      return FileInputMapper.map(inputConfig);
    case "hidden":
      return HiddenInputMapper.map(inputConfig);
    case "number":
      return NumberInputMapper.map(inputConfig);
    case "password":
      return PasswordInputMapper.map(inputConfig);
    case "radio":
      return RadioInputMapper.map(inputConfig);
    case "range":
      return RangeInputMapper.map(inputConfig);
    case "search":
      return SearchInputMapper.map(inputConfig);
    case "select":
      return SelectInputMapper.map(inputConfig);
    case "tel":
      return TelInputMapper.map(inputConfig);
    case "text":
      return TextInputMapper.map(inputConfig);
    case "textarea":
      return TextareaInputMapper.map(inputConfig);
    case "time":
      return TimeInputMapper.map(inputConfig);
    case "url":
      return UrlInputMapper.map(inputConfig);
    default:
      if (_getInputType(inputConfig) !== 'heading') {
        log.info("Failed to render %s. No mapper found. Falling back to text input.", _getInputType(inputConfig));
      }
      return TextInputMapper.map(inputConfig);
  }
};

var _getInputType = function(inputConfig) {
  //return (inputConfig.type) ? inputConfig.type.split(":input-")[1] : "text"; // default: text
  return (inputConfig.input && inputConfig.input._selected) ? inputConfig.input._selected : "text"; // default: text
};
