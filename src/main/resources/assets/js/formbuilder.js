'use strict';

var XP_LIST_UTIL = {
  asList:  function(listOrObject) {
    if (Object.prototype.toString.call(listOrObject) === '[object Array]') {
      return listOrObject;
    } else if (listOrObject !== undefined) {
      return [listOrObject];
    } else {
      return [];
    }
  },
  iterateSafely: function(listOrObject, handler) {
    var list = XP_LIST_UTIL.asList(listOrObject);
    for (var i = 0; i < list.length; i++) {
      handler(list[i]);
    }
  },
  forEach: function(list, handler) {
    for (var i = 0; i < list.length; i++) {
      handler(list[i]);
    };
  }
};

// Enables the submit button when CAPTCHA is verified
function recaptchaCallback() {
    var submitBtn = document.getElementById('xp-formbuilder-submit');
    submitBtn.removeAttribute('disabled');
};

// Resets the CAPTCHA on verification timeout
function recaptchaReset() {
    grecaptcha.reset();
};

var XP_FORM_BUILDER = {
  initializeForm: function(event) {
    XP_FORM_BUILDER.initializeCheckboxes(document.getElementsByClassName("indeterminate"));
    XP_FORM_BUILDER.disableSubmitForCaptcha();
  },
  initializeCheckboxes: function(checkboxes) {
    XP_LIST_UTIL.forEach(checkboxes, function(checkbox) {
      checkbox.indeterminate = true;
    });
  },
  disableSubmitForCaptcha: function() {
      var submitBtn = document.getElementById('xp-formbuilder-submit');
      if (submitBtn && submitBtn.getAttribute('data-captcha') == 'true') {
          submitBtn.setAttribute('disabled', 'disabled');
      }
  },
  addSubmitHandling: function(form) {
    var forms = document.getElementsByClassName("xp-formbuilder-form");
    for (var i = 0; i < forms.length; i++) {
      var currentForm = forms[i];
      if (currentForm.className.indexOf("ajax-submit") > -1) {
      currentForm.onsubmit = XP_FORM_BUILDER.submitForm;
      }
    }
  },
  submitForm: function(event) {
    event.preventDefault();
    var inputFields = this.querySelectorAll("input, textarea, select");
    var formData = XP_FORM_BUILDER.prepareFormData(inputFields);
    XP_FORM_BUILDER.disable(this);
    XP_FORM_BUILDER.sendForm(event.target, formData);
  },
  disable: function(form) {
    var inputElements = form.getElementsByClassName("xp-input");
    for (var i = 0; i < inputElements.length; i++) inputElements[i].disabled = true;
    form.getElementsByClassName("xp-submit")[0].disabled = true;
    form.className = (form.className) ? form.className + " xp-submitting" : "xp-submitting";
  },
  prepareFormData: function(inputFields) {
    var formData = new FormData();
    for (var i = 0; i < inputFields.length; i++) {
      var inputField = inputFields[i];
      if (inputField.type === "file") {
        XP_FORM_BUILDER.addFiles(inputField, formData);
      } else
      if (inputField.type === "radio" && inputField.checked !== true) {
        continue; // Don't add unchecked radiobuttons.
      } else if (inputField.type === "checkbox" && inputField.checked !== true) {
        // register a single checkbox (has an id attribute) even when it is unchecked
        // if (inputField.id) formData.append(inputField.name, "off");
        continue; // Don't add any other unchecked checkboxes.
      } else if (inputField.type === undefined && inputField.for !== undefined && inputField.attributes.name.value) {
        continue; // Don't add display field for range input. Use the range-value instead.
      } else if (inputField.type === "submit" || inputField.type === "reset" || !inputField.name) {
        continue; // Don't add submit or reset-buttons.
      } else {
        formData.append(inputField.name, inputField.value);
      }
    }
    return formData;
  },
  addFiles: function(inputField, formData) {
    for (var i = 0; i < inputField.files.length; i++) {
      var file = inputField.files[i];
      if (XP_FORM_BUILDER.validateFile(file)) {
        formData.append(inputField.name + "[" + i + "]", file, file.name);
      }
    }
  },
  sendForm: function(form, formData) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', form.action, true);
    xhr.onload = function(response) {
      if (xhr.status === 200) {
        var target = response.srcElement || response.target;
        XP_FORM_BUILDER.addResponse(form, target.responseText);
        if (form.remove) {
          form.remove();
        } else {
          form.parentElement.removeChild(form); //IE fallback
        }
      } else {
        console.log("Error: Failed submitting form.");
      }
    };
    xhr.send(formData);
  },
  validateFile: function(file) {
    return true;
  },
  addResponse: function(form, message) {
    var titleElement = document.getElementById("xp-formbuilder-title");
    if (titleElement) {
      //titleElement.remove();
      titleElement.parentElement.removeChild(titleElement);
    }
    var introTextElement = document.getElementById("xp-formbuilder-introtext");
    if (introTextElement) {
      // introTextElement.remove();
      introTextElement.parentElement.removeChild(introTextElement);
    }
    /*
    var responseTag = document.createElement("div");
    responseTag.className = "xp-form-response";
    responseTag.innerHTML = message;
    form.parentElement.insertBefore(responseTag, form);
    */
    var successElement = document.getElementById("xp-formbuilder-successmessage");
    if (successElement) {
      // Show success message
      successElement.removeAttribute("style");
    }
    window.scrollTo(0,0);
  }
};

var XP_FORM_APP = {
  onLoad: function(method) {
    if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', method);
    } else if (window.attachEvent) {
      window.attachEvent('load', method);
    } else {
      window.addEventListener('load', method);
    }
  }
}

XP_FORM_APP.onLoad(XP_FORM_BUILDER.initializeForm);
XP_FORM_APP.onLoad(XP_FORM_BUILDER.addSubmitHandling);
