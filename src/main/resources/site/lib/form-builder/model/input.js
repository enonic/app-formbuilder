var portal = require('/lib/xp/portal'); // Import the portal functions
var contentLib = require('/lib/xp/content'); // Import the portal functions

var LIST_UTIL = require('/lib/form-builder/list-util');

function Input(name, type, label) {
  if (!(this instanceof Input)) {
    return new Input(name, type, label);
  }

  this.id = name;
  this.name = name; // required
  this.label = label; // required
  this.type = type;
};

Input.prototype.setXpId = function(_id) {
  this._id = _id;
  return this;
}

Input.prototype.setId = function(id) {
  this.id = id;
  return this;
};

Input.prototype.setTitle = function(title) {
  this.title = title;
  return this;
};

Input.prototype.setClassAttribute = function(classAttribute) {
  this.class = classAttribute;
  return this;
};

Input.prototype.addClass = function(newClass) {
  this.class = (this.class) ? this.class + newClass : newClass;
  return this;
}

Input.prototype.setHelpText = function(helpText) {
  this.help = helpText;
  return this;
};

Input.prototype.setRequired = function(required) {
  if (required) {
    this.labelClass = "required";
  }
  this.required = required;
  return this;
};

/***** Input type specific attributes *****/

Input.prototype.setCheckedState = function(state) {
  if (state === "checked") {
    this.addClass("checked");
    this.checked = "checked";
  } else if (state === "indeterminate") {
    this.addClass("indeterminate");
  }
  return this;
};

Input.prototype.setValue = function(value) {
  this.value = value;
  return this;
};

Input.prototype.setText = function(text) {
  this.text = text;
  return this;
};

Input.prototype.setPlaceholder = function(placeholder) {
  this.placeholder = placeholder;
  return this;
};

Input.prototype.setDatalist = function(datalist) {
  this.datalist = datalist;
  return this;
};

Input.prototype.setMinimumValue = function(minimumValue) {
  this.min = minimumValue;
  return this;
};

Input.prototype.setMaximumValue = function(maximumValue) {
  this.max = maximumValue;
  return this;
};

Input.prototype.setPattern = function(regex) {
  this.pattern = regex;
  return this;
};

Input.prototype.setAcceptedFileTypes = function(fileTypes) {
  this.accept = fileTypes;
  return this;
};

Input.prototype.setAllowMultipleFiles = function(acceptMultipleFiles) {
  this.multiple = acceptMultipleFiles;
  return this;
};

Input.prototype.setSupportsCapture = function(supportsCapture) {
  this.capture = supportsCapture;
  return this;
};

Input.prototype.setStepInterval = function(stepInterval) {
  this.step = stepInterval;
  return this;
};

Input.prototype.setAutocomplete = function(shouldDisableAutocomplete) {
  if (shouldDisableAutocomplete) {
    this.autocomplete = 'autocomplete';
  }
  return this;
};

Input.prototype.setMinLength = function(minlength) {
  this.minlength = minlength;
  return this;
};

Input.prototype.setMaxLength = function(maxlength) {
  this.maxlength = maxlength;
  return this;
};

Input.prototype.setSize = function(size) {
  this.size = size;
  return this;
};

Input.prototype.setInputMode = function(inputMode) {
  this.inputMode = inputMode;
  return this;
};

Input.prototype.setPattern = function(pattern) {
  this.pattern = pattern;
  return this;
};

Input.prototype.setOptions = function(options) {
  this.options = options;
  return this;
};

Input.prototype.setOutput = function(output) {
  this.output = output;
  return this;
};

Input.prototype.setPlaceHolder = function(placeholder) {
  this.placeholder = placeholder;
  return this;
};

exports.Input = Input;
