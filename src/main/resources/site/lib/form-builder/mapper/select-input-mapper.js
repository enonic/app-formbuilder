var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
   var options=_getOptions(inputConfig.data);
   var preselected=false;
   for (var i = 0; i < options.length; i++) {
       if (options[i].checked) {
           preselected = true;
           break;
       }
   }
    return InputMapper.map(inputConfig)
    .setOptions(options).setPlaceHolder(preselected
        ? ''
        : (inputConfig.data.placeholder !== null && typeof inputConfig.data.placeholder !== 'undefined')
          ? inputConfig.data.placeholder
          : '');
};

function _getOptions(inputConfig) {
  var options = [];
  for (var i = 0; i < inputConfig.options.length; i++) {
    options[i] = {
      value: inputConfig.options[i].optionValue || null,
      text: inputConfig.options[i].optionText || null,
      checked: inputConfig.options[i].optionChecked || false
    };
  }
  return options;
};
