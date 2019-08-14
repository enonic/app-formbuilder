var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setPlaceholder(inputConfig.data.placeholder)
    .setMinimumValue(inputConfig.data.min)
    .setMaximumValue(inputConfig.data.max)
    .setStepInterval(inputConfig.data.step)
    .setAutocomplete(_getAutocomplete(inputConfig.data));
};

function _getAutocomplete(inputConfig) {
  if (inputConfig.disableAutocomplete === true) {
    inputConfig.autocomplete = 'autocomplete';
  }
};