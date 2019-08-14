var portal = require('/lib/xp/portal'); // Import the portal functions

function Form(id) {
  if (!(this instanceof Form)) {
    return new Form(id);
  }

  this.id = id;

  // Setting default values
  this.actionUrl = portal.componentUrl({});
  this.method = "post";
  this.ajax = true;
  this.title = null;
  this.submitText = "Submit";
  this.inputs = [];
};

Form.prototype.setActionUrl = function(actionUrl) {
  this.actionUrl = actionUrl;
  return this;
};

Form.prototype.setSubmitMethod = function(submitMethod) {
  this.method = submitMethod;
  return this;
};

Form.prototype.setUsingAjax = function(usingAjax) {
  this.ajax = usingAjax;
  return this;
};

Form.prototype.setTitle = function(title) {
  this.title = title;
  return this;
};

Form.prototype.setSubmitText = function(submitText) {
  this.submitText = submitText;
  return this;
};

Form.prototype.addInputField = function(inputField) {
  this.inputs.push(inputField)
  return this;
};

exports.Form = Form;