var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setPlaceholder(inputConfig.data.placeholder)
    .setMinLength(inputConfig.data.minLength)
    .setMaxLength(inputConfig.data.maxLength)
    .setSize(inputConfig.data.size)
    .setInputMode(inputConfig.data.inputMode)
    .setPattern(inputConfig.data.pattern);
};