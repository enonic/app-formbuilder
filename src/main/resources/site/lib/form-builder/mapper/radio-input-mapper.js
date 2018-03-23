var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setOptions(_getOptions(inputConfig.data));
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