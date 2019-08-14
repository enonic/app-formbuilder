var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
  /*return InputMapper.map(inputConfig)
    .setPlaceholder(inputConfig.data.placeholder)
    .setPattern(inputConfig.data.pattern);*/
    return InputMapper.map(inputConfig)
        .setPlaceholder(inputConfig.input[inputConfig.input._selected].placeholder);
};
