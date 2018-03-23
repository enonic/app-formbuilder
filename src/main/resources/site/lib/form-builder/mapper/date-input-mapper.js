var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setMinimumValue(inputConfig.data.min)
    .setMaximumValue(inputConfig.data.max)
    .setValue(inputConfig.data.value);
};